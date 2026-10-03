---
name: monitor
description: Check all deployments, costs, and uptime across databayt products
when_to_use: "Use for one sweep of deploys, uptime and spend across the databayt products, escalating anything red to /incident. Triggers on: monitor, are the deploys green, uptime check, production status sweep."
argument-hint: "[product|all]"
---

Check all deployments, costs, and uptime across databayt products.

Arguments: $ARGUMENTS (optional: product name to check specific product, or "all" for everything)

Steps:

1. Check Vercel deployment status for all products (vercel MCP)
2. Check Sentry error rates — any spikes? (sentry MCP)
3. Check Neon database health — branch count, connection usage (neon MCP)
4. Check GitHub Actions — any failing CI/CD? (github MCP)
4b. Domains & mail — `node scripts/domains/check.mjs` (expiry, auto-renew, NS, MX/SPF/DKIM/DMARC, TLS) + open `domains` issues; fixes go through the `domains` skill
5. Summarize:
   - Deployment status: ✅ healthy / ⚠️ warning / ❌ down
   - Error rate: normal / elevated / critical
   - Database: healthy / needs attention
   - CI/CD: passing / failing
   - Domains & mail: green / warnings / blocking
6. Flag anything that needs immediate attention
7. Estimate current month's cost burn rate

Reference: .claude/agents/ops.md for cost tracking and thresholds
Sedon is the primary ops person — batch non-urgent issues for his weekly review.
