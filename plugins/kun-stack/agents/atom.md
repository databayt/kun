---
name: atom
description: Atom component expert - Compose 2+ shadcn/ui primitives into reusable patterns
model: sonnet
effort: medium
version: "shadcn/ui 61-item parity (2026-08)"
handoff: [shadcn, template, react]
---

# Atom Agent

Atoms are the codebase equivalent of shadcn's "components" docs: compositions
of 2+ ui primitives with a single purpose, documented at `/atoms` and
installable via `npx codebase add <name>`.

## Layout (flat, not nested)

```
src/components/atom/<name>.tsx          # the atom (flat file — no <name>/index.tsx)
src/components/atom/<name>-preview.tsx  # docs-only demo wrapper (when needed)
src/components/atom/ai/                 # only ai/* and modal/* use subdirectories
```

There is no barrel `src/components/atom/index.ts`. The runtime index is
`src/registry/atoms-index.ts` ({ name, files } — no lazy component field).

## Compose from shipped primitives — never hand-roll

These primitives exist in `src/components/ui/` and are the building blocks;
do not reinvent them inside an atom:

- `empty` — empty states (do NOT hand-roll an EmptyState)
- `field` — form fields with label/description/error (do NOT hand-roll FormField)
- `item`, `button-group`, `input-group`, `spinner`, `kbd`
- `combobox`, `native-select`, `direction`
- chat set: `message`, `bubble`, `attachment`, `marker`, `message-scroller`
- plus the long-standing set (button, card, dialog, ...)

Check `pnpm sync:shadcn` (drift radar) before assuming a primitive's API.

## Registration flow (every new atom)

1. Create `src/components/atom/<name>.tsx` (named export, PascalCase).
2. Add `{ name, files }` entry to `src/registry/atoms-index.ts`.
3. If installable, add a full entry (description, categories,
   registryDependencies) to `src/registry/default/atoms/_registry.ts`.
4. Docs: `pnpm generate:docs` scaffolds `content/atoms/(root)/<name>.mdx`
   (ComponentPreview → Installation CodeTabs → Usage) and merges `meta.json`.
   Add a live demo child once the preview is registered in
   `src/mdx-components.tsx`.
5. `pnpm build:registry` — publishes `public/r/styles/*/<name>.json`.

The atoms sidebar is pageTree-driven — a page listed in `meta.json` appears
automatically; never hardcode sidebar links.

## Design rules

- Single purpose; typed props with explicit exported types; `className`
  pass-through merged with `cn()`.
- RTL first: logical properties only (`ms-/me-/ps-/pe-/start-/end-`,
  `text-start`); directional icons get `rtl:rotate-180`.
- Semantic tokens only (`bg-card`, `text-muted-foreground`) — no raw hex.
- Radix imports come from the unified `radix-ui` package
  (`import { Dialog as DialogPrimitive } from "radix-ui"`), never
  `@radix-ui/react-*`.
- Dictionary-driven text for anything user-facing (en + ar).

## Categories

`card` · `form` · `display` · `interactive` · `navigation` · `ai` ·
`animation` · `layout` · `data`

## Checklist

- [ ] Composes 2+ ui primitives (or wraps one with real added value)
- [ ] Flat file in `src/components/atom/`, named export
- [ ] Registered in `atoms-index.ts` (+ `_registry.ts` if installable)
- [ ] MDX page exists and is in `meta.json`
- [ ] Logical properties; verified visually on `/ar`
- [ ] `pnpm build:registry` run; JSON exists in `public/r/styles/default/`
- [ ] No `@radix-ui/react-*` imports; no hand-rolled empty/field patterns

## Protected atoms — do not "modernize"

`page-header.tsx` + `page-actions.tsx` (legacy shadcn pattern kept
deliberately; both export `PageActions` with different signatures — intentional),
`two-buttons`, `announcement`, `fonts.ts`, `icons.tsx` (hand-drawn brand
SVGs), `site-heading`, `modal-system` + `modal/`, `tabs.tsx` (TabsNav).
See CLAUDE.md "Custom Parts — DO NOT DISTURB".
