---
name: cloudflare
description: Cloudflare deploy operator — build, smoke, deploy, DNS cutover, cron and log inspection for the Workers + Containers lane
when_to_use: "Use for anything on the Cloudflare production platform — deploying hogwarts or mkan, checking whether a deploy is live, inspecting Worker logs or cron firings, flipping a hostname's DNS to proxied, diagnosing a connection reset that looks like an outage, or deciding Worker vs Container for a new app. This is the platform operator; /ship and /watch delegate here when the repo has a wrangler.jsonc. Triggers on: cloudflare, wrangler, worker, container, deploy to cloudflare, cutover, is it live on cloudflare, worker logs, cron not firing, ERR_CONNECTION_RESET, orange cloud, proxied."
argument-hint: "[build|smoke|deploy|status|logs|dns|crons] [app]"
allowed-tools: Bash(git *), Bash(pnpm *), Bash(npx *), Bash(gh *), Bash(curl *), Bash(dig *), Bash(docker *), Bash(security *)
model: opus
---

# Cloudflare — the deploy operator

The databayt production platform since 2026-09-07. Vercel is disabled on every account; do not
suggest going back to it without a settled billing method.

Full platform knowledge, traps and rationale live in the **`cloudflare` agent**
(`~/.claude/agents/cloudflare.md`). Repo-specific facts for hogwarts live in
`hogwarts/.claude/rules/cloudflare-deploy.md` and `hogwarts/DEPLOYMENT.md`. This skill is the
runbook — what to type, in what order, and how to prove it worked.

## Apps on this platform

| App      | Repo                               | Worker     | Zone                     | Live hosts                                   |
| -------- | ---------------------------------- | ---------- | ------------------------ | -------------------------------------------- |
| hogwarts | `~/hogwarts` · `databayt/hogwarts` | `hogwarts` | `balqalam.com` (**Pro**) | apex, `www`, `*.balqalam.com` (every school) |
| mkan     | `~/mkan` · `databayt/mkan`         | `mkan`     | `mkan.sd` (Free)         | pending the DNS flip                         |

Cloudflare account `ce9a5376d149c808a0b97072421ba12f`, workers.dev subdomain `osmanabdout`.

## $ARGUMENTS

### `deploy` (default) — ship the current code

The **order of operations is the `deploy` skill** (gate → push `main` → env → schema gap → build →
smoke → deploy → Neon restore point → prod data steps → real login → memory). This section is the
platform half of it. The commands, in the order they run:

```bash
cd ~/hogwarts                       # or ~/mkan
NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit                 # default heap SIGABRTs
git pull --rebase origin main && git push origin main                         # main == what ships
vercel env pull /tmp/prod.env --environment=production --scope databayt --yes && rm -f .env.local
CF_SOURCE=worktree scripts/deploy-cloudflare.sh /tmp/prod.env build          # working tree, ~12 min
scripts/deploy-cloudflare.sh /tmp/prod.env smoke                             # Docker: boot + curl table, read it
scripts/deploy-cloudflare.sh /tmp/prod.env deploy                            # wrangler pushes the image, swaps the container
```

Before building, always:

1. **Check the schema gap.** Deploying code ahead of its DDL breaks live pages.
   ```bash
   pnpm exec prisma migrate diff --from-url "$PROD_DIRECT_URL" --to-schema-datamodel prisma
   ```
   Added columns or tables block the deploy: apply them out-of-band first (restore point, then the
   additive statements only) and say what you skipped. Index-only and nullability drift that
   predates the deploy is noted, not fixed.
2. **Kill `next dev` and confirm no other Next build is running** — either one gets the build
   OOM-killed on this machine.

After deploying, always:

