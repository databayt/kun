---
domain: prisma-6
severity: error
paths:
  [
    "**/package.json",
    "**/.github/workflows/*.yml",
    "**/*.sh",
    "**/Makefile",
    "**/Dockerfile*",
  ]
since: "2026-09-26"
---

# Pin the Prisma CLI major and never run an unpinned `prisma`

The `latest` tag of the `prisma` package now points at the Prisma ORM 8 release-candidate CLI (`8.0.0-rc.17` as of 2026-09-24). That CLI does not read `schema.prisma` and has no `generate`, `migrate dev` or `db push`. Any of these now drops v8 into a Prisma 6 or 7 project: a bare `pnpm add -D prisma`, `pnpm dlx prisma …`, `npx prisma@latest …`, or `npx prisma …` in a directory with no local install. Lock the major in `package.json`, run the project's own binary with `pnpm exec prisma`, and write the major explicitly in one-off and CI calls. Prisma 7 stays supported for 18 months after v8 reaches GA (expected October 2026). Prisma 6 gets security patches only, and only until 2026-11-19.

## Good

```json
{
  "devDependencies": { "prisma": "^7.10.0" },
  "dependencies": { "@prisma/client": "^7.10.0" }
}
```

```bash
pnpm exec prisma migrate deploy   # the locked local CLI
npx prisma@7 migrate status       # one-off / CI without an install (prisma@6 in v6 repos)
```

## Bad

```bash
pnpm add -D prisma                # resolves to 8.0.0-rc.x today
pnpm dlx prisma migrate deploy    # dlx fetches from the registry and ignores the local install
npx -y prisma@latest generate
```

## Fix

Pin `prisma` and `@prisma/client` to the same major (`^7` or `^6.19`), call `pnpm exec prisma`, and spell out `prisma@<major>` wherever no lockfile applies.

> Source: https://www.prisma.io/docs/orm/release-status
