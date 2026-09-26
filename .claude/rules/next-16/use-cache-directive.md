---
domain: next-16
severity: error
paths:
  [
    "**/queries.ts",
    "**/actions.ts",
    "**/lib/**/*.ts",
    "**/data/**/*.ts",
    "**/page.tsx",
    "**/content.tsx",
  ]
since: "Next.js 16.0"
---

# Cache reads with `'use cache'` only under `cacheComponents` — and key every cache by tenant and user

`'use cache'` is a Cache Components feature: without `cacheComponents: true` in `next.config` the compiler rejects it ("please enable the feature flag `cacheComponents`"), and no databayt product sets that flag yet — flipping it is a `/decide` (rendering becomes dynamic-by-default). Until then keep `unstable_cache`, which Next 16 marks as replaced by `'use cache'`. Either way the key must carry everything the rows depend on: the tenant, and the user whenever RBAC narrows rows per user. Never call `auth()`, `cookies()` or `headers()` inside the cached scope — unsupported, and it stores one tenant's rows under a key the next tenant hits. `cacheLife`/`cacheTag` are stable; the `unstable_` aliases log a deprecation warning. Don't export a cached read from a `'use server'` file: every export there is a public Server Action.

## Good

```ts
// cacheComponents: true — the arguments are the cache key
import { cacheLife, cacheTag } from "next/cache";

export async function getStudents(schoolId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`students:${schoolId}`);
  return db.student.findMany({ where: { schoolId } });
}
```

```ts
// cacheComponents off (every product today) — tenant in keyParts and tags
import { unstable_cache } from "next/cache";

export const getStudentsCached = (schoolId: string) =>
  unstable_cache(
    () => db.student.findMany({ where: { schoolId } }),
    ["students", schoolId],
    { tags: [`students:${schoolId}`], revalidate: 3600 },
  )();
```

## Bad

```ts
export const getTaskCounts = unstable_cache(async () => {
  const { schoolId } = await getTenantContext(); // reads cookies inside the cache
  return db.task.groupBy({ by: ["status"], where: { schoolId } });
}, ["task-counts"]); // one key for every school: first tenant's counts go to all
```

## Fix

Resolve tenant/user outside, pass them as arguments (`'use cache'`) or `keyParts` (`unstable_cache`), import `cacheLife`/`cacheTag` without `unstable_`, and write `'use cache'` only after `cacheComponents: true` has landed.

> Source: https://nextjs.org/docs/app/api-reference/directives/use-cache · https://nextjs.org/docs/app/api-reference/functions/unstable_cache
