---
domain: next-16
severity: error
paths: ["**/actions.ts", "**/form.tsx", "**/*.client.tsx"]
since: "Next.js 16.0"
---

# Mutations are Server Actions, not client fetches

Writes go through `'use server'` actions bound with `useActionState` — never a client `fetch` to a hand-rolled route handler. An action keeps auth, tenant scope, validation and cache invalidation in one server function and works before hydration. It gets none of them for free: every exported action is reachable by a direct POST, so each one calls `auth()`, scopes by the session tenant, `safeParse`s its input and returns errors as state.

## Good

```tsx
// actions.ts
"use server";
import { updateTag } from "next/cache";

export async function createStudent(
  _: State,
  formData: FormData,
): Promise<State> {
  const session = await auth();
  if (!session?.user?.schoolId) return { error: "Unauthorized" };
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  await db.student.create({
    data: { ...parsed.data, schoolId: session.user.schoolId },
  });
  updateTag(`students:${session.user.schoolId}`);
  return {};
}
```

```tsx
// form.tsx ("use client")
const [state, action, isPending] = useActionState(createStudent, {});
return <form action={action}>...</form>;
```

## Bad

```tsx
// form.tsx — client fetch to a hand-rolled route handler, no tenant scope
await fetch("/api/students", { method: "POST", body: JSON.stringify(values) });
```

## Fix

Move the write into a `'use server'` function that calls `auth()`, `safeParse`, the tenant-scoped Prisma write and `updateTag`, and bind it via `useActionState`/`<form action={...}>`.

> Source: https://nextjs.org/docs/app/guides/data-security · https://nextjs.org/docs/app/guides/forms
