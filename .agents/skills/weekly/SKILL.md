---
name: weekly
description: Run the captain's weekly Monday-plan / Wednesday-check / Friday-review cycle
when_to_use: "Use when running the captain's weekly cadence — Monday plan (allocate the 7 humans), Wednesday check (progress vs plan), Friday review (coach + canon principle) with archive to memory/weekly. Triggers on: weekly, monday plan, friday review, plan the week."
argument-hint: "[plan|check|review]"
---

Run the captain's weekly review.

Arguments: $ARGUMENTS (optional: "plan" for Monday planning, "check" for Wednesday, "review" for Friday)

Default behavior (no args): Full weekly review.

Steps:

0. Run `/sync` — refresh the engine's view of its ecosystem before planning (due tiers only; it self-skips tiers whose `engine.json → sync.<tier>` stamp is fresh)
   0.5. **Engine self-check (free tier first)** — run `node .Codex/scripts/lint-contracts.mjs`, `node .Codex/scripts/harvest-transcripts.mjs --out .Codex/evals/cases/real-pairs.json` (the fidelity set grows from the week's sessions), `node .Codex/scripts/bench-retire.mjs` (retirement evidence for the review), and `node .Codex/scripts/extract-dispatch-cases.mjs --check`. All four are deterministic and cost nothing. Only if a guard trips, or `engine.json → eval.cadence_days` has elapsed since `skill-scores.json → last_updated`, run the `bench-dispatch` workflow (~16 agents, ~1.3M subagent tokens). L1 is saturated at 1.0, so it is a **regression tripwire, not an improvement target** — a drop is the signal; a 1.0 is not news. Record the result in `weekly_history` and report KPIs 7–8 alongside the other six.
1. Check git activity across all product repos (github MCP)
2. Check deployment health (vercel MCP if available)
3. Check error rates (sentry MCP if available)
4. Review revenue status (stripe MCP if available)
5. Summarize what shipped vs what was planned
6. Identify blockers and risks
   6.5. **Decision-review sweep (Friday / full review only)** — scan the decision journal (`.Codex/memory/decisions/` and `/decide` entries) for entries whose reviewed-by date has passed: grade the prediction against what actually happened, write the lesson as a `feedback_*` memory, and mark the entry reviewed. Predictions that are never graded never compound.
7. Recommend next week's allocation:
   - Abdout: [technical focus]
   - Ali: [business focus]
   - Samia: [content focus]
   - Sedon: [ops tasks — batched weekly]
8. Output concise summary for Slack posting

Reference: .Codex/agents/captain.md for weekly rhythm
Reference: .Codex/memory/team.json for team profiles
