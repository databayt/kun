---
domain: react-19
severity: error
paths: ["**/actions.ts", "**/actions.tsx", "**/*.action.ts"]
since: "React 19.0"
---

# Server Actions return typed errors, never throw for validation

Expected failures (Zod validation, tenant mismatch, duplicate) are part of the contract — return a typed state object so `useActionState` surfaces it in the form. A `throw` escapes to the error boundary and blanks the page; reserve it for truly unexpected faults. `redirect()` and `notFound()` are the exception: they throw on purpose, so call them after the `try/catch`, never inside it. Zod 4 deprecated `error.flatten()` — use `z.flattenError(error)`.

## Good

```ts
"use server";
import { z } from "zod";
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
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
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
  const session = await auth();
  if (!session) throw new Error("Unauthorized"); // blanks the page
  const parsed = studentSchema.parse(Object.fromEntries(form)); // throws on bad input
  try {
    await db.student.create({ data: parsed });
    redirect("/students"); // swallowed by the catch below
  } catch {
    return { error: "Failed" };
  }
}
```

## Fix

Swap `.parse()` for `.safeParse()`, `throw` for `return { error }` / `return { fieldErrors }`, and move `redirect()` below the `try/catch` so the returned state flows back into `useActionState`.

> Source: https://nextjs.org/docs/app/guides/forms · https://zod.dev/error-formatting
