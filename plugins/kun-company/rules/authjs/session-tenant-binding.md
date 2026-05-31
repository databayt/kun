---
domain: authjs
severity: error
applies-to:
  ["**/actions.ts", "**/actions/*.ts", "**/auth.ts", "**/auth.config.ts"]
since: "Auth.js 5.0"
---

# Scope writes to the session tenant, not a client value

The tenant id (`schoolId`/`vendorId`) lives on the session via the JWT/session callbacks; actions must read it from `session.user`. Trusting a tenant id from the form lets a user read or mutate another tenant's rows.

## Good

```ts
"use server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { studentSchema } from "./validation";

export async function createStudent(input: unknown) {
  const session = await auth();
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return { error: "No tenant" };

  const data = studentSchema.parse(input); // schema has NO schoolId field
  await db.student.create({ data: { ...data, schoolId } }); // tenant from session
  return { ok: true };
}
```

## Bad

```ts
"use server";
import { db } from "@/lib/db";

export async function createStudent(input: { name: string; schoolId: string }) {
  // schoolId comes from the client — caller can target any school's data
  await db.student.create({ data: input });
}
```

## Fix

Read `schoolId`/`vendorId` from `session.user`, drop it from the Zod schema, and inject it into every `where`/`data` clause server-side.
