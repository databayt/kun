# Deploying kun

> **Where kun runs (since 2026-09-13): Cloudflare Containers**, the same lane as hogwarts
> (`balqalam.com`) and mkan (`mkan.sd`). Vercel's free `databayt` account — kun's home since
> 2026-08-22 — was paused by Vercel on 2026-09-04 for exceeding the Hobby usage allowance (Fluid
> Active CPU at 300 %), which took every hostname on it to HTTP 402, kun included. Hobby has no
> billing cycle to wait for and no un-pause button: pay for Pro or wait ~30 days. Vercel billing
> does not work from Abdout's cards, so kun moved instead of waiting.

## Status

| | |
| --- | --- |
| Worker | `kun` (`cf/worker.js`), account `ce9a5376d149c808a0b97072421ba12f`, `workers_dev` on — live version `dd13f215` (2026-09-13, main `34714b0` + the AUTH_URL/stamp follow-up) |
| Live host | `https://kun.osmanabdout.workers.dev` — the interim origin until the DNS zone moves |
| Target host | `https://kun.databayt.org` — served once the `databayt.org` zone lives on Cloudflare (see Cutover) |
| Container | `KunContainer`, `basic` (¼ vCPU, 1 GiB), `max_instances: 1`, `sleepAfter: 24h`, Node heap 768 MB |
| Image | `Dockerfile.cf`: `node:22-bookworm-slim` + prebuilt Next standalone, COPY-only, linux/amd64 |
| Database | the same Neon project Vercel used (`DATABASE_URL`, Prisma 7 + `@prisma/adapter-neon`, engine-free) |
| Env | prod values from `vercel env pull` + Keychain overrides: config vars baked as `env.json`, secrets on the Worker |
| Crons | Worker trigger `0 6 * * *` → `/api/social/cron` (from `vercel.json`); drain / metrics / canary stay on GitHub Actions and reach the container through the `SITE_URL` repo variable |
| Cost | Workers Paid ($5/mo, already paid for hogwarts) + one always-on `basic` container, list ≈ $8/mo |

## Why a container and not a Worker

kun reads the filesystem at request time — `web/install.{sh,ps1}` for the installer routes, the
docs corpus for the Second Brain graph, deck JSON for carousels and the showroom (the
`outputFileTracingIncludes` entries in `next.config.ts` exist for exactly this). A Worker has no
disk, and the jobs pipeline shells out to `git`/`gh`. The standalone Node server in a container runs
all of it unchanged. `vinext` is out for the same reason it was for hogwarts: no next-auth.

## Shipping a release

```bash
git branch --show-current                                            # main
lsof -ti:3000 | xargs -r kill                                        # a resident next dev OOMs the build
NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit

vercel env pull /tmp/kun-prod.env --environment=production --scope databayt --yes && rm -f .env.local
scripts/cf-keychain-env.sh >> /tmp/kun-prod.env                      # rotated values win over Vercel's stale copies
scripts/deploy-cloudflare.sh /tmp/kun-prod.env build                 # clean export of HEAD → next build (standalone)
scripts/deploy-cloudflare.sh /tmp/kun-prod.env smoke                 # docker run on :3300, curl table, memory
scripts/cf-secrets.sh /tmp/kun-prod.env                              # only on first deploy or a rotation
scripts/deploy-cloudflare.sh /tmp/kun-prod.env deploy                # wrangler builds + pushes the image
```

- `CF_SOURCE=worktree` ships uncommitted work; `CF_SOURCE=<ref>` pins a commit; `CF_OVERLAY="a b"`
  copies working-tree files over the export. `CF_BUILD_DIR` moves the build dir (default `$TMPDIR/kun-cf-build`).
- **Rollback:** `pnpm exec wrangler rollback` from the build dir — a swap to the previous image.
- **Secrets and vars are read when the container starts.** `deploy` writes `.cf-deploy-stamp` as the
  image's last layer, so every deploy restarts the instance (only that tiny layer is pushed when the
  build is unchanged). A byte-identical image would not restart it — that cost one deploy on day one.
- **Rotated or new values never go to Vercel** (it refuses writes). Store them as
  `security add-generic-password -a "$USER" -s "cf-kun-<VAR>" -w "<value>" -U`; both scripts read
  every `cf-kun-*` entry. `GITHUB_PERSONAL_ACCESS_TOKEN` (rotated 2026-09-13) lives there.
