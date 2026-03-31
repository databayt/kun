Incident response workflow for production issues.

Arguments: $ARGUMENTS (description of the incident, e.g., "hogwarts login page returning 500")

Steps:
1. Classify severity:
   - P0: Service completely down, customers affected
   - P1: Service degraded, some features broken
   - P2: Minor issue, workaround available
2. Gather context:
   - Check Sentry for related errors (sentry MCP)
   - Check Vercel deployment logs (vercel MCP)
   - Check Neon database status (neon MCP)
   - Check recent git commits that might have caused it (github MCP)
3. Diagnose:
   - Use sse agent for server-side error analysis
   - Check if the issue is in the latest deployment
   - Determine if rollback is needed
4. Respond based on severity:
   - P0: Alert Abdout via Slack immediately, recommend rollback
   - P1: Create Linear issue, delegate to tech-lead
   - P2: Log for next sprint, inform support agent
5. Track:
   - Create Linear issue with all context
   - Start resolution timer
   - Update support agent for customer communication
6. Post-mortem (after resolution):
   - What broke and why
   - How was it detected
   - How to prevent recurrence
   - Update guardian agent's checklist if needed

Reference: .claude/agents/ops.md for incident workflow
Reference: .claude/agents/guardian.md for security implications
