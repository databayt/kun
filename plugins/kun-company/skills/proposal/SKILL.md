---
name: proposal
description: Generate a client proposal via the revenue agent
when_to_use: "Use when generating a client proposal via the revenue agent — scope, pricing, timeline, and branded structure ready to send to a school or client. Triggers on: proposal, draft the offer, client proposal, send them a quote."
argument-hint: <product> <client>
---

Generate a client proposal using the revenue agent.

Arguments: $ARGUMENTS (product name and client name, e.g., "hogwarts Ahmed Baha")

Steps:

1. Identify the product and client from arguments
2. Use the analyst agent to research the client's vertical and competitors
3. Use the revenue agent's proposal template
4. Include: client challenge, solution, features, pricing tier recommendation, timeline, why databayt
5. Generate both Arabic and English versions if the client is Saudi
6. Output as markdown ready for Notion or PDF export

Reference pricing from: .claude/agents/revenue.md
Reference team from: .claude/memory/team.json
Ali is the primary person who will deliver this proposal.
