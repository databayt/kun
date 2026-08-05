---
name: social
description: One spell — calendar, draft, media, approve, publish, measure for a brand post
when_to_use: "Use when a databayt brand needs a social post taken the whole way — pick the slot, write the bilingual copy, render the media, get a human sign-off, deliver to the channels, and read the numbers back. This is the compound orchestrator; run a single stage directly when that is all you need (/calendar, /draft, /higgs, /approve, /publish, /measure). Triggers on: social post, post about <topic>, publish to social, social automation, broadcast the announcement, منشور تواصل, انشر عن."
argument-hint: "<brand> <topic> [--channels ...] [--media [type]] [--at <iso>] [--from <stage>]"
---

# Social — one post, all the way through

**Claude drafts a FULL draft (copy + media), a human approves in the review
queue, the egress layer relays.**

```
calendar ─► draft ══► review ─► publish ─► measure
    │         │▲         │          │          │
/calendar  /draft ◄── /approve  /publish   /measure
              │       ▲ HARD STOP (/social/publish)
   media ─────┘
 (/higgs · /carousel — picked from the library or generated, attached to the draft)
```

The stages are wired: the calendar's briefs seed the draft queue (Mondays, plus
the panel's queue-now), the draft carries its media set (`mediaUrls` — showroom
Attach, library auto-pick, or a generation), and `/social/publish` is the
review queue where the next full draft waits for the human yes — publish now or
schedule for the cron drain.

Arguments: $ARGUMENTS — brand (`databayt|hogwarts|mkan|sijillee|moalimee`), the
idea or news, optional `--channels`, `--media`, `--at`, and `--from <stage>` to
resume mid-chain.

Autonomy is **L1/L2** — a human signs off before any brand post. L4 is gated
behind `/decide` plus an automated guardrail layer (LLM-judge content and
Arabic-correctness checks, per-channel rate limits, a kill switch). Strategy and
the ladder: `content/docs/social/` · `docs/SOCIAL-AUTOMATION.md`.

## Doctrine (non-negotiable)

1. **Claude writes the copy** — never the gateway's LLM. Hermes is a relay, not a
   brain.
2. **Arabic first, English second** — crafted, not translated. Correct Arabic or it
   does not ship. See `content/docs/brand.mdx`.
3. **The multiplier** — one core piece, then platform-native variants. One text
   fanned to every channel wastes the whole point.
4. **Media via `/higgs`** — text-free, brand kit, copy overlaid in-post. Label AI
   media.
5. **The gate** — no human approval, no publish. It never times out into a send.
6. **Moral gate** — truthful claims, cultural fit, consent for faces (children:
   never without written consent), no crisis-exploitation in Sudan-facing content.

## The channel model

**Eight distribution channels** carry marketing to an audience: facebook,
instagram, telegram, whatsapp, x, linkedin, tiktok, snapchat.

**Slack is the one communication channel** — the team surface where approvals and
notices land. It is never audience reach and never a publish destination; the
composer does not offer it, the Zod write gate rejects it, and `/api/social/relay`
refuses it by name.

Transports are orthogonal to that: `telegram` and `facebook` (direct APIs, drained
by kun), `hermes` (the gateway pulls its own work), and **`manual`** — WhatsApp,
where no organic posting API exists and `/publish` hands out a copy-out block for a
human to forward. Registry: `src/components/root/social/config.ts`.

## Phases

**Phase 1 — Pre-flight.** Resolve the brand against `PRODUCT_IDS`, accepting both
`moallimee` and `moalimee`. Resolve the channel set from `DISTRIBUTION_CHANNELS`
filtered by `productChannelWired`; refuse with the specific reason when a brand has
no wired channel (usually: no Facebook Page yet). If Slack was requested, refuse it
and say why — approvals and notices go there automatically.

**Phase 2 — Stage 1: `/calendar`.** Skip when the topic arrived as an argument.
Otherwise delegate to `.claude/skills/calendar/SKILL.md` to pick the slot.

**Phase 3 — Stage 2: `/draft`.** Delegate to `.claude/skills/draft/SKILL.md`.
Blocking — there is nothing to approve without copy.

**Phase 4 — Stage 3: media.** Pick before you generate: search
`content/media/library.json` by brand + type and attach the `cdnUrl`s to the
draft (`node scripts/social-drafts.mjs attach <id> --media …`, or the Hub's
showroom Attach). On `--media [type]`, or when nothing matches, generate: the
type comes from the showroom taxonomy
(`src/components/root/social/showroom/taxonomy.ts`, default `hero`) and picks
the lane — text-free photography (`hero`, `product`, `lifestyle`, `mockup`,
`reel`, `story`) delegates to `.claude/skills/higgs/SKILL.md`; text-bearing
formats (`og`, `banner`, `infographic`, `split`, `testimonial`) render as a deck
on `.claude/skills/carousel/SKILL.md` — a single card is a 1-slide deck.
Register the output in the library, then attach. Non-blocking: a media failure
downgrades to a text post rather than stopping the chain. A multi-slide deck is
`/carousel` either way.

**Phase 5 — Stage 4: `/approve` — HARD STOP.** Delegate to
`.claude/skills/approve/SKILL.md`. The primary lane is the Hub's review queue at
`/social/publish` (the answered full draft waits there; a contributor fine-tunes
and decides); the signed-link lane covers a remote approver. Unlike `/release`'s
advisory QA gate, this one blocks unconditionally.

**Phase 6 — Stage 5: `/publish`.** Delegate to `.claude/skills/publish/SKILL.md`,
only once Phase 5 returned an approval — the review queue's Approve (now or
scheduled to the drain) or a consumed signed link.

**Phase 7 — Stage 6: `/measure`.** Deferred, not inline — numbers do not exist for
an hour and refresh six-hourly. Print the command to run later.

**Phase 8 — Report.** One consolidated summary: what shipped, to which channels,
in which state, and what is waiting.

## Failure modes

| Stage      | Failure                            | What `/social` does                                 |
| ---------- | ---------------------------------- | --------------------------------------------------- |
| Pre-flight | Unknown brand                      | Stop; print the five valid ids                      |
| Pre-flight | No wired channel for the brand     | Stop; name the missing Page or token                |
| Pre-flight | Slack requested as a destination   | Refuse it, explain the tier, continue with the rest |
| Draft      | Arabic reads as translation        | Stop; rewrite natively — never ship it              |
| Media      | `/higgs` fails or is out of credit | **Warn and continue** as a text post                |
| Media      | Text baked into the render         | Stop; regenerate text-free                          |
| Approve    | No response                        | Stop and wait. Never time out into a publish        |
| Approve    | Held on one channel                | Publish the approved ones, report the held one      |
| Publish    | Transport error                    | Leave it queued; the drain retries 3× with backoff  |
| Publish    | `manual` channel                   | Render the copy-out block; never mark it published  |
| Measure    | Scope missing or metric retired    | Report the classified cause; do not retry inline    |

## When NOT to use

A multi-slide deck → `/carousel`. Media alone → `/higgs`. Planning alone →
`/calendar`. Shipping _code_ → `/ship` or `/release`. Posting into `#social` as a
human → just post; this is the audience lane.

Reference: `.claude/agents/growth.md` · `content/docs/social/` ·
`content/docs/brand.mdx` · `docs/SOCIAL-AUTOMATION.md`.
