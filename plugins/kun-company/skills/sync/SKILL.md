---
name: sync
description: Self-update — diff upstream releases and kun's own run evidence against the engine, adopt or propose
when_to_use: "Use when self-updating the engine against upstream releases (Anthropic, stack, services, practice) — adopt the mechanical wins, propose the rest, stamp the sync dates. Triggers on: sync, what's new in claude code, refresh the engine, release sweep, sync self, improve yourself, self-improve, what should kun improve."
argument-hint: "[anthropic|stack|services|practice|self|all] [--force]"
lane: judge
effort: high
---

# Sync — the engine updates itself

Kun configures the best of what exists rather than rebuilding it — which only works if it always knows what exists. `/sync` is that loop, across five tiers — four that look outward at releases, and `self`, which looks inward at what kun's own runs say. Anchor: `.claude/engine.json` → `sync`.

The keyword `sync` in natural conversation ("are we current?", "sync the engine", "anything new in Next.js?") routes here — no slash needed.

## Tiers

| Tier          | Surface                                                                                                                     | Cadence | Stamp            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------- |
| **anthropic** | Claude Code CHANGELOG · platform release notes · anthropic.com/news                                                         | 7 days  | `sync.anthropic` |
| **stack**     | Next.js · React · TypeScript · Tailwind · Prisma · shadcn/ui · GSAP release surfaces                                        | 14 days | `sync.stack`     |
| **services**  | Cloudflare · Neon · GitHub · Figma changelogs (Vercel: legacy, headlines only)                                              | 14 days | `sync.services`  |
| **practice**  | Agent-config craft: Anthropic engineering blog, AGENTS.md ecosystem, BMAD-method, high-signal community Claude Code configs | 30 days | `sync.practice`  |
| **self**      | Kun's own evidence: run ledger, awareness snapshot, router log, transcripts, lint, health, bench-retire (`improve.mjs`)      | 7 days  | `sync.self`      |

Exact URLs live in `engine.json → sync.sources` — when a source moves, fix it there, not here.

## Steps

### 1. Decide scope

- **No argument** → every tier whose stamp is older than its cadence (or `null` = never synced). Nothing due → report per-tier freshness and stop.
- **`anthropic` / `stack` / `services` / `practice` / `self`** → that tier only.
- **`all`** → every tier. **`--force`** ignores staleness.

### 2. Fetch (parallel WebFetch; `gh api` for GitHub releases)

For each in-scope tier, extract only what is NEW since the tier's stamp and RELEVANT to the engine:

- **anthropic** — new tools, config surfaces (settings keys, frontmatter fields, hook events, `.claude/*` dirs), models, permissions/sandbox, autonomy/long-horizon features, plan/billing changes
- **stack** — new versions, breaking changes, deprecations, new idioms for the versions kun's products pin (Next.js 16, React 19, TypeScript 5–6, Tailwind 4, Prisma 6–7, shadcn/ui, GSAP 3) — plus each vendor's own agent guidance (bundled docs, AGENTS.md, official MCP servers, official skills)
- **services** — platform changes that touch deploys (Cloudflare Workers + Containers; Vercel is legacy), databases (Neon), repo workflows (GitHub), design handoff (Figma)
- **practice** — agent-config patterns worth stealing: multi-agent methods (e.g. BMAD), CLAUDE.md/AGENTS.md conventions, skill/hook/workflow/subagent techniques

Sources of the form `gh:owner/repo` mean `gh api repos/owner/repo/releases --jq '.[0:5] | .[] | {tag_name, published_at, body}'` — cheaper and more structured than fetching release pages.

### 3. Classify each finding

| Class            | Meaning                                                                                          | Action                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **ADOPT-SAFE**   | Pure config/docs addition — no behavior risk, no spend, no team-workflow change                  | Apply now                                                                                                  |
| **ADOPT-DECIDE** | Changes behavior, cost, dependencies, or how the team works — including any product version bump | `node .claude/scripts/improve.mjs --add DECIDE "<title>" "<proposed change>" --source sync:<tier>` — it joins the one Engine decisions queue (approved with `yes <id>`); `/decide` entry for Type-1, plus `PushNotification` |
| **TRACK**        | Real but not useful to kun yet                                                                   | Deferred list in `docs/CONFIG-BENCHMARK.md`                                                                |

Standing constraints veto adoption regardless of class:

