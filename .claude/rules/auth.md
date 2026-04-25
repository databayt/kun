---
paths:
  - "src/**/auth/**"
  - "src/**/*auth*"
  - "src/middleware.ts"
  - "src/**/(login|register|signup|signout|session)/**"
  - "src/**/api/auth/**"
description: Auth.js v5 patterns — auth(), session, RBAC, tenant scoping
---

# Auth Rules

Active when working under any auth/session/middleware path. Auth.js v5 (NextAuth) only — no v4.

## Server-side auth check

Every protected page or layout calls `auth()` once at the top:

```ts
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // ...
}
```

Do NOT call `auth()` inside child Server Components — pass `session` down or fetch once at the layout.

## Server actions

Every `"use server"` action follows the 5-step contract:

```ts
"use server";
import { auth } from "@/auth";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";

const Schema = z.object({ /* ... */ });

export async function action(input: unknown) {
  const session = await auth();           // 1. auth
  if (!session?.user) throw new Error("unauthorized");
  const { schoolId } = await getTenantContext(); // 2. tenant
  const data = Schema.parse(input);       // 3. validate
  const result = await db.thing.create({  // 4. execute (always scoped by schoolId)
    data: { ...data, schoolId, userId: session.user.id }
  });
  revalidatePath("/admin");                // 5. revalidate
  return result;
}
```

## Tenant scoping

Every Prisma query against a tenant-owned model includes `schoolId` in the `where` clause. No exceptions for "admin" routes — admin still belongs to one school.

```ts
const students = await db.student.findMany({
  where: { schoolId },              // required
  select: { id: true, name: true }, // always select, never default
});
```

## Session shape

`session.user` carries: `id`, `email`, `role` (`OWNER | ADMIN | TEACHER | STUDENT | GUARDIAN`), `schoolId`. Extend via the `session` callback in `auth.config.ts`, never mutate the Session object at runtime.

## Middleware

`src/middleware.ts` enforces:
1. Redirect unauthenticated users to `/login` for any route under `/(admin|teacher|student|guardian)/...`
2. Set `x-tenant-id` header from subdomain
3. Set `x-pathname` for layout to read
4. Locale prefix (`/ar`, `/en`) — RTL/LTR derives from this

Never put database calls in middleware (edge runtime).

## Client-side

`useSession()` reads from the JWT cookie. Use sparingly — prefer server-fetched data passed as props. Loading state must render a skeleton, not null, or layout shifts on hydration.

## RBAC

Permission checks live in `authorization.ts` per feature:

```ts
import type { Role } from "@prisma/client";

export const can = {
  editStudent: (role: Role) => ["OWNER", "ADMIN", "TEACHER"].includes(role),
  deleteStudent: (role: Role) => role === "OWNER",
};
```

Action calls `can.editStudent(session.user.role)` after auth, before DB write.

## Never

- `useSession()` to gate UI without a server check (cookie can be stale)
- Trust `cookies()` for auth — always go through `auth()`
- Pass full `User` object to client — strip to id/name/role/schoolId
- Skip Zod parse on action input
- Skip `schoolId` filter on a tenant-owned query
- `--no-verify` on commits touching `auth.ts` / `middleware.ts`

## Reference

- Agent: `.claude/agents/authjs.md`
- Sweep: `/authjs` (mode: report)
- Pattern card: `.claude/patterns/cards/auth.md`
