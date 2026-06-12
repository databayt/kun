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

Second pass, produced by the new `/sync-anthropic` loop (which makes re-benchmarking continuous
instead of episodic). Surface verified against the Claude Code CHANGELOG (v2.1.129 → v2.1.175)
and the platform release notes.

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

## Engine KPIs — what "pushing the benchmark" means

The feature-parity survey above answers "is kun configured to the frontier?". These KPIs answer
"is the engine actually working?". Measured by the captain every Friday review from native
surfaces, recorded in `.claude/memory/weekly/<date>.md`.

| #   | KPI                                                                     | Source                                  | Target                            |
| --- | ----------------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| 1   | **Freshness** — days since Anthropic sync                               | `engine.json` → `anthropic_sync.last`   | ≤ 7                               |
| 2   | **Drift** — config vs reality                                           | `health.sh` + `build-plugin.sh --check` | 0 warnings                        |
| 3   | **Cycle time** — `/idea` issue open → `/watch` close                    | GitHub issue timestamps                 | ≤ 7 days p50                      |
| 4   | **Plan discipline** — usage inside subscription                         | `/usage` per-category, weekly           | inside Max-100 caps, $0 per-token |
| 5   | **Autonomy** — human unblocks needed per shipped feature                | session observation + `/insights`       | trending ↓                        |
| 6   | **North-star linkage** — allocations that name their line to the metric | `weekly/<date>.md`                      | 100%                              |

KPI 6 is the conscience clause: the engine exists to make databayt profitable and sustainable
(`NORTH-STAR.md`). An engine improvement that cannot articulate its line to active-paying-schools
is bench polish, not benchmark push.

## Adoption log

- **2026-06-12** — `/sync-anthropic` self-update loop; first deterministic workflow
  (`.claude/workflows/handover.js` — 12-keyword fan-out + adversarial FAIL verification);
  `fallbackModel` chain; engine KPIs defined; captain conscience block (argument protocol +
  engine self-awareness); billing posture corrected to Max 5x $100/mo, subscription-only.
  Engine v3.2.
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
