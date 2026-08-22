# Social runs one slice until it works: hogwarts × Facebook × Sudan

**ID**: D-20260806-social-one-slice
**Date**: 2026-08-06
**Decided by**: founder
**Type**: 2 (reversible — every deferred channel stays wired and every deferred brand stays registered; the expansion gate below is the reopen condition)
**Status**: executed
**Reviewed-by**: the expansion gate — earliest realistic review 2026-10-01 (8 weeks)
**Tags**: #social #scope #hogwarts #facebook #sudan #focus

## Decision

Social automation runs **one brand, one channel, one country** — **hogwarts × Facebook × Sudan** —
until the full loop demonstrably works end to end. Only then do we expand, and only in the order
named under [Expansion gate](#expansion-gate).

In Abdout's words:

> "we shall start by hogwarts product and facebook, for now (hogwarts, facebook, sudan) document
> this. we shall test the full flow and have a working social workflow/pipeline then only we can
> expand to other brands and other platforms and other countries."

**Deferred by this decision — not by any blocker:**

| Deferred                                   | State it stays in                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Instagram**                              | Adapter complete (`src/lib/instagram.ts`, in `DRAIN_TRANSPORTS`) behind `wired: false`. One ~10-min console test away — kun#141. Do not run it yet. |
| **Telegram**                               | Wired, bot valid, 2 env vars from live. Re-confirms the 2026-07-30 deferral rather than reversing it.                                               |
| **LinkedIn**                               | Registry only. Doctrine already says Ali's personal profile _is_ the LinkedIn strategy, so the Community Management API may never be needed.        |
| **WhatsApp**                               | No organic posting API exists. Stays a copy-out block, not a channel.                                                                               |
| **TikTok · X · Snapchat**                  | Registry only. X additionally needs a `/decide` (pay-per-use since Feb 2026).                                                                       |
| **mkan · databayt · sijillee · moallimee** | Registered in `products.ts`; `brand-kit.json` and `pillars.json` stay hogwarts-only, which is now correct rather than a gap.                        |
| **Saudi · UAE**                            | The product still targets Saudi/MENA. Only the _social proving run_ is Sudan-first.                                                                 |

## Context

The pipeline is neither model-limited nor code-limited. Nine skills, seven migrations, the 5-stage
Hub, a race-safe review queue, HMAC single-use approval, a 60-second launchd drain running
`claude -p` on the Max pool, refinement threading, and the closed `dismissReason → lessons → next
draft` loop are all built and committed (`fa1b4ad`). `content/docs/social/copy.mdx` is stronger
craft doctrine than anything on the skills market.

What is missing is proof. `content/docs/social/status.mdx` says it plainly: **"1 of 8 distribution
channels is live, 1 of 3 loops works."** Every hop of the chain is individually verified and **the
full chain — seed → drain → review → Facebook → metric, on a real published post — has never been
observed in one pass.**

The initial recommendation was to fix that by widening: Instagram (one console test away), Telegram
(2 env vars), Facebook Pages for the two brands missing them, five brands live. Abdout overruled it.
Widening multiplies an unproven loop; it does not prove it.

The slice chosen is also the best-aligned one available:

- **One real customer, in the country.** King Fahad Schools, Khartoum — admin **Ahmed Baha**, live
  on the pilot since 2026-04-15, reachable on WhatsApp through Sedon
  (`.claude/memory/customers.json`). The second pilot (Albayan, Mutaz) is also Khartoum.
- **Facebook is the one live channel**, and hogwarts is one of three brands with a Page and a
  verified permanent token.
- **hogwarts is the win horse** — the only brand with direct North-Star linkage (active paying
  schools), 72 feature blocks, and live pilots. `strategy.mdx`'s own drop order says hogwarts
  "posts last to die, because it feeds live sales."

### Two priorities invert because the country is Sudan, not Saudi

Recording these because they contradict what `strategy.mdx` would otherwise imply, and a future
session reading only that page would reintroduce both:

1. **Video drops down the list.** `strategy.mdx` names short vertical video as the format that wins
   (IG Reels ≈2.25× images, ~55% of Reel views from non-followers) — but that is a Saudi/Gulf claim.
   The same page's Sudan line governs here: _"connectivity is intermittent; cadence favors
   lightweight formats (text + image over video)."_ The template lane's static Arabic cards are both
   cheaper **and** better suited to a Khartoum audience.
2. **The Saudi school year stops being the clock.** `strategy.mdx` names Jul–mid-Aug as hogwarts'
   back-to-school push window against an Aug 23, 2026 start. That window does not apply to a
   Sudan-first run — which is good: a proving run should not be raced against a marketing deadline.

The moral code's Sudan clause binds throughout: **humility in tone; never exploit crisis for
engagement.**

## Premortem

- _"It failed because 'one slice' was read as 'go slow' and nothing shipped."_ — Mitigated: the
  slice's deliverable is a **published post with a metric row**, not a design document. Phase 1 of
  the plan is one observed end-to-end pass, twice.
- _"It failed because the next session read `strategy.mdx` and started widening again."_ — Mitigated
  by this file plus scope banners on `status.mdx`, `strategy.mdx`, `hogwarts.mdx`, and a scope line
  in the `social` and `calendar` skills. This risk is the reason Abdout said "document this."
- _"It failed because the loop 'worked' on invented copy."_ — Mitigated: the expansion gate requires
  ≥12 evidence rows and `"no hook"` no longer topping `social-drafts.mjs lessons`. A loop that runs
  on scenes nobody lived is a loop that proved plumbing, not content.
- _"It failed because one channel could not produce a signal worth reading."_ — Accepted, partly.
  Facebook Page organic reach is ~2–5% of followers. The gate therefore asks for **reach, shares,
  and comments trending**, plus one named human outcome — not a conversion number the channel cannot
  produce at this size.
- _"It failed because deferring Instagram lost the two-week Saudi window."_ — Accepted deliberately.
  See the inversion above: the window is Saudi, the market is Sudan.

## Expected outcome

- **Success looks like**: eight consecutive weeks of the loop running unattended, every published
  post past the mechanical craft bar, ≥12 real Khartoum scenes in the corpus, a metrics trend worth
  reading, and one named person saying they saw the page. At that point expansion is a mechanical
  repeat of a proven loop.
- **Failure looks like**: the loop still needs manual repair after two months, or it runs cleanly
  and produces zero signal — in which case `strategy.mdx`'s kill criteria fire on Facebook rather
  than on the pipeline, and that is a real answer worth having.
- **Probability of success (at decision time)**: 0.7 — the plumbing is built and verified hop by
  hop; the uncertainty is content quality and whether one channel at this follower count can show a
  trend inside two months.

## Alternatives considered

1. **Widen first — Instagram + Telegram + 5/5 brands on Facebook** (the original recommendation):
   Rejected. ~4× the reach of every post for about four hours of nobody's engineering time is a real
   argument, but it multiplies an unproven loop. Four live channels each half-working is harder to
   debug than one working, and the org has one content owner (Samia, 2–3 core pieces/week).
2. **Craft-first — linter and evidence corpus before any publishing run**: Rejected as the _lead_,
   kept as Phase 2–3. Better copy into a loop that has never completed still proves nothing.
3. **Video-first — exploit the Google AI Pro Flow seat's 1,000 monthly credits**: Rejected for this
   slice. Real unexploited capacity, but wrong format for Sudan bandwidth and it front-loads the one
   step that needs a human at a browser.
4. **Second brand alongside hogwarts (mkan)**: Rejected — Abdout chose "go deeper on hogwarts."
   mkan is the right _next_ brand (15 of 25 library assets, `@mkan.sd` already linked to a Page), so
   it leads the expansion order.

## Expansion gate

> **Corrected the same day it was written (2026-08-06).** The Graph API says the Hogwarts Page has
> **`followers_count: 0`** — the reach of 1–2 the metrics lane has faithfully recorded across three
> published posts is us looking at our own posts. Conditions 4 and 5 below (a trending read-back, a
> named outcome) are therefore **unmeetable as written**: no amount of craft produces a signal from
> an audience of zero, so the gate could never open. A seed condition has to come first, and it is
> hand-work — `strategy.mdx` § Grow already prescribed it (_"0 → 100 (seed): manual and personal…
> no automation needed; credibility is hand-made"_) and nobody had done it. Tracked as **kun#146**,
> now the top item in the slice.

Expand only when **all six** hold — condition 0 is new, and it gates 4 and 5:

0. **The Page has an audience at all.** ≥100 followers on the Hogwarts Page, seeded by hand
   (kun#146). Below that, 4 and 5 cannot be evaluated and everything above them is unfalsifiable.
1. **8 consecutive weeks** of seed → drain → review → Facebook running without manual repair.
2. **Zero linter escapes** — nothing published that trips a hard rule from `copy.mdx`'s reject list.
3. **≥12 evidence rows** in `content/social/evidence.json`, and `"no hook"` no longer the top entry
   in `social-drafts.mjs lessons`. `copy.mdx` names this as its own success test.
4. **A read-back that means something** — reach, shares, and comments per post, trending across
   several posts, not a single sample.
5. **One named outcome traceable to social** — Ahmed Baha or a Khartoum prospect saying they saw the
   page, or an inbound DM. `strategy.mdx` calls 0–3 months of silence normal and puts first signal
   at 3–6 months, so this is the honest bar rather than a quick one.

Then expand **one step at a time, re-proving the loop at each step**:

**Instagram** (kun#141; note delivery is single-image only today, so Reels and carousels need their
own container branches) → **Telegram** (2 env vars, owned and algorithm-proof) → **mkan** → **Saudi**.

## Action

- Owner: Abdout (scope + the Facebook publishes); Sedon (evidence collection from Ahmed Baha);
  Samia (curation + copy); Claude (linter, evidence gate, docs)
- Due: Phase 1 (one observed end-to-end pass, twice) — this week
- Next checkpoint: after the first two real published posts, record what broke in the Review section
  below
- Plan: `~/.claude/plans/we-have-claude-100-elegant-pebble.md`

## Review

**2026-08-06, same day — what the first pass actually found.**

Prepared the loop to the point where only the human yes is left: brief seeded, answered AR-first at
434 characters through the new craft gate (`craft: clean`), og card rendered on the template lane and
attached. Draft `cb537a063677f481db9033eb4` is `answered` and waiting at `/social/publish`.

Four things the pass surfaced that the plan had wrong or did not know:

1. **The Page has 0 followers** (`followers_count: 0`, `fan_count: 0`). Three posts published since
   2026-07-21 reached 1–2 each — that is us. This is the real bottleneck, it is not an engineering
   one, and it broke two conditions of this file's own gate (see the correction above). **kun#146.**
2. **The two library photos the briefs point at are unusable for product claims.** `hw-classroom`
   and `hw-dashboard-device` both show *fabricated* product UI with garbled pseudo-text. Attaching
   either to a claim about the product passes AI imagery off as reality — forbidden by
   `strategy.mdx` § Moral law 2. Neither carries a warning in `library.json`. One is already
   attached to a `pending` variant from 2026-08-01 (#145).
3. **Three variants are stuck `pending` forever.** Their signed links carried a 24h TTL and were
   minted 2026-08-01, and `pending` is the only state a link publishes from. Queue debt, not a
   decision waiting on anyone. One of them duplicates the attendance topic.
4. **`cdn.databayt.org` is bypassed, not blocking** — `cdnBase` already points at the S3 origin,
   which answers 200. The skill doc read like a blocker and was costing planning attention. **kun#148.**

What held up: the seed lane, the drain, the review queue, the permanent token, and the metrics lane
(six-hourly, zero errors, zero give-ups — it was reporting the truth about reach all along, and
nobody had read it).


## Amendment — 2026-08-22: pillars widened to four brands

**Decided by**: founder, in session · **Amends**: the deferral row
"mkan · databayt · sijillee · moallimee — `brand-kit.json` and `pillars.json` stay hogwarts-only".

That row is now partly reversed. `pillars.json` carries **hogwarts, mkan, balqalam and databayt**
(4 briefs each for the three added; hogwarts keeps its 8). `brand-kit.json` had already drifted past
this decision — all four brands were filled before today — so the two files are now consistent with
each other rather than one lagging.

**What did NOT change, and is the reason this is a small amendment rather than a reversal:**

- The **human gate is untouched.** Pillars seed draft asks; asks become answers in the review queue;
  nothing reaches a Page without an Approve. Authoring a pillar publishes nothing.
- **hogwarts × Facebook × Sudan is still the proving slice.** The other three brands now *can* be
  drafted for; they are not scheduled, and the loop is still unproven end to end.
- **The expansion order is unchanged** (Instagram → Telegram → mkan → Saudi) and the five written
  conditions still gate it. This amendment does not tick any of them.

Reasoning: the three brands each had a Facebook Page, a permanent token and a filled brand kit, and
were blocked only by having nothing written for them — a content gap masquerading as a scope
decision. The cheap half of expansion (a content spine) is now done; the expensive half (proving the
loop, then publishing) still waits on the gate.

Two of the four unresolved items above are also now closed or moved:

- **databayt's token identity** (the last brand on a personal grant) was root-caused this session:
  the Page is owned by business portfolio `1364261941941312` — a **second portfolio also named
  "Databayt"**, distinct from `2243724639760887` which holds the other three Pages and the System
  User. Abdout is not a member of it and cannot see it; the Aug-19 "add Page" request went to its
  admins and is unanswered. Name collision is why this read as one portfolio for three days.
- The personal grant's 90-day data-access clock was **refreshed to 2026-11-20** by re-consenting, so
  the deadline moved but did not disappear.
