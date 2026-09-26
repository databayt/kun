---
domain: next-16
severity: error
paths: ["**/actions.ts", "**/route.ts"]
since: "Next.js 16.0"
---

# Invalidate the exact tag after every mutation — `updateTag` in actions, two-argument `revalidateTag` elsewhere

A mutation that leaves its cached read alone keeps serving stale rows. In a Server Action call `updateTag(tag)` for read-your-writes: the tag expires and the next read waits for fresh data. Outside actions (route handlers, webhooks, crons) call `revalidateTag(tag, "max")` for stale-while-revalidate, or `revalidateTag(tag, { expire: 0 })` to expire at once. Next 16 removed the one-argument `revalidateTag(tag)` from the types (a TypeScript error, deprecated at runtime) and there is no `unstable_updateTag` export — `updateTag` and `refresh` are stable in `next/cache`. When nothing is cached but the page must re-render, `refresh()` refreshes the client router from the action. Use the tag string the read set, tenant id included.

## Good

```ts
"use server";
import { updateTag } from "next/cache";

export async function updateGrade(id: string, value: number) {
  const session = await auth();
  if (!session?.user?.schoolId) return { error: "Unauthorized" };
  await db.grade.update({
    where: { id, schoolId: session.user.schoolId },
    data: { value },
  });
  updateTag(`grades:${session.user.schoolId}`); // same tag as the cached read
  return {};
}
```

```ts
// app/api/cron/publish/route.ts — not a Server Action, so no updateTag
revalidateTag(`announcements:${schoolId}`, "max");
```

## Bad

```ts
"use server";
import { revalidateTag, unstable_updateTag } from "next/cache"; // no such export

export async function updateGrade(id: string, value: number) {
  await db.grade.update({ where: { id }, data: { value } });
  revalidateTag("grades"); // one-argument form: TS error, and not the read's tag
}
```

## Fix

In actions call `updateTag("<tag>")` (or `refresh()` when nothing is cached); elsewhere call `revalidateTag("<tag>", "max")` — always with the tenant-scoped tag the read registered.

> Source: https://nextjs.org/docs/app/api-reference/functions/updateTag · https://nextjs.org/docs/app/api-reference/functions/revalidateTag
