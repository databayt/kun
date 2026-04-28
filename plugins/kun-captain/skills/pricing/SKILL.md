---
name: pricing
description: Calculate and compare pricing tiers for a databayt product.
---

Calculate and compare pricing tiers for a databayt product.

Arguments: $ARGUMENTS (product name, e.g., "hogwarts" or "souq")

Steps:
1. Load pricing strategy from .claude/agents/revenue.md
2. Use analyst agent to pull competitor pricing benchmarks
3. Calculate cost structure from .claude/agents/ops.md cost tracking
4. Generate pricing table with tiers: Free, Starter, Pro, Enterprise
5. Show cost vs margin analysis for each tier
6. Compare against competitors in the vertical
7. Recommend optimal pricing with justification

Output: Pricing table, competitor comparison, margin analysis, recommendation.
