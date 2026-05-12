# Build the leadership-tier agent OS (9 leaders + 31 specialists)

**ID**: D-20260331-build-leadership-tier-agent-os
**Date**: 2026-03-31
**Decided by**: founder
**Type**: 1 (architectural — the structure of the agent system shapes all subsequent work)
**Status**: executed
**Reviewed-by**: 2026-06-30 (Q2 end)
**Tags**: #architecture #agents #captain #leadership #backfilled

## Decision

Build the Databayt agent OS as a tiered hierarchy: **Tier 0 captain** → **Tier 1 business** (revenue, growth, support) → **Tier 2 product** (product, analyst) → **Tier 3 tech** (tech-lead, ops, guardian) → **31 specialists** (engineering execution agents). 9 leadership-tier agents total. Each leadership agent has explicit handoff list, MCP allocation, and per-product knowledge.

## Context

- Pre-decision state: scattered specialist agents with no business-side coverage.
- Vision: Kun should run both technical AND business operations of Databayt.
- Founder constraint: 4 (now 6) human teammates need 40+ AI agents to operate as a 20-person company.
- Anthropic Routines + Claude Code subagents make this architecture executable.

## Premortem (retrospective)

- *"It failed because the captain agent had no real authority and became advisory."* — Partial; addressed in Captain v2 (this Phase A, May 2026).
- *"It failed because leadership tiers became overhead, not leverage."* — Not yet — but risk if not used. Mitigated by routines that wake the captain weekly.
- *"It failed because the specialist agents got smarter than the leadership agents."* — Not yet, but the framework needs leadership-tier discipline (frontmatter, memory, decision matrix as YAML — all addressed in Phase A).

## Expected outcome

- **Success looks like**: 6 humans operate as a 20-person company. Founder leverage measurably increases. Customer-facing functions (revenue, support, growth) have real agent backing.
- **Failure looks like**: Agents become noise; team ignores them; Abdout still does everything alone.
- **Probability of success (at decision time)**: 0.65
- **Reasoning**: Novel architecture; depends heavily on captain v2 maturity.

## Alternatives considered

1. **Flat agent structure (no tiers)**: Rejected — no clear coordination point; specialist conflicts unresolved.
2. **Single super-captain agent**: Rejected — too much context for one agent; violates separation of concerns.
3. **Tier 0 only (just captain)**: Rejected — captain alone can't carry 5 products.

## Action

- Owner: Abdout
- Due: 2026-03-31
- Next checkpoint: 2026-06-30

## Review

(To be filled at reviewed-by date 2026-06-30.)

**Notes from backfill (2026-05-12)**: 9 leadership agents built and operating (captain, revenue, growth, support, product, analyst, tech-lead, ops, guardian). 31+ specialists in `/Users/abdout/kun/.claude/agents/`. Captain v2 (this Phase A) addresses the "captain advisory not authoritative" risk by giving it persistent state, frontmatter discipline, and machine-parseable decision matrix.
