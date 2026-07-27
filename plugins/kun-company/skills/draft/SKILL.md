---
name: draft
description: Write the core piece and its per-channel variants — Arabic crafted first, English mirrored
when_to_use: "Use when a topic needs to become actual post copy for a databayt brand — the core piece plus one platform-native variant per channel, Arabic written natively and English mirrored, with UTM on every link. This is the writing stage only: it does not decide what to write about (/calendar), does not make images or video (/higgs), does not stage for sign-off (/approve), and never sends anything to a platform (/publish). Triggers on: draft a post, write the copy, write the caption, post about <topic>, اكتب منشور, صياغة المنشور."
argument-hint: "<brand> <topic> [--channels facebook,telegram] [--locale ar|en|both]"
---

# Draft — the copy, Arabic first

One core piece, then one platform-native variant per channel. Claude writes it —
never a gateway LLM, never a translation pass.

Arguments: $ARGUMENTS — brand, the topic or news, optional `--channels`
(default: every channel the brand is wired for), optional `--locale`.

## Doctrine (inherits /social)

- **Claude writes the copy.** Hermes is a relay, not a brain.
- **Arabic is crafted first, English mirrors it** — never a literal translation in
  either direction. Correct Arabic or it does not ship.
- **Moral gate**: truthful claims, no invented metrics or customers, cultural fit,
  no crisis-exploitation in Sudan-facing content.

## Steps

1. **Resolve the brand** against `PRODUCT_IDS` in
   `src/components/root/social/products.ts`. Accept both **`moallimee`** and
   **`moalimee`** and map to the registry id `moalimee` — the double-L spelling is
   canonical in prose and everywhere in the docs, the single-L is the env-var
   suffix and the stored `SocialPiece.brand` value. Refuse an unknown brand by
   listing the five.
2. **Read the voice** — `content/docs/brand.mdx` for the tone doctrine and the
   per-brand tagline, then `content/docs/social/<brand>.mdx` for audience, channel
   mix, and content pillars.
3. **Resolve the channel set** from `DISTRIBUTION_CHANNELS`
   (`src/components/root/social/config.ts`), intersected with what the brand is
   wired for via `productChannelWired`. Slack is never a draft target — it is the
   team channel, and its notices are sent by `sendReview`, not written here.
4. **Write the core piece**, story-first, in Arabic. This is the thing being said;
   the variants are how each platform says it.
5. **Adapt per channel** — hook, length, hashtag budget, aspect hint, CTA. A single
   text fanned to every channel is the failure this stage exists to prevent (the
   06:00 cron still does exactly that; see `content/docs/social/status.mdx`).
   Rough budgets: X ≤ 280 · Telegram caption ≤ 1024 · Facebook and LinkedIn long-form
   fine · Instagram and TikTok caption-led, first line carries it.
6. **UTM every link**, matching `src/lib/social-utm.ts` exactly:
   `utm_source=<channel>&utm_medium=social&utm_campaign=<brand>`. Note that
   `applyUtm` runs at delivery and is idempotent — hand-tagging a link means your
   tag wins, so only do it deliberately.
7. **WhatsApp gets a variant like any other channel.** Its transport is `manual`,
   not absent: `/publish` will render it as a copy-out block for a human to
   forward. Draft it properly — short, forwardable, no link-preview dependency.
8. **Run the moral gate** before handing off.

## Exit gate

One core piece plus exactly one variant per requested channel, each inside its
platform's budget; the Arabic reads as idiom rather than MSA press-release
register; every link is UTM-shaped; and nothing is asserted that is not true — no
invented metric, customer, price, or date.

Hand off to `/higgs` for media, then `/approve`. This stage never publishes.
