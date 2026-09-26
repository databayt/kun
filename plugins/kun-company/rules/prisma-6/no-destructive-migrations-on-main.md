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

`migrate reset` and `db push --accept-data-loss` drop tables and discard rows. Run against a shared or production database, they wipe every tenant. `migrate dev` does not belong there either: when it detects drift it offers to reset the database. Only `migrate deploy` should touch live data; it applies committed migrations non-interactively under an advisory lock. Since Prisma 6.15 the CLI blocks destructive commands such as `migrate reset --force` when an AI agent (Claude Code included) launches them, until `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` holds the user's literal consent text; 7.10 extends the check to `db push` data-loss prompts. An agent never sets that variable on its own. In kun, local `.env` points at the one database prod also uses, so running `migrate dev` locally is running it on prod.

## Good

```json
{
  "db:deploy": "prisma migrate deploy",
  "db:dev": "prisma migrate dev"
}
```

`db:dev` runs only against a disposable database: local Postgres or an expiring Neon branch.

## Bad

```json
{
  "db:fix": "prisma migrate reset --force",
  "db:sync": "prisma db push --accept-data-loss",
  "db:ci": "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes prisma migrate reset --force"
}
```

## Fix

Replace reset and `--accept-data-loss` with `prisma migrate deploy`. Run `migrate dev` and resets only on a throwaway database, and never pre-fill the AI-consent variable.

> Source: https://www.prisma.io/docs/orm/v7/more/best-practices · https://www.prisma.io/docs/ai/tools/mcp-server#ai-safety-guardrails-for-destructive-commands
