---
domain: prisma-6
severity: warn
paths:
  ["**/actions.ts", "**/content.tsx", "**/page.tsx", "**/*.queries.ts"]
since: "Prisma 6.0"
---

# Select only the fields you render

Use `select`/`include` to fetch just the columns the UI needs — returning whole rows ships secrets (`passwordHash`, tokens) to the client and bloats the RSC payload.

## Good

```tsx
const teachers = await db.teacher.findMany({
  where: { schoolId },
  select: { id: true, name: true, email: true, subject: true },
});
```

## Bad

```tsx
// Returns every column, incl. passwordHash + internal flags
const teachers = await db.teacher.findMany({
  where: { schoolId },
});
```

## Fix

Add a `select` (or `include` for relations) listing only the fields the component reads.
