---
domain: prisma-6
severity: warn
paths: ["**/actions.ts", "**/content.tsx", "**/page.tsx", "**/*.queries.ts"]
since: "Prisma 6.0"
---

# Select only the fields you render

Without `select`, Prisma returns every scalar column, so `passwordHash`, tokens and internal flags ship to the client and bloat the RSC payload. `include` does not narrow the result: it adds the relation with **all** of its scalars, so `include: { user: true }` leaks the user's secrets too. Select the fields the UI reads and nest `select` inside relations. As a safety net for columns that must never leave the server, add `omit` (per query, or globally on the client; GA since 6.2).

## Good

```tsx
const teachers = await db.teacher.findMany({
  where: { schoolId },
  select: {
    id: true,
    name: true,
    subject: true,
    user: { select: { email: true } },
  },
});
// safety net: new PrismaClient({ adapter, omit: { user: { passwordHash: true } } })
```

## Bad

```tsx
// Every teacher column, plus every user column (passwordHash included)
const teachers = await db.teacher.findMany({
  where: { schoolId },
  include: { user: true },
});
```

## Fix

Replace bare and `include` reads with a `select` that names each rendered field, nest `select` for relations, and add a global `omit` for secret columns.

> Source: https://www.prisma.io/docs/orm/v7/prisma-client/queries/select-fields · https://www.prisma.io/docs/orm/v7/prisma-client/queries/excluding-fields
