---
name: guard
description: Guard — Full Coverage Security Sweep
paths: ["src/**/auth*","src/**/actions.ts","src/middleware.ts","prisma/**"]
---

# Guard — Full Coverage Security Sweep

Systematically verify every route has auth checks, input validation, and tenant isolation. Reports security gaps.

## Usage

- `guard` — sweep ALL routes in current product
- `guard admission` — sweep only the admission block
- `guard --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

### Step 1: Identify Product and Scope

Detect product from cwd. If `$ARGUMENTS` contains a block name, scope to that block. If `--status`, skip to Step 7.

### Step 2: Discover Routes

```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | sort
```

Group by module. Also find all `actions.ts` and `layout.tsx` files.

### Step 3: Load Ledger

Read `.claude/coverage/ledger.json`. Initialize `guard` sweep entry if first run.

### Step 4: Detect Drift

Same drift detection — new/modified/deleted routes.

### Step 5: Plan Batches

Sort modules: unchecked/stale first, smallest first.

### Step 6: Execute (Module by Module)

For each module, check three security layers:

#### 6a. Auth Layer (layout.tsx)

Check the module's layout.tsx (or nearest parent layout) for:
- `auth()` call from next-auth
- Redirect to `/login` or `/unauthorized` if no session
- Role-based access check if applicable

Use Grep: `auth\(\)` in layout files.

Public routes (from `src/routes.ts` publicRoutes) are exempt.

#### 6b. Validation Layer (actions.ts)

Check every server action file for:
- `"use server"` directive at top
- Zod schema validation (`safeParse` or `safeParseAsync`)
- Auth check within the action (not just relying on layout)
- `revalidatePath` or `revalidateTag` after mutations

Use Grep patterns:
- `"use server"` — must be present
- `safeParse|safeParseAsync` — input validation
- `auth\(\)` — action-level auth

#### 6c. Tenant Isolation Layer

For multi-tenant routes (under `s/[subdomain]/`), check for:
- `getTenantContext()` or `schoolId` in every database query
- No queries without tenant scope (bare `prisma.model.findMany()` without where clause)

Use Grep: `getTenantContext|schoolId` in action and query files.

#### 6d. Record Results

For each route:
- `status`: `pass` (all 3 layers present), `warn` (partial coverage), `fail` (missing auth or validation)
- `details.hasAuth`: boolean
- `details.hasValidation`: boolean
- `details.hasTenantScope`: boolean
- `details.unprotectedActions`: list of actions without validation

**SAVE LEDGER after each module.**

This command is REPORT-ONLY for auth and tenant issues (too risky to auto-fix security code). It CAN add missing `"use server"` directives.

### Step 7: Report

```
Guard Coverage — hogwarts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 441 routes | Auth: 430/441 | Validation: 380/441 | Tenant: 350/441

Module          Routes  Auth  Validation  Tenant  Status
auth               7    7/7      N/A       N/A    PASS (public)
admission          4    4/4      4/4       4/4    PASS
finance           74   74/74    60/74     55/74    WARN
...

Security gaps (CRITICAL):
1. src/app/.../finance/budget/actions.ts — no Zod validation on createBudget
2. src/app/.../attendance/bulk/actions.ts — no tenant scope in bulkUpdate query
...

Priority: Fix FAIL items first (unprotected routes), then WARN (missing validation).
```

### Step 8: Update Cross-Product Index
