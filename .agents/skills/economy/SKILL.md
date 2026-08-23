---
name: economy
description: Token economy — audit consumption and delegate across model × effort × product lane
when_to_use: "Use when token consumption, plan limits, or usage windows are the topic — auditing what's burning the Max pool, delegating work to a cheaper model/effort/product lane, or applying session hygiene. Triggers on: economy, token usage, optimize tokens, we're burning tokens, hit the limit, usage window, plan limit, tokens per outcome, توكن, استهلاك."
argument-hint: "[audit|route <task>]"
model: sonnet
effort: medium
---

Token-economy audit and delegation. Policy: `docs/TOKEN-ECONOMY.md`; machine truth: `.Codex/engine.json` → `delegation`.

Arguments: $ARGUMENTS (default `audit`; or `route <task description>` to place one task on the cheapest adequate lane)

## The constraint

Max 5x ($100/mo), subscription-only. There is no dollar meter — the budget is the **5-hour session window + weekly window**, and it is **one pool shared across Codex, Codex chat, and Cowork**. Optimization = tokens-per-outcome. Only the `a` (Antigravity/Gemini) and `h` (Hermes/Nous) lanes are off-pool.

## `audit` mode

1. **Measure the session surface** (report numbers, don't guess):
   - Always-loaded config: `wc -c ~/.Codex/AGENTS.md ~/.Codex/rules/*.md <repo>/AGENTS.md <repo>/.Codex/AGENTS.md <repo>/.Codex/rules/*.md` (top-level only — domain rules are path-scoped). Flag anything pushing the preamble past ~15KB; propose moving workflow detail into skills (they load on demand).
   - MCP surface: `python3 -c "import json; d=json.load(open('$HOME/.Codex.json')); print(list(d.get('mcpServers',{}).keys()))"` — tool schemas are deferred, but every server still injects its name list and instructions block. Flag servers unused in recent memory; propose `Codex mcp remove` for them (reversible; needs Abdout's nod — other sessions/skills may depend on them).
   - Fleet drift: every agent in `~/.Codex/agents/` and `.Codex/agents/` must carry `effort:` matching its model per `engine.json → delegation.efforts` (haiku→low, sonnet→medium, opus→high; captain/architecture/orchestration→xhigh). Fix drift mechanically.
   - Tell Abdout to run `/usage` (per-category breakdown, flags long-context/cache-miss behaviors ≥10%) and `/context` (what fills this session) — these are interactive-only.
2. **Report**: one table — surface, current cost, action, saving. Apply mechanical fixes (effort drift, stale skill pointers); propose posture changes (MCP trim, AGENTS.md diet) without executing.

## `route <task>` mode

Place the task on the cheapest adequate lane, citing `engine.json → delegation`:

1. **Off-pool first**: trivial one-file mechanical change → `a` lane. Chat relay/gateway → `h` lane.
2. **Product lane**: pure think-work (Q&A, drafting, decisions) → Codex chat or Cowork (handoff via bridge.md), not a Code session dragging rules + MCP + repo per turn. Long-running babysitting → Codex.ai/code routine, kept lean.
3. **Model × effort**: inside Code, delegate to the lowest-tier agent that can own it — subagents keep verbose output (tests, logs, docs-fetch) out of the main context, returning only the summary. Workflow stages get explicit `opts.effort` (low for mechanical, high+ only for verify/judge).
4. **Session hygiene** for whatever stays in the main loop: `/clear` between unrelated tasks; `/compact <focus>` on long ones; batch touches inside the 1h cache window; plan mode before big builds; specific prompts over "improve this".

## Standing rules (any mode)

- Fable tokenizer counts ~30% more than pre-4.7 models — never reuse old token estimates; recount against `Codex-fable-5`.
- Fable can't disable thinking — **effort is the lever**, not `MAX_THINKING_TOKENS`.
- Never propose usage credits or API-key spend — subscription-only posture changes require `/decide` + Abdout.
