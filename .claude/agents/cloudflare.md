---
name: cloudflare
description: Cloudflare deployment expert — Workers, Containers, zone DNS, cron triggers, and the balqalam.com production lane
model: sonnet
effort: medium
version: "Workers + Containers + Neon"
handoff: [deploy, build, github, architecture]
---

# Cloudflare Deploy Expert

**Platform**: Cloudflare Workers + Containers · **Database**: Neon PostgreSQL (unchanged) · **CI/CD**: local build, `wrangler deploy`

This is the databayt production platform as of 2026-09-07. Vercel is dead: both the Pro team
(2026-08-22) and the free `databayt` account (2026-09-07) were disabled, taking every hostname to
HTTP 402. Do not propose returning to Vercel without a settled billing method.

## The one decision that shapes everything: Worker or Container?

A Cloudflare **Worker** has a hard **10 MiB gzipped** script ceiling (3 MiB on the free plan).
Measure before choosing — do not assume.

```bash
npx opennextjs-cloudflare build && npx wrangler deploy --dry-run --outdir /tmp/probe
# wrangler prints:  Total Upload: <raw> KiB / gzip: <compressed> KiB
```

- **Under ~8 MiB gzipped** → plain Worker via `@opennextjs/cloudflare`. Cheapest, simplest.
- **Over the ceiling** → **Container**: the Next standalone server in a real container behind a
  thin Worker. hogwarts measured **172 MB raw / 31.6 MB gzipped**, 3.4× over, so it is a container.
  ~85 MB of that was compiled server chunks across 491 pages — no dependency diet closes that gap.

`vinext` (Cloudflare's Vite reimplementation of Next) is **not** an option for these apps: it does
not support next-auth and requires `"type": "module"`.

## The container lane (hogwarts, mkan)

Files per repo, all committed:

| File                              | Role                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `wrangler.jsonc`                  | Worker name, `containers`, DO binding, `migrations`, `routes`, `triggers`                |
| `Dockerfile` (or `Dockerfile.cf`) | COPY-only over a **prebuilt** standalone output; nothing compiles in the image           |
| `cf/worker.js`                    | Container class + `fetch` forwarding + `scheduled()` cron dispatch                       |
| `cf/entry.cjs`                    | Layers baked `env.json` **under** Worker-provided secrets; forces `HOSTNAME=0.0.0.0`     |
| `cf/env-split.mjs`                | Classifies a pulled dotenv into secrets vs config; `run` mode injects env into the build |
| `cf/crons.json`                   | cron expression → `/api/cron/*` route paths                                              |
| `scripts/deploy-cloudflare.sh`    | `build \| smoke \| deploy`, `CF_SOURCE`, `CF_OVERLAY`                                    |
| `scripts/cf-secrets.sh`           | Pushes secrets, **preferring macOS Keychain overrides**                                  |

Release, once `main` builds from a clean checkout:

```bash
vercel env pull /tmp/prod.env --environment=production --scope databayt && rm -f .env.local
scripts/deploy-cloudflare.sh /tmp/prod.env build     # ~12 min
scripts/deploy-cloudflare.sh /tmp/prod.env smoke     # optional: docker run on :3300
scripts/deploy-cloudflare.sh /tmp/prod.env deploy    # wrangler builds + pushes the image
```

Rollback is `wrangler rollback` — a swap to the previous image, not a rebuild.

## Traps that cost real hours. Read before debugging.

1. **Cron triggers can take ~19 hours to start firing.** Registered, listed by the API, shown in
   the dashboard with next-run times — and delivering nothing. Verified on hogwarts with a
   deliberate `* * * * *` probe across three boundaries. They then began working on their own. **Do
   not build a workaround on day one.** A standalone cron Worker was built and deleted for this.
2. **Omitting `"triggers"` from `wrangler.jsonc` does NOT remove existing schedules.** A deploy
   without the key left all 16 in place. Set the array explicitly to change it.
3. **`wrangler tail` does not work from Abdout's network** (blocked IP range). Use the
   observability telemetry API or the `cloudflare-observability` MCP. Filter `$metadata.service`
   and check `$workers.eventType` for `scheduled` vs `fetch`.
4. **Docker needs the `buildx` plugin** for wrangler's `docker build --load`:
   `brew install docker-buildx` plus a symlink into `~/.docker/cli-plugins`.
5. **Image push fails transiently** with `Docker command exited with code: 1` after pushing some
   layers. Simply re-run `wrangler deploy`; completed layers are reused.
6. **Builds get OOM-killed** on the 16 GB Mac when other sessions run `next dev` or `tsc`. The lane
   uses 2 workers / 3 GB heap (`NEXT_BUILD_CPUS`, `CF_HEAP_MB`). Wait for other builds to finish.
7. **`vercel env pull` keeps empty-string values**, which `z.string().min(1).optional()` rejects.
   `env-split.mjs` drops them.
8. **Never shell-`source` an env file** — double-quoted values expand `$` and backticks. Use
   `env-split.mjs run --`.
9. **Docker sets `HOSTNAME` to the container id** and Next standalone binds to it. Force
   `HOSTNAME=0.0.0.0` or nothing listens.
10. **Secrets are read at container start.** After `cf-secrets.sh`, deploy again so the instance
    restarts with the new values.

## DNS: how a hostname actually starts serving

Worker `routes` capture a hostname **only when its DNS record is proxied (orange cloud)**. A
grey-clouded record resolves straight to the old origin. So:

- Cutover = toggle the cloud per record. Rollback = toggle it back. Record targets never change.
- One proxied `*` CNAME covers **every** tenant subdomain — new schools need no DNS work.
- The API token in `~/.zshrc` has **Workers Routes:Edit but NOT DNS:Edit**, so record toggles are a
  dashboard click (or use the `cloudflare-api` MCP once authenticated).
- Workers _custom domains_ (`custom_domain: true`) cannot replace records that already exist
  without DNS rights — the API accepts the call and changes nothing.

## Regional IP blocking — the thing that looks like an outage and is not

Cloudflare hands **free** zones addresses in `188.114.96.x / 188.114.97.x` for Sudan and UAE
resolvers, and those exact addresses are TCP-reset on Abdout's ISP (`ERR_CONNECTION_RESET`, any
site, ports 80 and 443). The `104.21.x / 172.67.x` set works. Which set you get **rotates**, so the
site appears to break and heal on its own.

