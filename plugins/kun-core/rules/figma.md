# Figma Design Integration Rules

## URL Parsing

When a `figma.com` URL appears, always extract fileKey and nodeId:

| URL Pattern | Action |
|-------------|--------|
| `figma.com/design/:fileKey/:name?node-id=:nodeId` | Use fileKey, convert `-` to `:` in nodeId |
| `figma.com/design/:fileKey/branch/:branchKey/:name` | Use branchKey as fileKey |
| `figma.com/make/:makeFileKey/:name` | Use makeFileKey (Figma Make file) |
| `figma.com/board/:fileKey/:name` | FigJam — use `get_figjam` not `get_design_context` |

Always pass `clientFrameworks="react,nextjs"` and `clientLanguages="typescript,css"` to `get_design_context`.

## Token Mapping

- Never use hardcoded hex/rgb values in generated code
- Map Figma color variables to existing CSS custom properties first (`--primary`, `--secondary`, etc.)
- Only create new custom properties if no existing token matches
- Spacing always maps to Tailwind scale (`p-4`, `gap-2`), never pixel values in classes
- Typography maps to project font system (`--font-heading`, `--font-sans`, `--font-mono`)
- Border radius maps to Tailwind scale (`rounded-sm`, `rounded-md`, `rounded-lg`)
- Reference `~/.claude/memory/figma_projects.json` for the default mapping table

## Component Mapping Priority

When converting Figma components to code, resolve in this order:

1. **Code Connect** — check `get_code_connect_map` for existing mappings first
2. **ui/** — match to `src/components/ui/` (shadcn/ui primitives)
3. **atom/** — match to `src/components/atom/` (composed components)
4. **Create new atom** — if 2+ primitives combine and no existing match
5. **Never raw HTML** — if a shadcn/ui primitive exists for the element, use it

## RTL

Every component generated from Figma must use:

- Logical properties only: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`
- `text-start`/`text-end` not `text-left`/`text-right`
- `flex-row` with `rtl:flex-row-reverse` only when auto-direction fails
- Test visual output in both `/ar/` and `/en/` routes when browser is available

## Pixel-Perfect Comparison

When running `mirror` or visual verification:

1. Take Figma screenshot via `get_screenshot`
2. Take implementation screenshot via browser MCP at same viewport size
3. Compare: spacing, colors, typography, alignment, border radius, shadows
4. Tolerance: 1-2px for spacing, exact match for colors and typography
5. Maximum 3 iteration rounds — if still mismatched after 3, report remaining differences
6. Always fix the most visible differences first (layout > colors > spacing > shadows)

## Code Connect

After every successful design-to-code conversion:

- Set up Code Connect mapping via `add_code_connect_map`
- Label: `"React"`
- Source path: actual project path (e.g., `src/components/atom/user-card/index.tsx`)
- For bulk operations, use `send_code_connect_mappings`

## Project Registration

When a user provides a Figma URL for a project not yet registered:

1. Extract fileKey from URL
2. Call `get_metadata` to get file name
3. Update `~/.claude/memory/figma_projects.json` with fileKey and URL
4. Inform user the project is now registered for future `figma <product>` access
