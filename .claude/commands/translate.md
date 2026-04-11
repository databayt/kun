# Translate — Full Coverage Translation Sweep

Systematically find and fix every hardcoded English string across the entire app or a specific block.

## Usage

- `translate` or `translation` — sweep ALL routes in current product, fix everything
- `translate admission` — sweep only the admission block
- `translate --status` — show current coverage without processing

## Arguments: $ARGUMENTS

## Protocol

### Step 1: Identify Product and Scope

Detect product from cwd:
- `/Users/abdout/hogwarts` → hogwarts
- `/Users/abdout/souq` → souq
- `/Users/abdout/mkan` → mkan
- `/Users/abdout/shifa` → shifa

If `$ARGUMENTS` contains a block name (e.g., `admission`, `finance`, `attendance`), scope the sweep to just that block.
If `$ARGUMENTS` is `--status`, skip to Step 7 (report only).

### Step 2: Discover Routes

Run via Bash:
```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | sort
```

Group routes into modules by extracting the module name from the path:
- `src/app/[lang]/(auth)/login/page.tsx` → module: `auth`
- `src/app/[lang]/s/[subdomain]/(school-dashboard)/admission/...` → module: `admission`
- `src/app/[lang]/s/[subdomain]/(school-dashboard)/(listings)/students/...` → module: `students`
- `src/app/[lang]/s/[subdomain]/(school-dashboard)/finance/...` → module: `finance`
- `src/app/[lang]/(saas-dashboard)/...` → module: `saas-dashboard`
- `src/app/[lang]/(saas-marketing)/...` → module: `saas-marketing`

Module extraction rule: take the first meaningful directory segment after removing route groups `(parentheses)`, `[lang]`, `s`, and `[subdomain]`.

If a block name was specified, filter to only modules whose name contains the block name (fuzzy match).

### Step 3: Load Ledger

Read `.claude/coverage/ledger.json` from the product repo.

If the file has no sweeps data (first run), initialize the `translation` sweep entry:
```json
{
  "translation": {
    "lastSweepAt": null,
    "progress": { "total": 0, "checked": 0, "pass": 0, "warn": 0, "fail": 0, "unchecked": 0 },
    "modules": {}
  }
}
```

Update the manifest section with the fresh route discovery from Step 2.

### Step 4: Detect Drift

For each route already in the ledger:
1. Check if the file still exists → if not, mark as `removed`
2. Run `git hash-object <file>` and compare to stored `gitHash` → if different, mark as `stale`

New routes (in manifest but not in ledger) → mark as `unchecked`.

### Step 5: Plan Batches

Sort modules for processing:
1. Modules with `stale` or `unchecked` routes first
2. Smallest modules first (quick wins build momentum)
3. Already-complete modules are skipped

For each module, identify all component files to scan:
- The page.tsx file itself
- All .tsx files in the corresponding component directory (mirror pattern)
  - Route: `src/app/[lang]/s/[subdomain]/(school-dashboard)/admission/page.tsx`
  - Components: `src/components/platform/admission/**/*.tsx` (or similar)
- Also check the module's layout.tsx if it exists

Output the batch plan before starting:
```
Translation Sweep — hogwarts
Modules to process: 18
Routes to check: 321 (of 441 total, 120 already passing)

1. auth (7 routes) — unchecked
2. admission (4 routes) — 2 stale, 2 unchecked
3. parent (3 routes) — unchecked
...
18. finance (74 routes) — unchecked

Starting...
```

### Step 6: Execute (Module by Module)

For each module in the batch plan:

#### 6a. Scan for Hardcoded Strings

Use Grep to search all .tsx files in the module for these patterns (from keywords.json):

1. `<FormLabel>[A-Za-z][^{<]+</FormLabel>` — hardcoded form labels
2. `toast\.(success|error|warning|info)\(["'][A-Za-z]` — hardcoded toasts
3. `<Button[^>]*>[A-Za-z][^{<]+</Button>` — hardcoded buttons
4. `placeholder=["'][A-Z][^"'{]+["']` — hardcoded placeholders
5. `error:\s*["'][A-Z]` — hardcoded error returns
6. `label:\s*["'][A-Z]` — hardcoded select labels
7. `\.(min|max|email|url|regex|refine)\([^)]*["'][A-Z]` — hardcoded Zod messages
8. `(title|name|description|label|body)(Ar|En|Arabic|English)\b` — bilingual field names

