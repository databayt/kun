---
name: draft
description: Write the full draft — copy (Arabic crafted first, English mirrored) and/or its media set
when_to_use: "Use when a topic needs to become a FULL draft for a databayt brand — the core piece plus one platform-native variant per channel, Arabic written natively and English mirrored, with UTM on every link, AND the draft's media half: library picks attached by URL, or a generation hand-off. ALSO the answering half of the Hub's agent window: with no topic, or on any phrasing about the draft queue, it drains the briefs contributors submitted on /social — picking media from the library as it answers. This is the drafting stage only: it does not decide what to write about (/calendar), does not render new images or video itself (/higgs, /carousel — it attaches their output), does not approve (/approve), and never sends anything to a platform (/publish). Triggers on: draft a post, write the copy, write the caption, post about <topic>, attach media to the draft, drain the draft queue, answer the social asks, any drafts waiting, اكتب منشور, صياغة المنشور, طابور الصياغة, أرفق وسائط للمسودة."
argument-hint: "[<brand> <topic>] [--channels facebook,telegram] [--locale ar|en|both] [--media urls|type] · no args = drain the queue"
---

# Draft — the full draft, Arabic first

One core piece, then one platform-native variant per channel — plus the draft's
media half. Claude writes the copy (never a gateway LLM, never a translation
pass) and picks or commissions the media.

**A full draft is copy AND/OR media.** The valid shapes: text only · text +
image(s) · text + video · image(s) only · video only. Media rides
`SocialDraftRequest.mediaUrls` (≤ 10 public https URLs; one video max per post
— the delivery layer refuses mixed image+video in a single post).

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
   mix, and content pillars, then **`content/docs/social/copy.mdx`** for the craft
   bar and the register ladder — the seven checks this draft will be rejected
   against, and which rung of Arabic this brand and channel take. Calibration
   examples: `references/golden-set.md`. For check 4's raw material read
   `references/scene-bank.md` → `content/social/scenes.json` — concrete
   reader-week moments per brand and season; ground the post in one it can
   honestly claim rather than summarizing docs (docs contain no Thursdays).
3. **Resolve the channel set** from `DISTRIBUTION_CHANNELS`
   (`src/components/root/social/config.ts`), intersected with what the brand is
   wired for via `productChannelWired`. Slack is never a draft target — it is the
   team channel, and its notices are sent by `sendReview`, not written here.
