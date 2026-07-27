---
name: publish
description: Deliver approved copy to the channels — automated where an API exists, copy-out where it does not
when_to_use: "Use when APPROVED social copy must reach its channels, now or on a schedule — via the Hub composer, the signed approval link, or the copy-out block for WhatsApp. This publishes CONTENT, not code: /ship and /deploy put software in production and /release ships a feature block, and none of them touch a brand page. It refuses without an /approve artifact, never writes copy (/draft), and never reads numbers back (/measure). Triggers on: publish the post, send it out, post it now, schedule it for tomorrow, broadcast it, انشر المنشور, ابعت المنشور."
argument-hint: "<brand> [--channels ...] [--at <iso>] [--dry-run]"
---

# Publish — the last mile

Approved copy reaches the channels. Three lanes, because the eight distribution
channels do not share one delivery mechanism.

Arguments: $ARGUMENTS — brand, channels, optional `--at` for a scheduled time.

## Doctrine (inherits /social)

- **Nothing publishes without a recorded approval.** This stage verifies the gate;
  it does not substitute for it.
- **Egress only** — this layer delivers approved copy. It never writes copy.
- **A channel is never silently absent.** Every requested channel ends in exactly
  one named state.

## Steps

1. **Verify the gate.** Refuse unless the variant is `pending` with a live signed
   link, or a human said yes in-session. No artifact, no send.
2. **Partition by lane**, from `src/components/root/social/config.ts`:
   - `DRAIN_CHANNEL_IDS` — telegram, facebook. kun delivers these itself.
   - `HERMES_CHANNEL_IDS` — the gateway pulls them from `/api/social/queue`.
   - `MANUAL_CHANNEL_IDS` — whatsapp. Copy-out.
3. **Drain lane** — click the signed approval link to publish now, or use the
   composer's **Schedule** (`schedulePost`) with `--at`, which writes variants as
   `scheduled` and lets `/api/social/drain` deliver within ~15 minutes. The drain
   retries three times with backoff and alerts the review channel only on the
   terminal failure.
4. **Hermes lane** — write the variant and stop. The gateway pulls its own work;
   Vercel can never call into it. Nothing to do in-session, and a Hermes outage
   means the item waits rather than being lost.
5. **Manual lane** — render the copy-out block. Never call an API, never mark it
   published:

   ```
   ── WhatsApp · <brand> · copy and forward ───────────────
   <the UTM-tagged text, exactly as it should appear>

   Media: <path or CDN url>
   To:    WhatsApp Channel "<brand>" / the school broadcast list
   Note:  Meta offers no organic posting API for Channels or
          broadcast lists. Do NOT use a WhatsApp-Web automation
          package — number bans are common and permanent.
          See /docs/social/channels/whatsapp.
   ────────────────────────────────────────────────────────
   ```

   `deliverPost` refuses a manual channel by design, so an attempt to automate this
   fails loudly rather than recording a publish that reached nobody.

6. **Record `externalId`** per channel where the platform returns one — without it
   a post cannot be found again, so it cannot be retracted and `/measure` has
   nothing to attach to.
7. **Log the slot** back to `/calendar`.

## Exit gate

Every requested channel has landed in exactly one terminal state: **delivered**
with an `externalId`, **queued** (for the drain or for Hermes) with a variant id,
or **handed out** as a copy-out block. No channel is silently absent, and nothing
was delivered without a recorded approval.

## When NOT to use

Shipping code is `/ship`, `/deploy`, or `/release`. Posting a message into
`#social` as a human is just posting — this is the audience lane. A multi-slide
deck is `/carousel`.
