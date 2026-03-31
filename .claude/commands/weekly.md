Run the captain's weekly review.

Arguments: $ARGUMENTS (optional: "plan" for Monday planning, "check" for Wednesday, "review" for Friday)

Default behavior (no args): Full weekly review.

Steps:
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
