---
name: Clone (URL mirror)
description: Mirror a live URL section's DOM + exact computed styles into the house stack (Next 16 / React 19 / Tailwind v4 / shadcn-ui), pixel-exact, RTL-ready. Deterministic Playwright capture; tiered-model Workflow for translate/reconcile/land.
argument-hint: "<url> [section text] [--pick] [--devtools] [--into atom|template|block]"
model: claude-opus-4-8
allowed-tools:
  [
    "Bash(node *)",
    "Bash(npx playwright *)",
    "Bash(npm *)",
    "Bash(pnpm *)",
    "Bash(ls *)",
    "Bash(cat *)",
    "Bash(grep *)",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "Agent",
    "Workflow",
    "mcp__browser__*",
    "mcp__browser-headed__*",
    "mcp__chrome-devtools__*",
    "mcp__shadcn__*",
    "mcp__tailwind__*",
  ]
---

# Clone — live-URL section mirror

Point at a live URL and faithfully reproduce a section in the house stack — **pixel-exact**.
Replaces the manual "open Inspect, copy HTML + computed styles, rebuild by hand" loop with a
deterministic capture + a tiered-model translate. The capture spends **zero model tokens**;
only translate (Opus) and reconcile (Sonnet) cost reasoning.

> **Don't set `/effort max` for clone.** The Workflow already pins Opus·high on translate
> (the only fidelity-critical phase) and Sonnet·medium/low on the rest. A session-wide `max`
> just inflates the cost of the deterministic capture + orchestration glue — the exact tax this
> design removes. Leave session effort at its default; the per-phase tiers do the right thing.

This is the url-mode of `/clone`. (Source-mode — Figma/GitHub/shadcn/codebase — stays in the
command.) Invoked when the argument is a non-Figma `http(s)://` URL.

## Argument: $ARGUMENTS

Parse: the URL; an optional **section name** (heading/copy text to target); flags `--pick`,
`--devtools`, `--into atom|template|block`.

## Process

### 1. Setup

- Derive `<slug>` = `<host>-<section|page>`. Snapshot dir = `<repoRoot>/.clone/<slug>/`.
- Ensure `.clone/` is gitignored (append if missing — it's scratch, never committed).
- Choose browser mode: default headless; use **`--devtools`** (real Chrome via chrome-devtools
  MCP) when the section is behind a login or a value won't reproduce and you need the network/
  cascade. Use **`--pick`** when the user wants to click the element instead of naming it.

### 2. Capture — deterministic, no model

Run the capture script. Playwright resolves from the global `@playwright/mcp` (zero install on
the kun default); on a bare machine run the one-time bootstrap first:
`(cd ~/.claude/skills/clone/scripts && npm run bootstrap)`.

```bash
node ~/.claude/skills/clone/scripts/clone-capture.mjs \
  --url "<url>" --out "<repoRoot>/.clone/<slug>" \
  [--section "<heading/copy text>"] [--pick] [--devtools] \
  --breakpoints 375,768,1440
```

Section selection (most → least automated, per the user's preference):

- **No section** → full-page capture; the script writes `sections.json` (heading-anchored,
  script-stripped — usable even on pages that wrap everything in one `<main>` child). Show the
  user that index (headings + sample copy) and let them **name** the section. Then re-run with
  `--section "<their text>"` for a focused snapshot.
  - **A full page is NOT one clone unit.** If `manifest.capped === true` (the page exceeded the
    node cap — typical for store/marketing pages), do **not** translate the whole page. Present
    the section index and clone **one section at a time** (`--section`), each landing as its own
    atom/template. A focused section stays well under the cap and yields a faithful component;
    the whole page in one translate does not.
- **`--section "<text>"`** → resolves the smallest element containing the copy/heading, climbs
  to the nearest semantic ancestor.
- **`--pick`** → opens a **headed** browser; hover highlights, click selects (the watchable
  mode the user asked to see).

Confirm the snapshot: `manifest.json`, `dom.html`, `styles.json` (≈10–25 exact props/node),
`tokens.json`, `shots/{375,768,1440}.png`, `assets/`. The script prints a tight JSON summary
(node count, palette, font, spacing scale, sections) — read that, not the raw files.

### 3. Translate → Reconcile → Land — tiered model + effort (Workflow)

Hand the snapshot to the clone Workflow. It sets model + effort **per phase** (the only
mechanism that controls both) so the blanket Opus-max tax is gone:

| Phase     | Model  | Effort | Work                                                           |
| --------- | ------ | ------ | -------------------------------------------------------------- |
| Translate | opus   | high   | DOM + exact styles → pixel-exact JSX (`clone` agent)           |
| Reconcile | sonnet | medium | render on port 3000, screenshot ×3, diff vs `shots/`, fix loop |
| Land      | sonnet | low    | place into atom/template/block, `pnpm build`, report           |

```
Workflow({
  scriptPath: "~/.claude/skills/clone/scripts/clone.workflow.mjs",
  args: { snapshotDir: "<abs path to .clone/<slug>>", into: "<atom|template|block|auto>", repoRoot: "<abs repo root>" }
})
```

The Workflow runs in the background and notifies on completion. (Invoking a Workflow is the
multi-agent opt-in — it's intrinsic to this skill's tiered design, not a separate ask.)

### 4. Report

Relay the Workflow result: final component path + level, build pass/fail, whether all 3
breakpoints matched, exact-value class count, fonts substituted, any token equivalences worth
adopting later, and any unresolved diffs. The `.clone/<slug>` snapshot stays as the scratch record.

## Exit Gate

`pnpm build` passes **and** reconcile reports all 3 breakpoints (375/768/1440) within tolerance.

## Notes

- **Port 3000 only** for the reconcile dev server — never switch ports.
- **Pixel-exact** means arbitrary Tailwind values from `getComputedStyle`, not token-snapping.
  The one idiomatic concession is logical RTL properties (lossless in LTR).
- chrome-devtools MCP is the `--devtools` escalation (logins, network waterfall, CSS cascade),
  not the default capture path — the headless script is.
