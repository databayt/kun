Check all deployments, costs, and uptime across databayt products.

Arguments: $ARGUMENTS (optional: product name to check specific product, or "all" for everything)

Steps:
1. Check Vercel deployment status for all products (vercel MCP)
2. Check Sentry error rates — any spikes? (sentry MCP)
3. Check Neon database health — branch count, connection usage (neon MCP)
4. Check GitHub Actions — any failing CI/CD? (github MCP)
5. Summarize:
   - Deployment status: ✅ healthy / ⚠️ warning / ❌ down
   - Error rate: normal / elevated / critical
   - Database: healthy / needs attention
   - CI/CD: passing / failing
6. Flag anything that needs immediate attention
7. Estimate current month's cost burn rate

Reference: .claude/agents/ops.md for cost tracking and thresholds
Sedon is the primary ops person — batch non-urgent issues for his weekly review.
