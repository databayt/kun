# Skeleton — Full Coverage Loading State Sweep

Systematically check every page directory has a `loading.tsx` with proper Skeleton components. Creates missing loading files.

## Usage

- `skeleton` — sweep ALL routes in current product
- `skeleton admission` — sweep only the admission block
- `skeleton --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

### Step 1: Identify Product and Scope

Detect product from cwd. If `$ARGUMENTS` contains a block name, scope to that block. If `--status`, skip to Step 7.

### Step 2: Discover Routes

```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | sort
```

Group by module (same logic as translate command).

### Step 3: Load Ledger

Read `.claude/coverage/ledger.json`. Initialize `skeleton` sweep entry if first run:
```json
{
  "skeleton": {
    "lastSweepAt": null,
    "progress": { "total": 0, "checked": 0, "pass": 0, "warn": 0, "fail": 0, "unchecked": 0 },
    "modules": {}
  }
}
```

### Step 4: Detect Drift

Compare current routes vs ledger manifest. Mark new routes `unchecked`, modified routes `stale`, deleted routes `removed`.

### Step 5: Plan Batches

Sort modules: unchecked/stale first, smallest first.

### Step 6: Execute (Module by Module)

For each page.tsx file in the module:

#### 6a. Check for loading.tsx Sibling

Look in the same directory as page.tsx for a `loading.tsx` file.

**Exceptions — skip these directories:**
- `(auth)/` routes (login, register — too simple for skeletons)
- Root `page.tsx` (marketing homepage)
- API routes (`route.ts`)
- Pages with only static content (no data fetching)

#### 6b. Create Missing loading.tsx

If no loading.tsx exists and the page fetches data:

1. Read the page.tsx to understand its layout structure
2. Create a loading.tsx that mirrors the layout with Skeleton components:
   ```tsx
   import { Skeleton } from "@/components/ui/skeleton"

   export default function Loading() {
     return (
       <div className="space-y-4 p-6">
         <Skeleton className="h-8 w-48" />
         <Skeleton className="h-[400px] w-full" />
       </div>
     )
   }
   ```
3. Match the page's actual layout — if it has a header + table, skeleton should have header skeleton + table skeleton

#### 6c. Verify and Record

After processing each route:
- `status`: `pass` (loading.tsx exists), `warn` (created new one), `fail` (couldn't determine layout), `skip` (exception)
- `details.hasLoading`: boolean
- `details.created`: boolean (true if we created it this run)

**SAVE LEDGER after each module.**

### Step 7: Report

```
Skeleton Coverage — hogwarts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 441 routes | Has loading.tsx: 380 | Created: 45 | Skipped: 16

Module          Routes  Has Loading  Created  Skipped
auth               7        0          0        7 (exception)
admission          4        2          2        0
finance           74       60         14        0
...
```

### Step 8: Update Cross-Product Index

Write summary to `~/.claude/memory/coverage-index.json`.
