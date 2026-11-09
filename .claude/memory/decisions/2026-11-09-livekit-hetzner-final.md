# LiveKit on our own Hetzner server — final call for 2026-11-09

**ID**: D-20261109-livekit-hetzner-final
**Date**: 2026-11-09
**Decided by**: founder (Abdout): *"go with hetzner"*
**Type**: 2 (reversible: 4 env vars point the app at any LiveKit server)
**Status**: decided
**Reviewed-by**: 2026-11-23
**Tags**: #spend #hogwarts #live #livekit #infra
**Supersedes**: [D-20261109-livekit-ship-now-self-host-later](2026-11-09-livekit-ship-now-self-host-later.md). **Revives**: [D-20261109-livekit-self-host-hetzner-cloudflare-turn](2026-11-09-livekit-self-host-hetzner-cloudflare-turn.md), whose design (TURN on 443, Cloudflare TURN only if needed) still holds.

## Decision

Host LiveKit on one Hetzner Cloud server in Germany: an ARM CAX21 or similar, about €9–15/mo with 20 TB included, at `live.balqalam.com` / `turn.balqalam.com`. Abdout pays by Riyad Bank card or PayPal; Oracle refused that card. Until the server is tested, classes stay on LiveKit Cloud's free plan. Al-Ibda used 51 participant-minutes this month because students couldn't log in, so the free plan holds. **Ship ($50) is a one-month safety net only**, if usage approaches 5,000 before the switch.

## Why this, after the same-day back-and-forth

- **Oracle Jeddah:** the best latency, but payment failed with Abdout's Saudi card.
- **LiveKit Ship:** about $100–180/mo for one school.
- **AWS:** charged per GB sent, about $70–215/mo.
- **Hetzner:** pays easily, flat cost, latency of 67–132 ms to Egypt, Saudi Arabia and the Gulf (fine for class video). LiveKit Cloud stays as the fallback.

## Expected outcome

- **Success:**
  - The server is live and load-tested before it carries a real class.
  - Al-Ibda runs 2 weeks on it with no cap and no outage during class hours.
  - The bill stays at or under €15/mo.
- **Failure:** an outage during class with nobody switching to the fallback, or ops time eating the savings.
- **Probability of success**: 0.75

## Action

- **Abdout:** create the Hetzner Cloud account (card or PayPal) and an API token (read & write).
- **Claude Code:**
  - Provision the server and install LiveKit (Caddy with TLS, TURN on 443).
  - DNS records, a load test, and Globalping latency checks.
  - Switch prod at night: Worker env plus a container restart.
  - Run the demo E2E, then watch Al-Ibda's next day.
