# Captain Journal

> Chronological log of major captain decisions, observations, and learnings.
> One entry per significant event. Dated. Append-only (corrections in new entries).

The captain reads the **last 5 entries** at session start, plus any entries tagged `#open` or `#review-due`.

---

## 2026-05-12 — Captain OS bootstrap

**What happened**: Phase A of the Captain OS implementation began. Identity layer (CONSTITUTION.md, NORTH-STAR.md, PRINCIPLES.md) written. State files seeded (runway.json, revenue.json, customers.json, pipeline.json, capacity.json, risks.json, north_star.json, okrs.json). Memory directories created (decisions/, weekly/, monthly/, quarterly/, 1on1/, interviews/).

**Why this matters**: Before today, the captain was stateless — every session started blank. The Monday/Wednesday/Friday rhythm described in `captain.md` had no archive. Now there is a persistent operating system.

**Three founder-level decisions captured** (from Abdout, 2026-05-12):
1. **North Star** = "Active paying schools using Hogwarts" (current 0, 12-month target 3, 5-year target 50).
2. **Mission** = "To make excellent school operations accessible to every Arabic-speaking community — built in the open, shared as an economy."
3. **Phase A scope** = Full Phase A (Days 1-5) in this session.

**Default state**: default-dead (Graham). 10 months of runway, $0 MRR. Exit to default-alive requires 3 paying schools at avg $100/mo.

**Active risks logged**: 8 risks in risks.json. The two with highest score:
- R-003 (Sudan banking/sanctions) — 16 (likelihood 4, impact 4). Sedon's Saudi infra is the mitigation.
- R-005 (no paying customer in 6 months) — 15. Q2 2026 OKR-O1 is the mitigation.
- R-006 (Ahmed Baha disengages silently) — 15. Weekly check-in by Ali is the mitigation.

**Tags**: #bootstrap #open

---

## 2026-08-19 — Comment→DM capture proposed; the gate moves to the campaign

**What happened**: Reviewed [diwenne/openreply](https://github.com/diwenne/openreply) (open-source ManyChat alternative: Instagram comment → auto-DM) against the social pipeline. The pipeline is outbound-complete (`calendar → … → measure`) and **capture-missing** — `/funnel`'s zeros are structural, because `upsertInboundProspect`/`promoteToLead()` have zero importers. OpenReply is a reference implementation of exactly that missing lane. Recommendation: take the **pattern** (campaign = keyword + DM template + tracked link), not the codebase — its Redis/BullMQ worker duplicates kun's existing drain/cron.

**The blocker is doctrine, not engineering**: an auto-DM is an outbound brand message with no per-message approval — L4 under the current ladder, where `/social` doctrine #5 sits at L1/L2. Proposed resolution: the **DM template becomes the approvable artifact**, approved once per campaign in the existing `/social/publish` queue, with approval expiring on Meta's own 7-day private-reply window.

**Measured, not assumed**: `debug_token` on the hogwarts Page token shows `pages_messaging` is **not** granted (only `pages_manage_posts`, `pages_read_engagement`, `pages_read_user_content`, `pages_show_list`, `read_insights`). Reading comments already works; sending does not. Re-auth **plus Meta App Review** is the long pole — the code is worthless until it clears.

**Decision**: [D-20260819-campaign-level-dm-approval](decisions/2026-08-19-campaign-level-dm-approval.md) — Type 1, status `proposed`, awaiting Abdout by 2026-08-26. Scope stays hogwarts × facebook × Sudan per D-20260806; IG inherits when #141 unblocks.

**Tags**: #decision #social #funnel #capture #open

---

## 2026-11-08 — Interim CEO desk: one price, one contract, one plan the team receives

**What happened**: Abdout asked Claude to run the team while the CEO seat is empty (Abobaker paused), with gated access to «المدرسة 2.0» (read everything, post nothing without his "send"). A full read of the group showed the drift: 171 messages in October, 7 in November, هويدا's "ما الجديد؟" unanswered, and the 10-29 marketing meeting never held. The CRM held 3,899 scraped schools and one stale deal. Al-Ibda (client #1, 48 students) starts teaching this week. Under the "first 100 free" rule it would never have paid. Abdout reset the price to 24 SAR ($6.40) per student from the first, with a 1-month trial for new schools; Al-Ibda keeps 3 months from 09-19, so the first bill is 12-19 ([D-20261108-pricing-one-month-trial](decisions/2026-11-08-pricing-one-month-trial.md)). The ~43 business pages were folded into 16 short team pages (EN + AR) in hogwarts docs. A one-page Arabic contract was made for Al-Ibda, and 4 real deals were put in the CRM.

**Why this matters**: R-005 ("no paying customer") triggers 11-12 and runway is an estimated 3–5 months. Nothing moved because the plan never reached the team and the pipeline lived in WhatsApp.

**Decision/Next action**: Sprint 1 (8–21 Nov) = Al-Ibda signs by 11-20 and two schools start a free month. The cadence moves to Sudan's week: Sunday plan, Tuesday check, Thursday review, posted to «المدرسة 2.0» only on Abdout's "send". Drafts 01–03 are in `~/.claude/state/team/outbox/`. Owed by Abdout: contract blanks (signing entity, Bankak account), real cash and burn, London/Alhuda real or test, هويدا on the roster, the 09-16/09-17 clients.

**Tags**: #decision #pricing #weekly #open

---

## How to use this journal

**When the captain writes**: At the end of every weekly/monthly/quarterly review. On every Type-1 decision (use `/decide`). On every observation worth keeping for later sessions.

**Entry format**:
```
## YYYY-MM-DD — Short title

**What happened**: One paragraph of facts.
**Why this matters**: One paragraph of interpretation.
**Decision/Next action**: What was decided or what comes next.
**Tags**: #weekly #monthly #decision #pivot #lesson #review-due #open #closed
```

**Tagging conventions**:
- `#open` — there is still work to do; the captain returns to this at next review.
- `#closed` — the matter is resolved; no further action.
- `#review-due` — the captain should re-evaluate this entry (typically 30 or 90 days after the original entry).
- `#lesson` — a generalizable principle; consider promoting to `PRINCIPLES.md` via `/principle add`.
- `#pivot` — a major direction change.
- `#decision` — links to a decision in `decisions/<date>-<slug>.md`.
- 2026-10-21 #decision mkan /find agent reads and writes with Claude Haiku 5.5 on the included Max API credits, hard-capped at $15/mo (ledger `ApiSpend`, Groq → rules fallback) — [D-20261021-included-api-credits-for-find](decisions/2026-10-21-included-api-credits-for-find.md)
- 2026-11-08 #decision hogwarts live classes run on LiveKit Cloud Ship ($50/mo + overage, ~$50–110/mo at alabidae's volume vs ~$26/mo its revenue) — subscription-only exception; kill/continue ≥60% of alabidae students joining within 2 weeks; review 2026-11-23 — [D-20261108-livekit-ship-for-live-classes](decisions/2026-11-08-livekit-ship-for-live-classes.md)
