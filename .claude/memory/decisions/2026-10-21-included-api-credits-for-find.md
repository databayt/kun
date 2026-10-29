# The /find rental agent may spend included Max API credits, capped at $15 a month

**ID**: D-20261021-included-api-credits-for-find
**Date**: 2026-10-21
**Decided by**: founder (Abdout, choosing Haiku 5.5 and the cap while approving the mkan agent plan)
**Type**: 2 (reversible — unset `AGENT_ANTHROPIC_API_KEY`, or write a `capped` row, and the agent falls back to Groq, then rules)
**Status**: decided
**Reviewed-by**: 2026-11-04
**Tags**: #billing #mkan #agent

## Decision

mkan's `/find` rental agent reads every typed tenant message with Claude Haiku 5.5 (`claude-haiku-5-5`, $0.10 / $0.50 per MTok) and writes its replies with it, paid **only** from the Max plan's included $100 / month API credits. The code enforces a hard cap of **$15 a month** (`AGENT_API_CAP_USD`) from a Postgres ledger (`ApiSpend`), paced to at most twice the daily share, and treats a 402 or "credit balance" error as the cap. Paid overage is never used. The fallback chain is Groq's free tier, then the deterministic rules. The key is its own name, `AGENT_ANTHROPIC_API_KEY`, so the uncapped report-triage path (`src/lib/report/triage.ts`, which reads plain `ANTHROPIC_API_KEY`) stays off. This extends D-20261021-included-api-credits-for-readers (scrape readers, $10 cap); together they can use at most $25 of the $100.

## Context

The agent's reader was Groq's free `openai/gpt-oss-20b`: a 3.5 s timeout, a key shared with the TikTok lane (429s pause it for 60 s), and a narrow field list that missed landmarks, must-haves, move-in dates and USD amounts. Replies were dictionary templates. Over the 30 days to 10-18: 15 conversations, 10 shortlists, 0 broker asks. Abdout asked for an agent that is smart, remembers, and finds the best match in few interactions, and suggested the included credits.

## Expected outcome

- **Success looks like:** Claude reads at least 90% of typed turns; turns to the first shortlist stay ≤ 4 s; the month's agent spend stays under $15, with no cap hit before the 25th; turns to the first shortlist fall to 1 for at least 90% of conversations.
- **Failure looks like:** the cap is hit mid-month by abuse or a loop; p95 reader latency over 2.5 s; Claude misreads Arabic or Kinyarwanda more than the rules do on the golden set.
- **Probability of success:** 0.8
- **Reasoning:** about 3k input and up to 650 output tokens per read plus about 1.5k / 300 per reply is roughly $0.001 a turn, so $15 covers about 15k turns a month; today's volume is about 60. Per-IP and per-profile rate limits plus daily pacing bound abuse.

## Alternatives considered

1. **Sonnet 5.5 ($30 cap)**: sharper on messy multi-constraint Arabic, but about ten times the cost per turn and turns of 4–5 s. Rejected on latency and spend for a requirements reader.
2. **Opus 5.5 ($40 cap)**: the smartest and the slowest, 5–7 s turns. More than reading a rental request needs.
3. **Do nothing (stay on Groq free)**: keeps the 429s, the 3.5 s timeout and the weak Arabic and Kinyarwanda reading that the plan exists to fix.

## Action

- Owner: Claude Code (mkan agent plan, phase P2) + Abdout (claim the credits, create the key)
- Key: Keychain `mkan-ANTHROPIC_API_KEY` (Mac lanes) and `cf-mkan-AGENT_ANTHROPIC_API_KEY` (prod, via `scripts/cf-secrets.sh`)
- Kill switch: `INSERT INTO "ApiSpend"(day, lane, "updatedAt") VALUES (to_char(now(),'YYYY-MM-DD'), 'capped', now())` stops every instance within a minute until the month turns; delete the row to resume.
- Next checkpoint: `pnpm agent:funnel` reader mix + spend, 2026-11-04

## Review (filled at reviewed-by date)

- **Actual outcome**: ...
- **Was the prediction right?** ...
- **Was the decision right** (independent of outcome)? ...
- **Lesson**: ...
