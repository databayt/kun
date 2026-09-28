---
name: economy
description: Token economy — audit consumption and delegate across model × effort × product lane
when_to_use: "Use when token consumption, plan limits, or usage windows are the topic — auditing what's burning the Max pool, delegating work to a cheaper model/effort/product lane, or applying session hygiene. Triggers on: economy, token usage, optimize tokens, we're burning tokens, hit the limit, usage window, plan limit, tokens per outcome, توكن, استهلاك."
argument-hint: "[audit|route <task>]"
model: sonnet
effort: medium
---

Token-economy audit and delegation. Policy: `docs/TOKEN-ECONOMY.md`; machine truth: `.claude/engine.json` → `delegation`.

Arguments: $ARGUMENTS (default `audit`; or `route <task description>` to place one task on the cheapest adequate lane)

## The constraint

Max 5x ($100/mo), subscription-only. There is no dollar meter — the budget is the **5-hour session window + weekly window**, and it is **one pool shared across Claude Code, Claude chat, and Cowork**. Optimization = tokens-per-outcome. Only the `a` (Antigravity/Gemini) and `h` (Hermes/Nous) lanes are off-pool.

## `audit` mode

1. **Measure the session surface** (report numbers, don't guess): `node .claude/scripts/preamble.mjs [repo]` reads the newest transcript and prints the first-turn prefix in tokens plus every surface the harness injected, in chars — each instruction file, the skill listing, MCP tool names per server, MCP instruction blocks, the agent listing (`--last 10` for the trend). Baseline after the 2026-09-28 pass: ~54K session-specific tokens per kun turn (`docs/TOKEN-ECONOMY.md`).
   - Instruction files: flag any always-loaded file that grew; detail needed only sometimes belongs in a skill or a doc (loaded on demand). MEMORY.md is an index — one short hook per line, the content lives in the files.
   - MCP: price each server from that output, then check its use — count `mcp__<server>__` calls across `~/.claude/projects/*/*.jsonl`. Propose removing the unused ones (user scope: `claude mcp remove -s user <name>`; a claude.ai connector: a `deniedMcpServers` entry) — reversible, but needs Abdout's nod, since other sessions/skills may depend on them.
   - Skill listing: it sits at the `skillListingBudgetFraction` ceiling while total demand exceeds it, so trimming descriptions buys dispatch room, not tokens — the saving comes only from less demand or a lower fraction.
   - Fleet drift: every agent in `~/.claude/agents/` and `.claude/agents/` must carry `effort:` matching its model per `engine.json → delegation.efforts` (haiku→low, sonnet→medium, opus→high; captain/architecture/orchestration→xhigh). Fix drift mechanically.
   - Tell Abdout to run `/usage` (per-category breakdown, flags long-context/cache-miss behaviors ≥10%) and `/context` (what fills this session) — these are interactive-only.
2. **Report**: one table — surface, current cost, action, saving. Apply mechanical fixes (effort drift, stale skill pointers); propose posture changes (MCP trim, CLAUDE.md diet) without executing.

## `route <task>` mode

Place the task on the cheapest adequate lane, citing `engine.json → delegation`:

1. **Off-pool first**: trivial one-file mechanical change → `a` lane. Chat relay/gateway → `h` lane.
2. **Product lane**: pure think-work (Q&A, drafting, decisions) → Claude chat or Cowork (handoff via bridge.md), not a Code session dragging rules + MCP + repo per turn. Long-running babysitting → claude.ai/code routine, kept lean.
3. **Model × effort**: inside Code, delegate to the lowest-tier agent that can own it — subagents keep verbose output (tests, logs, docs-fetch) out of the main context, returning only the summary. Workflow stages get explicit `opts.effort` (low for mechanical, high+ only for verify/judge).
4. **Session hygiene** for whatever stays in the main loop: `/clear` between unrelated tasks; `/compact <focus>` on long ones; batch touches inside the 1h cache window; plan mode before big builds; specific prompts over "improve this".

## Standing rules (any mode)

- Fable tokenizer counts ~30% more than pre-4.7 models — never reuse old token estimates; recount against the current model (`engine.json` → `model`).
- Fable can't disable thinking — **effort is the lever**, not `MAX_THINKING_TOKENS`.
- Never propose usage credits or API-key spend — subscription-only posture changes require `/decide` + Abdout.
