---
domain: react-19
severity: error
applies-to: ["**/actions.ts", "**/actions.tsx", "**/*.action.ts"]
since: "React 19.0"
---

# Server Actions return typed errors, never throw for validation

Expected failures (Zod validation, tenant mismatch, duplicate) are part of the contract — return a typed state object so `useActionState` surfaces it in the form. A `throw` escapes to the error boundary and blanks the page; reserve it for truly unexpected faults.

## Good

```ts
"use server";
import { auth } from "@/auth";
import { studentSchema } from "./validation";

type ActionState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function createStudent(
  _: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.schoolId) return { error: "Unauthorized" };
  const parsed = studentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  await db.student.create({
    data: { ...parsed.data, schoolId: session.user.schoolId },
  });
  return {};
}
```

## Bad

```ts
"use server";
export async function createStudent(_: unknown, form: FormData) {
  const parsed = studentSchema.parse(Object.fromEntries(form)); // throws on bad input
  if (!session) throw new Error("Unauthorized"); // throws to error boundary
  await db.student.create({ data: parsed });
}
```

## Fix

Swap `.parse()` for `.safeParse()` and `throw` for `return { error }` / `return { fieldErrors }` so the returned state flows back into `useActionState`.
