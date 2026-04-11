# Clone from Source

Clone and adapt code from various sources — including pixel-perfect Figma designs.

## Arguments
- `$1`: Source (figma URL, github:owner/repo/path, shadcn:component, codebase:path)
- `$2`: (optional) Target path for generated code

## Sources

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

Clone source: $ARGUMENTS
