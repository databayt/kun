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

Since 2026-09-04 a Cloudflare **Worker** may be up to **64 MiB uncompressed** on Free and Paid
alike — there is no compressed-size limit any more — and it must still parse and run its global
scope within the **1 s startup limit**. Measure the build you would ship — do not assume.

```bash
npx opennextjs-cloudflare build && npx wrangler deploy --dry-run --outdir /tmp/probe
# wrangler prints:  Total Upload: <raw> KiB / gzip: <compressed> KiB — only the raw Total Upload counts
```

- **Raw `Total Upload` ≤ 64 MiB** → plain Worker, no container. Cheapest, simplest.
- **Over 64 MiB raw** → **Container**: the Next standalone server in a real container behind a
  thin Worker. hogwarts measured **172 MB raw**, well over the limit, so it is a container.
  ~85 MB of that was compiled server chunks across 491 pages — no dependency diet closes that gap.

`vinext` (Cloudflare's Vite reimplementation of the Next.js API, beta) is now **Cloudflare's
recommended path** for Next.js on Workers; OpenNext (`@opennextjs/cloudflare`) is for existing
OpenNext apps (co). next-auth runs on vinext with the NextRequest patch (`pnpm patch vinext` — see
mazin and nmbd).

## The container lane (hogwarts, mkan, kun, marketing, codebase)

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

## The containerless lane (no container, $0 marginal)

- **co** — OpenNext on a plain Worker (`co.databayt.org`); `~/co/scripts/deploy-cloudflare.sh`.
- **mazin, nmbd, satellites** — vinext + Workers Static Assets; recipe
  `kun/.claude/scripts/vinext-migrate.sh <repo-dir> <hostname> all`.
- **thmanyah** — Workers Static Assets only (no `main`, no Worker code).

## Traps that cost real hours. Read before debugging.

1. **New cron triggers once took ~19 hours to start firing — an observed anomaly.** Cloudflare
   documents that adding, changing or deleting a trigger propagates in up to 15 minutes. On
   hogwarts they were registered, listed by the API, shown in the dashboard with next-run times —
   and delivered nothing, verified with a deliberate `* * * * *` probe across three boundaries.
   They then began working on their own. **Do not build a workaround on day one.** A standalone
   cron Worker was built and deleted for this.
2. **Omitting `"triggers"` from `wrangler.jsonc` does NOT remove existing schedules.** A deploy
   without the key left all 16 in place. Set the array explicitly to change it.
3. **`wrangler tail` can be blocked or flaky on Abdout's network** (blocked IP range). Try
   `wrangler tail --format=json` first; when it will not connect, read Workers Logs — the Worker's
   Observability tab or the telemetry API. Filter `$metadata.service` and check
   `$workers.eventType` for `scheduled` vs `fetch`. (The `cloudflare-observability` MCP is not
   registered — pending a decision.)
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
11. **A byte-identical image does not restart the container**, so a vars-only or secrets-only deploy
    changes nothing until the instance cycles. kun's lane stamps `.cf-deploy-stamp` into the image's
    last layer on every `deploy` (one tiny layer pushed); copy that pattern instead of editing `public/`.
12. **next-auth needs `AUTH_URL` in a standalone container.** Next's standalone server reports the
    request URL as `0.0.0.0:3000` and next-auth builds every redirect from it — a login attempt bounced
    to `https://0.0.0.0:3000/login` on kun even with the right `Host`. Set `AUTH_URL` (Worker var) to
    the public origin; Vercel never needed it.

## DNS: how a hostname actually starts serving

Worker `routes` capture a hostname **only when its DNS record is proxied (orange cloud)**. A
grey-clouded record resolves straight to the old origin. So:

- Cutover = toggle the cloud per record. Rollback = toggle it back. Record targets never change.
- One proxied `*` CNAME covers **every** tenant subdomain — new schools need no DNS work.
- The API token in `~/.zshrc` has **Workers Routes:Edit but NOT DNS:Edit**. DNS writes use the
  Keychain token **`cloudflare-zones`** (Zone + DNS edit, minted 2026-09-18;
  `security find-generic-password -a "$USER" -s cloudflare-zones -w`, as `kun/scripts/cf-zone.sh`
  does) or a dashboard click. The `cloudflare-api` MCP is not registered — pending a decision.
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

Workers Paid is $5/month. hogwarts' container billed **$0.19** in its first period. Containers
bill **CPU on active use** only, but **memory and disk on the provisioned instance size** for as
long as the instance runs — a vCPU list-price estimate overstates the CPU part, while an always-on
instance still pays for its memory and disk. From **2026-10-01** trace spans bill as Workers
Observability events (same quota as logs: 20 M/month on Paid, then $0.60 per million). Pro on a
zone is $25/month. Real invoices: $0.00 for months, then $10.46 and $2.74.

## MCP servers

Only **`cloudflare-docs`** (`https://docs.mcp.cloudflare.com/mcp`, no auth) is registered. The
Code Mode `cloudflare-api` (`https://mcp.cloudflare.com/mcp`) and `cloudflare-observability`
(`https://observability.mcp.cloudflare.com/mcp`) servers are **not registered — pending a
decision**; work through `wrangler`, the telemetry API and the Keychain tokens instead.

## Handoff

- Build failures and TypeScript → `build`
- Repo, issues, Actions → `github`
- Vercel-era questions or a comparison → `deploy`
- Post-deploy verification → the `watch` skill