Skip files in: `dictionaries/`, `__tests__/`, `.test.`, `.spec.`, `node_modules/`

#### 6b. Fix Each Match

For each hardcoded string found:

1. **Determine the dictionary section** — use the module name (e.g., `admission`, `attendance`)
2. **Generate a key name** — camelCase from the string content (e.g., "Quick Actions" → `quickActions`)
3. **Add to both dictionaries**:
   - Add English value to the appropriate `en.json` or module dictionary `dictionaries/en/<module>.json`
   - Add Arabic translation to `ar.json` or `dictionaries/ar/<module>.json`
4. **Replace in the component**:
   - FormLabel: `<FormLabel>{d?.module.keyName}</FormLabel>`
   - Toast: use `ToastHelper` from `@/components/internationalization/helpers`
   - Button: `<Button>{d?.module.keyName}</Button>`
   - Placeholder: `placeholder={d?.module.keyName}`
   - Error: use `ErrorHelper`
   - Zod: use `ValidationHelper`

Reference: `.claude/rules/translation.md` and `.claude/agents/i18n.md` for correct fix patterns.

#### 6c. Verify and Record

After fixing all files in the module:

1. Run `pnpm tsc --noEmit` on the changed files to verify no type errors
2. If type errors, fix them before proceeding
3. Record per-route result in the ledger:
   - `status`: `pass` (0 hardcoded strings), `warn` (had strings, now fixed), `fail` (couldn't fix)
   - `checkedAt`: current ISO timestamp
   - `gitHash`: result of `git hash-object <file>` after fixes
   - `details.hardcodedStrings`: count found before fix
   - `details.fixed`: count successfully fixed

4. **SAVE LEDGER** — write `.claude/coverage/ledger.json` after EACH module completes. This is the resume point. If interrupted, the next run will skip completed modules.

Output module result:
```
[2/18] admission — 4 routes, 8 strings found, 8 fixed ✓
```

### Step 7: Report

After all modules are processed (or for `--status` flag), output the summary:

```
Translation Coverage — hogwarts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 441 routes | Checked: 441 | Pass: 420 | Warn: 21 | Fail: 0

Module          Routes  Status   Hardcoded  Fixed
auth               7   PASS          0       0
admission          4   PASS          8       8
attendance        23   PASS         12      12
finance           74   WARN         45      40
exams             55   PASS         30      30
...

Remaining issues (5 files):
1. src/components/platform/finance/payroll/slip.tsx:42 — "Net Pay" (complex template literal)
2. ...

Progress: ████████████████████░ 95.2%
```

### Step 8: Update Cross-Product Index

Write summary to `~/.claude/memory/coverage-index.json`:
```json
{
  "products": {
    "hogwarts": {
      "totalRoutes": 441,
      "keywords": {
        "translation": { "checked": 441, "pass": 420, "warn": 21, "fail": 0 }
      }
    }
  }
}
```

## Resume Behavior

When running `translate` again after an interruption:
1. Load ledger → see which modules have `status: "complete"`
2. Skip complete modules
3. If a module has `status: "in_progress"`, check which routes were recorded → continue from the next unrecorded route
4. Process remaining modules

## Important Notes

- **Never skip a module** — the whole point is 100% coverage
- **Save after each module** — crash resilience is critical
- **Fix, don't just report** — this command finds AND fixes hardcoded strings
- **Arabic translations** — use clear, professional Arabic. When unsure, add `TODO_TRANSLATE` as the Arabic value for Samia's review
- **Dictionary structure** — follow the existing dictionary loading pattern from `src/components/internationalization/dictionaries.ts`
- **Type safety** — ensure dictionary access matches the TypeScript `Dictionary` type. See `.claude/skills/dictionary-validator.md`
