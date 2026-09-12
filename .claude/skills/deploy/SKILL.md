---
name: deploy
description: Production deploy operator — the full cycle on Cloudflare (gate, push, env, schema gap, worktree build, smoke, deploy, Neon restore point, prod data steps, real-login verify), with the Vercel preview lane kept for repos that still use it
when_to_use: "Use when Abdout says deploy, push to prod, ship it, or deploy everything in a repo — the whole cycle from typecheck to a verified login on the live hostname, not just the upload. Routes by platform: a repo with wrangler.jsonc (hogwarts, mkan) takes the Cloudflare lane below; anything else takes the legacy Vercel lane. Owns the Neon restore-point rule (quota eviction of the oldest branch) and the prod data steps the deploy script never runs. Distinct from /check (pre-ship gate only), /watch (observe production, never fix), /cloudflare (platform operator: DNS, crons, logs), and /quick (commit-lint-push without a build). Triggers on: deploy, deploy everything, push to production, ship to cloudflare, redeploy, why is the deploy stuck, vercel preview, deploy to staging."
argument-hint: "[preview|logs|status] [app]"
allowed-tools: Bash(git *), Bash(pnpm *), Bash(npx *), Bash(gh *), Bash(curl *), Bash(docker *), Bash(vercel *), Bash(scripts/*)
model: opus
---

# Deploy — the production cycle

"Deploy" means the **whole cycle**, and it ends with a real login on the live hostname, not with
an exit code. Since 2026-09-07 the databayt products run on **Cloudflare Workers + Containers**;
every Vercel hostname on the databayt accounts answers HTTP 402. Vercel's env storage still
works, and that is the only thing this cycle still uses it for.

## Platform check — do this first

```bash
ls wrangler.jsonc 2>/dev/null && echo "CLOUDFLARE" || echo "VERCEL"
```

`wrangler.jsonc` present → the Cloudflare lane. Otherwise the legacy Vercel lane at the end.
Platform mechanics (DNS, crons, observability, the network-reset trap) live in the `cloudflare`
skill; this skill is the order of operations and the two things it keeps getting wrong: the Neon
restore point and the data steps the deploy never runs.

## Cloudflare lane — in this order

Run the long steps in the background and wait with an `until grep` loop on the log. Do not
`tail -f | grep` a Next build: the nuqs `localStorage` prerender warning fires hundreds of
times and drowns the monitor.

### 1. Gate the tree

```bash
git branch --show-current                                   # must print: main
lsof -ti:3000 | xargs -r kill                               # next dev resident → the build OOMs
NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit  # default heap SIGABRTs on hogwarts
```

### 2. Make `main` equal what ships

The build takes the **working tree** (`CF_SOURCE=worktree`) — that is what "deploy everything"
means — so `main` must catch up first or production and GitHub drift for weeks.

- Commit the modified **tracked** files with a real message. Never `git add -A`: the root
  fills with screenshots, poll JSONs and throwaway scripts between deploys.
- Untracked directories under `public/` ship verbatim. Reference captures already live there
  (`books-app`, `github`, `apple-tv`), so a new capture set is committed, not hidden.
- `git pull --rebase origin main && git push origin main`.

### 3. Production env

```bash
vercel env pull /tmp/prod.env --environment=production --scope databayt --yes && rm -f .env.local
```

If the CLI refuses, that is the blocker to surface. Never reconstruct secrets.

Vercel refuses env **writes** under the fair-use block, so a var added after 2026-09-12 lives in
the macOS Keychain as `cf-<worker>-<VAR>` and is appended to the pulled file before the build —
`cf/env-split.mjs` then classifies it (secret → Worker via cf-secrets.sh, config → baked):

```bash
for n in NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT; do
  printf '%s=%s\n' "$n" "$(security find-generic-password -a "$USER" -s "cf-hogwarts-$n" -w)" >> /tmp/prod.env
done
```

### 4. Schema gap — read the diff, do not just run it

```bash
DIRECT=$(grep -E '^DIRECT_URL=' /tmp/prod.env | tail -1 | cut -d= -f2- | tr -d '"')
pnpm exec prisma migrate diff --from-url "$DIRECT" --to-schema-datamodel prisma
git diff --name-only <last-deployed-sha>..HEAD -- prisma/schema*        # does THIS deploy move the schema?
```

- **Blocker**: added columns or tables. Apply the additive DDL out-of-band first (restore point,
  then the additive statements only) and say what you skipped.
- **Not a blocker**: index-only and nullability drift that predates the deploy (hogwarts carries
  four such items by design — the `Application` unique index blocked by duplicate rows, two
  `live_class_*` items, one `notification_templates` index). Note it, ship.

### 5. Build, smoke, deploy

```bash
CF_SOURCE=worktree scripts/deploy-cloudflare.sh /tmp/prod.env build    # ~12 min, 2 workers / 3 GB
scripts/deploy-cloudflare.sh /tmp/prod.env smoke                       # Docker: boot, health, locales, tenant Host header
scripts/deploy-cloudflare.sh /tmp/prod.env deploy                      # capture "Current Version ID"
```

Read the smoke table, not just its exit code: health `200`, `/en` and `/ar` `200`, and the
`Host: demo.<root>` line must `307` to the **school** login with `subdomain=demo`. Read the
container log tail — env-validation failures surface there. A `Docker command exited with code: 1`
on deploy is transient: re-run, completed layers are reused.

### 6. The data steps the deploy never runs

`deploy-cloudflare.sh` never seeds and `ensure-demo` short-circuits once the demo exists, so a
seed-bearing deploy leaves prod data behind. Find what is owed **before** verifying:

```bash
git log <last-deployed-sha>..HEAD --format='%h %s' -- prisma/seeds prisma/scripts
grep -rn -A8 "Production needs\|after the next deploy" src/components/*/ISSUE.md src/components/*/*/ISSUE.md
```

Then take a **restore point (rule below)** and run them against prod. Set both URLs on the
command line; `dotenv` never overrides an exported variable, so the local `.env` cannot win:

```bash
export DATABASE_URL="$DIRECT" DIRECT_URL="$DIRECT"
pnpm db:seed:single <module>
npx tsx -r dotenv/config prisma/scripts/<script>.ts
```

Write each command out. **zsh does not word-split an unquoted variable** — a `for step in
"pnpm db:seed:single x"; do $step; done` loop exits 127 on every line and looks like it ran.

### 7. Verify — a login, not a status code

- `curl -s https://<apex>/api/health` — `uptime` resets to seconds when the new container is
  serving. `status: degraded` is the known heap heuristic (heapUsed ÷ heapTotal), not a failure.
- **Real login through the browser MCP**: `admin@kingfahd.com` / `1234` on
  `kingfahd.balqalam.com/dashboard` → `/en/dashboard` titled _Overview_. Escape closes the tour
  dialog on the first authed page. Wait for `load`, never `networkidle`.
- The pages the diff touched, on a phone viewport when the diff was mobile work.
- The `_vercel/insights` and `_vercel/speed-insights` 404s in every console are pre-existing.
- A connection reset is the network, not the app — see the `cloudflare` skill's `status` recipe.

### 8. Record

One memory entry: `DEPLOY <date> — Worker <version id>, main at <sha>`, the restore branch id,
and anything still owed. The next session starts from that line.

## Neon restore point — the quota rule

**Why this keeps happening.** Neon's free tier allows **10 branches, 1 snapshot, 6 h PITR**. On
Vercel a deploy was an upload that never touched the database, so restore points were rare. On
Cloudflare every seed-bearing deploy needs a prod data step, every data step takes a restore
point, and nothing ever pruned them — six were created between 09-07 and 09-11 alone. The quota
fills in about a week, and it fills _during_ a deploy, when the branch is needed most.

**Standing rule (Abdout, 2026-09-12): evict the oldest, do not ask.**

1. Prefer a **branch** with `no_compute: true` (`restore-point-before-<what>-<date>`). The
   snapshot limit is 1; a compute-less branch is free and there are ten slots.
2. If `create_branch` fails on the limit: `list_branches`, sort by `created_at`, delete the
   **oldest** branch that is not `default`, not `protected`, not `production`, and not younger
   than 24 h. Repeat once if needed. Then create.
3. At the **end** of a verified deploy, delete every `restore-point-*` and `test-*` branch older
   than **7 days**. A restore point outlives its usefulness the moment the change it guards has
   been verified; leaving them is what fills the quota.
4. If even that fails, the 6-hour PITR (`restore_snapshot` on `production` with a timestamp) is
   the fallback for additive, idempotent seeds — record the pre-write timestamp in the memory
   entry.

Never delete `production` (`br-small-tooth-adscsfmb` on hogwarts), never the `platform` school
inside it, and never a branch another session named in memory as a restore for unfinished work.

## `$ARGUMENTS`

- `status` — `pnpm exec wrangler deployments list --name <worker>` from the build dir, then the
  `cloudflare` skill's two-way curl (direct and `--resolve`).
- `logs` — `wrangler tail` does not work from this network; use the `cloudflare-observability`
  MCP per the `cloudflare` skill.
- `preview` — Cloudflare has no preview lane yet; the `workers.dev` host serves marketing and
  login but not tenant dashboards (no wildcard). Say so instead of inventing one.

## Legacy Vercel lane (repos without `wrangler.jsonc`)

`npx vercel --yes` for preview, `npx vercel --prod --yes` for production; poll
`npx vercel inspect <url>` every 30 s until `Ready` or `Error`; on `Error` read
`npx vercel inspect <url> --logs`, fix, commit, push, retry — five attempts, then stop and show
the trail. Never invent an env var. Do not use this lane for hogwarts or mkan.
