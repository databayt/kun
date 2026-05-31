---
domain: next-16
severity: warn
applies-to:
  [
    "**/actions.ts",
    "**/page.tsx",
    "**/content.tsx",
    "**/lib/**/*.ts",
    "**/data/**/*.ts",
  ]
since: "Next.js 16.0"
---

# Cacheable reads use the `'use cache'` directive

Mark deterministic, tenant-scoped read functions with `'use cache'` so Cache Components can dedupe and reuse them; scope freshness with `cacheLife` and invalidation with `cacheTag`. Without it, every render re-hits Prisma.

## Good

```tsx
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";

export async function getStudents(schoolId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`students:${schoolId}`);
  return db.student.findMany({ where: { schoolId } });
}
```

## Bad

```tsx
// No directive — re-queries on every request, no tag to invalidate later
export async function getStudents(schoolId: string) {
  return db.student.findMany({ where: { schoolId } });
}
```

## Fix

Add `'use cache'` as the first statement, then `cacheLife(...)` for TTL and `cacheTag(...)` keyed by the tenant id so mutations can target it.
