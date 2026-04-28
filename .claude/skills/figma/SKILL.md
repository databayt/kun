---
name: figma
description: Figma — Bidirectional Design Workflows
---

# Figma — Bidirectional Design Workflows

Pixel-perfect design-to-code and code-to-design bridge.

## Usage

```
/figma                         → Show connected projects, auth status
/figma <figma-url>             → Full design-to-code pixel-perfect workflow
/figma apple                   → Browse Apple Design Resources HIG kit
/figma mirror <url> <path>     → Compare implementation to design, auto-fix
/figma tokens <url>            → Extract and map design tokens
/figma connect <url>           → Set up Code Connect component mapping
/figma push <path>             → Write implementation back to Figma
/figma diagram <description>   → Generate FigJam diagram
```

## Argument: $ARGUMENTS

---

## Routing

### No arguments → Status

1. Call `mcp__claude_ai_Figma__whoami` to verify authentication
2. Read `~/.claude/memory/figma_projects.json` for registered projects
3. Display:
   - Auth status (connected/disconnected)
   - Table of registered projects with names and status (fileKey set or pending)
   - Quick commands: `/figma apple`, `/figma <product>`, `/figma <url>`

### Figma URL → Design-to-Code

Detect: argument contains `figma.com/`

1. **Parse URL** — extract fileKey and nodeId (convert `-` to `:` in nodeId)
   - `figma.com/design/:fileKey/:name?node-id=:nodeId` → standard
   - `figma.com/design/:fileKey/branch/:branchKey/:name` → use branchKey
   - `figma.com/make/:makeFileKey/:name` → Figma Make
   - `figma.com/board/:fileKey/:name` → FigJam, use `get_figjam`

2. **Read design** (parallel calls):
   ```
   mcp__claude_ai_Figma__get_design_context(fileKey, nodeId, clientFrameworks="react,nextjs", clientLanguages="typescript,css")
   mcp__claude_ai_Figma__get_screenshot(fileKey, nodeId)
   ```

3. **Extract tokens**:
   ```
   mcp__claude_ai_Figma__get_variable_defs(fileKey)
   ```
   Map to project CSS custom properties using `figma_projects.json` tokenMapping.

4. **Resolve components**:
   ```
   mcp__claude_ai_Figma__get_code_connect_map(fileKey)
   ```
   Priority: Code Connect → ui/ → atom/ → create new atom.

5. **Generate code** — shadcn/ui + Tailwind CSS 4 + TypeScript + RTL-first logical properties

6. **Build check** — `pnpm build` to verify no type/compilation errors

7. **Visual verify loop** (max 3 rounds):
   - Browser screenshot of implementation
   - Compare to Figma screenshot
   - Fix differences → re-screenshot → repeat until match

8. **Register Code Connect** — `add_code_connect_map` for new components

### `apple` → Apple Design Resources

1. Read `~/.claude/memory/figma_projects.json` → `projects.design-system[0]`
2. If `fileKey` is null:
   - Tell user: "Open your Apple Design Resources file in Figma and paste the URL here"
   - On URL received: extract fileKey, update memory, proceed
3. If `fileKey` exists:
   - Call `get_metadata(fileKey)` to browse available pages
   - Display navigation: iOS Components, SF Symbols, System Colors, Typography
   - User can drill into specific nodes

### `mirror <url> <path>` → Compare and Fix

1. Parse the Figma URL → get fileKey and nodeId
2. Take Figma screenshot: `get_screenshot(fileKey, nodeId)`
3. Start dev server if not running
4. Navigate browser to the local path, take implementation screenshot
5. Compare side-by-side: spacing, colors, typography, alignment, radius, shadows
6. List differences with severity (critical/minor)
7. Auto-fix what can be fixed
8. Re-screenshot and compare (max 3 rounds)
9. Report final status: MATCH or remaining differences

### `tokens <url>` → Extract Design Tokens

1. Parse URL → fileKey
2. Call `get_variable_defs(fileKey)`
3. Display all variables organized by collection (colors, spacing, typography, etc.)
4. Show mapping table: Figma variable → CSS custom property → Tailwind class
5. Identify unmapped tokens (Figma variables with no project equivalent)
6. Optionally update `globals.css` with missing token definitions

### `connect <url>` → Code Connect Setup

1. Parse URL → fileKey
2. Call `get_code_connect_suggestions(fileKey)` for AI-suggested mappings
3. Display suggested mappings in a table
4. Ask user to confirm or modify
5. Call `send_code_connect_mappings(fileKey, mappings)` with confirmed set
6. Report: N components now linked between Figma and codebase

### `push <path>` → Code-to-Figma

1. Read the implementation file at the given path
2. Determine which product this belongs to (from file path)
3. Look up product's Figma file in memory; if none, create via `create_new_file`
4. Generate Plugin API JavaScript that recreates the component in Figma:
   - Auto-layout frames for containers
   - Text nodes for content
   - Fills using Figma variables where possible
5. Call `use_figma(fileKey, pluginApiCode)`
6. Set up Code Connect mapping back to the source file
7. Report: Figma URL of the created frame

### `diagram <description>` → FigJam Diagram

1. Parse the description
2. Call `generate_diagram(description)`
3. Return the FigJam file URL

### `<product>` → Product Design Files

Detect: argument matches `hogwarts`, `souq`, `mkan`, `shifa`

1. Look up product in `figma_projects.json` → `projects.products[]`
2. If `fileKey` is null: ask user for the Figma URL, register it
3. If `fileKey` exists: call `get_metadata(fileKey)`, display pages/frames

---

## Output Format

```
Figma "{operation}" complete

Source: {figma_url or local_path}
Target: {local_path or figma_url}

Files:
  - {created/modified files with paths}

Tokens: {N mapped, M new}
Code Connect: {N components linked}
Visual match: {PASS | differences remaining}
```
