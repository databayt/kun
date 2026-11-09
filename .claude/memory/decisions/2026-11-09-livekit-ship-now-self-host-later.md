# LiveKit Cloud Ship now for stability; self-host later to cut cost

**ID**: D-20261109-livekit-ship-now-self-host-later
**Date**: 2026-11-09
**Decided by**: founder (Abdout): *"I want an easy, stable solution because school is about to begin."*
**Type**: 2 (reversible: a monthly plan; downgrade any month, or move servers by changing 4 env vars)
**Status**: superseded — by [D-20261109-livekit-hetzner-final](2026-11-09-livekit-hetzner-final.md) (Abdout: go with Hetzner; Ship only as a one-month safety net)
**Reviewed-by**: 2026-11-23
**Tags**: #spend #hogwarts #live #livekit #alabidae #subscription-exception
**Supersedes**: [D-20261109-livekit-self-host-hetzner-cloudflare-turn](2026-11-09-livekit-self-host-hetzner-cloudflare-turn.md). **Revives**: [D-20261108-livekit-ship-for-live-classes](2026-11-08-livekit-ship-for-live-classes.md), with the same kill/continue test.

## Decision

Upgrade the existing LiveKit Cloud project (`hogwarts-jsmb894l`) to **Ship**. Ship is $50/mo and includes 150,000 participant-minutes and 250 GB; after that it's $0.0005/min and $0.12/GB.

Nothing changes in the app: same keys, same URL, no deploy. Self-hosting (Oracle Jeddah first, Hetzner second) becomes a later cost-cutting project with no deadline. Its research is on hogwarts#470.

## Context

- Al-Ibda went fully online on 2026-11-09, at about 13k participant-minutes per school day. The free plan (5k a month, shared by all schools) runs out the first afternoon.
- Same-day research found self-hosting cheaper: Oracle Jeddah at $0–28/mo with the best latency, Hetzner at €9–15/mo. But it means a new vendor signup, a server to run, and new failure modes on a school day.
- LiveKit Cloud already has Jeddah and UAE edges (5–7 ms from Saudi Arabia and Dubai on Globalping). Sudatel exits via Saudi Telecom and Zain via Telecom Egypt (RIPEstat).
- Estimated cost: about $100–180/mo at full attendance, against the roughly $26/mo Al-Ibda pays. That's negative margin; it's a bet on online delivery as a product.

## Expected outcome

- **Success looks like:**
  - Zero classes fail for quota.
  - By 2026-11-23, at least 60 % of Al-Ibda's enrolled students have joined a class through the platform (STUDENT rows in `live_class_participants`).
  - The first invoice is at or under $150.
- **Failure looks like:** under 30 % of students ever join, or spend above $180/mo with no second online school in sight.
- **Probability of success**: 0.55
- **Reasoning**: The infrastructure risk is gone: managed, Gulf edges, no ops. What's left is adoption (teachers starting on time, students tapping Join) and the bill. The bill is capped by attendance, and the self-host move cuts it once things are calm.

## Alternatives considered

1. **Self-host on Oracle Jeddah**: about $0–28/mo with the best latency. Rejected *for today* because of signup and ops risk on a school day. It's the planned cost-cut.
2. **Self-host on Hetzner EU + Cloudflare TURN**: about €9–15/mo. Superseded for the same reason, and worse latency for Saudi Arabia and the Gulf.
3. **AWS (EC2/Lightsail, Chime SDK, IVS)**: outbound traffic is charged (about $150+/mo), and the managed products cost about $340–485/mo. AWS matters for credits and for Gulf data residency, not for video.
4. **Do nothing (free plan)**: live classes stop for every school the first afternoon of each month.

## Action

- **Owner: Abdout.** Upgrade at cloud.livekit.io → project `hogwarts` → Settings → Billing → Ship, before the 16:00 classes.
- **Then Claude Code:**
  - Set the Worker's `LIVEKIT_TIER_WEBRTC_MINUTES=150000` and `LIVEKIT_TIER_CONCURRENT` to Ship's limit, then restart the container tonight.
  - Watch the meter.
- **Checkpoints:** the first invoice, and 2026-11-23 (the kill/continue test).
- **Cost-cut trigger:** if the monthly invoice exceeds $120, or at the review, start the Oracle Jeddah self-host using the #470 research.

## Review (filled at reviewed-by date)

- **Actual outcome**:
- **Was the prediction right?**
- **Was the decision right** (independent of outcome)?
- **Lesson**:
