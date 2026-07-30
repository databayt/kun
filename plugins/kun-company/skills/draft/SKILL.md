---
name: draft
description: Write the core piece and its per-channel variants — Arabic crafted first, English mirrored
when_to_use: "Use when a topic needs to become actual post copy for a databayt brand — the core piece plus one platform-native variant per channel, Arabic written natively and English mirrored, with UTM on every link. ALSO the answering half of the Hub's agent window: with no topic, or on any phrasing about the draft queue, it drains the briefs contributors submitted on /social. This is the writing stage only: it does not decide what to write about (/calendar), does not make images or video (/higgs), does not stage for sign-off (/approve), and never sends anything to a platform (/publish). Triggers on: draft a post, write the copy, write the caption, post about <topic>, drain the draft queue, answer the social asks, any drafts waiting, اكتب منشور, صياغة المنشور, طابور الصياغة."
argument-hint: "[<brand> <topic>] [--channels facebook,telegram] [--locale ar|en|both] · no args = drain the queue"
---

# Draft — the copy, Arabic first

One core piece, then one platform-native variant per channel. Claude writes it —
never a gateway LLM, never a translation pass.

Arguments: $ARGUMENTS — brand, the topic or news, optional `--channels`
(default: every channel the brand is wired for), optional `--locale`.

**With no topic, go to [Queue mode](#queue-mode--answering-the-hubs-agent-window)
first.** A session invoked without a topic is asking whether there is work, and
the work is whatever the team submitted from `/social`.

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

## Queue mode — answering the Hub's agent window

The Social Agent on `/social` lets any contributor describe a post without a
Claude Code session. It cannot write the copy: kun's billing is subscription-only,
so no API key has credits (D-20260730). The window records the ask as a
`SocialDraftRequest` and polls; **this skill is the half that answers it**, on the
Max pool, so the copy comes out of the same doctrine as a hand-run `/draft`
instead of depending on who happens to be at the keyboard.

```bash
node scripts/social-drafts.mjs list          # JSON: id, brand, brief, requestedBy, waitingMinutes
```

For each ask, oldest first:

1. **Run Steps 1–4 above** for its `brand` and `brief` — resolve the brand, read
   `content/docs/brand.mdx` for voice and `content/docs/social/<brand>.mdx` for
   audience, pillars, and channel mix. Skipping this is the whole failure mode
   queue mode exists to prevent: a brief answered without the voice docs reads
   like generic SaaS copy in Arabic.
2. **Write the core piece only** — Arabic first, English as its sibling. The
   window's contract is one `ar` and one `en`, not the per-channel fan-out; the
   contributor picks channels in the composer afterwards. Do not fan out here.
3. **Fit the composer's ceiling** — `MAX_CAPTION` in the composer, and remember a
   post staged for review must be short enough to survive `/approve`.
4. **Run the moral gate.** This matters more here than in a hand-run draft: the
   asker may not know the doctrine, and a thin brief invites invention. Never add
   a metric, customer, price, or date the brief did not contain.
5. **Write the answer back through files** — never argv, which mangles multi-line
   Arabic and quotes:

```bash
node scripts/social-drafts.mjs answer <id> --ar ar.txt --en en.txt --note "claude-code:<who>"
```

6. **Refuse honestly when you should.** `note` is rendered to the asker verbatim
   in the window, so it is a message to a person, not a log line — say what to add
   and they can re-ask in one edit:

```bash
node scripts/social-drafts.mjs fail <id> --note "Which school signed? The brief says 'a new pilot' — I will not name one that might be wrong."
```

`answer` and `fail` are both conditional on `status = 'pending'`, so two sessions
draining at once is safe: exactly one wins and the other is told why it lost.

**What a good brief looks like** — tell contributors this, or answer thin briefs
with a `fail` note that asks for the missing part: what happened (the fact), who it
is for (audience), what they should do (the CTA), and any hard constraint (a date,
a link, a name). Brand comes from the window's product selector, so it is never
part of the brief. A brief that is only a topic gets copy that is only a topic.

## Exit gate

One core piece plus exactly one variant per requested channel, each inside its
platform's budget; the Arabic reads as idiom rather than MSA press-release
register; every link is UTM-shaped; and nothing is asserted that is not true — no
invented metric, customer, price, or date.

In queue mode: every pending ask ends `answered` or `failed` — never left
`pending`, because the window polls forever and a silent skip looks like an outage
to the person waiting.

Hand off to `/higgs` for media, then `/approve`. This stage never publishes.
