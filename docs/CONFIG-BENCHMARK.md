# Config Benchmark — kun vs. the best public Claude Code setups

> Consolidated 2026-06-04. Counts and the model live in `.claude/engine.json` (the
> single source of truth); this doc captures _decisions and rationale_, not numbers.

We surveyed the strongest public Claude Code configurations — Anthropic's own docs and
example plugins, the AGENTS.md ecosystem (Vercel `next.js`, OpenAI `codex`, Supabase), and
the high-signal community collections (subagent fleets, hook kits, statusline tools) — then
**verified every load-bearing claim against the official docs** before adopting anything. The
raw research carried errors we discarded (subagents _can_ use MCP via `mcpServers`; the
`allowManaged*` settings keys don't exist; `/output-style` is deprecated in favor of `/config`;
no repo's star count was taken at face value). What follows is the verified picture.

## Verified Claude Code feature surface (2026)

| Capability        | Status               | What's actually true                                                                                                                                                                                                     |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Path-scoped rules | ✅ native            | `.claude/rules/*.md` with a `paths:` glob frontmatter load **only** when Claude touches a match; no `paths` = always-on. Quote globs (`["**/*.tsx"]`); `globs:` is a fallback alias; injection is most reliable on Read. |
| `AGENTS.md`       | ⚠️ not read natively | Only via `@AGENTS.md` import in `CLAUDE.md` or a symlink; `/init` folds an existing one in. The cross-tool standard (Codex/Cursor/Copilot read it directly).                                                             |
| Hooks             | ✅ 28 events         | `PreToolUse` exiting **2 blocks** the tool (stderr → Claude); handler types `command \| http \| mcp_tool \| prompt \| agent`; plugins bundle `hooks/hooks.json` (auto-discovered).                                       |
| Subagents         | ✅ rich frontmatter  | `model` (`opus\|sonnet\|haiku\|inherit`), `tools`, `disallowedTools`, `permissionMode`, `skills`, **`mcpServers`** (MCP _is_ available), `memory`, `isolation: worktree`.                                                |
| Skills            | ✅                   | `context: fork` + `agent: <type>` run a skill in a forked subagent; `allowed-tools`, `paths`, and `` !`cmd` `` dynamic injection are real.                                                                               |
| Plugins/market    | ✅                   | `.claude-plugin/marketplace.json` catalog + per-plugin `plugin.json`; `${CLAUDE_PLUGIN_ROOT}` for bundled scripts (exec-form `args`).                                                                                    |
| Settings          | ✅                   | Precedence managed → CLI → local → project → user; `allow/deny/ask`. Real managed keys: `claudeMd`, `forceLoginOrgUUID`.                                                                                                 |
| Output styles     | ✅                   | `~/.claude/output-styles/*.md`; set via `/config` (the `/output-style` command was removed).                                                                                                                             |

## Where kun already leads (kept as-is)

- **Two-plugin marketplace built from canonical sources** (`build-plugin.sh`) with a `--check`
  drift mode _and_ a literal-secret guard — most public repos hand-maintain their plugin trees.
- **`engine.json` as a single source of truth** + `/health` drift detection.
- A real **idea→ship pipeline** with human gates and keyword routing.
- The Good/Bad/Fix **rule corpus** and an **already-tiered portable agent fleet** (opus for
  architecture/orchestration, sonnet for build agents, haiku for routine ones) — the community
  best-practice we'd otherwise have had to adopt.

## What this benchmark changed

1. **Path-scoped the rule corpus.** The 29 domain rules used a custom `applies-to:` field Claude
   Code ignores, so all of them loaded into _every_ session. Renamed to the native `paths:` —
   each rule now auto-loads only when Claude touches a matching file. Explicit reads by the
   quality agent / `/check` are unaffected; we only shed the redundant always-on context cost.
2. **Closed drift gaps.** Added a `domain_rules` count to `engine.json` (the rule corpus was
   untracked by `/health`, which only counted top-level files) and a `config-drift` CI workflow
   that runs `build-plugin.sh --check` on PRs touching `.claude/**` or `plugins/**`.
3. **Shipped a safety guard as a hook.** `block-destructive-bash.sh` (PreToolUse, exit-2-blocks)
   enforces what the prisma-6 rule and the deny-list only advise — `rm -rf /`, `prisma migrate
reset`, `--accept-data-loss`, `git reset --hard`, force-push, `DROP/TRUNCATE`. Narrow by
   design: routine `rm -rf node_modules` and `--force-with-lease` pass. Wired in project settings
   _and_ bundled into the kun-company plugin so it travels with installs.
4. **Confirmed model tiering.** The portable fleet was already textbook-tiered; only the project
   fleet was uniformly opus. Downtiered `package` (mechanical dep audit) to sonnet and codified
   the policy in `engine.json` → `model_tiers`.

## Re-benchmark 2026-06-12 — the June surface

Second pass, produced by the new `/sync` loop (which makes re-benchmarking continuous instead
of episodic — four tiers: anthropic weekly, stack + services biweekly, agent-practice monthly).
Surface verified against the Claude Code CHANGELOG (v2.1.129 → v2.1.175) and the platform
release notes.

| Capability (version)                                                                 | What it is                                                                         | kun decision                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Dynamic workflows (v2.1.154)                                                         | `.claude/workflows/` named scripts orchestrate 10–100s of agents deterministically | **ADOPTED** — `handover.js` is the first; encode `/release` and repo-wide sweeps after first production runs |
| `fallbackModel` chains (v2.1.166)                                                    | Up to 3 fallbacks tried on overload/unavailability                                 | **ADOPTED** — `opus-4-8 → sonnet-4-6` in project settings                                                    |
| Usage attribution (v2.1.149 `/usage`, v2.1.174)                                      | Per-skill/agent/plugin/MCP cost breakdown, 24h/7d                                  | **ADOPTED** — weekly `/usage` check is the billing posture's enforcement + KPI 4                             |
| `/goal` loops (v2.1.139)                                                             | Completion condition; Claude works across turns until met                          | **ADOPTED** as practice for long fix loops (vocabulary already routes `goal`)                                |
| `/code-review` + `--fix` (v2.1.147/152)                                              | Effort-graded correctness review, applies findings                                 | **ADOPTED** as pre-ship lane alongside `/check`                                                              |
| `/cd` cache-preserving dir moves (v2.1.169)                                          | Move session between repos without cold cache                                      | **ADOPTED** as habit for cross-repo sessions — no config needed                                              |
| `claude agents` manager + `--json` (v2.1.139/145)                                    | Fleet view of every session; scripting surface                                     | TRACK — single-operator today; revisit when Ali/Samia drive their own sessions                               |
| Plugins auto-load from `.claude/skills` (v2.1.157)                                   | Skills discovered without a marketplace                                            | TRACK — the marketplace flow stays canonical for team installs                                               |
| Skill `disallowed-tools` frontmatter (v2.1.152)                                      | Least-privilege per skill/command                                                  | TRACK — pairs with the deliberately deferred `allowed-tools` hardening pass                                  |
| `/reload-skills` + SessionStart `reloadSkills` (v2.1.152)                            | Skills available same-session after generation                                     | TRACK — useful when `/analyze` generates configs mid-session                                                 |
| Hook upgrades: exec-form `args`, `$CLAUDE_EFFORT`, `terminalSequence` (v2.1.133–141) | Safer spawning, effort-aware hooks, notification sequences                         | TRACK — current hook kit is sufficient; adopt exec-form on next hook edit                                    |

## Re-benchmark 2026-07-10 — the July surface (engine v4.0)

Third pass — a full four-tier `/sync` (anthropic + stack + services + practice, all stamped
2026-07-10) plus a deep sweep of the reference configs Abdout named: vercel-labs/agent-skills +
agent-browser, garrytan/gstack, bmad-method v6.10, github/spec-kit v0.12.9, microsoft/markitdown
v0.1.6, hermes-agent v0.18.2, Claude Design, and the harness-engineering + solo-leverage
literature. Verified against CHANGELOG 2.1.199→2.1.206 and the July docs.

| Finding (source)                                                                            | kun decision                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude 5 family GA; Fable 5 set as session default via `/model`                             | **ADOPTED** — engine model `claude-fable-5`, fallbacks `opus-4-8 → sonnet-5`; agent alias tiers unchanged                                                     |
| spec-kit `clarify` (taxonomy scan + ≤5 questions before the gate)                           | **ADOPTED** — CLARIFY step in `/spec` (≤3 questions, answers encoded into the spec comment)                                                                   |
| spec-kit `analyze` gate semantics (read-only, constitution conflict = CRITICAL)             | **ADOPTED** — READY stage wired into `/feature` (Stage 2.7): coverage + conflict + constitution, FAIL blocks the pipeline                                     |
| Vercel react-best-practices rule pack (impact-tagged, per-rule files)                       | **ADOPTED** — new `react-perf/` domain, 8 rules vendored + `_template.md` + `impactDescription` frontmatter; feeds `stack`/`trace`/`efficient`                |
| Claude Design: `design` plugin (knowledge-work-plugins) + canvas MCP, Max-covered           | **ADOPTED** — onboarding Phase 5 wires both; `claude-design` added to the declared MCP fleet; `/design-login` is a deferred manual click                      |
| Anthropic harness engineering (initializer/worker, evaluator ≠ generator, JSON state)       | **ADOPTED** — `/sync` harness-audit step (retire dead scaffolds on model releases), `/qa` baseline smoke + `blocks.json` verdict contract, CEO-OS Direction 8 |
| Second-brain / one-person-$1M operating moves                                               | **ADOPTED** — NORTH-STAR "enough" line, CEO-OS cash mechanics + custom-work rule, `/weekly` decision-review sweep, memory TL;DR/archive practice              |
| Vocabulary drift: duplicate `feature`/`check`/`ship`, dead BMAD v4 spells, `sync` collision | **ADOPTED** — vocabulary v2: deduped, stale spells pruned, Anthropic-native automation school (`loop`/`goal`/`schedule`/`workflow`), 12 missing spells added  |
| Hermes docs drift (`gateway run` vs `start`; Slack event subscriptions)                     | **ADOPTED** — hermes.mdx corrected against the v0.18.2 official docs                                                                                          |
| TypeScript 7.0 native (Go) stable 2026-07-08; TS 6.0 current JS release                     | TRACK — hold products until **7.1** restores the JS API (typescript-eslint blocked); STACK.md updated                                                         |
| Prisma 6.x maintenance tail ended (6.19.3, Apr 2026); Prisma 7 requires driver adapters     | **PROPOSE** — `/decide` + `/package`-driven migration plan; marketing (already 7.2.0) is the proof path                                                       |
| shadcn/ui defaults to Base UI (Jul 2026); Radix demoted to `-b radix`                       | **PROPOSE** — `/decide` Base-UI-vs-Radix; affects the databayt/radix fork, codebase atoms, shadcn skill pack                                                  |
| vercel-labs/agent-browser (Rust CDP daemon, CLI-first, MCP profiles)                        | TRACK — pilot on one niche keyword before any Playwright swap; no independent benchmark, deep `~/.playwright-auth` wiring stays                               |
| gstack eval infra (LLM-judge skill evals, diff-based selection, gate/periodic tiers)        | TRACK — highest-leverage QA idea seen; costs plan usage, scope to 3–5 pipeline skills when piloted                                                            |
| Cloud routines API/GitHub triggers (P0-labeled issue → auto `/report` session)              | **PROPOSE** — one routine + stored bearer token; removes polling from incident response                                                                       |
| Stacked skills (2.1.199+), MCP `request_timeout_ms`, hook `prompt_id`                       | TRACK — adopt opportunistically on next touch of each surface                                                                                                 |

Ceremony rejected on the cash-flow filter: BMAD party-mode/PRFAQ/sprint-status.yaml, spec-kit
`checklist`/`taskstoissues`/personas, BenAI's n8n/Airtable stack, gstack wholesale (worktree+PR
flow contradicts main-only). Both spec frameworks stop where kun's leverage begins — ship, watch,
incident, browser QA, and the business brain remain kun advantages.

