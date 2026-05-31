---
domain: neon
severity: info
applies-to:
  [
    "**/prisma/schema.prisma",
    "**/prisma/migrations/**",
    "**/.github/workflows/*.yml",
  ]
since: "Neon"
---

# Run schema-changing PRs against a Neon branch, not production

Every PR that touches `schema.prisma` or adds a migration must apply it to a throwaway Neon branch (one per PR) so production data is never the test bed. Delete the branch on merge/close so compute and storage don't leak.

## Good

```yaml
# .github/workflows/preview.yml — branch per PR, deleted on close
- uses: neondatabase/create-branch-action@v5
  with:
    project_id: ${{ vars.NEON_PROJECT_ID }}
    branch_name: pr-${{ github.event.number }}
    api_key: ${{ secrets.NEON_API_KEY }}
- run: pnpm prisma migrate deploy   # runs against the PR branch DATABASE_URL

# separate cleanup job on pull_request: closed
- uses: neondatabase/delete-branch-action@v3
  with: { branch: pr-${{ github.event.number }} }
```

## Bad

```yaml
# Migrating the production branch from CI — drops/renames hit live tenant data
- run: pnpm prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

## Fix

Create a `pr-<number>` Neon branch in CI, point `DATABASE_URL` at it, and add a `closed` job that calls `delete-branch-action`.
