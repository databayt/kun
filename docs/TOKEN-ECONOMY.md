# Token Economy — delegate model × effort × product lane

> The budget is not dollars. On Max 5x ($100/mo, subscription-only) the budget is the
> **5-hour session window + weekly window** — one pool shared across Claude Code, Claude
> chat, and Cowork. Every optimization here is tokens-per-outcome: same result, smaller
> draw on the pool. Machine-readable truth: `.claude/engine.json → delegation`.
> On-demand audit: `/economy`.

Sources: [Claude Code costs](https://code.claude.com/docs/en/costs) ·
[Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) ·
community practice (r/ClaudeCode). Adopted 2026-07-26.

## Facts the policy stands on

| Fact                                                          | Consequence                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All Anthropic surfaces draw one Max pool                      | Product delegation shifts _tokens-per-outcome_, not quota; only `a`/`h` lanes are off-pool                                                              |
| The 4.7-generation-on tokenizer counts ~35% more than earlier | Never reuse old token estimates; recount against the current model (`engine.json` → `model`)                                                            |
| Opus 5.5 and Fable cannot turn thinking off                   | **Effort is the lever** (`/effort`, agent `effort:` frontmatter, Workflow `opts.effort`)                                                                |
| Opus 5.5 lists at 2× Sonnet 5 per token ($4/$20 vs $2/$10)    | Down-tier routine work, but judge per solved task — on nextjs.org/evals Opus 5.5 solved more for less                                                   |
| Prompt-cache TTL is 1h on subscription                        | A >1h idle gap reprocesses full context on the next message — batch touches inside the window                                                           |
| Full conversation travels with every message                  | A one-line question in an all-day session pays for the whole day — `/clear` between tasks                                                               |
| MCP schemas are deferred, but names + instructions still load | Measured 2026-09-28: 13 user-scope servers + the claude.ai connectors ≈ 380 tool names (13K chars) in every session — `preamble.mjs` prices each server |
| Scheduled tasks fire with full context even while idle        | Keep routines lean and infrequent                                                                                                                       |
| Token-counting API is free but needs an API key               | Out of subscription-only posture; not wired                                                                                                             |

## Axis 1 — model tier (who runs the task)

Already encoded in agent frontmatter; `engine.json → model_tiers` is the doctrine.

| Tier   | Agents                                             | Work                                                 |
| ------ | -------------------------------------------------- | ---------------------------------------------------- |
| opus   | main loop + strategy/leadership + deep specialists | Interactive judgment, architecture, review, fixes    |
| fable  | `/model` escalation only                           | Never in agents, fallbacks, or headless `-p` runs    |
| sonnet | build agents                                       | Standard implementation with known patterns          |
| haiku  | mechanical agents                                  | Formatting, git, icons, comments, routine transforms |

Delegate verbose operations (test runs, log processing, docs fetching) to subagents even when
the tier is the same — the verbose output stays in the subagent's context; only the summary
returns.

## Axis 2 — effort (how hard it thinks)

New dimension added 2026-07-26: **every agent carries `effort:` frontmatter** matching its
model tier — haiku→`low`, sonnet→`medium`, opus→`high`; judgment tier (captain, architecture,
orchestration)→`xhigh`. Thinking tokens bill as output tokens; on Opus 5.5 and Fable this is the
only thinking control that exists. Haiku 4.5 has no effort levels — `effort: low` is a no-op there.

- Main loop: default effort stays as set in `/model`; raise to xhigh only for explicit deep-design asks.
- Workflow scripts: pass `opts.effort` per stage — `low` for mechanical stages, `high`+ only for verify/judge stages.
- Models that can disable thinking: `MAX_THINKING_TOKENS=8000` is available, but prefer effort levels — they survive model switches.

## Axis 3 — product lane (which surface hosts the work)

| Lane                    | Pool         | Route here                                                                                    |
| ----------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| Claude Code (`c`)       | shared       | Build work only — heaviest per-turn context (rules + MCP + repo travel with every message)    |
| Cowork                  | shared       | Planning, research, decisions, docs — no repo/MCP preamble; handoff via `~/.claude/bridge.md` |
| Claude chat / desktop   | shared       | Pure Q&A, drafting, brainstorming — cheapest surface; think there, then open Code to build    |
| claude.ai/code routines | shared       | Long-running babysitting (autofix-pr, schedules) — lean prompts, wide intervals               |
| Antigravity (`a`)       | **off-pool** | Easy one-file mechanical tasks — Gemini, zero Anthropic tokens                                |
| Hermes (`h`)            | **off-pool** | Chat relay/gateway tasks — never build work                                                   |

The routing question is always: _what is the cheapest surface that can own this outcome?_
Off-pool first, then the lightest shared surface, then Code.

## Session hygiene (the daily 80/20)

1. **`/clear` between unrelated tasks** — `/rename` first so `/resume` can find it later.
2. **`/compact <focus>`** on long tasks — compaction itself reads the whole conversation, so compact before the context is huge, not after.
3. **Stay inside the cache window** — the 1h TTL means a lunch-break gap makes the next message a full-context cache miss.
4. **Plan mode before big builds** — wrong-direction rework is the single most expensive failure; Escape early, `/rewind` instead of arguing.
5. **Specific prompts** — "add validation to `login` in auth.ts" beats "improve auth" by an order of magnitude of file reads.
6. **Verification targets in the prompt** — expected output/tests let Claude self-check instead of round-tripping.
7. **`/usage` weekly** (already engine doctrine) — the breakdown flags long-context and cache-miss behaviors at ≥10% with per-item tips; `/context` shows what fills the current session.

## Adopted 2026-07-26 (were standing proposals)

- **MCP trim** ✅: removed `sequential-thinking`, `storybook`, `a11y` (was dead), `tailwind`, `git` (Bash covers git) from user-scope registration and both catalogs (29 → 25). Re-add anytime: `claude mcp add <name> ...` per the catalog entry in git history. Prefer CLIs where they exist: `gh`, `vercel`, `sentry-cli` cost zero preamble.
- **CLAUDE.md diet** ✅: user CLAUDE.md 11.5KB → 3.3KB (keyword table → compact pointer; registry + skill `when_to_use` are the routing truth). Template matched.
- **Rules dedupe** ✅ (found during adoption): the four cross-repo rules (`cowork-bridge`, `github-workflow`, `patterns`, `block-protocol`) double-loaded in every kun session — once from `~/.claude/rules/` (setup.sh install) and once from project `.claude/rules/`. They now live in `.claude/rules-global/` (dist-only, no auto-load) and load exactly once at user level; `engine-parity.md` stays project-side only. ~12KB per kun session saved.

## Adopted 2026-09-28 — the preamble pass

Measured, not estimated: `node .claude/scripts/preamble.mjs` reads a real transcript and prints
the first turn's prompt size plus every surface the harness injected (`--last N` for the trend,
a repo path for another repo). Before the pass, a kun session opened at **96,938 tokens** —
26,937 of them Claude Code's shared system prompt, ~70K the engine's own surfaces, re-read on
every turn. A fresh session after it: **~54K** session-specific tokens (−16K per turn).

