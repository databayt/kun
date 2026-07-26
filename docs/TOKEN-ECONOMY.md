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

| Fact                                                          | Consequence                                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| All Anthropic surfaces draw one Max pool                      | Product delegation shifts _tokens-per-outcome_, not quota; only `a`/`h` lanes are off-pool    |
| Fable/Mythos tokenizer counts ~30% more than pre-4.7 models   | Never reuse old token estimates; recount against `claude-fable-5`                             |
| Fable cannot disable extended thinking                        | **Effort is the lever** (`/effort`, agent `effort:` frontmatter, Workflow `opts.effort`)      |
| Opus-class burns ~5× sonnet against plan windows              | Down-tier every task that doesn't need judgment                                               |
| Prompt-cache TTL is 1h on subscription                        | A >1h idle gap reprocesses full context on the next message — batch touches inside the window |
| Full conversation travels with every message                  | A one-line question in an all-day session pays for the whole day — `/clear` between tasks     |
| MCP schemas are deferred, but names + instructions still load | 25 registered global servers ≈ hundreds of tool names in every session's preamble             |
| Scheduled tasks fire with full context even while idle        | Keep routines lean and infrequent                                                             |
| Token-counting API is free but needs an API key               | Out of subscription-only posture; not wired                                                   |

## Axis 1 — model tier (who runs the task)

Already encoded in agent frontmatter; `engine.json → model_tiers` is the doctrine.

| Tier   | Agents                                 | Work                                                 |
| ------ | -------------------------------------- | ---------------------------------------------------- |
| fable  | main loop only                         | Interactive judgment, captain-grade calls            |
| opus   | strategy/leadership + deep specialists | Architecture, review, fixes, product references      |
| sonnet | build agents                           | Standard implementation with known patterns          |
| haiku  | mechanical agents                      | Formatting, git, icons, comments, routine transforms |

Delegate verbose operations (test runs, log processing, docs fetching) to subagents even when
the tier is the same — the verbose output stays in the subagent's context; only the summary
returns.

## Axis 2 — effort (how hard it thinks)

New dimension added 2026-07-26: **every agent carries `effort:` frontmatter** matching its
model tier — haiku→`low`, sonnet→`medium`, opus→`high`; judgment tier (captain, architecture,
orchestration)→`xhigh`. Thinking tokens bill as output tokens; on Fable this is the only
thinking control that exists.

- Main loop: default effort stays as set in `/model`; raise to xhigh only for explicit deep-design asks.
- Workflow scripts: pass `opts.effort` per stage — `low` for mechanical stages, `high`+ only for verify/judge stages.
- Non-Fable models: `MAX_THINKING_TOKENS=8000` is available, but prefer effort levels — they survive model switches.

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

## Standing proposals (Abdout's call, not auto-applied)

- **MCP trim**: 25 global servers registered; the rarely-used ones (e.g. `sequential-thinking`, `storybook`, `a11y`, `tailwind`, `git` — Bash covers git) each tax every session's preamble. `claude mcp remove <name>` is reversible. Prefer CLIs where they exist: `gh`, `vercel`, `sentry-cli` cost zero preamble.
- **CLAUDE.md diet**: always-loaded config (user CLAUDE.md + rules + project CLAUDE.md + rules) is ~35KB ≈ 10–12k tokens per session before work starts. The official guidance is <200 lines; the keyword tables and playbook detail could move into skills (on-demand) with one-line pointers left behind.
- **Hooks as preprocessors**: a PreToolUse hook can filter test/log output to failures-only before Claude reads it (the costs doc ships a ready `filter-test-output.sh` pattern).
- **Code intelligence plugin**: typed-language plugins replace grep-then-read-candidates with one go-to-definition call.

## Enforcement

- `/economy` audits a session and fixes mechanical drift (missing `effort:`, stale pointers).
- `/health` counts include the economy skill; engine-parity applies (plugins + vocab rebuilt in the same commit).
- `/sync` (anthropic tier) re-checks these facts against the costs/token-counting docs — they are release-sensitive (cache TTLs, tokenizer, effort semantics).