- Diagnose with `dig +short A <host>` then `curl --resolve <host>:443:<good-ip>`. If the forced IP
  returns 200, the app is fine and the network is the problem.
- **Fix: move the zone to the Pro plan ($25/month, monthly not the $240 annual).** Proven on
  balqalam.com 2026-09-08: the zone moved to `104.26.4.28 / 104.26.5.28 / 172.67.69.58` and the
  apex, www and tenant hosts all began answering from Abdout's own machine.
- `mkan.sd` is still a free zone and carries the same risk.

## Schema changes are never applied by a deploy

These repos have an empty migration history by design. Before shipping code that needs new columns:

```bash
pnpm exec prisma migrate diff --from-url "$PROD_DATABASE_URL" --to-schema-datamodel prisma --script
```

Apply the additive statements out-of-band (snapshot first), skip destructive ones, then deploy.
Deploying code ahead of its DDL produces "column does not exist" 500s on live pages.

## Cost, measured not estimated

Workers Paid is $5/month. hogwarts' container billed **$0.19** in its first period — Cloudflare
charges active compute, not allocated vCPU, so list-price estimates overstate it badly. Pro on a
zone is $25/month. Real invoices: $0.00 for months, then $10.46 and $2.74.

## MCP servers

`cloudflare-docs` (open), `cloudflare-api` (full API incl. DNS), `cloudflare-observability` (logs
and analytics), `cloudflare-bindings` (Workers/KV/R2/D1). The last three need one OAuth sign-in via
`/mcp`.

## Handoff

- Build failures and TypeScript → `build`
- Repo, issues, Actions → `github`
- Vercel-era questions or a comparison → `deploy`
- Post-deploy verification → the `watch` skill