## Engine KPIs — what "pushing the benchmark" means

The feature-parity survey above answers "is kun configured to the frontier?". These KPIs answer
"is the engine actually working?". Measured by the captain every Friday review from native
surfaces, recorded in `.claude/memory/weekly/<date>.md`.

| #   | KPI                                                                                 | Source                                  | Target                            |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| 1   | **Freshness** — sync tiers overdue (anthropic 7d, stack/services 14d, practice 30d) | `engine.json` → `sync.*`                | 0 overdue                         |
| 2   | **Drift** — config vs reality                                                       | `health.sh` + `build-plugin.sh --check` | 0 warnings                        |
| 3   | **Cycle time** — `/idea` issue open → `/watch` close                                | GitHub issue timestamps                 | ≤ 7 days p50                      |
| 4   | **Plan discipline** — usage inside subscription                                     | `/usage` per-category, weekly           | inside Max-100 caps, $0 per-token |
| 5   | **Autonomy** — human unblocks needed per shipped feature                            | session observation + `/insights`       | trending ↓                        |
| 6   | **North-star linkage** — allocations that name their line to the metric             | `weekly/<date>.md`                      | 100%                              |

KPI 6 is the conscience clause: the engine exists to make databayt profitable and sustainable
(`NORTH-STAR.md`). An engine improvement that cannot articulate its line to active-paying-schools
is bench polish, not benchmark push.

