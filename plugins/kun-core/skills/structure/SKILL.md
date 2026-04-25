---
name: structure
description: Structure — Full Coverage File Convention Sweep
paths: ["src/**"]
---

# Structure — Full Coverage File Convention Sweep

Systematically verify every module follows the mirror pattern file conventions. Reports missing or misplaced files.

## Usage

- `structure` — sweep ALL modules in current product
- `structure admission` — sweep only the admission block
- `structure --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

### Step 1: Identify Product and Scope

Detect product from cwd. If `$ARGUMENTS` contains a block name, scope to that block. If `--status`, skip to Step 7.

### Step 2: Discover Routes

```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | sort
```

Group by module. For structure checks, also identify the corresponding component directory for each module using the mirror pattern:
- Route: `src/app/[lang]/s/[subdomain]/(school-dashboard)/admission/` → Components: `src/components/platform/admission/`
- Route: `src/app/[lang]/s/[subdomain]/(school-dashboard)/(listings)/students/` → Components: `src/components/platform/students/`

### Step 3: Load Ledger

Read `.claude/coverage/ledger.json`. Initialize `structure` sweep entry if first run.

### Step 4: Detect Drift

Same as translate — check for new/modified/deleted routes.

### Step 5: Plan Batches

Sort modules: unchecked/stale first, smallest first.

### Step 6: Execute (Module by Module)

For each module, check the mirror pattern:

#### 6a. Route-Side Check (src/app/)

For each page directory, check for expected files:

| File | Required | Purpose |
|------|----------|---------|
| `page.tsx` | yes | Route entry point — async server component |
| `layout.tsx` | module root only | Auth guard, metadata, shared UI |
| `loading.tsx` | recommended | Loading skeleton |

#### 6b. Component-Side Check (src/components/)

For the module's component directory, check:

| File | Required | Purpose |
|------|----------|---------|
| `content.tsx` | yes | Server component, fetches data |
| `actions.ts` | if has forms/mutations | Server actions with auth + validation |
| `validation.ts` | if has actions | Zod schemas |
| `form.tsx` | if has create/edit | Client component with controlled inputs |
| `columns.tsx` | if has table | Column definitions with useMemo |
| `table.tsx` | if has list view | Data table component |
| `authorization.ts` | optional | RBAC permission checks |
| `queries.ts` | optional | Reusable database queries |

#### 6c. Record Results

For each module:
- `status`: `pass` (all required files present), `warn` (missing optional files), `fail` (missing required files)
- `details.missingRequired`: list of missing required files
- `details.missingOptional`: list of missing optional files
- `details.mirrorMapped`: boolean (component directory matches route)

**SAVE LEDGER after each module.**

This command is REPORT-ONLY — it does not create files. It identifies gaps for the developer to address.

### Step 7: Report

```
Structure Coverage — hogwarts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 441 routes | 18 modules | Conforming: 12 | Issues: 6

Module          Routes  page  content  actions  validation  form  Status
auth               7     7/7    5/7      3/7       3/7      2/7   WARN
admission          4     4/4    4/4      4/4       4/4      2/4   PASS
finance           74    74/74  60/74    45/74     40/74    30/74   WARN
...

Missing required files:
1. src/components/platform/finance/budget/ — missing content.tsx
2. src/components/platform/attendance/geo/ — missing actions.ts, validation.ts
...
```

### Step 8: Update Cross-Product Index
