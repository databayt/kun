---
domain: next-16
severity: error
applies-to: ["**/actions.ts", "**/form.tsx", "**/*.client.tsx"]
since: "Next.js 16.0"
---

# Mutations are Server Actions, not client fetches

Writes go through `'use server'` actions invoked from `useActionState` — never a client-side `fetch` to a route handler. Actions get auth, tenant scope, Zod validation, and progressive enhancement for free; ad-hoc fetches duplicate all of it and bypass it.

## Good

```tsx
// actions.ts
"use server";
export async function createStudent(_: State, formData: FormData) {
  const session = await auth();
  const data = studentSchema.parse(Object.fromEntries(formData));
  await db.student.create({
    data: { ...data, schoolId: session.user.schoolId },
  });
  revalidateTag(`students:${session.user.schoolId}`);
  return { ok: true };
}

// form.tsx
const [state, action] = useActionState(createStudent, {});
return <form action={action}>...</form>;
```

## Bad

```tsx
// form.tsx — client fetch to a hand-rolled route handler, no tenant scope
await fetch("/api/students", { method: "POST", body: JSON.stringify(values) });
```

## Fix

Move the write into a `'use server'` function, call `auth()` + Zod inside it, and bind it via `useActionState`/`<form action={...}>`.
