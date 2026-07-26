# Global Claude Code Instructions

## Preferences

- **Model**: `claude-fable-5` (default — fallbacks `claude-opus-4-8` → `claude-sonnet-5`). Max $100/mo plan, subscription-only — no usage credits, no API-key spend.
- **Package Manager**: pnpm
- **Stack**: Next.js 16, React 19, Prisma 6, TypeScript 5, Tailwind CSS 4, shadcn/ui
- **Languages**: Arabic (RTL default), English (LTR)
- **Port**: Always use port 3000 — NEVER switch to another port (Exceptions: in `/Users/abdout/apple`, we are cloning Apple and run on `localhost:3001` bypassing the rule of 3000 because it would be pussy for the time being; in `/Users/abdout/nike`, we are cloning Nike and run on `localhost:3002` bypassing the rule of 3000 because it would be pussy for the time being)
- **Environment**: Only use central `.env` — NEVER create `.env.local`, `.env.development`, or any `.env.x` files (Note: `.env.local` is present in `/Users/abdout/apple` and `/Users/abdout/nike`)

> Global rules auto-load from `~/.claude/rules/` (session-start, github-workflow, cowork-bridge,
> org-refs, multi-repo, patterns, block-protocol + path-scoped domain rules) — no imports needed.

---

## Component Hierarchy

| Level | Name       | Description         | shadcn Equivalent |
| ----- | ---------- | ------------------- | ----------------- |
| 1     | `ui`       | Radix primitives    | shadcn/ui         |
| 2     | `atom`     | 2+ primitives       | UI Components     |
| 3     | `template` | Full-page layouts   | Blocks            |
| 4     | `block`    | UI + business logic | Beyond shadcn     |
| 5     | `micro`    | Mini micro-services | —                 |

**Memory files:** `~/.claude/memory/{atom,template,block}.json` (kun-authored component snapshots)

## Reference Codebase

**Local:** `/Users/abdout/codebase` | **GitHub:** `databayt/codebase`

Check first: `src/components/` → `__registry__/` → `src/registry/`

Say **`shadcn`** to load the full shadcn/ui knowledge pack (`~/.claude/skills/shadcn/`); **`shadcn docs`** to apply the shadcn docs-block pattern (MDX `ComponentPreview` → `Installation` → `Usage` → `API Reference`). Heavy build/customize work hands off to the `shadcn` agent.

---

## Keyword Vocabulary — passive activation

Abdout speaks natural language, never slash commands — pick the keywords out of prose and
activate the right skill/agent/MCP automatically. The in-session skills listing (each skill's
`when_to_use` frontmatter) is the routing truth; the live registry is `kun/.claude/vocabulary.json`
(160 spells, browsable at kun.databayt.org/en/docs/keywords), and full playbooks live at
`~/.claude/skills/<keyword>/SKILL.md`.

High-frequency verbs: lifecycle `check` · `handover` · `qa` · `ship` · `watch` · `release` ·
`report` · `quick`; niche quality `see` · `flow` · `debug` · `responsive` · `lang` · `fast` ·
`guard` · `architecture` · `structure` · `pattern` · `design` · `stack` · `trace` · `efficient` ·
`mirror` · `diff`; pipeline `feature` · `idea` · `spec` · `plan` · `schema` · `code` · `wire`;
ops `captain` · `sync` · `health` · `economy` · `dispatch`; media/docs `higgs` · `social` ·
`carousel` · `convert`. Project-specific orchestrators live in each repo's `.claude/CLAUDE.md`.
