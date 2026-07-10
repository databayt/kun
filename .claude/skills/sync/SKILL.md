---
name: sync
description: Self-update — read the latest releases across the engine's whole surface (Anthropic, stack, services, practice), diff against the engine, adopt or propose
when_to_use: "Use when self-updating the engine against upstream releases — reads the Anthropic/stack/services/practice release feeds per engine.json sync tiers, diffs findings against the engine, adopts mechanical wins, proposes the rest, and stamps sync dates. Triggers on: sync, what's new in claude code, refresh the engine, release sweep."
argument-hint: "[anthropic|stack|services|practice|all] [--force]"
---

# Sync — the engine updates itself

Kun configures the best of what exists rather than rebuilding it — which only works if it always knows what exists. `/sync` is that loop, across four tiers. Anchor: `.claude/engine.json` → `sync`.

The keyword `sync` in natural conversation ("are we current?", "sync the engine", "anything new in Next.js?") routes here — no slash needed.

## Tiers

| Tier          | Surface                                                                                                                     | Cadence | Stamp            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------- |
| **anthropic** | Claude Code CHANGELOG · platform release notes · anthropic.com/news                                                         | 7 days  | `sync.anthropic` |
| **stack**     | Next.js · React · TypeScript · Tailwind · Prisma · shadcn/ui release surfaces                                               | 14 days | `sync.stack`     |
| **services**  | Vercel · Neon · GitHub · Figma changelogs                                                                                   | 14 days | `sync.services`  |
| **practice**  | Agent-config craft: Anthropic engineering blog, AGENTS.md ecosystem, BMAD-method, high-signal community Claude Code configs | 30 days | `sync.practice`  |

Exact URLs live in `engine.json → sync.sources` — when a source moves, fix it there, not here.

## Steps

### 1. Decide scope

- **No argument** → every tier whose stamp is older than its cadence (or `null` = never synced). Nothing due → report per-tier freshness and stop.
- **`anthropic` / `stack` / `services` / `practice`** → that tier only.
- **`all`** → every tier. **`--force`** ignores staleness.

### 2. Fetch (parallel WebFetch; `gh api` for GitHub releases)

For each in-scope tier, extract only what is NEW since the tier's stamp and RELEVANT to the engine:

- **anthropic** — new tools, config surfaces (settings keys, frontmatter fields, hook events, `.claude/*` dirs), models, permissions/sandbox, autonomy/long-horizon features, plan/billing changes
- **stack** — new versions, breaking changes, deprecations, new idioms for the versions kun's products pin (Next.js 16, React 19, TypeScript 5, Tailwind 4, Prisma 6, shadcn/ui)
- **services** — platform changes that touch deploys (Vercel), databases (Neon), repo workflows (GitHub), design handoff (Figma)
- **practice** — agent-config patterns worth stealing: multi-agent methods (e.g. BMAD), CLAUDE.md/AGENTS.md conventions, skill/hook/workflow/subagent techniques

Sources of the form `gh:owner/repo` mean `gh api repos/owner/repo/releases --jq '.[0:5] | .[] | {tag_name, published_at, body}'` — cheaper and more structured than fetching release pages.

### 3. Classify each finding

| Class            | Meaning                                                                                          | Action                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **ADOPT-SAFE**   | Pure config/docs addition — no behavior risk, no spend, no team-workflow change                  | Apply now                                                                                                  |
| **ADOPT-DECIDE** | Changes behavior, cost, dependencies, or how the team works — including any product version bump | `/decide` entry + GitHub issue (`type:chore`, label `engine-upgrade`); `PushNotification` Abdout if Type-1 |
| **TRACK**        | Real but not useful to kun yet                                                                   | Deferred list in `docs/CONFIG-BENCHMARK.md`                                                                |

Standing constraints veto adoption regardless of class:

- **Subscription-only** — nothing that requires usage credits or per-token spend (`engine.json` → `billing`)
- **Main-only git** — nothing that reintroduces branches/worktrees/PRs (`.claude/rules/github-workflow.md`)
- **Anthropic-native** — no third-party substitutes for anything Anthropic ships (`docs/CONFIG-BENCHMARK.md`)

Stack findings diff against reality, not memory: product `package.json` versions + the rule corpus (`.claude/rules/<domain>/`, `since:` frontmatter). A breaking change with no matching rule → write the rule (ADOPT-SAFE). A version bump for products → ADOPT-DECIDE, executed via `/package`.

### 3.5 Harness audit (on model releases only)

When the anthropic tier surfaces a **new model** (or a major Claude Code version), run the reverse pass: every rule, hook, gate, and fix-loop in the engine encodes an assumption about what the model _couldn't_ do when it was written. Sample the highest-friction ones (fix loops with retry caps, mandatory verification passes, deny-list breadth) and ask: does the new model still need this scaffold? Propose removals as ADOPT-DECIDE — guardrails get retired, not just added. (Anthropic harness-engineering guidance, adopted 2026-07-10.)

### 4. Apply + record

1. Apply ADOPT-SAFE to canonical sources; regenerate plugins if any plugin source changed (`bash .claude/scripts/build-plugin.sh`)
2. Stamp each synced tier: `engine.json` → `sync.<tier>` = today; tier `anthropic` also updates `sync.claude_code_version`
3. Material adoptions → dated line in `docs/CONFIG-BENCHMARK.md` → **Adoption log**
4. Commit: `chore(engine): sync <tiers> — <headline>` + `git pull --rebase origin main && git push origin main`

### 5. Report

One table per synced tier — finding → class → action taken — then per-tier freshness ("anthropic 0d · stack 0d · services 12d · practice 21d").

## Cadence

- **Weekly**: `/weekly` Monday plan runs `/sync` first (due tiers only — usually just anthropic).
- **Session start**: the captain flags any overdue tier and syncs before allocating.
- **Event-driven**: a release mentioned in conversation ("did you see the Next.js release?") → sync that tier now.

## Exit gate

Every in-scope tier stamped today, every finding classified, ADOPT-SAFE applied and committed, ADOPT-DECIDE escalated with a durable record.
