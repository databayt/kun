# Global Claude Code Instructions

## Preferences

- **Model**: `claude-opus-4-8` (default). Max $100/mo plan, subscription-only — no usage credits, no API-key spend.
- **Package Manager**: pnpm
- **Stack**: Next.js 16, React 19, Prisma 6, TypeScript 5, Tailwind CSS 4, shadcn/ui
- **Languages**: Arabic (RTL default), English (LTR)
- **Port**: Always use port 3000 — NEVER switch to another port (Exceptions: in `/Users/abdout/apple`, we are cloning Apple and run on `localhost:3001` bypassing the rule of 3000 because it would be pussy for the time being; in `/Users/abdout/nike`, we are cloning Nike and run on `localhost:3002` bypassing the rule of 3000 because it would be pussy for the time being)
- **Environment**: Only use central `.env` — NEVER create `.env.local`, `.env.development`, or any `.env.x` files (Note: `.env.local` is present in `/Users/abdout/apple` and `/Users/abdout/nike`)

## Imported Rules

@~~/.claude/rules/multi-repo.md
@~~/.claude/rules/org-refs.md
@~/.claude/rules/session-start.md

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

### shadcn

Say **`shadcn`** to load the full shadcn/ui knowledge pack (`~/.claude/skills/shadcn/`) — CLI, MCP, registry, skills, directory, the `ui`/`atom`/`template`/`block` mapping, and every reference link — so no website or repo lookup is needed. Say **`shadcn docs`** to apply the pattern and style of shadcn's docs block (the MDX `ComponentPreview` → CLI/Manual `Installation` → `Usage` → `API Reference` anatomy on fumadocs catch-all routes). Reference implementation: `/Users/abdout/codebase`. Heavy build/customize work hands off to the `shadcn` agent.

---

## Keyword Vocabulary

Each keyword maps to a skill or specialist agent. Use as `/keyword` or in conversation. The live registry is `kun/.claude/vocabulary.json` (browsable at kun.databayt.org/en/docs/keywords); each skill's `when_to_use` frontmatter carries its triggers. Detailed playbooks live in the corresponding skill (`/security`, `/performance`, `/figma`, `/report`, etc.) — open `~/.claude/skills/<keyword>/SKILL.md` for the full spec.

| Category               | Keyword                     | Purpose                                                                                                            |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Lifecycle**          | `check`                     | Pre-ship quality gate (typecheck + build + visual + tests)                                                         |
|                        | `handover`                  | UI verification: `/handover <url>` (12 niche keywords) or `/handover <block>` (per-route subset)                   |
|                        | `qa`                        | Autonomous block QA: detect → adversarially verify → fix safe tiers → open one human-signoff issue (`/qa <block>`) |
|                        | `ship`                      | Promote checked build to production (Vercel --prod)                                                                |
|                        | `watch`                     | Post-deploy verify (visual + console + smoke)                                                                      |
|                        | `release`                   | One spell: handover → check → ship → watch → auto-comment issue                                                    |
|                        | `report`                    | Auto-fix user-reported issues                                                                                      |
|                        | `quick`                     | fix → commit → push (tight inner loop)                                                                             |
| **Browser** (niche)    | `see`                       | Visual screenshot + analysis                                                                                       |
|                        | `flow`                      | Walk through a user journey                                                                                        |
|                        | `debug`                     | Find errors (console, network)                                                                                     |
|                        | `responsive`                | Test 3 breakpoints (375 / 768 / 1440)                                                                              |
|                        | `lang`                      | RTL/LTR + translation check                                                                                        |
|                        | `fast`                      | Quick performance health                                                                                           |
| **Code** (niche)       | `guard`                     | Auth + validation + tenant scope                                                                                   |
|                        | `architecture`              | Mirror pattern + data flow                                                                                         |
|                        | `structure`                 | File organization                                                                                                  |
|                        | `pattern`                   | Page/actions/form conventions                                                                                      |
|                        | `design`                    | Component primitive usage                                                                                          |
|                        | `stack`                     | Imports + version checks                                                                                           |
| **Deep**               | `trace`                     | Performance investigation + fix                                                                                    |
|                        | `performance`               | Core Web Vitals optimization                                                                                       |
|                        | `efficient`                 | Code efficiency / API reduction                                                                                    |
| **Compare**            | `mirror`                    | Figma vs implementation                                                                                            |
|                        | `diff`                      | URL vs URL                                                                                                         |
| **Orchestrator**       | `handover`                  | (also Lifecycle) Polymorphic: `/handover <url>` runs 12 niche keywords, `/handover <block>` runs per-route subset  |
|                        | `release`                   | (also Lifecycle) Full client handoff — composes handover, check, ship, watch                                       |
| **Org/Pipeline**       | `feature`                   | idea→spec→schema→code→wire→check→ship→watch                                                                        |
|                        | `captain`                   | CEO-brain decision loop (kun)                                                                                      |
|                        | `dispatch`                  | Atomic write to Apple Notes + Slack + bridge.md                                                                    |
| **Documents**          | `convert`                   | File or URL → Markdown via MarkItDown MCP (`/convert`)                                                             |
| **Anthropic cost**     | `cache`                     | Caching audit + breakpoint suggestions (`/cache-audit`)                                                            |
|                        | `batch`                     | Tier-2b sweep via Batch API at 50% off (`/batch`)                                                                  |
|                        | `think`                     | Extended thinking with interleaved tool use                                                                        |
| **Anthropic tools**    | `memory`                    | File-based memory tool ↔ ~/.claude/memory/ (`/memory-bridge`)                                                      |
|                        | `web-search` / `web-fetch`  | Anthropic server tools with citations                                                                              |
|                        | `code-exec`                 | Container code execution (50 free hrs/day)                                                                         |
| **Anthropic workflow** | `goal`                      | Loop until condition met (built-in `/goal`)                                                                        |
|                        | `routine` / `schedule`      | Cloud cron via built-in `/schedule`                                                                                |
|                        | `sandbox`                   | Bash sandbox presets (`/sandbox captain/dev/strict/off`)                                                           |
|                        | `team`                      | Agent teams (experimental)                                                                                         |
|                        | `autofix-pr`                | Web-session PR babysitter (`/autofix-pr`)                                                                          |
|                        | `ultraplan` / `ultrareview` | Browser-based plan/review refinement                                                                               |
| **Anthropic insight**  | `insights`                  | Session-pattern report (built-in `/insights`)                                                                      |
|                        | `team-onboarding`           | Paste-able teammate guide (built-in)                                                                               |
|                        | `agent-view`                | Multi-session manager (`claude agents`)                                                                            |

Project-specific orchestrators (e.g., hogwarts QA loop with kingfahad creds) live in each project's `.claude/CLAUDE.md`, not here.
