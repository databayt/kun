---
description: Clone a pattern/component from a source repo OR mirror a live URL section pixel-exact
argument-hint: <url|figma|github:|shadcn:|codebase:|pattern:> [section|target] [--pick] [--devtools] [--into atom|template|block]
---

# Clone

Polymorphic. Two families of source:

- **Live URL** (any non-Figma `http(s)://`) → **url-mode**: deterministically capture a section's
  DOM + exact computed styles and mirror it **pixel-exact** into the house stack. Replaces the
  manual Inspect-and-rebuild loop. Handled by the `clone` skill.
- **Source-to-code** (Figma / GitHub / shadcn / codebase / pattern) → adapt existing code/design.

## Arguments

- `$1`: Source — a live URL, a figma URL, `github:owner/repo/path`, `shadcn:component`,
  `codebase:path`, or `pattern:keyword`
- `$2`: (optional) For url-mode: the **section** name (heading/copy text) to target, or a target
  path. For source-mode: target path for generated code.
- Flags (url-mode): `--pick` (click the section in a headed browser), `--devtools` (real Chrome
  for logins / network / CSS cascade), `--into atom|template|block` (landing level).

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

## Process

**Mode detection** (check `$1` in this order):

1. `http(s)://` containing `figma.com` → Figma branch (below).
2. any other `http(s)://` → **url-mode**: invoke the `clone` skill.
3. `figma:` / `github:` / `shadcn:` / `codebase:` / `pattern:` / bare path → source branches.

### If source is a live URL (http/https, not figma.com):

Invoke the **`clone` skill** (`~/.claude/skills/clone/SKILL.md`), passing the URL, the optional
section text (`$2` when it isn't a path), and any flags (`--pick`, `--devtools`, `--into`). The
skill runs: Setup → deterministic Capture (`clone-capture.mjs`, zero model tokens) → tiered
Workflow (Translate Opus·high → Reconcile Sonnet·medium → Land Sonnet·low) → report. Pixel-exact
fidelity (arbitrary Tailwind values from `getComputedStyle`, logical RTL properties). Do not
hand-crawl or copy styles yourself — the skill + script own that.

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

Clone source: $ARGUMENTS
