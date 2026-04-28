---
name: sprint-plan
description: Captain's Monday sprint planning ceremony. Allocates 14 days of work across 4 humans + 5 products from the runway/capacity/pilot snapshot.
argument-hint: "[--dry-run | --sprint <number>]"
allowed-tools: Read, Glob, Grep, Bash(jq:*), Bash(gh:*), Bash(bash scripts/runway.sh), Bash(bash scripts/inventory.sh), Write, Edit
context: fork
agent: general-purpose
---

# /sprint-plan

The Monday ceremony. Replaces 90 minutes of human stand-around with a structured allocation captain dispatches by 09:00 Asia/Riyadh.

## Inputs (in this order)

1. **Last sprint outcome** — `~/.claude/projects/-Users-abdout-kun/memory/captain_journal.md` (last `## YYYY-MM-DD — Weekly cycle` entry)
2. **Open issues across 14 repos** — `gh issue list --label captain,pilot,P0,P1` for `databayt/{kun,hogwarts,marketing,mkan,souq,shifa,swift-app}`
3. **Capacity** — `.claude/memory/capacity.json` (per-human focus, hours, blockers, accessibility)
4. **Runway** — `.claude/memory/runway.json` (weeks_remaining, monthly_burn, MRR)
5. **Pilot stage** — `.claude/memory/pilot-king-fahad.json`
6. **Cost telemetry** — `~/.claude/memory/spend-daily.json` (E28.1) for spend trajectory
7. **Inventory** — `~/.claude/memory/kun-inventory.json` for surface state

## Procedure

### Step 1: Refresh state

```bash
bash scripts/runway.sh
bash scripts/inventory.sh
```

### Step 2: Detect sprint number

Read `captain-state.json.sprint.current`. Increment by 1 (S1 → S2, etc.).

### Step 3: Allocate per human

For each human in `capacity.json`, draft 3-5 tasks scoped to:

- **abdout (founder, eng)**: 1-2 product features, 1 foundation task, 1 review task. Watch hours: max 30/week.
- **ali (qa+sales)**: Test newly deployed flows + 1 outreach campaign + report-issue triage. Time-box: 20h.
- **samia (rd + kun caretaker)**: 1 research item + kun-side documentation + Arabic content review. Accommodates accessibility (verbose status, semantic markers).
- **sedon (saudi ops, part-time)**: 1 batched ops task. Friday delivery target.

Each task gets:
- `id` (auto: `S{n}.{human}.{seq}`)
- `title` (≤80 chars)
- `outcome` (one observable result)
- `definition_of_done` (link to `.claude/dod/<type>.md`)
- `est_hours`
- `blocks` / `blockedBy`
- `priority` (P0/P1/P2 per the captain's ICE matrix)

### Step 4: Write the sprint file

Output path: `.claude/sprints/{sprint-number}.md`

Format:

```markdown
# Sprint {N}

> Window: {YYYY-MM-DD → YYYY-MM-DD}
> Goal: {one sentence}
> Captain: assigned {today}

## Per-human

### Abdout
- [ ] **S{N}.abdout.1** — {title}
  - Outcome: …
  - DoD: .claude/dod/feature.md
  - Est: 8h | Priority: P0

### Ali
- [ ] **S{N}.ali.1** — …

### Samia
- [ ] …

### Sedon
- [ ] …

## Stretch (only if primary done)

- [ ] …

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|

## Definition of Done

Each task above marks completion against `.claude/dod/<type>.md`.
```

### Step 5: Update GitHub Project board

If a `Databayt Engineering` GitHub Project exists, mirror tasks as cards. Add `--label sprint:S{N}` to each.

### Step 6: Update memory

- Append to `captain_journal.md`:
  ```
  ## {YYYY-MM-DD} — Sprint {N} planning
  - Goal: {goal}
  - Per-human top task: {abdout}, {ali}, {samia}, {sedon}
  - Top 3 risks: {list}
  ```
- Update `captain-state.json`:
  - `sprint.current = "S{N}"`
  - `sprint.window = "{start} → {end}"`
  - `sprint.focus = "{goal}"`

### Step 7: Dispatch

`/dispatch --priority normal --channel cowork "Sprint {N} plan posted at .claude/sprints/{N}.md"` plus a Slack `#dispatch` summary.

## --dry-run output

Prints the sprint draft to stdout without writing files or dispatching.

## Definition of Done for /sprint-plan itself

- [ ] `.claude/sprints/{N}.md` exists with all 4 humans allocated
- [ ] Captain journal has the dated entry
- [ ] `captain-state.json.sprint.current` updated
- [ ] Slack `#dispatch` summary posted (only when not `--dry-run`)
- [ ] If MRR > 0 last week, MRR delta noted in journal

## When NOT to use this skill

- Mid-sprint adjustments — use `/dispatch` to communicate small changes
- Hiring or budget decisions — escalate via captain decision matrix instead

## Reference

- Captain agent: `.claude/agents/captain.md`
- Decision matrix: `.claude/captain/decision-matrix.yaml`
- Routine equivalent: `.claude/routines/weekly-captain-cycle.md` (autonomous version)
