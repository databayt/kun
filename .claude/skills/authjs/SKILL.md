---
name: authjs
description: Auth.js — Full Coverage Authentication Sweep
paths: ["src/**/auth/**","src/**/*auth*","src/middleware.ts"]
---

# Auth.js — Full Coverage Authentication Sweep

Sweep every auth touchpoint for Auth.js v5 anti-patterns: deprecated getSession, client-side auth overuse, missing null checks, hardcoded secrets.

## Usage

- `authjs` — sweep ALL auth code in current product
- `authjs admission` — sweep only the admission block
- `authjs --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `authjs` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find)

1. **`getSession()`** → use `auth()` from `@/auth` in server components
2. **`useSession()` overuse** → prefer server-side `auth()` over client hook
3. **Session property access without null check** → add `session?.user?.role`
4. **Hardcoded JWT secrets** → use `AUTH_SECRET` env var
5. **Plain text passwords** → always hash with bcrypt

### Mode: Report

This keyword REPORTS issues but does NOT auto-fix. Auth code changes require careful review.

### Auth Pattern Reference

```tsx
// Server Component — correct
import { auth } from "@/auth"
const session = await auth()
if (!session) redirect("/login")

// Server Action — correct
"use server"
import { auth } from "@/auth"
export async function createItem() {
  const session = await auth()
  if (!session) throw new Error("Unauthorized")
  // ...
}

// Layout — correct (protects all child routes)
export default async function DashboardLayout({ children }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasRole(session, "ADMIN")) redirect("/unauthorized")
  return <>{children}</>
}
```

### Coverage Focus

Prioritize checking:
1. Every `layout.tsx` in protected route groups
2. Every `actions.ts` file
3. Every API route (`route.ts`)
4. Middleware/proxy configuration
