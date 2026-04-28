---
name: coverage
description: Coverage — Keyword Coverage Report
---

# Coverage — Keyword Coverage Report

Show current coverage status across products and keywords. Reads from the coverage ledger without making changes.

## Usage

- `coverage` — cross-product summary (all products, all keywords)
- `coverage hogwarts` — all keywords for hogwarts
- `coverage hogwarts translation` — detailed per-module breakdown for translation in hogwarts

## Arguments: $ARGUMENTS

## Protocol

### Parse Arguments

- No args → cross-product summary
- One arg → product name (hogwarts, souq, mkan, shifa)
- Two args → product + keyword (translation, skeleton, structure, guard, rtl, pattern)

### Mode 1: Cross-Product Summary (no args)

Read `~/.claude/memory/coverage-index.json`.

If empty or missing, scan for ledger files:
- `/Users/abdout/hogwarts/.claude/coverage/ledger.json`
- `/Users/abdout/souq/.claude/coverage/ledger.json`
- `/Users/abdout/mkan/.claude/coverage/ledger.json`
- `/Users/abdout/shifa/.claude/coverage/ledger.json`

Output:
```
Coverage Summary — All Products
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Product   Routes  translation  skeleton  structure  guard  rtl  pattern
hogwarts    441    280/441      0/441     0/441     0/441  --    --
souq         --    --           --        --        --     --    --
mkan         --    --           --        --        --     --    --
shifa        --    --           --        --        --     --    --

Legend: checked/total | -- = no ledger | code = grep-based | browser = screenshot-based
```

### Mode 2: Product Overview (one arg)

Read `<product>/.claude/coverage/ledger.json`.

If no ledger exists, report:
```
No coverage data for <product>. Run a keyword sweep first:
  translate          — translation coverage
  skeleton           — loading state coverage
  structure          — file convention coverage
```

If ledger exists, show all keywords:
```
Coverage — hogwarts (441 routes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Keyword       Checked   Pass   Warn   Fail   Last Run
translation   280/441   250    20     10     2026-04-08
skeleton        0/441     0     0      0     never
structure       0/441     0     0      0     never
guard           0/441     0     0      0     never

Run: translate, skeleton, structure, guard to start sweeping.
```

### Mode 3: Detailed View (product + keyword)

Read the specific keyword's sweep data from the ledger.

First, re-discover current routes to check for drift:
```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | wc -l
```

Compare current route count to ledger's manifest. Flag if different.

Output detailed per-module breakdown:
```
Coverage — hogwarts — translation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: 441 routes | Checked: 280 (63%) | Pass: 250 | Warn: 20 | Fail: 10
Drift: 3 new routes since last sweep

Module           Routes  Checked  Pass  Warn  Fail  Status
auth                 7      7/7     7     0     0   complete
admission            4      4/4     3     1     0   complete
attendance          23    20/23    18     2     0   in_progress
finance             74     0/74     0     0     0   unchecked
exams               55     0/55     0     0     0   unchecked
students            19    19/19    15     4     0   complete
teachers            16    16/16    14     2     0   complete
...

Stale routes (modified since last check): 5
  src/app/[lang]/s/.../admission/settings/page.tsx (checked 2 days ago, modified today)
  ...

Top issues:
1. src/components/platform/students/form.tsx — 4 hardcoded strings
2. src/components/platform/attendance/manual/form.tsx — 3 hardcoded strings
3. ...

Next action: Run `translate` to process remaining 161 unchecked routes.
```

## Notes

- This command is READ-ONLY — it never modifies code or the ledger
- If a ledger exists but is outdated (drift detected), flag it but don't auto-fix
- Show progress bars where possible for visual clarity
- For keywords with `method: "browser"`, note that those require a running dev server
