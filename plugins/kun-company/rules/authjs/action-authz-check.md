---
domain: authjs
severity: error
paths: ["**/actions.ts", "**/actions/*.ts"]
since: "Auth.js 5.0"
---

# Re-check session + role inside every mutating action

Every `"use server"` mutation must call `auth()` and verify the role before writing. Hiding a button in the UI is not authorization — Server Actions are public POST endpoints that anyone can invoke directly.

## Good

```ts
"use server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { gradeSchema } from "./validation";

export async function updateGrade(input: unknown) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthenticated" };
  if (session.user.role !== "TEACHER") return { error: "Forbidden" };

  const data = gradeSchema.parse(input);
  await db.grade.update({
    where: { id: data.id },
    data: { value: data.value },
  });
  return { ok: true };
}
```

## Bad

```ts
"use server";
import { db } from "@/lib/db";

// No auth() call — relies on the form being hidden from students in the UI.
export async function updateGrade(input: { id: string; value: number }) {
  await db.grade.update({
    where: { id: input.id },
    data: { value: input.value },
  });
}
```

## Fix

Add `const session = await auth()` plus an explicit role check at the top of the action, returning an error before any `db` write.
