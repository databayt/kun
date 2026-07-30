---
name: approve
description: The human gate — stage copy and media for sign-off, then stop
when_to_use: "Use when drafted copy and media are ready for a human to say yes before anything reaches a public brand page — staging into #social with a signed single-use link (it opens a confirm page; only its button publishes), or recording an in-session approval. This is the gate, not the send: it never writes copy (/draft), never makes media (/higgs), and never delivers to a platform (/publish, which refuses to run without the artifact this stage produces). Triggers on: stage for review, send for approval, get sign-off, ready for review, اعتماد, أرسل للمراجعة."
argument-hint: "<brand> [--channels ...] [--media <url>] [--reviewer <name>]"
---

# Approve — the gate

Brand accounts are public and irreversible. This stage exists so a human says yes
before that happens, and it ends by **stopping**.

Arguments: $ARGUMENTS — brand, the channels being approved, the media URL if any.

## Doctrine (inherits /social)

- **No approval, no publish.** Ever. This gate never times out into a send.
- **Media is text-free** (`content/docs/brand.mdx` hard rule) — AI typography
  breaks, and Arabic doubly so. Copy is overlaid in-post, never baked into a
  `/higgs` render. Deterministic HTML renders (`/carousel`) are the exception.
- **Label AI media** — TikTok `is_aigc` and equivalents; the house rule is stricter
  than the platform floor.

## Steps

1. **Assemble** — copy plus media path, per channel, exactly as it will appear.
2. **Pre-flight checks**, all of which are cheaper here than after publishing:
   - Arabic glyph integrity — no broken or disconnected forms, no synthetic bold on
     a display face.
   - No text baked into a generated raster image.
   - AI-generated media is labelled.
   - Consent for any recognisable face. **Children: never without written consent.**
   - Claims are truthful and the links resolve.
3. **Stage** — push each channel down the approval path so it gets its own
   `SocialVariant` in `pending` and its own signed, single-use, 12-hour link:
   - From the Hub: the composer's **Send for review** (`stageForReview` in
     `src/actions/post-social.ts`). This is the only staging lane.
   - **`POST /api/social/relay` is NOT staging — it publishes immediately.**
     The relay's contract is "a human already said yes upstream, in Slack";
     pointing an unapproved draft at it bypasses this gate entirely.

   Per-channel variants are deliberate — a reviewer can take Telegram and hold
   Facebook. One token covering the whole fan-out was all-or-nothing.
   The link opens a read-only confirm page; only its **Approve & publish**
   button (a POST) delivers, so a chat client's link preview can never consume
   the approval — and its **Reject** button records `rejected` on the row.

4. **Where it lands**: the review destination, `#social` via Hermes by default
   (`SOCIAL_REVIEW_CHANNEL`), falling back to a **private** `TELEGRAM_REVIEW_CHAT_ID`.
   That chat id must never equal `TELEGRAM_CHANNEL_ID` — sending approval links to
   the public brand channel publishes a button that lets any reader post as the
   brand.
5. **STOP.** Deliver the links and wait. Do not proceed to `/publish` in the same
   breath.
6. **Record the decision** per channel — approved, held, or rejected. The
   link's Reject button persists `rejected` on the variant itself; an
   in-session hold is named in the report, never silently dropped.

## Exit gate

Every requested channel has either a `SocialVariant` row in `pending` with a
signed link delivered to the review channel, **or** an explicit recorded human
yes. The session has made zero platform calls. Any held or rejected channel is
named with its reason.

## When NOT to use

Approving _code_ to ship is `/check` and `/ship`. This gate is for copy that will
appear on a public brand page.