4. **Name three angles before writing one.** One line each: **the pain** (what the
   reader's week costs them), **the moment** (a scene they recognize), **the proof**
   (the one true fact from the brief). Pick the one whose first line survives check 1
   — a pain or a promise, never a description — and say in one clause why the other
   two lost. Runner-ups are not persisted; the discipline produces the hook, the
   artifact has no reader (`copy.mdx` § "Why not a candidate set").
5. **Write the winner**, story-first, in Arabic. This is the thing being said; the
   variants are how each platform says it. Open on the scene, name the failure as a
   rhythm, land one claim, close on a feeling — not on a feature.
6. **Adapt per channel** — hook, length, hashtag budget, aspect hint, CTA. A single
   text fanned to every channel is the failure this stage exists to prevent (the
   06:00 cron still does exactly that; see `content/docs/social/status.mdx`).
   Rough budgets: X ≤ 280 · Telegram caption ≤ 1024 · Facebook and LinkedIn long-form
   fine · Instagram and TikTok caption-led, first line carries it.
7. **UTM every link**, matching `src/lib/social-utm.ts` exactly:
   `utm_source=<channel>&utm_medium=social&utm_campaign=<brand>`. Note that
   `applyUtm` runs at delivery and is idempotent — hand-tagging a link means your
   tag wins, so only do it deliberately.
8. **WhatsApp gets a variant like any other channel.** Its transport is `manual`,
   not absent: `/publish` will render it as a copy-out block for a human to
   forward. Draft it properly — short, forwardable, no link-preview dependency.
9. **Settle the media half.** Pick before you generate:
   - **Pick** — search `content/media/library.json` by brand + assetType (the
     brief's `(library: <id>)` hint wins) and take the `cdnUrl`. Free, instant.
   - **Generate** — nothing matches and the piece needs a visual: text-free
     photography → `/higgs`; text-bearing formats (og, banner, infographic,
     split, testimonial) → `/carousel` as a 1-slide deck. Register the output
     in the library, then attach its URL.
   - **Neither** — a text-only draft is a valid full draft; say so rather than
     forcing a stock-looking image.
10. **Run the moral gate** before handing off.

## Queue mode — answering the Hub's agent window

The Social Agent on `/social` lets any contributor describe a post without a
Claude Code session. It cannot write the copy: kun's billing is subscription-only,
so no API key has credits (D-20260730). The window records the ask as a
`SocialDraftRequest` and polls; **this skill is the half that answers it**, on the
Max pool, so the copy comes out of the same doctrine as a hand-run `/draft`
instead of depending on who happens to be at the keyboard.

```bash
node scripts/social-drafts.mjs list       # JSON: id, brand, brief, requestedBy, mediaUrls,
                                          # waitingMinutes + any direction the asker set:
                                          # model, angle, register, referenceAr, turn, refine
node scripts/social-drafts.mjs lessons    # what reviewers rejected in the last 60 days
```

Asks arrive from two writers: contributors on `/social`, and the **weekly seeder**
(`scripts/seed-drafts.sh`, Mondays 07:00 — files briefs from `content/social/pillars.json`
with `requestedBy: seed:weekly`). Both are answered identically; a seeded brief is just a
brief whose asker is the calendar.

**Before the first ask of a run, read the corrections:**

```bash
node scripts/social-drafts.mjs lessons          # or --brand <brand>
```

Recent dismissals, most common failure first. Every row is a draft a session
already believed was finished and a human refused anyway — so the top reason is
the check _this_ run is most likely to fail again. Read it once, with `copy.mdx`
and the golden set, not per ask.

For each ask, oldest first:

1. **Run Steps 1–5 above** for its `brand` and `brief` — resolve the brand, read
   `content/docs/brand.mdx` for voice, `content/docs/social/<brand>.mdx` for
   audience, pillars, and channel mix, and `content/docs/social/copy.mdx` for the
   seven checks and the register ladder; then name the three angles and pick one.
   Skipping this is the whole failure mode queue mode exists to prevent: a brief
   answered without the voice docs reads like generic SaaS copy in Arabic, and a
   brief answered without the craft bar reads like the product documentation it
   was sourced from. Read `copy.mdx` and `references/golden-set.md` **once for the
   whole run**, not per ask.

1b. **Obey the ask's direction.** `list` carries whatever the contributor set,
and each field is a decision rather than a hint:

| Field         | Means                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `angle`       | The angle is decided. Still name three in the log; write the one asked for.                                                   |
| `register`    | A rung from copy.mdx's ladder — overrides the brand map's rung.                                                               |
| `referenceAr` | Echo this post's **voice** — rhythm, sentence length, distance from the reader. Never its subject; never reuse its sentences. |
| `refine`      | This ask is the next turn of a draft a human just read. See below.                                                            |

Absent means unset, and unset means you choose — the fields are omitted from
the JSON rather than sent null so the two cases never blur.

1c. **A refinement rewrites, it does not re-roll.** `refine.previousAr` /
`refine.previousEn` is the exact text the reviewer read; `refine.instruction`
is what they want changed. Change **that and nothing else** — keep the hook if
the note is about length, keep the length if the note is about the hook. A
refinement that quietly rewrites the whole post takes away the part they had
already accepted, and they have to find it again. If the instruction cannot be
satisfied without breaking a craft check, do it their way and name the cost in
`--note`. 2. **Write the core piece only — and make it portable rather than fanned out.**
The window's contract is one `ar` and one `en`; the contributor picks channels
in the composer afterwards. So the piece must clear **check 7**: a first line
that works cold with no image, a body that reads with no link preview, ≤ 3
hashtags at the end, and no platform-specific verb (no "swipe", no "link in
bio"). At this volume a portable core piece _is_ the per-channel adaptation
that matters — a thin fan-out into a schema that stores one `ar` and one `en`
would be generated and then discarded. 3. **Fit the composer's ceiling** — `MAX_CAPTION` in the composer, and remember a
post staged for review must be short enough to survive `/approve`. 4. **Run the moral gate.** This matters more here than in a hand-run draft: the
asker may not know the doctrine, and a thin brief invites invention. Never add
a metric, customer, price, or date the brief did not contain. 5. **Pick the media half from the library.** When the brief suggests a visual,
read `content/media/library.json` and match by the `(library: <id>)` hint
first, else by brand + assetType; pass the matched `cdnUrl`s with `--media`.
The rules of this lane:

- **Never invent or guess a URL** — only a `cdnUrl` read from the library.
- **The ask may already carry `mediaUrls`** (a contributor attached them from
  the showroom) — keep them unless the brief says otherwise; `--media`
  REPLACES the stored set, so include what you mean to keep.
- **No match → answer text-only.** Generation is a full-session job (`/higgs`
  or `/carousel`, then `attach`) — the 5-minute drain tick has no generation
  tools, by design.

6. **Write the answer back through files** — never argv, which mangles multi-line
   Arabic and quotes; media goes as comma-separated URLs:

```bash
node scripts/social-drafts.mjs answer <id> --ar ar.txt --en en.txt \
  --media "https://cdn…/hero.png" --note "claude-code:<who>"
# later, from a full session that generated something better:
node scripts/social-drafts.mjs attach <id> --media "url1,url2"   # pending or answered; REPLACES the set
```

**`answer` runs the craft gate and will refuse you.** `copy.mdx`'s reject list is
executed by `scripts/lib/craft.mjs`, so a draft that trips it never reaches a
human. A refusal is not a failed ask — read the named failures, rewrite, answer
again. Check before committing to the round trip:

```bash
node scripts/social-drafts.mjs check <id> --ar ar.txt --en en.txt   # pulls the brief from the ask
```

Two it catches that a writer reliably misses: **a number, date or price not in
the brief** (the guard is a set difference against the brief, plus a refinement's
instruction and parent), and **a link without `https://`** — `applyUtm` only tags
absolute URLs, so a bare `ed.databayt.org` ships untagged and attribution
silently reads zero.

What it does **not** do is judge whether the hook is a pain or a promise. The
12-word ceiling is a floor under check 1, never the check — the 2026-08-05
failure `copy.mdx` quotes is exactly 12 words and passes the rule while failing
the doctrine. That judgment stays yours.

`--craft-override "<why>"` exists for a human who has read the findings and
judged a rule wrong for one draft; the reason is stored on the row so the
reviewer sees it. Do not reach for it unattended. If a draft cannot pass after
two rewrites, `fail` the ask with the findings — a rule that blocks correct copy
is a bug worth a human's attention.

7. **Refuse honestly when you should.** `note` is rendered to the asker verbatim
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
platform's budget; **the copy clears all seven checks in
`content/docs/social/copy.mdx`** and sits on the register rung its brand and
channel take — name any check it clears only marginally; every link is
UTM-shaped; nothing is asserted that is not true — no invented metric, customer,
price, or date — and the media half is settled: library URLs attached, a
generation handed off, or text-only said out loud.

**A draft that fails check 1 (hook) or check 2 (one idea) is not finished.**
Rewrite it before answering; do not answer and let the reviewer catch it. The
reviewer's dismiss is the feedback loop, not the quality gate — and now that
`lessons` reads those dismissals back, answering a draft you know is weak costs
the next run as well as this one.

**Half of this gate is now mechanical, and it is the easy half.** Since
2026-08-06 `answer` refuses anything on `copy.mdx`'s reject list — length,
hashtags, emoji, punctuation, the wordlist, engineering Arabic, `يتم + مصدر`,
Arabic-Indic digits, a second link, a link without a scheme, an invented number.
Clearing it is the floor, not the bar: the checks it cannot see — is the hook a
pain or a promise, is this one idea, does the reader recognize their own week,
do the Arabic and English diverge in at least two places — are the ones the
draft is actually judged on, and they are all yours.

**A refinement is judged against its instruction, not just the checks.** Ask what
the reviewer wanted changed, whether it changed, and whether anything they did
not mention survived intact. All three, or the turn was wasted.

In queue mode: every pending ask ends `answered` or `failed` — never left
`pending`. The window stops polling after 10 minutes and the drain sweep expires
hour-old asks, so a skipped ask becomes a visible failure — but only after the
asker already gave up waiting. `scripts/drain-drafts.sh` runs this mode on a
**60-second** launchd tick, up to two passes per run so a reply typed while you
were writing is caught in the same run; every `list` (yours included) beats the
`draft-drain` heartbeat the Hub shows.

**A run answers only the ids it was given.** The drain groups the pending queue
by `model` and makes one `claude -p --model` call per group, because `--model` is
a property of the session and one call cannot honour a queue that chose two. If
your prompt names ids, another session is answering the rest — leave them alone.

An answered full draft lands in the review queue on `/social/publish`, where a
human fine-tunes and approves (`/approve` is that gate's doctrine). This stage
never publishes. A reviewer who wants a change can ask for one instead of
dismissing: that files the next turn of the thread, and it comes back here as an
ordinary pending ask carrying `refine`.
