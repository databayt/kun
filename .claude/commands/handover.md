# Handover — Pre-Demo Quality Pass

Multi-pass Playwright QA for "before client demo." Heavier than `/check`, lighter than a release. Scoped to a feature block.

Use this when a feature is "done" and you want it inspected at three breakpoints, in both languages, with the console clean and translations complete — the things a client will notice five minutes in.

## Usage
- `/handover admission` — full pass against the admission block
- `/handover admission --env staging` — run against `ed.databayt.org` instead of localhost
- `/handover admission --pass responsive` — single pass (bug-free, flow, responsive, rtl, translation)

## Argument: $ARGUMENTS

## Instructions

### Phase 1 — Discover routes

Scope to the block argument:

```bash
find src/app -name "page.tsx" -not -path "*/node_modules/*" | sort
```

Group by extracting the first meaningful path segment after stripping route groups `(parentheses)`, `[lang]`, `s`, and `[subdomain]`. Filter to routes whose group matches the `[block]` argument (fuzzy match).

If zero routes match, stop and ask the user to confirm the block name.

### Phase 2 — Pre-flight

1. Ensure the dev server is running on port 3000 (default) or that the `--env` flag points at a reachable URL
2. Reuse `browser-headed` MCP — this is meant to be watched, not headless
3. Resize: 375 (mobile), 768 (tablet), 1440 (desktop)
4. Create the report directory: `.claude/handover-reports/<block>-<YYYYMMDD-HHmm>/`

### Phase 3 — Five passes per route

For each discovered route, run the passes below. Save screenshots to the report directory. Tag each verdict `PASS`, `WARN`, or `FAIL`.

#### Pass 1 — Bug-free
- `browser_navigate` to the route
- Wait for load, then `browser_console_messages`
- `FAIL` if any console error (red). `WARN` if any failed network request. `PASS` otherwise.

#### Pass 2 — Flow
- `browser_snapshot` and identify the primary interaction (form, button, link)
- Drive the happy path: click → type → submit. Verify the post-state (toast, navigation, data row)
- `FAIL` if the primary flow does not complete. `PASS` if it lands on the expected state.

#### Pass 3 — Responsive
- `browser_resize` to 375, then 768, then 1440
- `browser_take_screenshot` at each
- Visually compare: no horizontal scroll, no overlapping elements, no truncated text on mobile
- `FAIL` on overflow or broken layout. `WARN` on minor visual issues.

#### Pass 4 — RTL + i18n
- Navigate to the `/ar/` version of the route
- Verify logical properties flip: spacing, alignment, icon direction
- Check that LTR-exempt elements (phone numbers, emails, code blocks) stay LTR
- `FAIL` if layout does not mirror or if Arabic text is cut off

#### Pass 5 — Translation
- Grep the route's component files for hardcoded English (use the patterns below)
- Confirm every dictionary key referenced resolves in both `dictionaries/en.json` and `dictionaries/ar.json`
- `FAIL` on missing keys. `WARN` on hardcoded strings.

Hardcoded-string patterns (apply to `.tsx` files under the block):
```
<FormLabel>[A-Za-z][^{<]+</FormLabel>
toast\.(success|error|warning|info)\(["'][A-Za-z]
<Button[^>]*>[A-Za-z][^{<]+</Button>
placeholder=["'][A-Z][^"'{]+["']
```

### Phase 4 — Report

Write `report.md` to the report directory:

```
## Handover — <block> — <timestamp>
Environment: <localhost:3000 | ed.databayt.org>
Routes inspected: N

| Route | Bug-free | Flow | Responsive | RTL | Translation |
|---|---|---|---|---|---|
| /admission | PASS | PASS | WARN | PASS | FAIL (3 keys) |
| /admission/[id] | PASS | PASS | PASS | PASS | PASS |
...

Verdict: BLOCKED (1 FAIL, 2 WARN)

## Findings
- /admission @ 375px: form overflows on the right
- /admission translation: "Submit application" hardcoded (form.tsx:42, footer.tsx:18, button.tsx:31)
...

Screenshots: .claude/handover-reports/<block>-<timestamp>/
```

### Phase 5 — Fix loop (optional)

If the user runs `/handover <block> --fix`, attempt automated fixes for WARN/FAIL:
- Translation FAIL → replace hardcoded strings with dictionary keys, add to en.json + ar.json
- RTL FAIL → swap physical Tailwind classes (`ml-`, `pr-`) for logical (`ms-`, `pe-`)
- Bug-free FAIL → triage the console error, classify, fix or surface for user

Do **not** auto-fix Flow or Responsive failures — those need human judgment.

After fixes, re-run the affected passes only. Append a "Fix round N" section to the report.

## Exit gate

- All five passes report PASS or WARN on every route in the block
- Zero FAIL verdicts
- Verdict: `READY FOR DEMO`

If any FAIL persists after `--fix`: surface the blocking issues with file:line references and stop.

## When to use

- Before a scheduled client demo (King Fahad, Ahmed Baha, etc.)
- Before merging a large block to `main`
- After a refactor that touched routing, layouts, or i18n
- When you suspect a regression but cannot pinpoint it

Not a replacement for `/check`. Run `/check` first to confirm the code compiles; run `/handover` to confirm it behaves.
