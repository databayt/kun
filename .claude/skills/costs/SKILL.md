---
name: costs
description: API spend breakdown and cost optimization analysis.
context: fork
agent: general-purpose
---

API spend breakdown and cost optimization analysis.

Arguments: $ARGUMENTS (optional: "monthly" for full report, or specific service like "vercel", "neon", "stripe")

Steps:
1. Gather cost data:
   - Claude Max subscription: $200/mo (fixed)
   - Vercel: Check usage tier and bandwidth (vercel MCP)
   - Neon: Check branch count, compute hours (neon MCP)
   - Stripe: Calculate transaction fees from recent volume (stripe MCP)
   - Domains: Estimate from known registrations
2. Calculate total monthly spend
3. Compare against budget (~$500/mo burn, $5K capital = 10 months runway)
4. Identify optimization opportunities:
   - Can any Vercel project stay on free tier?
   - Are there stale Neon branches to delete?
   - Can Stripe fees be reduced with annual billing?
   - Are we using Claude API efficiently?
5. Project next month's costs based on trends
6. Output: cost table, trend, optimizations, recommendation

Reference: .claude/agents/ops.md for cost structure
Reference: .claude/agents/revenue.md for revenue context
