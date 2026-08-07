# The agent window drafts inline on Gemini, with the Mac queue as the floor

**ID**: D-20260807-gemini-inline-draft
**Date**: 2026-08-07
**Decided by**: Abdout ("i need web page to be ~10 seconds"), measured and executed by Claude
**Type**: 2 (reversible — `SOCIAL_DRAFT_INLINE=off` reverts to the queue in one env var)
**Status**: verified — proceed, with a named ceiling
**Reviewed-by**: 2026-09-07 (against observed daily draft volume)
**Tags**: #social #draft #gemini #latency #billing
**Supersedes the blocked half of**: [D-20260730-in-app-draft-spend](./2026-07-30-in-app-draft-spend.md)

## Decision

`/social/draft` answers inline through the **Gemini Developer API** on the existing free-tier
`GEMINI_API_KEY`, instead of only queueing for the Mac `claude -p` drain. The queue row stays the
durable record and the drain stays the fallback: any inline failure, timeout, or rate-limit leaves
the row `pending` and the Mac absorbs it on its next tick.

D-20260730 sanctioned this surface for API spend but died on an unfunded `ANTHROPIC_API_KEY`
(401). Gemini's free tier needs no card, which is what makes the lane live at last — and the
Mada blocker ([[project_vercel_mada_blocker]]) is routed around rather than solved.

## What was measured (Track 0), 2026-08-07

All figures from a realistic 12.3K-token prompt (copy.mdx + brand.mdx + hogwarts.mdx +
golden-set.md + craft rules), six Arabic briefs across all three angles, scored by `checkCraft`.

| Model                           | p50 latency   | First-pass craft-clean             | Free-tier RPD         |
| ------------------------------- | ------------- | ---------------------------------- | --------------------- |
| `gemini-3.1-flash-lite`         | **1.5–2.5 s** | 0/6 — short body, 30–40-word hooks | unmeasured            |
| **`gemini-3.6-flash`** ← chosen | **10.9 s**    | **4/6**                            | **20/day (measured)** |
| `gemini-3.5-flash`              | 15.8 s        | 5/6                                | unmeasured            |
| `gemini-2.5-flash`              | ~24 s         | —                                  | unmeasured            |

- **0.a** Key authenticates for text. HTTP 200. (Its _image_ quota is 0 — that is a separate
  bucket and does not apply here.)
- **0.b** `gemini-3.6-flash`. `gemini-3.5-flash` is the quality-first alternate: +1/6 clean for
  +5 s, which loses the headline target.
- **0.c** `generationConfig.responseSchema` **is honoured** on free tier — returns clean
  `{"ar":…,"en":…}`. The `draft_bilingual` forced-tool shape survives intact; no tolerant parser
  needed. **Gotcha:** thinking tokens count against `maxOutputTokens`. At 2000 the JSON truncated
  and parsed as garbage; **8000 is the working floor.**
- **0.d** p50 **10.9 s** (range 9.5–12.1 s over 12 runs). Hits the ~10 s target.
- **0.e** 429 → `RESOURCE_EXHAUSTED`, with `RetryInfo.retryDelay: 27s` and a `QuotaFailure`
  naming `GenerateRequestsPerDayPerProjectPerModel-FreeTier`. Retryable.
- **0.f** **Implicit caching works on free tier** — `cachedContentTokenCount: 8056` of 12 343
  (~65%) from the second call on, with no `cachedContents` setup. Static-first prompt ordering is
  what earns it. Explicit caching stays cut.

## The ceiling, stated plainly

**`gemini-3.6-flash` free tier is 20 requests per day, per project, per model** — measured, not
documented. Google no longer publishes the free-tier table; it is per-project in AI Studio. The
widely-cited "1,500/day" figure is wrong for this model.

Twenty covers the team's current 5–10 drafts/day, but not with headroom: a refinement turn is
another call, and a craft repair is another. Realistic ceiling is **~8–12 finished drafts/day**
before overflow. Overflow is not a failure — it lands on the Mac lane, which is the design.

Two levers when it binds, in order:

1. **Enable billing on the Google project** (Tier 1). At ~20K in / 2K out per draft with 65%
   cached, ≈**$5–10/mo** at 60 drafts/day. Needs a working card — the standing blocker.
2. **Route overflow to `gemini-3.5-flash`** (separate quota bucket, better craft rate, slower).

## Premortem

- **The free tier is cut again.** It was cut 50–80% in Dec 2025. Guard: `SOCIAL_DRAFT_INLINE=off`
  is a one-variable revert to today's behaviour, and the Mac lane is never removed.
- **A contributor burns the day's 20 on refinements by 10am.** Bounded: rate limiter at 8/60 s
  global, 4/60 s per user, non-throwing — the 9th draft queues instead of erroring. Nobody sees a
  failure; they see the speed they had last week.
- **The 20K-token prompt makes copy worse, not better.** Unproven and real. Guard: the assembler
  can drop sections; `matchedBlocks` and `approxChars` are logged per call; week one gets
  hand-scored against the golden set.
- **Latency drifts past `maxDuration`.** p50 is 10.9 s against a 60 s ceiling — 5× headroom. The
  adapter's own timeout is **20 s, not the 9 s originally planned**, which would have killed the
  only model that passes.

## Expected outcome

Contributors get copy in ~11 s instead of minutes, for the first ~10 drafts of a day, with the
queue silently absorbing the rest. No card, no doctrine change, no new dependency. If the
2026-09-07 review shows overflow is routine, that is the evidence for enabling billing — a
~$5–10/mo decision, not an architectural one.

## Found along the way

Measuring first-pass craft rates surfaced a live bug: the `invented-number` guard could never
accept a figure supplied by an Arabic brief in Arabic-Indic digits, making such drafts
unanswerable on the shipping Mac lane without `--craft-override`. Fixed in `440f5ee`; first-pass
clean went **1/6 → 4/6** on the fix alone.