| Surface (chars)   | Before | After  | What changed                                                                                                                                              |
| ----------------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction files | 60,251 | 36,539 | MEMORY.md index 17.1K → 6.8K (facts moved into the memory files); the four cross-repo rules 22.7K → 9.6K (Cowork-side detail → `content/docs/cowork.mdx`) |
| MCP tool names    | 27,921 | 13,109 | claude.ai Vercel (243 names) + PlanetScale stub denied on Abdout's Mac; `higgs` removed from user scope                                                   |
| MCP instructions  | 10,952 | 7,342  | the Vercel and higgs instruction blocks went with them                                                                                                    |
| Skill listing     | 59,951 | 58,429 | fleet 38,915 → 32,356 (back under `listing_cap`) — but see below                                                                                          |

**The skill listing is pinned by the budget, not by the fleet.** `skillListingBudgetFraction`
(0.02 since 2026-09-26) is a ceiling the harness fills: while total demand exceeds it, it drops
descriptions of the least-used skills, so the listing sits at ~60K chars. Trimming the fleet by
6.5K did not shrink it — the room was taken at once by eight claude.ai skills (docx, pptx, xlsx,
pdf, deep-research, …) that had been listed name-only. That is a dispatch gain, not a saving.
The listing only gets cheaper when total demand falls below the budget (the synced figma /
design / cowork plugins are ~9K of it — kept by Abdout's call on 2026-09-28) or the fraction is
lowered — test that with `/skill-doctor`, since at 0.01 kun's own skills lost their descriptions.

Re-add paths: delete an entry from `deniedMcpServers` in `~/.claude/settings.json` (a personal
key setup.sh preserves) · `claude mcp add --transport http -s user higgs https://mcp.higgsfield.ai/mcp`
then authorize. The seven servers removed on 2026-09-26 (airtable, linear, notion, posthog,
sentry, slack, stripe) now carry `$skipRegistration` in the catalog — before this, an
interactive `setup.sh` run would have registered all seven again.

Same pass: `format-on-write` calls the repo's own prettier (0.66 s per edit in kun, was
1.6–3.8 s of npx registry checks); `.prettierignore` keeps machine-written JSON in its writers'
style; the report-queue and block-protocol hooks, never wired since setup.sh owns the `hooks` key,
are now in `.claude/settings.json`.

## Standing proposals (Abdout's call, not auto-applied)

- **Hooks as preprocessors**: a PreToolUse hook can filter test/log output to failures-only before Claude reads it (the costs doc ships a ready `filter-test-output.sh` pattern).
- **Code intelligence plugin**: typed-language plugins replace grep-then-read-candidates with one go-to-definition call.

## Enforcement

- `/economy` audits a session and fixes mechanical drift (missing `effort:`, stale pointers).
- `/health` counts include the economy skill; engine-parity applies (plugins + vocab rebuilt in the same commit).
- `/sync` (anthropic tier) re-checks these facts against the costs/token-counting docs — they are release-sensitive (cache TTLs, tokenizer, effort semantics).
