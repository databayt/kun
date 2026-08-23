---
name: template
description: Create templates - full-page layouts and major UI sections
when_to_use: When creating, listing, previewing, or rebuilding a template in /Users/abdout/codebase — a full-page layout (shadcn blocks equivalent) registered at /templates with per-template MDX docs. Triggers on "template <name>", "create a template", "new hero/sidebar/login template", "rebuild the template registry".
argument-hint: "<name|list|preview|build> [name]"
allowed-tools:
  ["Bash(pnpm *)", "Read", "Write", "Edit", "Glob", "Grep", "mcp__shadcn__*"]
---

# Template Skill

Create and manage templates in `/Users/abdout/codebase` — full-page layouts
mirroring shadcn's blocks, plus our per-template MDX docs layer.
Deep expertise: the `template` agent (`.Codex/agents/template.md` in the repo).

## Usage

```
/template <name>           - Create + register + document a new template
/template list             - List the 36 registered templates
/template preview <name>   - Preview at /templates/<name> and /view/templates/<name>
/template build            - pnpm build:registry (regenerates default/, index, JSONs)
```

## Argument: $ARGUMENTS

## Full flow (create → register → document → publish)

1. **Create** under the SOURCE style — `new-york`, not default:

```
src/registry/new-york/templates/{name}/
├── page.tsx              # registry:page
└── components/           # registry:component files
```

Naming: `{type}-{number}` (`hero-04`, `sidebar-17`). Internal imports use
`@/registry/new-york/...` so style sync can rewrite them.
`src/registry/default/templates/` is GENERATED — never edit it.

2. **Register** in `src/registry/registry-templates.ts`: description,
   registryDependencies, files, categories (`src/lib/categories.ts`),
   `meta.iframeHeight`.
3. **Document**: `pnpm generate:template-docs` scaffolds
   `content/templates/(root)/<name>.mdx` (TemplatePreview → Installation →
   Usage) and merges `meta.json`.
4. **Publish**: `pnpm build:registry` — regenerates `default/`, the typed
   `src/__registry__/index.tsx`, `public/r/styles/*` and `public/r/templates/*`.
5. **Verify** featured/category/docs/full-page views on `/en` and `/ar`.

## Design rules

- Self-contained; responsive mobile→desktop; themeable light/dark
- RTL logical properties (`ms-/me-/ps-/pe-/start-/end-`)
- Semantic tokens; Radix via unified `radix-ui`
- `meta.iframeHeight` matched to real content height

## Categories (live)

sidebar · hero · header · footer · login · signup · subscription · dashboard ·
authentication (see `src/lib/categories.ts` for the routable set)
