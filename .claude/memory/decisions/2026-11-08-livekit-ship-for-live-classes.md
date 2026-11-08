# LiveKit Cloud Ship for every hogwarts school's live classes

**ID**: D-20261108-livekit-ship-for-live-classes
**Date**: 2026-11-08
**Decided by**: founder (Abdout), in the live-classes planning session
**Type**: 2 (reversible — a monthly plan; downgrade or switch the provider default back to `external` any month)
**Status**: decided (the plan upgrade itself is Abdout's billing action — not yet executed)
**Reviewed-by**: 2026-11-23 (two weeks after alabidae goes Online)
**Tags**: #spend #hogwarts #live #livekit #alabidae #subscription-exception

## Decision

Hogwarts live classes run on LiveKit Cloud's **Ship** plan ($50/month including 150,000 participant-minutes, then $0.0005/minute) for every school, with in-app rooms as the default for any school set to Online or Hybrid. This is an exception to the subscription-only spend posture, chosen over a $0 alternative (each teacher's own Google Meet/Zoom link) in the session that produced hogwarts commits `630d5e9c4` / `941673080` / `519561c0c`.

## Context

- hogwarts#469 (2026-11-08): an alabidae student could not join a class. Prod showed alabidae — an online-only school — set to `physical` with provider `external`, no links, no fallback: nothing was ever online. Four teachers opened ad-hoc LiveKit rooms that day; **zero students joined**.
- LiveKit's free Build plan: 5,000 participant-minutes/month and 100 concurrent. alabidae's timetable alone is ~62,550 participant-minutes/week at full attendance (~270k/month; peak 10 concurrent classes, 44 people) — the free tier lasts about one school day.
- Cost at alabidae's volume: ~$50–110/month (realistic attendance nearer the bottom). Revenue from alabidae at the 2026-11-08 price ($6.40/student/yr, D-20261108-pricing-one-month-trial): 49 students ≈ $26/month. **On alabidae alone this spend is negative-margin**; it is a bet on online delivery as a product, not on this one account.
- Canon: *The Lean Startup* (#13, #15) — test the riskiest assumption before scaling spend. The riskiest assumption is not the video stack; it is whether students actually show up to an online class through the platform (0 of 49 did on 2026-11-08). Hence the kill/continue metric below.
- Cost controls shipped with it: recording starts OFF for a school coming online (egress minutes are the likely largest line), attendance sync ON, and a daily minutes guard that emails the platform from 80% of the tier (`live/actions/usage-guard.ts`, `OPS_ALERT_EMAIL`, default hi@databayt.org).

## Premortem (short — Type 2, but it is recurring money)

> It's 2026-12-08 and this was a mistake. Students still don't come; the LiveKit bill ran $110 a month for a school paying $26; recordings were switched on by an admin and egress doubled it; nobody read the 80% email.

1. **Attendance never materializes**: kill/continue metric at the review; downgrade or flip the provider default to `external` (teacher links) if missed.
2. **Recording turned on school-wide**: defaults off; the guard's email names the recording minutes separately; review the egress line at the first invoice.
3. **The alert goes unread**: the guard emails hi@databayt.org — confirm that inbox is read, or set `OPS_ALERT_EMAIL` to Abdout's address on the Worker.

## Expected outcome

- **Success looks like**: by 2026-11-23, ≥60% of alabidae's enrolled students have joined at least one live class through the platform (STUDENT rows in `live_class_participants` with `joinedAt`), month-to-date LiveKit spend ≤ $70, no class failed for quota.
- **Failure looks like**: <30% of students ever join, or spend > $110/month with no second online school in sight.
- **Probability of success**: 0.45
- **Reasoning**: The join path is now one tap from timetable, dashboard, banner and reminders, which removes the 2026-11-08 failure mode. But alabidae's students have no habit of joining through the platform yet, the school has run on WhatsApp, and the first week will show whether teachers start classes on time.

## Alternatives considered

1. **Teacher Meet/Zoom links, $0** (my recommendation in session): no spend, one click via the join link; rejected by Abdout in favour of in-app rooms (real presence → attendance, recordings, one product experience).
2. **Auto-generated Google Meet via API**: $0 but weeks of Google OAuth verification, students knocking to be admitted on consumer accounts, 60-minute cap on group calls — rejected as the riskiest path.
3. **Self-hosted LiveKit on a VPS**: ~$20–40/month plus ops burden on a 16 GB-RAM, already-saturated operating setup — rejected for now.
4. **Do nothing**: alabidae stays unable to hold a single online class — rejected; it is the school's whole model.

## Action

- Owner: Abdout — upgrade the LiveKit Cloud project to Ship (billing); then the engine sets `LIVEKIT_TIER_WEBRTC_MINUTES` / `LIVEKIT_TIER_CONCURRENT` / `LIVEKIT_TIER_RECORDING_MINUTES` on the hogwarts Worker, deploys, and flips alabidae to Online in `/school/configuration/teaching-mode` (Neon restore branch first).
- Due: before alabidae's next school day.
- Next checkpoint: 2026-11-23 — read `live_class_participants` (STUDENT joins) and the month's LiveKit invoice.

## Review (filled at reviewed-by date)

- **Actual outcome**: ...
- **Was the prediction right?** ...
- **Was the decision right** (independent of outcome)? ...
- **Lesson**: ...
