---
name: clone
description: Clone a pattern/component from a source repo OR mirror a live URL section pixel-exact
when_to_use: "Use when reproducing something that already exists somewhere else — a live site section to mirror pixel-exact into the house stack (url-mode: deterministic Playwright capture → tiered Workflow), a Figma frame to implement, or code to adapt from github:/shadcn:/codebase:/pattern: sources. Triggers on: clone <url>, clone this section, make ours look like <site>, clone the figma design, clone shadcn:<component>, pattern:<keyword>. Distinct from /atom or /template (net-new components) — clone always starts from an existing source."
argument-hint: "<url|figma|github:|shadcn:|codebase:|pattern:> [section|target] [--pick] [--devtools] [--into atom|template|block]"
model: opus
---

# Clone

Polymorphic. Two families of source:

- **Live URL** (any non-Figma `http(s)://`) → **url-mode**: deterministically capture a section's
  DOM + exact computed styles and mirror it **pixel-exact** into the house stack. Replaces the
  manual Inspect-and-rebuild loop. Playbook below.
- **Source-to-code** (Figma / GitHub / shadcn / codebase / pattern) → adapt existing code/design.

## Argument: $ARGUMENTS

**Mode detection** (check `$1` in this order):

1. `http(s)://` containing `figma.com` → Figma branch (below).
2. any other `http(s)://` → **url-mode** playbook (below).
3. `figma:` / `github:` / `shadcn:` / `codebase:` / `pattern:` / bare path → source branches.

## Sources

### Live URL (pixel-exact section mirror)

```
/clone https://stripe.com                      # full page → name a section
/clone https://stripe.com "Pricing"            # target a section by heading/copy
/clone https://stripe.com --pick               # click the section in a headed browser
/clone https://linear.app "hero" --into atom   # land as an atom
/clone https://app.example.com/dash --devtools # logged-in page via real Chrome
```

### Figma (pixel-perfect design-to-code)

```
/clone https://figma.com/design/abc/File?node-id=1-234
/clone https://figma.com/design/abc/File?node-id=1-234 src/components/messaging/
```

### GitHub

```
/clone github:vercel/ai/examples/next-openai
/clone github:shadcn-ui/ui/apps/www/components/ui/button
```

### shadcn Registry

```
/clone shadcn:button
/clone shadcn:data-table
```

### Local Codebase

```
/clone codebase:src/components/atom/stat-card
/clone codebase:src/registry/new-york/templates/hero-01
```

---

## URL-mode playbook — live-URL section mirror

Point at a live URL and faithfully reproduce a section in the house stack — **pixel-exact**.
The capture spends **zero model tokens**; only translate (Opus) and reconcile (Sonnet) cost
reasoning.

> **Don't set `/effort max` for clone.** The Workflow already pins Opus·high on translate
> (the only fidelity-critical phase) and Sonnet·medium/low on the rest. A session-wide `max`
> just inflates the cost of the deterministic capture + orchestration glue — the exact tax this
> design removes. Leave session effort at its default; the per-phase tiers do the right thing.

Parse: the URL; an optional **section name** (heading/copy text to target); flags `--pick`,
`--devtools`, `--into atom|template|block`.

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

---

## Source-mode branches

### If source is a Figma URL (contains `figma.com`):

1. **Parse URL** — Extract `fileKey` and `nodeId` from the Figma URL:
   - `figma.com/design/:fileKey/:fileName?node-id=:nodeId` → convert `-` to `:` in nodeId
   - `figma.com/design/:fileKey/branch/:branchKey/:fileName` → use branchKey as fileKey

2. **Read design** — Call these tools in parallel:
   - `mcp__claude_ai_Figma__get_design_context` with fileKey, nodeId, clientFrameworks="react,nextjs", clientLanguages="typescript,css"
   - `mcp__claude_ai_Figma__get_screenshot` with fileKey, nodeId (visual reference)

3. **Extract tokens** — If the design uses variables:
   - `mcp__claude_ai_Figma__get_variable_defs` with fileKey, nodeId
   - Map Figma tokens to project tokens:
     - Colors → existing CSS variables (`--msg-*`, `--color-*`) or Tailwind tokens
     - Spacing → Tailwind spacing scale (p-4, gap-2, etc.)
     - Typography → project font variables (`--font-heading`, `--font-sans`)
     - Border radius → Tailwind rounded scale

4. **Check component mappings**:
   - `mcp__claude_ai_Figma__get_code_connect_map` — resolve Figma components to existing codebase imports
   - Prioritize: shadcn/ui primitives → atom compositions → new components

5. **Generate code** at target path (or infer from design context):
   - Use existing shadcn/ui primitives (Button, Avatar, Input, ScrollArea, Badge, etc.)
   - Compose into atoms when 2+ primitives combine
   - Tailwind CSS 4 classes with semantic tokens — NO hardcoded hex colors
   - RTL-first: logical properties only (`ms`, `me`, `ps`, `pe`, `start`, `end`)
   - Responsive: mobile-first breakpoints
   - Adapt the Figma output to match project patterns (not raw copy)

6. **Build check** — Run `pnpm build` to verify TypeScript compilation

7. **Visual verify** — If dev server is running:
   - Navigate browser to the page showing the component
   - Take screenshot of implementation
   - Compare side-by-side with Figma screenshot
   - Identify pixel differences (spacing, colors, sizing, alignment)

8. **Iterate** — Fix differences and repeat steps 7-8 until visually indistinguishable:
   - Color mismatch → check token mapping
   - Spacing mismatch → check Tailwind scale conversion
   - Layout mismatch → check flex/grid structure
   - Font mismatch → check font-family and weight

### If source starts with `pattern:`:

1. Read `.claude/patterns/registry.json`
2. Look up the keyword (e.g., `pattern:form` → keyword `form`)
3. Resolve to canonical repo + path (e.g., hogwarts → `src/components/form/`)
4. Read the pattern card at `.claude/patterns/cards/{keyword}.md` for context
5. Clone from the canonical local path: `/Users/abdout/{repo}/{path}`
6. Adapt imports: replace canonical repo paths with current project paths
7. Generalize tenant-specific code (e.g., `schoolId` → parameterized)
8. Apply project conventions (shadcn/ui, RTL-first, Tailwind CSS 4)

### If source is GitHub/shadcn/codebase:

1. Fetch source code
2. Analyze dependencies
3. Adapt imports to local structure
4. Apply project conventions (shadcn/ui, RTL-first, Tailwind CSS 4)
5. Update registry if component

## Exit Gate

- **url-mode**: `pnpm build` passes **and** the reconcile phase reports all 3 breakpoints
  (375 / 768 / 1440) within tolerance of the captured screenshots.
- **source-mode**: `pnpm build` passes; for Figma, the implementation is visually
  indistinguishable from the design screenshot.

## Notes (url-mode)

- **Port 3000 only** for the reconcile dev server — never switch ports.
- **Pixel-exact** means arbitrary Tailwind values from `getComputedStyle`, not token-snapping.
  The one idiomatic concession is logical RTL properties (lossless in LTR).
- chrome-devtools MCP is the `--devtools` escalation (logins, network waterfall, CSS cascade),
  not the default capture path — the headless script is.
- **Proprietary fonts can't pixel-match text wrapping.** When the source uses a closed font
  (Anthropic Sans, SF Pro, …), the nearest `next/font` substitute has different metrics, so
  line-count/wrapping can differ even when sizing, columns, and spacing are exact. This is a
  font artifact, not a structural miss — reconcile reports it and moves on; consumers wire the
  substituted `--font-*` variables on an ancestor.
