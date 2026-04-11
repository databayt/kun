# Universal Sweep Protocol

Every sweep-capable keyword follows this same protocol. The keyword registry (`keywords.json`) defines what to check. This protocol defines how to sweep.

## Protocol Steps

### Step 1: Identify Product and Scope

Detect product from cwd:
- `/Users/abdout/hogwarts` → hogwarts
- `/Users/abdout/souq` → souq
- `/Users/abdout/mkan` → mkan
- `/Users/abdout/shifa` → shifa

If arguments contain a block name (e.g., `admission`, `finance`), scope to that block only.
If arguments contain `--status`, skip to Step 7 (report only).

### Step 2: Discover Routes

Run via Bash:
```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | sort
```

Group routes into modules by extracting the module name from the path:
- Strip route groups `(parentheses)`, `[lang]`, `s`, `[subdomain]`
- Take the first meaningful directory segment

If a block name was specified, filter to modules matching that name (fuzzy).

### Step 3: Load Ledger

Read `.claude/coverage/ledger.json` from the product repo.
Initialize the keyword's sweep entry if first run.

### Step 4: Detect Drift

For previously-checked routes:
1. File still exists? If not → `removed`
2. `git hash-object <file>` matches stored hash? If not → `stale`

New routes not in ledger → `unchecked`.

### Step 5: Plan Batches

Sort modules:
1. Modules with `stale` or `unchecked` routes first
2. Smallest modules first (quick wins)
3. Skip `complete` modules

Output the plan before starting:
```
<Keyword> Sweep — <product>
Modules to process: N
Routes to check: X (of Y total, Z already passing)
```

### Step 6: Execute (Module by Module)

For each module:

#### Code Method (`method: "code"`)
1. Identify all files to scan:
   - Route files: `page.tsx`, `layout.tsx`, `loading.tsx` in `src/app/`
   - Component files: all `.tsx` in the mirror component directory (`src/components/`)
   - Data files: `actions.ts`, `validation.ts`, `queries.ts`
2. Run grep patterns from keywords.json against these files
3. For fix-capable keywords: apply fixes. For report-only: log findings.
4. Record per-route result: `pass`, `warn`, `fail`
5. **SAVE LEDGER after each module** — this is the resume point

#### Browser Method (`method: "browser"`)
1. Ensure dev server running on port 3000
2. For each route (batch of 5-10):
   a. Navigate to the URL
   b. Take screenshot
   c. Evaluate against criteria
3. Record results
4. **SAVE LEDGER after each batch**

#### File Check Method (`checkType: "sibling_file"` or `"file_convention"`)
1. Check for expected files alongside or mirroring each route
2. Create missing files if the keyword's `fixAction` allows
3. Record results
4. **SAVE LEDGER after each module**

### Step 7: Report

```
<Keyword> Coverage — <product>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: N routes | Checked: X | Pass: P | Warn: W | Fail: F

Module          Routes  Checked  Pass  Warn  Fail  Status
<module>           N      N/N     N     N     N    PASS/WARN/FAIL
...

Top issues:
1. file:line — description
...

Progress: ████████████████████░ XX%
```

### Step 8: Update Cross-Product Index

Write summary to `~/.claude/memory/coverage-index.json`.

## Resume Behavior

When running a keyword again after interruption:
1. Load ledger → identify complete modules
2. Skip complete modules
3. Continue from next unchecked module
4. Process remaining

## Key Rules

- **Never skip a module** — the point is 100% coverage
- **Save after each module** — crash resilience
- **Fix what you can** — some keywords fix (translate, skeleton), others report (structure, guard)
- **Drift is automatic** — modified files get re-checked on next run