3. **Run the data steps the script never runs.** `deploy-cloudflare.sh` never seeds and
   `ensure-demo` short-circuits, so every seed commit in the range is owed a run against prod —
   behind a Neon restore point, under the **quota rule in the `deploy` skill** (evict the oldest
   branch when the free tier's 10 are taken; prune `restore-point-*` older than 7 days when done).
4. **Verify with a real login**, then write the memory line (Worker version id, `main` sha,
   restore branch).

Variants: `CF_SOURCE=<ref>` pins a commit, `CF_SOURCE=worktree` ships uncommitted work (what the
user usually means by "deploy everything"), `CF_OVERLAY="a b"` copies working-tree files over the
export.

If the push dies with `Docker command exited with code: 1`, **re-run the deploy** — it is transient
and completed layers are reused.

### `smoke` — prove the image before it reaches users

```bash
SMOKE_DATABASE_URL="$PROD_DATABASE_URL" scripts/deploy-cloudflare.sh /tmp/prod.env smoke
```

Runs the linux/amd64 image on `:3300` and curls health, both locales, login, a tenant path and a
`Host:` header test. Read the container log tail it prints — env-validation failures surface there.

### `status` — what is actually live

```bash
cd <build dir> && pnpm exec wrangler deployments list        # current version id
curl -s https://<worker>.osmanabdout.workers.dev/api/health  # bypasses DNS entirely
```

Then the real hostnames. **Always test two ways**, because a reset here is usually the network:

```bash
dig +short A demo.balqalam.com
curl -s -o /dev/null -w '%{http_code}\n' https://demo.balqalam.com/en                      # direct
curl -s -o /dev/null -w '%{http_code}\n' --resolve demo.balqalam.com:443:104.21.41.193 \
     https://demo.balqalam.com/en                                                          # forced good IP
```

Direct fails but forced succeeds → **the app is fine, the network is blocking that address range**.
See the agent's regional-IP section; the fix is the zone's Pro plan, not a redeploy.

### `logs` — Worker and cron observability

`wrangler tail` **does not work from this network**. Use the `cloudflare-observability` MCP, or the
telemetry API directly:

```
POST /accounts/<acct>/workers/observability/telemetry/query
  filters: $metadata.service = "hogwarts"        (add $metadata.message includes "api/cron")
  view: "events"
```

`$workers.eventType` distinguishes `fetch` from `scheduled`. Windows must be computed from epoch
arithmetic — macOS `date -u -j -f` parses as local time and silently shifts the window.

### `crons` — are the scheduled jobs running?

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/<acct>/workers/scripts/hogwarts/schedules"
```

Then confirm the app **received** the calls by querying observability for `api/cron` messages.
Registered-but-silent is normal for up to ~19 hours after a trigger is first added — **do not build
a workaround**; that mistake was made and reverted once already.

### `dns` — cutover and rollback

A Worker route captures a hostname only when its DNS record is **proxied (orange)**. Targets never
change; the cloud icon is the switch, and toggling it back is the rollback.

Order: one tenant host first → verify → apex and `www` → then a proxied `*` CNAME so new subdomains
need no DNS work.

The API token has Workers Routes:Edit but **not** DNS:Edit, so either use the `cloudflare-api` MCP
(after `/mcp` sign-in) or hand the user the dashboard link:
`https://dash.cloudflare.com/<acct>/<zone>/dns/records`

### `build` — just compile, do not ship

`scripts/deploy-cloudflare.sh /tmp/prod.env build`. Useful to prove `main` builds from a clean
checkout after someone forgets to `git add` a file.

## Secrets

`scripts/cf-secrets.sh /tmp/prod.env` pushes secret-classified vars to the Worker and **prefers
macOS Keychain overrides** (`cf-<worker>-<VAR>`) over the dotenv — because the pulled Vercel env
carries values that are wrong or dead. Deploy again afterwards: a container reads its env at start.

Known bad values already fixed and overridden: mkan's `NEXTAUTH_SECRET` shipped as the literal
string `secret`, and the Resend keys on both apps were revoked.

## Verification is not optional

Never report a deploy as done on the strength of `wrangler deploy` exiting 0. Prove it:
health endpoint, a real login through a browser, and the specific pages the change touched.