## Adoption log

- **2026-07-10** — engine v4.0 benchmark pass: model → Fable 5 (fallbacks opus-4-8 → sonnet-5);
  vocabulary v2 (deduped keywords, BMAD-era spells pruned, `loop`/`goal`/`schedule`/`workflow`
  wired, +12 spells for existing skills); `/spec` CLARIFY + `/feature` READY gate (spec-kit
  semantics); `react-perf/` rule domain (8 rules vendored from vercel-labs/agent-skills);
  Claude Design plugin + MCP in onboarding Phase 5 + declared fleet; onboarding `--doctor`
  mode (all 3 OS backends) + `setup.sh` role default; `/sync` harness-audit + `/qa` verdict
  contract + `/weekly` decision sweep; hermes.mdx corrected to v0.18.2; STACK.md refreshed
  (TS 6/7-native, Prisma 7, shadcn→Base UI, Next 16.3 agent-native); NORTH-STAR "enough" line +
  CEO-OS cash mechanics/custom-work/Direction 8. All four sync tiers stamped 2026-07-10.
- **2026-06-12** — `/sync` self-update loop (four tiers: anthropic + stack + services +
  agent-practice, incl. BMAD-method tracking; keyword `sync` routes to it passively); first
  deterministic workflow (`.claude/workflows/handover.js` — 12-keyword fan-out + adversarial
  FAIL verification); `fallbackModel` chain; engine KPIs defined; captain conscience block
  (argument protocol + engine self-awareness); billing posture corrected to Max 5x $100/mo,
  subscription-only. Engine v3.2.
