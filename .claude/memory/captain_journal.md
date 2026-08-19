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
