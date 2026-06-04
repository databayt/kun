---
domain: prisma-6
severity: error
paths:
  [
    "**/schema.prisma",
    "**/package.json",
    "**/*.sh",
    "**/Makefile",
    "**/.github/workflows/*.yml",
  ]
since: "Prisma 6.0"
---

# No destructive migrations on shared/live DBs

`migrate reset` and `db push --accept-data-loss` drop tables and discard rows — run against a shared or production database they wipe every tenant. Only `migrate deploy` touches live data.

## Good

```tsx
// CI / production: forward-only, never drops data
"db:deploy": "prisma migrate deploy"

// Local dev only, against a disposable DB
"db:dev": "prisma migrate dev"
```

## Bad

```tsx
// Wipes all tenants on the shared DB
"db:fix": "prisma migrate reset --force"
"db:sync": "prisma db push --accept-data-loss"
```

## Fix

Replace reset / `--accept-data-loss` with `prisma migrate deploy`; reserve `migrate dev` and resets for throwaway local databases.
