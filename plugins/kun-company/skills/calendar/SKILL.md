---
name: calendar
description: The content calendar — which brand publishes what, on which day
when_to_use: "Use when deciding or reviewing WHAT to publish and WHEN — mapping topics to weeks, allocating slots per brand, checking what actually shipped against what was planned. This is the planning stage that feeds /draft: it never writes post copy (/draft), never renders media (/higgs), never stages for sign-off (/approve), never delivers (/publish), and never reads numbers back (/measure). Triggers on: content calendar, plan the content, what are we publishing, which brand is due, what slipped this week, التقويم, خطة المحتوى."
argument-hint: "[plan|review] [brand] [date-range]"
---

# Calendar — what publishes, for which brand, when

The planning stage. Decides the slots; `/draft` fills them.

Arguments: $ARGUMENTS — `plan` (allocate the coming period) or `review` (diff the
last one against what shipped), optionally scoped to a brand and a date range.
Default: `plan` for next week.

**SCOPE (2026-08-06) — one slice: `hogwarts` × `facebook` × Sudan.** Plan for
hogwarts only, and allocate Facebook slots only. `content/social/pillars.json`
carries hogwarts' 8 briefs and nothing else, so a five-brand plan would invent
slots no stage can fill. Say the other four are deferred by decision rather than
planning empty rows for them. Two inversions apply because the country is Sudan:
**static Arabic cards lead over video** (intermittent connectivity favors light
formats), and **the Aug 23 Saudi school-year window is not the clock**. Reasoning

- expansion gate:
  `.claude/memory/decisions/2026-08-06-social-one-slice-hogwarts-facebook-sudan.md`.

## Doctrine (inherits /social)

- **Arabic first, English second** — a slot's topic is decided in the language its
  audience actually reads.
- **The multiplier** — one core piece per slot, adapted per channel. Five brands ×
  eight channels is only feasible because a slot is a _piece_, not a post.
- **Cash flow first** — a slot that cannot rank, educate, or attract contributors
  is a slot worth cutting.

## Steps

1. **Read the strategy** — `content/docs/social/strategy.mdx` for per-brand cadence
   and the kill criteria; `.claude/agents/growth.md` for the content pillars
   (Arabic-first tech · product marketing per vertical · dev relations · founder
   story). The standing week-by-week allocation lives in `content/social/pillars.json`
   — the seed lane (`scripts/seed-drafts.sh`, Mondays 07:00) files it into the draft
   queue automatically; editing that file IS editing the recurring calendar. The Hub
   renders it live at `/social/calendar`: per-brand briefs, this ISO week's rotation
   picks highlighted (`src/components/root/social/rotation.ts` mirrors the seeder's
   math), a queue chip per brief, and a **Queue now** button that files a brief as a
   draft ask on the spot — calendar → draft is a click, not a wish.
2. **Read the brands** — `content/docs/social/<brand>.mdx` for each brand's channel
   mix and audience. The five are `databayt`, `hogwarts`, `mkan`, `sijillee`,
   `moalimee` (registry ids in `src/components/root/social/products.ts`; the
   canonical public spelling of the last is _Moallimee_).
3. **Diff against reality** — read `SocialPiece` joined to `SocialVariant` for the
   period and compare `published` rows against the previous plan. A plan never
   checked against what shipped is a wish list.
4. **Allocate** — one idea per slot. Every row names a brand, a topic, a channel
   set (drawn from `DISTRIBUTION_CHANNELS` — Slack is the team channel and is never
   a slot), and an owner: Samia (content), Ali (business), Abdout (technical).
5. **Account for what slipped** — every unshipped slot from the previous period is
   either rescheduled with a new date or dropped with a stated reason. Silently
   dropping it is how a calendar stops meaning anything.
6. **Emit** the markdown calendar and name the gaps.

Per piece, carry: title (AR + EN), brand, channel set, owner, SEO keywords
(AR + EN), and a two-sentence brief.

## Exit gate

A dated table in which every row carries brand, topic, channel set, and owner —
and every slipped slot from the previous period is either rescheduled or
explicitly dropped with a reason.

Reference: `.claude/agents/growth.md` (Samia is the primary content creator) ·
`content/docs/social/strategy.mdx`.
