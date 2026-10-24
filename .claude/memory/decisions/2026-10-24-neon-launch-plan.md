# The Neon org moves from Free to Launch, paid from the $100 credit first

**ID**: D-20261024-neon-launch-plan
**Date**: 2026-10-24
**Decided by**: founder (Abdout, choosing Launch over Build after the hogwarts outage)
**Type**: 2 (reversible: Billing → Change plan; dropping back to Free re-imposes the 100 CU-hour cap per project)
**Status**: decided
**Reviewed-by**: 2026-11-07
**Tags**: #billing #neon #hogwarts #outage

## Decision

The Neon org **Abdout** (`org-blue-bar-09493777`, every live product database) is on the **Launch** plan from 2026-10-24: usage-based, $0.106 per CU-hour and $0.35 per GB-month, no free limits. Neon's $100 sign-up credit pays first. The hogwarts production compute (`ep-little-credit-ad4uobus`) autoscales from 0.25 to **1 CU** (lowered from 8 the same day), so a spike can't run up the bill. This is an exception to the subscription-only billing rule, made because a database cap took paying schools offline.

## Context

On 2026-10-23 23:12Z the hogwarts project (`square-hall-52214783`, free_v3) used up its 100 CU-hours. Every query failed with "exceeded the quota", and balqalam.com showed "Temporarily unavailable" to every school (alabidae, kingfahd, demo). The cap would have reset on 2026-11-01, eight days away. The database had been awake about 77% of the month: the */15 and */30 cron sweeps plus a :17 job never gave Neon its 5 idle minutes to scale to zero. The data sat inside the blocked project, with no off-Neon dump, so no free host could take over. The whole org used about 277 CU-hours in October.

## Expected outcome

- **Success looks like:** no quota outage again; the monthly Neon bill stays at or under $25 once the credit is spent; the credit lasts until about January 2027.
- **Failure looks like:** the bill goes over $40 a month, or a runaway compute shows up as a jump in the daily `active_time`.
- **Probability of success:** 0.8
- **Reasoning:** hogwarts at about 0.26 CU awake all month comes to about $20. The hogwarts cron quiet hours (`8866ec28e`) and the 1 CU ceiling bring that down; mkan and space add the rest.

## Alternatives considered

1. **Build ($10/mo flat, 250 CU-hours, about 10 months on the credit)**: cheaper, but the org's 277 CU-hours in October are already over the 250 limit, and going over it causes exactly this outage. Rejected for production. Revisit once usage stays well under 250.
2. **Wait for the 2026-11-01 reset ($0)**: eight days with pilot schools offline.
3. **PlanetScale Postgres**: no free tier; its ~$5 single node (1/16 vCPU, 512 MB) is weaker than Neon's; the move still needs Neon unblocked first, plus half a day of migration.
4. **Supabase / Aiven free**: the data couldn't be reached to move it, and Supabase's 500 MB is under our 525 MB.

## Action

- Owner: Abdout (plan + card, done 2026-10-24) · Claude Code (verification, burn reduction)
- Done 2026-10-24: health passing, demo admin sign-in lands on the dashboard, first off-Neon dump `~/backups/hogwarts/hogwarts-20261024-105840.dump` (21 MB, 336 tables), max CU 8 → 1.
- Owed: deploy hogwarts `8866ec28e` (cron quiet hours) with the next release; turn on Neon spending notifications (suggested $30); review mkan and space cron and connection habits.
- Next checkpoint: the Neon billing page + per-project `active_time`, 2026-11-07

## Review (filled at reviewed-by date)
