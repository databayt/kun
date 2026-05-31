---
domain: prisma-6
severity: error
applies-to:
  ["**/actions.ts", "**/content.tsx", "**/page.tsx", "**/*.queries.ts"]
since: "Prisma 6.0"
---

# Scope every query by the tenant key

In a multi-tenant model every read and write must filter by the tenant key (`schoolId` / `vendorId`) resolved from `auth()` — an unscoped `findMany`/`update` leaks or mutates another tenant's data.

## Good

```tsx
const session = await auth();
const schoolId = session?.user?.schoolId;
if (!schoolId) throw new Error("Unauthorized");

const students = await db.student.findMany({
  where: { schoolId, status: "active" },
});
```

## Bad

```tsx
// No tenant filter — returns every school's students
const students = await db.student.findMany({
  where: { status: "active" },
});
```

## Fix

Resolve `schoolId`/`vendorId` from `auth()` and add it to the `where` of every query (and the `data` of every create).
