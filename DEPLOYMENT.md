# Deploying kun

> **Where kun runs (since 2026-10-25): a plain Cloudflare Worker via OpenNext, no container.**
> Same lane as food, marketing and codebase. History: Vercel's free `databayt` account was paused
> 2026-09-04 (HTTP 402 everywhere), kun moved to a Cloudflare Container (`basic`, always on) on
> 2026-09-13, and left it for a $0-marginal Worker once the container turned out to be most of the
> bill. Do not propose returning to Vercel without a settled billing method.

## Status

| | |
| --- | --- |
| Worker | `kun` (`cf/worker.js` → OpenNext's `.open-next/worker.js` + a `scheduled` handler), account `ce9a5376d149c808a0b97072421ba12f`, `workers_dev` on |
| Host | `https://kun.databayt.org` (route + proxied `AAAA 100::` record in the `databayt.org` zone) |
| Bundle | ~43 MiB raw / ~9.4 MiB gzip (the build aborts over `MAX_GZIP_KB`, default 10240) |
| Cache | incremental cache → KV `NEXT_INC_CACHE_KV`; tag cache → sharded Durable Object `DOShardedTagCache` |
| Database | the same Neon project (`DATABASE_URL`, Prisma 7 `prisma-client` generator + `@prisma/adapter-neon`); `src/lib/db.ts` builds one client **per request** on Workers |
| Env | `vars` in `wrangler.jsonc` (`CF_WORKERS`, `SOCIAL_PUBLIC_URL`, `AUTH_URL`); everything else is a Worker secret pushed by `deploy` |
| Crons | Worker trigger `0 6 * * *` → `/api/social/cron` (`cf/crons.json`, dispatched in `cf/worker.js` with the `CRON_SECRET` bearer); drain / metrics / canary stay on GitHub Actions via the `SITE_URL` repo variable |
| Cost | Workers Paid ($5/mo, shared) — no container, so no provisioned memory/disk |

## Why this works now (it used to need a container)

kun read the disk at request time. `scripts/gen-bundle.mjs` now bundles those files into
`src/generated/kun-bundle.ts` (git-ignored; run by `postinstall`, `predev`, `prebuild` and the OpenNext
`buildCommand`): `web/install.{sh,ps1}` (the `/install` routes — byte-identical), the docs notes for the
Second Brain graph, kun-owned `content/carousels/<brand>/*.json` decks, and the list of vendored
`public/carousel-art` files. **Add a deck or an installer edit, and it ships on the next build; in
local dev, restart `next dev` (or run `node scripts/gen-bundle.mjs`) to refresh the bundle.**

## Shipping a release

```bash
git branch --show-current                                            # main
VERCEL_ORG_ID=team_BrPSqGS4wSpLors2B9jYAAFs VERCEL_PROJECT_ID=prj_rywieXexNWaY0H6KqPlYsQzVNi7G \
  vercel env pull ~/.cache/cf-build/kun-prod.env --environment=production --yes   # not the repo's dead .vercel link
scripts/cf-keychain-env.sh >> ~/.cache/cf-build/kun-prod.env         # rotated cf-kun-* values win (last one wins)
chmod 600 ~/.cache/cf-build/kun-prod.env
scripts/deploy-cloudflare.sh ~/.cache/cf-build/kun-prod.env build    # clean export of HEAD → webpack build → OpenNext (~10 min)
scripts/deploy-cloudflare.sh ~/.cache/cf-build/kun-prod.env preview  # optional: real workerd on :8788, real database
scripts/deploy-cloudflare.sh ~/.cache/cf-build/kun-prod.env deploy   # secrets → KV cache → wrangler deploy
```

- `CF_WORKER_NAME=kun-next` builds/deploys a **trial** Worker (no routes, no crons, no `AUTH_URL`) on
  workers.dev; delete it with `wrangler delete --name kun-next`. `CF_DEPLOY_REF=<sha>` pins the commit.
- **Rollback:** `pnpm exec wrangler rollback` from the build dir — a swap to the previous version.
- **Rotated or new values never go to Vercel** (it refuses writes). Store them as
  `security add-generic-password -a "$USER" -s "cf-kun-<VAR>" -w "<value>" -U`.
  `AUTH_PASSWORD_HASH_ALI` lives only as a Worker secret (not in the pulled env): `secret bulk` adds and
  overwrites, it never deletes, so a deploy keeps it — do not recreate the Worker from scratch.
- **Schema changes are not applied by the deploy.** `prisma migrate diff --from-config-datasource
  --to-schema prisma/schema.prisma` first; apply additive DDL out-of-band before shipping code that needs it.
- One build at a time on the 16 GB Mac (`CF_HEAP_MB`, default 4096).

## Verify — a deploy is done when these pass

```bash
curl -s https://kun.databayt.org/api/health                                  # {"ok":true,"checks":{"database":{"pass":true…
curl -s -o /dev/null -w '%{http_code}\n' https://kun.databayt.org/en/docs
curl -fsSL https://kun.databayt.org/install | cmp - web/install.sh            # byte-identical
curl -s -H "Authorization: Bearer $CRON_SECRET" https://kun.databayt.org/api/social/canary   # 200
```

Then the login page renders, a wrong password gives `error=CredentialsSignin` (this login never touches
the database — it proves scrypt runs, nothing more), and the GitHub Actions `social-canary` run is green.
Logs: `wrangler tail` does not work from Abdout's network; use the observability telemetry API and filter
`$metadata.service = kun`, `$workers.eventType` = `scheduled` for the 06:00 cron.

## Known edges

- **Degraded on Workers (by design):** the jobs evidence scan shells out to `git`/`gh`/`curl` and reads
  clones on the Mac — skipped when `CF_WORKERS` is set, so `/seek/profile` and job matching run on the CV
  evidence channel only (zero repository facts). The Keychain Twenty-key lookup is skipped too (the key
  must be a Worker secret). Carousel decks owned by other repos (`BRANDS[x].deckDir`, e.g. hogwarts) are
  local-only: only kun's own decks render and list on Workers.
- `AUTH_URL` is pinned as a Worker var; the request URL is right on Workers, so the trial Worker runs without it.
- The 06:00 cron's `scheduled` handler calls the OpenNext handler in-process. New cron triggers can take
  ~19 hours to start firing; omitting `triggers` from `wrangler.jsonc` does NOT remove existing schedules.
- **Report intake on kun fails closed** without `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`.
- `src/app/layout.tsx` hardcodes `metadataBase` to `https://kun.databayt.org`.
- `databayt.org` is a Free zone: it can hand Sudan/UAE resolvers the `188.114.96/97.x` addresses that
  Abdout's ISP resets (the site looks down and is not). Pro is the fix ($25/mo, monthly).
- The Vercel project `databayt/kun` still holds the `kun.databayt.org` attachment. Harmless: DNS
  decides who serves.
