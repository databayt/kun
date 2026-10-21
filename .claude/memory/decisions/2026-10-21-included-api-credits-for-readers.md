# Included Max API credits may power the scrape readers, capped

**ID**: D-20261021-included-api-credits-for-readers
**Date**: 2026-10-21
**Decided by**: founder (Abdout, approving the scrape-optimization plan)
**Type**: 2 (reversible — unset the key and the lane falls back to Groq)
**Status**: decided
**Reviewed-by**: 2026-11-21
**Tags**: #billing #scrape #mkan

## Decision

The Max plan now includes $100 a month in API credits, and the scrape lanes' vision readers may spend part of them. Only the included credits are used. The code enforces a hard monthly cap: the TikTok reader stops at `TIKTOK_API_CAP_USD`, default $10. Paid overage is never used, and a 402 or "credit balance" error counts as hitting the cap. The reader is `claude-haiku-5-5` ($0.10 / $0.50 per MTok), with Groq's free tier as the fallback. The "subscription-only, no API-key spend" posture otherwise stands.

## Context

Groq's free vision tier shares one key with mkan's `/find` agent. On 2026-10-20, with repeat runs, the TikTok sweep read only 2–8 videos by vision while fetch pulled 40 a day, and 128 downloaded videos went stale unread. On a clean day (2026-10-21) Groq read 22 by vision and 50 still waited. Abdout saw the included-credits offer at session start on 2026-10-21 and asked to use it.

## Expected outcome

- **Success looks like:** 30 or more TikTok reads a day, a monthly spend of a few dollars, and the vision backlog stays near zero.
- **Failure looks like:** the cap is hit before month end, or reads still stall on Groq because the key was never claimed.
- **Probability of success:** 0.8
- **Reasoning:** about 7.4k input tokens per read (6 frames at 720px) costs roughly $0.001. 100 reads a day is about $3 a month, well inside a $10 cap.

## Actions

- Abdout claims the credits and stores the key as the Keychain item `mkan-ANTHROPIC_API_KEY` (credentials skill).
- Spend ledger: `mkan/scripts/crm/.data/tiktok/spend.json`. Review it on the reviewed-by date.
