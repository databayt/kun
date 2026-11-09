# Self-host LiveKit on Hetzner, Cloudflare TURN for blocked networks

**ID**: D-20261109-livekit-self-host-hetzner-cloudflare-turn
**Date**: 2026-11-09
**Decided by**: founder
**Type**: 2 (reversible — the app switches LiveKit servers with 4 env vars)
**Status**: decided
**Reviewed-by**: 2026-11-23
**Tags**: #hogwarts #live #infra #cost
**Supersedes**: [D-20261109-livekit-free-tier-bridge](2026-11-09-livekit-free-tier-bridge.md)

## Decision

Run hogwarts live classes on a self-hosted `livekit-server` on one Hetzner Cloud CPX31 in the EU (4 vCPU / 8 GB, 20 TB of traffic included, about €15/mo flat). It serves `live.balqalam.com` with TLS and LiveKit's built-in TURN on 443, through grey-cloud DNS.

Then add **Cloudflare Realtime TURN** as the relay for students on networks that block UDP. Short-lived credentials are minted at each join, and use stays inside Cloudflare's 1 TB a month free. Above that it's $0.05/GB.

The LiveKit Cloud Build (free) project stays as a manual fallback: re-point the 4 env vars.

**Cloudflare RealtimeKit** stays on watch. It gets a prototype on demo only once its price after launch is confirmed per GB, not per participant-minute.

## Context

Al-Ibda went Online on 2026-11-09. Its load is about 13k participant-minutes per school day, about 285k a month, and roughly 1–1.6 TB of downstream video. The free Cloud plan (5k participant-minutes and 50 GB a month, shared by every school) runs out on the first afternoon. Al-Ibda pays $307/yr (about $25/mo).

LiveKit can't run on Cloudflare: Workers and Containers are HTTP-only, and WebRTC media needs UDP.

## Expected outcome

- **Success looks like:**
  - Al-Ibda runs every class for 2 weeks on the VM without hitting a cap.
  - Infra stays at or under €20/mo, with VM egress tracking about 1.5 TB/mo.
  - No more than 1 report per week of "can't join".
  - Users on TURN-only networks connect through Cloudflare once phase 2 ships.
- **Failure looks like:**
  - The VM goes down during class hours with nobody watching.
  - Latency or packet loss from Sudan to the EU makes video unusable.
  - Ops time eats the savings.
- **Probability of success**: 0.75
- **Reasoning**: The load is small for the box: about 50 concurrent with one publisher per room, which is bandwidth-bound, and 20 TB is far above what's needed. The main risks are a single box and EU latency. The fallback (Cloud env vars) and Cloudflare TURN on the edge cover the worst of both.

## Alternatives considered

1. **LiveKit Cloud Ship ($50 + overage)**: about $280/mo for Al-Ibda alone ($68 in minutes and $160 in bandwidth above the included 250 GB). That's 11× the school's revenue.
2. **LiveKit Cloud Scale ($500+)**: same problem, worse.
3. **Cloudflare Realtime SFU / RealtimeKit as a LiveKit replacement**: about $0–30/mo with an edge near Africa. But it means rebuilding the room (hands, chat, board, presence-to-attendance) over weeks, and RealtimeKit's price after launch is unsettled ($0.05/GB vs $0.002 per participant-minute, which would be about $570/mo).
4. **AWS/GCP near Africa (Cape Town, Bahrain)**: egress at about $0.09–0.11/GB brings it to about $150/mo.
5. **Do nothing (free plan)**: live classes stop for every school on the first afternoon of each month.

## Action

- Owner: Abdout (Hetzner account and card), then Claude Code (VM, LiveKit, DNS, load test, prod switch, E2E).
- Due: before Al-Ibda's next school day after the cap is hit.
- Next checkpoint: 2026-11-16 (first full week on the VM).

## Review (filled at reviewed-by date)

- **Actual outcome**:
- **Was the prediction right?**
- **Was the decision right** (independent of outcome)?
- **Lesson**:
