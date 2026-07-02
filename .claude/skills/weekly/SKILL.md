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
1. Check git activity across all product repos (github MCP)
2. Check deployment health (vercel MCP if available)
3. Check error rates (sentry MCP if available)
4. Review revenue status (stripe MCP if available)
5. Summarize what shipped vs what was planned
6. Identify blockers and risks
7. Recommend next week's allocation:
   - Abdout: [technical focus]
   - Ali: [business focus]
   - Samia: [content focus]
   - Sedon: [ops tasks — batched weekly]
8. Output concise summary for Slack posting

Reference: .claude/agents/captain.md for weekly rhythm
Reference: .claude/memory/team.json for team profiles
