# Cross-Session Learnings

> Patterns the captain has learned across sessions. Promoted from journal entries when they generalize.
> Reviewed quarterly. Promoted to `PRINCIPLES.md` when proven over multiple cycles.

**Last reviewed**: 2026-05-12 (founding entries from existing memory)

---

## L-001 — Build for long-term market leadership, not survival

**Source**: `feedback_kun_autonomy.md` (founder feedback, 2026 Q1)

**Lesson**: Databayt has 10 months runway and $0 MRR but is **not** in survival mode — we are in building mode. Every decision should reflect long-term market leadership in Sudan/MENA education, not short-term survival. Building solid > shipping fast.

**How to apply**: When the captain feels urgency, ask "is this urgency real, or am I confusing 10 months of runway with 1 month of runway?" If real, escalate. If not, slow down.

**Promotion status**: Already promoted → `PRINCIPLES.md` Tier 1 (Principles #3 "Quality over speed", #4 "Mission > Survival").

---

## L-002 — Apple Notes is the founder's iPhone bridge

**Source**: `agents/captain.md` + `scripts/dispatch.sh`

**Lesson**: Abdout works mostly on MacBook M4 but reads asynchronously on iPhone 16e. Apple Notes (synced via iCloud) is the only reliable channel that reaches him outside of a dev session. Three folders: Dispatch/Captain (Captain → Abdout), Dispatch/Cowork (Cowork ↔ Code), Dispatch/Inbox (Abdout → Captain).

**How to apply**: The captain dispatches to Apple Notes for any decision that requires Abdout's attention outside the current session. Add deadline tags (24h / 72h / 1 week / undated).

**Promotion status**: Operational. Captain agent already encodes this.

---

## L-003 — QA via GitHub Issues, not WhatsApp

**Source**: `feedback_qa_workflow.md` (founder feedback)

**Lesson**: Ali QA-tests features in production after Claude deploys. Reports MUST go to GitHub Issues (with the `report` label), not WhatsApp. The auto-fix pipeline (`/report` skill) only triggers from labeled issues with the credibility-scored verified-report bucket.

**How to apply**: Any time the captain wants Ali to test something, the captain creates the issue first. Any time Ali wants to report a bug, he uses the issue template.

**Promotion status**: Operational. Encoded in the `report` skill and the session-start hook.

---

## L-004 — Figma is the design source of truth

**Source**: `feedback_figma_source.md` (founder feedback)

**Lesson**: When implementing UI, always pull from Figma first. Never work from docs alone. Never make up colors/sizes/spacing.

**How to apply**: The wire / atom / block / template skills all check Figma (via Figma MCP) before generating.

**Promotion status**: Operational. Encoded in the relevant skills.

---

## L-005 — "Win horse" not "money maker" (hogwarts framing)

**Source**: `feedback_hogwarts_naming.md` (founder feedback)

**Lesson**: Hogwarts is "the win horse," not "the money maker." The framing matters — it signals aspirational quality over transactional revenue extraction. Internal language shapes culture and external language shapes positioning.

**How to apply**: When the captain or any teammate refers to hogwarts in writing or speech, use "win horse" / "flagship" / "pilot path", not "money maker" / "cash cow" / "revenue driver".

**Promotion status**: Cultural. Already in captain.md style.

---

## How learnings graduate

A learning starts as a journal entry (`captain_journal.md`). When it shows up a second time in a different context, the captain promotes it here. When it shows up a third time and the founder confirms the pattern, it graduates to `PRINCIPLES.md`.

A learning is also retired here if it stops being true (with a new entry below noting "L-XYZ retired because…").

---

## Quarterly review template

At the end of each quarter, run `/founder-retro` or manually:

1. **What did we learn that surprised us?**
2. **What did we expect to learn that we didn't?**
3. **What's a pattern that showed up twice this quarter?** → log here as L-NNN
4. **What's a learning from a prior quarter that's no longer true?** → mark retired
5. **What's a Tier 1 principle that should be added/changed?** → propose via `/principle add`
