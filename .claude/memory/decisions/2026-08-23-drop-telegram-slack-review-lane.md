# Telegram is retired; Slack becomes the review lane

**ID**: D-20260823-drop-telegram-slack-review-lane
**Date**: 2026-08-23
**Decided by**: Abdout ("use slack instead of telegram, forget about telegram for good")
**Type**: 2 (reversible — the transport was ~200 lines against a documented public API; re-adding it is a day's work, and git holds the deleted files)
**Status**: adopted
**Reviewed-by**: 2026-11-23 (90 days)
**Tags**: #social #channels #review #slack #telegram

## Decision

Remove **Telegram** from the engine entirely — transport, channel registry entry,
drain lane, craft rule, platform specs, carousel slot, env, docs — and make
**Slack** the review lane, reached by a direct incoming webhook rather than
through the Hermes gateway.

## Why now

This came out of the 2026-08-23 verification pass, which asked why nothing had
published since 2026-07-31. The answer was not broken machinery:

- Three finished variants sat `pending` at the human approval gate for **23 days**.
- `scheduled` was 0, so the hourly drain reported `success` — truthfully — on an
  empty queue. Every dashboard was green while the lane produced nothing.
- The cause was that **production had no review destination configured at all**,
  so `sendReview()` could never tell anyone a draft existed.

The fix had to be a destination that works when nobody is watching. Slack was
already the registry's one _communication_ channel, but its transport was
`hermes` — a gateway running on a laptop at home, which issue #143 records as
never having run end to end. An approval notice that waits for a lid to open
cannot be the thing that fixes "nobody was told."

## Why Telegram costs nothing to drop

Measured before touching anything:

- **No variant has ever gone through Telegram.** Every row in `SocialVariant`,
  published or pending, is `facebook`.
- Production carried **no `TELEGRAM_*` env at all**.

So this was a transport the engine maintained, tested, and documented for a
channel that never carried a single post. Deleting it removes real surface area
— a channel in every registry, a drain lane, a craft rule, a specs entry, two
routing tests — for zero delivered reach.

## What it costs

Stated plainly rather than discovered later: the **carousel lane's client-DM
delivery was Telegram albums**, and the `hogwarts-intro` deck is staged awaiting
approval. That deck now has no delivery transport. The 10-slide cap survives
unchanged on Instagram's carousel limit, which happens to be the same number.
Re-homing carousel delivery is follow-up work, not part of this decision.

## Second-order effect worth recording

Slack had been declared a `communication` channel while parked on the `hermes`
transport — which is how it satisfied the "every channel has exactly one publish
lane" test. It was, technically, publishable. Giving it its own `slack` transport
forced that into the open: the lane partition now covers **distribution**
channels only, and a test asserts communication channels have **no** publish
lane. The taxonomy the config file says it exists to defend is now actually
enforced.

## What would make this wrong

A Sudanese or diaspora audience that genuinely lives on Telegram groups and
converts there. The lead work points at WhatsApp-first for that book, not
Telegram, and the org Telegram channel published nothing in the months it
existed. If that reverses, the transport comes back from git — Type 2, cheaply.
