---
name: shadcn
description: shadcn/ui knowledge pack — CLI, MCP, registry, skills, directory, and the docs-block pattern. Say "shadcn" to load it; "shadcn docs" = the docs-block style.
argument-hint: "<docs|add|registry|cli|mcp|directory> [name]"
model: claude-opus-4-8
allowed-tools:
  [
    "Bash(pnpm *)",
    "Bash(npx shadcn@latest *)",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "mcp__shadcn__*",
    "WebFetch",
  ]
---

# shadcn

The single word that loads everything Databayt knows about shadcn/ui — say `shadcn`
and this pack is in context, no website or repo lookup needed. We adopt shadcn deeply:
`ui` primitives are copied from it, the org registry at `/Users/abdout/codebase` is
built **on top of** its registry system, and its **docs-block** pattern is reused
across repos.

> **Argument:** $ARGUMENTS

## Modes

| You say                                         | Mode       | What happens                                                                                        |
| ----------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `shadcn`                                        | load       | This pack answers / routes by intent.                                                               |
| `shadcn docs`                                   | docs-block | Reproduce shadcn's docs-block MDX pattern → `references/docs-block.md`.                             |
| `shadcn add <name>` · `shadcn <name>`           | install    | Install via shadcn MCP (`mcp__shadcn__*`) or `npx shadcn@latest add`. Heavy build → `shadcn` agent. |
| `shadcn registry` · `cli` · `mcp` · `directory` | spec       | Deep reference → `references/registry-and-cli.md`.                                                  |

## The five surfaces

1. **CLI** — `npx shadcn@latest <init|add|view|search|build|info|docs|migrate|eject|mcp>`. Namespaced installs: `add @acme/login-form`.
2. **MCP** — `npx shadcn@latest mcp` (already registered). Browse / search / install across every registry in the project's `components.json`. Tools: `mcp__shadcn__*`.
3. **Registry** — `registry.json` + `registry-item.json` distribute components as JSON under `public/r/`. Types `registry:ui|block|component|lib|hook|page|file|style|theme`.
4. **Skills** — `pnpm dlx skills add shadcn/ui` drops a _per-repo_ project-aware skill into `.claude/skills/`. This pack is the always-on user-level umbrella above it.
5. **Directory** — community registries built into the CLI, addressed by `@namespace`, configured in `components.json` → `registries`.

## Component hierarchy ↔ shadcn

| Kun level  | shadcn equivalent                  | Registry type                          |
| ---------- | ---------------------------------- | -------------------------------------- |
| `ui`       | primitives (Radix, copied)         | `registry:ui`                          |
| `atom`     | components, 2+ primitives composed | `registry:atom` (org)                  |
| `template` | blocks / full-page layouts         | `registry:block` / `registry:template` |
| `block`    | _beyond shadcn_ — UI + logic       | —                                      |
| `micro`    | _beyond shadcn_ — mini service     | —                                      |

Create these with the `/atom`, `/template`, `/block` skills — they already compose shadcn primitives.

## Directories that follow shadcn's pattern

Recognize and work with these wherever they appear (look in `/Users/abdout/codebase` first, per `org-refs`):

| Path                                                            | Holds                                              |
| --------------------------------------------------------------- | -------------------------------------------------- |
| `components.json`                                               | config — style (`new-york`), aliases, `registries` |
| `src/components/ui/`                                            | primitives (`registry:ui`)                         |
| `src/components/atom/`                                          | atoms (`registry:atom`)                            |
| `src/components/template/` · `src/registry/**/templates/`       | templates (`registry:block`)                       |
| `__registry__/` · `src/registry/{schema,*-index,registry-*}.ts` | registry index + schema                            |
| `public/r/**`                                                   | built registry JSON (what the CLI installs from)   |
| `content/{docs,atoms}/**.mdx`                                   | docs-block MDX (see `shadcn docs`)                 |

**Lookup order:** `/Users/abdout/codebase` (`databayt/codebase`) → `databayt/shadcn` fork (`apps/v4/registry/new-york-v4`) → `databayt/radix`.

## Routing

- **Build / customize a primitive** → `shadcn` agent (`~/.claude/agents/shadcn.md`).
- **Compose components** → `/atom`, `/template`, `/block`.
- **Find / install** → shadcn MCP (`mcp__shadcn__*`) + `npx shadcn@latest`.
- **Author / publish a registry** → `references/registry-and-cli.md`.
- **Docs-block pages** → `shadcn docs` → `references/docs-block.md`.
- **Tokens / RTL / a11y** → `tailwind`, `semantic`.

## References (canonical — embedded so you need not fetch)

- **Docs**: https://ui.shadcn.com/docs · /docs/cli · /docs/skills · /docs/mcp · /docs/registry (/registry/registry-json, /registry/registry-item-json) · /docs/directory
- **Schemas**: https://ui.shadcn.com/schema/registry.json · https://ui.shadcn.com/schema/registry-item.json
- **Repo**: https://github.com/shadcn-ui/ui — `apps/v4` (site + `content/docs` + `registry/new-york-v4`), `packages/shadcn` (CLI), `templates/`, `skills/shadcn`
- **Org**: `/Users/abdout/codebase` (`databayt/codebase`) · `databayt/shadcn` fork · `databayt/radix`

Only WebFetch these when you need something genuinely newer than this pack.
