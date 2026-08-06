---
name: publish
description: Deliver approved full drafts to the channels — the review queue decides, the lanes deliver
when_to_use: "Use when an APPROVED full draft (copy + media) must reach its channels, now or on a schedule — via the review queue on /social/publish (Approve = publish right away or delegate to the cron drain, per its settings), the signed approval link, or the copy-out block for WhatsApp. This publishes CONTENT, not code: /ship and /deploy put software in production and /release ships a feature block, and none of them touch a brand page. It refuses without a recorded /approve yes, never writes copy (/draft), never creates from blank (the queue only fine-tunes), and never reads numbers back (/measure). Triggers on: publish the post, send it out, post it now, schedule it for tomorrow, broadcast it, review and publish, انشر المنشور, ابعت المنشور, راجع وانشر."
argument-hint: "<brand> [--channels ...] [--at <iso>] [--dry-run]"
---

# Publish — the last mile

Approved full drafts reach the channels. The Hub side is a **review queue**, not
a composer: `/social/publish` shows the next answered draft awaiting approval,
every upcoming one browsable, an editor that fine-tunes (text, attachments,
channels) but never creates from blank, and a settings choice for what Approve
does — **publish right away**, or **schedule and delegate to the cron drain**
(GitHub Actions, every ~15 minutes).

Arguments: $ARGUMENTS — brand, channels, optional `--at` for a scheduled time.

## Doctrine (inherits /social)

- **Nothing publishes without a recorded approval.** This stage verifies the gate;
  it does not substitute for it.
- **Egress only** — this layer delivers approved copy. It never writes copy.
- **A channel is never silently absent.** Every requested channel ends in exactly
  one named state.
- **Media routes by shape.** The fan-out reads the variant's `mediaUrls`: text ·
  one photo · 2–10 album/carousel · one video. Mixed image+video, two videos, or
  > 10 images are refused by name before anything is delivered.

## Steps

1. **Verify the gate.** Refuse unless the review queue recorded an approval
   (request `consumed`), the variant is `pending` with a live signed link, or a
   human said yes in-session. No recorded yes, no send.
2. **Partition by lane**, from `src/components/root/social/config.ts`:
   - `DRAIN_CHANNEL_IDS` — telegram, facebook, instagram. kun delivers these
     itself. Instagram is in the allow-list so it goes live the moment its
     `wired` flag flips; today only **facebook** is both wired and in scope.
   - `HERMES_CHANNEL_IDS` — the gateway pulls them from `/api/social/queue`.
   - `MANUAL_CHANNEL_IDS` — whatsapp. Copy-out.
3. **Drain lane** — the review queue's **Approve** delivers now, or (approve-mode
   `schedule`, or `--at`) writes variants as `scheduled` and lets
   `/api/social/drain` deliver within ~15 minutes; the signed approval link's
   button is the remote equivalent. The drain retries three times with backoff
   and alerts the review channel only on the terminal failure.
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
