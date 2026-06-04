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
