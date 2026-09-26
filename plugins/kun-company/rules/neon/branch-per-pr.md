---
domain: neon
severity: warn
paths:
  [
    "**/prisma/schema.prisma",
    "**/prisma/models/*.prisma",
    "**/prisma/migrations/**",
    "**/scripts/deploy*.sh",
    "**/.github/workflows/*.yml",
  ]
since: "2026-09-26"
---

# Rehearse schema changes on an expiring Neon branch, then take a restore point before prod

A migration's first run must never be against live tenants. databayt works main-only (no PRs), so the unit is the **change**: branch production, run `migrate deploy` against the copy, check it, take a restore point, then migrate prod. Give every throwaway branch `--expires-at` (max 30 days out). Branches created by the CLI or API never expire by default, and the Free plan caps a project at 10 branches, which is why restore points currently have to be evicted by hand. A restore point can be an expiring branch or a manual snapshot (`neon snapshots create`; Free allows 1, paid plans 100).

## Good

```bash
# BSD/macOS date shown; GNU/CI: date -u -d '+2 days' +%FT%TZ
B=rehearse-$(git rev-parse --short HEAD)
neon branches create --name "$B" --expires-at "$(date -u -v+2d +%FT%TZ)"  # parent = default (prod) branch
URL=$(neon connection-string "$B")                                        # direct host, not --pooled
DATABASE_URL=$URL DIRECT_URL=$URL pnpm exec prisma migrate deploy          # rehearsal
neon branches create --name "restore-point-$(date +%F)" --expires-at "$(date -u -v+7d +%FT%TZ)"
pnpm exec prisma migrate deploy                                           # prod, only after both passed
```

## Bad

```yaml
# First run of a new migration is against live tenants, with no restore point
- run: npx prisma migrate deploy
  env: { DATABASE_URL: "${{ secrets.PRODUCTION_DATABASE_URL }}" }
# v5 action, no expires_at: branches pile up until the 10-branch cap blocks the next one
- uses: neondatabase/create-branch-action@v5
```

## Fix

Rehearse on `neon branches create --expires-at …` (in CI: `create-branch-action@v6` with `expires_at`; `delete-branch-action@v3` needs `project_id`, `branch` and `api_key`). Then take an expiring restore point and migrate prod.

> Source: https://neon.com/docs/guides/branch-expiration · https://neon.com/docs/guides/backup-restore · https://neon.com/docs/introduction/plans · https://github.com/neondatabase/create-branch-action