- **Subscription-only** — nothing that requires usage credits or per-token spend (`engine.json` → `billing`)
- **Main-only git** — nothing that reintroduces branches/worktrees/PRs (`.claude/rules-global/github-workflow.md`)
- **Anthropic-native** — no third-party substitutes for anything Anthropic ships (`docs/CONFIG-BENCHMARK.md`)

Stack findings diff against reality, not memory: product `package.json` versions + the rule corpus (`.claude/rules/<domain>/`, `since:` frontmatter). A breaking change with no matching rule → write the rule (ADOPT-SAFE). A version bump for products → ADOPT-DECIDE, executed via `/package`.

### 3.5 Harness audit (on model releases only)

When the anthropic tier surfaces a **new model** (or a major Claude Code version), run the reverse pass: every rule, hook, gate, and fix-loop in the engine encodes an assumption about what the model _couldn't_ do when it was written. Sample the highest-friction ones (fix loops with retry caps, mandatory verification passes, deny-list breadth) and ask: does the new model still need this scaffold? Propose removals as ADOPT-DECIDE — guardrails get retired, not just added. (Anthropic harness-engineering guidance, adopted 2026-07-10.)

Two native tools do the mechanical half — run them before sampling by hand:

- **`/doctor prompt-audit`** (Claude Code 2.1.283+) audits CLAUDE.md files, skills, agents and commands for prompting patterns written for older models. Its findings are the harness-audit candidate list.
- **`/skill-doctor`** (2.1.261+) reports each skill's listing cost and usage. The skill listing is capped at `skillListingBudgetFraction` of the context window (default 1%); on overflow Claude Code silently drops the descriptions of the least-used skills — which is exactly how passive keyword routing degrades. Read it beside KPI 8.

### 3.6 Tier `self` — learn from kun's own runs (no fetching)

The outward tiers ask "what's new out there?"; `self` asks "what did our own runs show?".
Detection is zero tokens — `improve.mjs` already does it, daily, in the heartbeat:

1. `node .claude/scripts/improve.mjs --apply-safe` — refreshes `~/.claude/state/findings.json`
   and applies the machine-local SAFE fixes (env-file permissions, missing labels, the
   approved prune).
2. SAFE + `fix.kind: repo` (an engine.json count that drifted, a plugin rebuild once its
   sources are committed, regenerated vocab): apply → `health.sh` engine ✅ + lint clean →
   commit with pathspecs.
3. `node .claude/scripts/improve.mjs --issue` — rewrites the rolling **Engine decisions** issue
   (label `engine-decision`) and reads Abdout's `yes <id>` comments into `approved`.
4. Each `approved` finding: implement, verify, commit, set its status to `applied@<sha>` in
   findings.json, and add an Adoption-log line with the metric's `before`. The next run
   fills in `after` on its own: the detector stops firing → `verified`; fires again →
   `regressed` (flag it, never auto-revert).
5. TRACK findings go into the weekly plan as context — nothing to apply.

Hard limits: no bench run (≈2.8M tokens — only on an approved row), no billing change, and
no edit to a fleet surface (hooks, settings, rules-global, skills, engine policy) without an
approved row — `maintain` ships `main` to every teammate's machine within a day.

### 4. Apply + record

1. Apply ADOPT-SAFE to canonical sources; regenerate plugins if any plugin source changed (`bash .claude/scripts/build-plugin.sh`)
2. Stamp each synced tier: `engine.json` → `sync.<tier>` = today; tier `anthropic` also updates `sync.claude_code_version`
3. Material adoptions → dated line in `docs/CONFIG-BENCHMARK.md` → **Adoption log**
4. Commit: `chore(engine): sync <tiers> — <headline>` + `git pull --rebase origin main && git push origin main`

### 5. Report

One table per synced tier — finding → class → action taken — then per-tier freshness ("anthropic 0d · stack 0d · services 12d · practice 21d").

## Cadence

- **Weekly**: the Monday routine (`scripts/captain/weekly.sh`) runs `self` plus any outward tier whose source shows a release newer than its stamp — never a 36-day catch-up unattended.
- **Daily**: the heartbeat runs `improve.mjs` (detection + local SAFE fixes, zero tokens).
- **Session start**: the captain flags any overdue tier and syncs before allocating.
- **Event-driven**: a release mentioned in conversation ("did you see the Next.js release?") → sync that tier now.

## Exit gate

Every in-scope tier stamped today, every finding classified, ADOPT-SAFE applied and committed, ADOPT-DECIDE escalated with a durable record.
