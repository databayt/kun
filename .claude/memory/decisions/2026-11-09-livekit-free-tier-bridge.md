# LiveKit on the free Build plan until it is self-hosted

**ID**: D-20261109-livekit-free-tier-bridge
**Date**: 2026-11-09
**Decided by**: founder (Abdout)
**Type**: 2 (reversible — buy Ship, self-host, or fall back to meeting links any day)
**Status**: superseded — by [D-20261109-livekit-self-host-hetzner-cloudflare-turn](2026-11-09-livekit-self-host-hetzner-cloudflare-turn.md)
**Reviewed-by**: the day the free cap is first hit, or 2026-11-23, whichever comes first
**Tags**: #spend #hogwarts #live #livekit #alabidae

## Decision

Hogwarts live classes keep using LiveKit (in-app rooms) for every school, on LiveKit Cloud's **free Build plan**, until Abdout hosts LiveKit on a cheaper server of his own. No paid LiveKit plan is bought. Supersedes [D-20261108-livekit-ship-for-live-classes](2026-11-08-livekit-ship-for-live-classes.md).

## Context

- The Build plan is a **hard cap**: 5,000 WebRTC participant-minutes a month and 100 concurrent connections, **shared across all of the account's projects**. Past the cap, new connections fail until the monthly reset; there is no overage ([LiveKit quotas and limits](https://docs.livekit.io/home/cloud/quotas-and-limits/)).
- alabidae alone is ~62,550 participant-minutes a week at full attendance (255 weekly slots). The teachers alone are ~12,750 a week. So a fully online alabidae reaches the cap within a school day or two, and then **no school can join any class** until the reset.
- The app already switches LiveKit back-ends with four env vars (`LIVEKIT_HOST`, `LIVEKIT_WS_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) plus the webhook, and was designed for a self-hosted SFU with TURN over 443 (the Aldar plan in hogwarts `live/RUNBOOK.md`). The `LIVEKIT_TIER_*` defaults are already the free plan's numbers, and the daily minutes guard emails hi@databayt.org from 80%.

## Premortem

> It's 2026-11-23. alabidae went Online, used up the free minutes on the first afternoon, and spent two weeks with every Join failing. The school went back to WhatsApp and told other schools that the platform's live classes don't work.

1. **The cap arrives on day one**: decide the fallback BEFORE flipping alabidae — self-host first, or keep a per-school meeting link ready to switch to, or flip only some grades (hybrid per-grade overrides exist).
2. **Nobody notices until teachers complain**: the guard emails once a day at 06:00 UTC; the usage page at /live shows the meter; read it daily during the first week.
3. **Self-hosting slips**: cap the bridge — if not self-hosted by the review date, buy one month of Ship (~$50–110) or switch the school to meeting links.

## Expected outcome

- **Success looks like**: LiveKit self-hosted (a VPS with TLS + TURN) before alabidae's usage hits the cap, and the four env vars switched with no class lost.
- **Failure looks like**: the cap is hit with alabidae Online and no fallback, and classes fail until the reset.
- **Probability of success**: 0.35, rising to 0.8 if self-hosting lands before alabidae flips to Online.
- **Reasoning**: The cap is roughly one alabidae school day, so the outcome depends almost entirely on the order of steps: self-host, then flip.

## Alternatives considered

1. **Ship ($50/mo + overage)**: dropped. ~$50–110/mo against ~$26/mo of alabidae revenue.
2. **Teachers' own Meet links ($0)**: no in-app attendance or recordings; kept as the emergency fallback.
3. **Do nothing**: alabidae cannot hold online classes. Rejected.

## Action

- Owner: Abdout — self-host LiveKit; the engine can set the server up once there is a VPS.
- Next checkpoint: before alabidae is flipped to Online (hogwarts#470).
