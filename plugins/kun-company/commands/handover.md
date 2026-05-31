---
description: UI verification — runs niche quality keywords on a URL or block
argument-hint: <url>|<block> [--env staging] [--fix]
---

# Handover — UI Verification

Run the niche quality keywords against a route or every route in a block. Composes — does not redefine — the per-URL checks the `quality` agent already owns.

`/handover` has two modes, detected by argument shape:

- **URL mode** — argument starts with `/`. Runs the 12 per-URL niche keywords (browser 6 + code 6) on that route. _Replaces the old `qa <url>` orchestrator._
- **Block mode** — argument is a bare word. Runs the per-route subset (`debug`, `flow`, `responsive`, `lang`) on every route discovered in the block.

## Usage

- `/handover /admission/new` — URL mode: 12 niche checks on one URL
- `/handover admission` — block mode: per-route niche checks on the admission block
- `/handover admission --env staging` — block mode against `ed.databayt.org`
- `/handover admission --fix` — auto-fix the safe categories (translation, RTL classes)

## Argument: $ARGUMENTS

## Instructions

### Phase 1 — Detect mode

If `$ARGUMENTS` begins with `/` → URL mode. Skip to Phase 2A.
Otherwise → block mode. Continue to Phase 2B.

### Phase 2A — URL mode

Run the 12 per-URL niche keywords (browser 6 + code 6) defined in `.claude/agents/quality.md`:

- Browser: `see`, `flow`, `debug`, `responsive`, `lang`, `fast`
- Code: `guard`, `architecture`, `structure`, `pattern`, `design`, `stack`

For each keyword, invoke the keyword's own definition. Collect verdicts (PASS / WARN / FAIL).

Output a verdict table:

```
URL: /admission/new
├── see ............. PASS
├── flow ............ PASS
├── debug ........... PASS (0 console errors)
├── responsive ...... WARN (form overflows at 375px)
├── lang ............ FAIL (3 untranslated keys)
├── fast ............ PASS (LCP 1.8s)
├── guard ........... PASS
├── architecture .... PASS
├── structure ....... PASS
├── pattern ......... PASS
├── design .......... PASS
└── stack ........... PASS

Result: 10/12 PASS, 1 WARN, 1 FAIL
```

Stop here. URL mode does not write a sentinel — it's a spot-check.

### Phase 2B — Block mode

**Discover routes** in the block:

```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | sort
```

Group by stripping route groups `(parens)`, `[lang]`, `s`, `[subdomain]`. Filter to routes whose group matches the `[block]` argument (fuzzy).

Stop and ask if zero routes match.

**Pre-flight:**

- Ensure dev server is running on port 3000 (default) or `--env` target is reachable
- Create the report directory: `.claude/handover-reports/<block>-<YYYYMMDD-HHmm>/`

**For each route, run the per-route niche subset:**

| Pass | Niche keyword                | What it does                                                     |
| ---- | ---------------------------- | ---------------------------------------------------------------- |
| 1    | `debug`                      | Console + network — fail on errors, warn on failed requests      |
| 2    | `flow`                       | Primary interaction — click, type, submit, verify post-state     |
| 3    | `responsive`                 | 375 / 768 / 1440 breakpoints — fail on overflow or broken layout |
| 4    | `lang` (RTL portion)         | `/ar/` variant — verify logical-property flip, LTR exemptions    |
| 5    | `lang` (translation portion) | Hardcoded-string scan + dictionary key resolution                |

These keywords are defined in `.claude/agents/quality.md`. Block mode invokes each keyword per route — it does not redefine the check logic here.

### Phase 3 — Report

Write `report.md` to the report directory:

```
## Handover — <block> — <timestamp>
Mode: block | URL
Environment: <localhost:3000 | ed.databayt.org>
Routes inspected: N

| Route | debug | flow | responsive | lang (RTL) | lang (translation) |
|---|---|---|---|---|---|
| /admission | PASS | PASS | WARN | PASS | FAIL (3 keys) |
| /admission/[id] | PASS | PASS | PASS | PASS | PASS |
...

Verdict: BLOCKED (1 FAIL, 2 WARN)

## Findings
- /admission @ 375px: form overflows on the right (responsive)
- /admission: "Submit application" hardcoded (form.tsx:42, footer.tsx:18, button.tsx:31)
```

### Phase 4 — Fix loop (optional, `--fix`)

Auto-fix the safe categories — each delegated to the niche keyword that defined the rule:

- `lang` FAIL → replace hardcoded strings with dictionary keys (translation portion)
- `lang` (RTL) FAIL → swap physical Tailwind classes (`ml-`, `pr-`) for logical (`ms-`, `pe-`)
- `debug` FAIL → triage the console error and surface it for human judgment

`flow` and `responsive` failures stay manual — they need human judgment.

After fixes, re-run the affected passes only. Append a "Fix round N" section to the report.

### Phase 5 — Sentinel (block mode only)

On overall PASS or WARN (no FAIL), write to `.claude/session-state.json`:

```json
{
  "handover": {
    "scope": "block",
    "block": "<block>",
    "status": "PASS",
    "at": "<ISO timestamp>"
  }
}
```

`/release` reads this sentinel and skips Stage 1 if recent (within 10 minutes).

## Exit gate

- Every route reports PASS or WARN across all niche checks
- Zero FAIL verdicts
- Verdict: `READY FOR DEMO`

If any FAIL persists after `--fix`: surface the blocking findings with file:line references and stop.

## When to use

- **URL mode** — quick spot-check on one route: "is this URL clean across all 12 dimensions?"
- **Block mode** — before a client demo: "is the whole admission feature ready to show?"
- Before merging a large block to `main`
- After a refactor that touched routing, layouts, or i18n

Not a replacement for `/check`. `/check` is the typecheck + build gate; `/handover` is the UI verification gate. Both feed `/release`.