- **Schema changes are not applied by the deploy.** `prisma migrate diff --from-url "$DATABASE_URL"
  --to-schema-datamodel prisma` first; apply additive DDL out-of-band before shipping code that needs it.
- The build needs Docker (colima) with the `buildx` plugin, ~3 GB of disk and the Mac to itself —
  two Next builds at once get OOM-killed.

## Verify — a deploy is done when these pass

```bash
curl -s https://kun.osmanabdout.workers.dev/api/health                       # {"ok":true,"checks":{"database":{"pass":true…
curl -s -o /dev/null -w '%{http_code}\n' https://kun.osmanabdout.workers.dev/en/docs
curl -s -H "Authorization: Bearer $CRON_SECRET" https://kun.osmanabdout.workers.dev/api/social/canary   # 4/4 brands
```

Then the login page renders, a wrong password is refused, and the GitHub Actions `social-canary`
run is green (`gh workflow run social-canary.yml`).

## Cutover to kun.databayt.org — what is staged and what is left

`databayt.org` DNS is hosted by Vercel (`ns1/ns2.vercel-dns.com`) inside the paused free account.
A Worker can only serve a hostname whose zone is on Cloudflare, so the zone has to move. The record
set is prepared and committed — `cf/dns/databayt-org-records.json` (Cloudflare API shape) and
`cf/dns/databayt-org.zone` (BIND, for the dashboard importer): the 22 records Vercel serves today,
verbatim (mail, DKIM, DMARC, SPF, CAA, CloudFront `cdn`/`assets`, the Vercel wildcard so the
satellites keep resolving), plus one new proxied `kun` record for the Worker.

Neither stored Cloudflare token can create zones or edit DNS, so two steps are Abdout's:

1. **A Cloudflare API token** with *Account → Zone → Edit* and *Zone → DNS → Edit* (all zones), stored
   as `security add-generic-password -a "$USER" -s cloudflare-zones -w "<token>" -U`. With it the
   next session creates the zone, loads the records, and verifies every one against Vercel's answers
   with `dig @<assigned-ns>` before anything changes. (Alternative: `/mcp` sign-in on `cloudflare-api`.)
2. **Nameservers at Namecheap** (`databayt.org`, DNSSEC unsigned, expires 2027-06): set the two
   names Cloudflare assigns. Propagation is the only wait.

Then, in one deploy: uncomment `routes` in `wrangler.jsonc`, set `vars.SOCIAL_PUBLIC_URL` **and**
`vars.AUTH_URL` to `https://kun.databayt.org`, deploy, and point the GitHub `SITE_URL` variable back
at the real host.

Tradeoff to decide at that point: the zone lands on Cloudflare's Free plan, which answers Sudan
and UAE resolvers with the `188.114.96/97.x` addresses Abdout's ISP resets. balqalam.com paid $25/mo
for Pro to escape that; kun is used from Sudan daily.

## Known edges

- **The jobs pipeline degrades** on the container: `src/lib/jobs/*` shells out to `git`, `gh` and
  `curl`, none of which exist in the image. Every call is wrapped, so `/jobs` renders from the
  static evidence facts with zero repositories. Vercel had no `gh` either; parity, not a regression.
- **Report intake on kun fails closed** without `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
  (the prod env never had them). The workers.dev host is in the intake allowlist for when they exist.
- **`AUTH_URL` is required in the container.** Next's standalone server reports the request URL as
  `0.0.0.0:3000`, and next-auth builds every redirect from it — a login attempt bounced to
  `https://0.0.0.0:3000/login` until `AUTH_URL` pinned the origin (Worker var in `wrangler.jsonc`).
  Vercel never needed it because its runtime carried the real host.
- `src/app/layout.tsx` hardcodes `metadataBase` to `https://kun.databayt.org`; OG URLs point at the
  real host even while the interim host serves.
- `wrangler tail` does not work from Abdout's network; use the observability telemetry API.
- New cron triggers can take ~19 hours to start firing (hogwarts, 2026-09-08). Do not diagnose on day one.
- The Vercel project `databayt/kun` still holds the `kun.databayt.org` attachment. Harmless: DNS
  decides who serves. Delete the project when the account is cleaned up.
