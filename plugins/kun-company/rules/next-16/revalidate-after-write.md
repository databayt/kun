---
domain: next-16
severity: error
paths: ["**/actions.ts"]
since: "Next.js 16.0"
---

# Revalidate after every mutation

A Server Action that mutates must invalidate the cache it changed — `revalidateTag`/`revalidatePath`, or `updateTag` for read-your-writes — or the UI keeps serving the stale `'use cache'` result. Match the tag you set in the read.

## Good

```tsx
"use server";
import { revalidateTag, unstable_updateTag as updateTag } from "next/cache";

export async function updateGrade(id: string, value: number) {
  const session = await auth();
  await db.grade.update({
    where: { id, schoolId: session.user.schoolId },
    data: { value },
  });
  updateTag(`grades:${session.user.schoolId}`); // read-your-writes, same request
  return { ok: true };
}
```

## Bad

```tsx
"use server";
export async function updateGrade(id: string, value: number) {
  await db.grade.update({ where: { id }, data: { value } });
  return { ok: true }; // cached list never refreshes — user sees old grade
}
```

## Fix

After the Prisma write, call `revalidateTag`/`revalidatePath` (or `updateTag` for same-request freshness) using the exact tag from the cached read.
