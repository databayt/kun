# Captain Journal

> Auto-loaded into every session via `~/.claude/projects/-Users-abdout-kun/memory/MEMORY.md`.
> First 200 lines / 25KB are hot. Older entries archive to dated topic files.
> Captain writes here on every weekly cycle and after every escalation.

## Index

- `## Current sprint` — what we're working on
- `## Recent decisions` — last 5 captain decisions with rationale
- `## Open escalations` — items dispatched to Abdout, awaiting response
- `## Runway snapshot` — derived from `runway.json`
- `## Pilot status` — derived from `pilot-king-fahad.json`
- `## What changed since last session` — auto-diff vs prior journal entry

---

## Current sprint

**S1: Foundation Repair (2026-04-26 → 2026-05-09)**

Active epics: E13 (Engine State Reconciliation), E14 (Rules + Memory Backfill), E15 (Permissions & Settings Hardening).

Goal: close docs/reality gap so subsequent sprints have stable ground. By end of S1: inventory script in CI, 8 path-scoped rules + 10+ memory files exist, settings.json has full allow/deny + SessionStart hook wired Mac+Windows.

---

## Recent decisions

_(none yet — populated as captain runs weekly cycles)_

---

## Open escalations

_(none)_

---

## Runway snapshot

- Capital: $5,000
- Monthly burn: $500
- Months remaining: 10
- MRR: $0 (no paying customers)
- Anthropic envelope: $200/mo (max plan)

Source: `.claude/memory/runway.json` (last updated 2026-04-25).

---

## Pilot status

- Pilot: King Fahad Schools, Sudan
- Primary contact: Ahmed Baha
- Stage: `meeting` — discovery meeting held 2026-04-04
- Outcome of 2026-04-04 meeting: **not yet ingested into memory** — captain follow-up needed
- Blocker: admission QA (databayt/hogwarts#115) has 5 interactive items pending

Source: `.claude/memory/pilot-king-fahad.json`.

---

## What changed since last session

_(first session — establishes baseline)_

Initial captain_journal seeded as part of Story 14.6 / E16.1.

Prior accumulated context lives in 19 narrative memory files at `~/.claude/projects/-Users-abdout-kun/memory/`:
- `project_kun_profile.md` — kun engine state
- `project_hogwarts_pilot.md` — King Fahad pilot context
- `project_qa_mission.md` — issue #115 QA loop
- `team_profiles.md` — 4-human team profiles
- `feedback_kun_autonomy.md` — captain delegation philosophy
- (14 more)

Captain reads those before writing new entries here, to avoid duplicating context.

---

## Notes

This file is the captain's working memory between sessions. Never edit by hand — captain rewrites it during weekly cycles and after each major decision. Older entries roll off into dated topic files (`captain_journal_<YYYY-MM>.md`).
