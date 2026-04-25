---
paths:
  - ".github/workflows/**"
  - "vercel.json"
  - "next.config.{ts,js,mjs}"
  - "DEPLOY.md"
  - "Dockerfile"
  - "scripts/deploy*.sh"
description: Deployment — Vercel-first, env hygiene, post-deploy verify
---

# Deployment Rules

Active in deploy/CI paths. Vercel is the production target for all Next.js products.

## Vercel — primary deploy target

Auto-deploy on push to `main`. PR previews on every branch. Production URL convention:

| Repo | Production URL |
|------|----------------|
| hogwarts | `kingfahad.databayt.org` (per-tenant subdomain) |
| kun | `kun.databayt.org` |
| marketing | `databayt.org` |
| souq | `souq.databayt.org` |
| mkan | `mkan.databayt.org` |
| shifa | `shifa.databayt.org` |

`vercel.json` is the source of truth. Never set per-deploy overrides via dashboard — they don't survive a rollback.

## Environment variables

ONE `.env` file per repo, at the repo root. Never commit it. Never create `.env.local` / `.env.development` / `.env.x`. Vercel project env settings mirror `.env`.

Required keys per repo are documented in the repo's `README.md`. Captain's `dispatch.sh setup-env <repo>` writes the canonical set from Keychain.

## Pre-deploy gate

Every PR runs:

```yaml
- pnpm install --frozen-lockfile
- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm build
```

Failed → cannot merge. Fix before retry. Never `--no-verify` push to main.

## Post-deploy verify

After `pnpm deploy` (or Vercel auto-deploy) succeeds:

```bash
/watch [url]            # captures CWV + console errors + screenshot
gh run watch            # latest workflow status
gh deployment list      # vercel deploy state
```

`/watch` reports back to the issue that triggered the deploy. Fail = open `incident` issue automatically.

## Migrations on deploy

Prisma migrations run from a separate Vercel deploy hook (NOT in build). The hook is gated on a `MIGRATE_ON_DEPLOY=true` env on production only. Staging migrates inline.

```bash
# vercel.json hook target
{ "buildCommand": "prisma generate && next build" }
# Migration via separate cron'd serverless function or a manual /ship --migrate
```

Never run `prisma migrate deploy` in the build step — concurrent builds can both attempt the same migration.

## Rollback

Vercel dashboard → Deployments → "Promote to Production" on the previous good deploy. Captain logs every rollback to `~/.claude/memory/rollbacks.jsonl`.

## Self-hosting

Optional. See `docs/SELF-HOSTING.md` for Tailscale/tmux/Docker. Not the default path.

## Never

- Push to main without a green CI
- Use `--no-verify`, `--no-gpg-sign`, or skip pre-commit hooks unless explicitly approved
- Add a Vercel env var via dashboard without mirroring in `.env`
- Run `prisma migrate deploy` in the build command
- Promote a deploy that hasn't passed `/watch`

## Reference

- Agent: `.claude/agents/deploy.md`
- Skill: `/deploy`, `/ship`, `/watch`
- Doc: `DEPLOY.md`