- **2026-06-04** — founding benchmark (this doc): path-scoped rule corpus, drift CI,
  destructive-bash hook, model tiering codified. Engine v3.1.

## Model-tiering policy

See `engine.json` → `model_tiers`. In short: **opus** for architecture, orchestration, deep
reasoning, code review/fixes, and strategy/leadership; **sonnet** for standard build agents and
mechanical project agents; **haiku** for routine/formatting agents. `report` stays on **opus**
despite being a "loop" agent — it performs real code fixes, and quality-over-speed wins over the
negligible cost saving on a non-hot-path agent.

## Why Claude-native (not AGENTS.md)

`AGENTS.md` is the emerging cross-tool standard, but Claude Code doesn't read it natively (only via
`@import`/symlink), and kun is deliberately Anthropic-native — it _configures_ the Claude Code
harness (skills, hooks, plugins, output styles) rather than targeting a lowest-common-denominator
file. Adopting `AGENTS.md` would add a sync surface for capabilities other tools can't act on. If
the databayt stack is ever driven by Cursor/Codex at scale, the cheap bridge is a generated
`AGENTS.md` that `CLAUDE.md` `@import`s — revisit then, not now.

## Sources

Official: `code.claude.com/docs/en/{memory,hooks,skills,sub-agents,settings,plugins-reference,output-styles}`.
Ecosystem: `agents.md`; `vercel/next.js`, `openai/codex`, `supabase/agent-skills` AGENTS.md files;
community subagent/hook/statusline collections (used for convergent patterns, not verbatim).
