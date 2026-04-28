---
name: sprint-review
description: End-of-sprint retro — tallies completed/incomplete stories, computes velocity, drafts next sprint, updates captain journal
argument-hint: "[--sprint <number>]"
allowed-tools: Read, Glob, Grep, Bash(jq:*), Bash(gh:*), Edit, Write
context: fork
agent: general-purpose
---

# /sprint-review

The Friday retrospective. Closes the loop on the past sprint and feeds the next `/sprint-plan` cycle.

## Procedure

### Step 1: Identify the sprint

Read `.claude/memory/captain-state.json.sprint.current`. Look up `.claude/sprints/{current}.md`.

### Step 2: Tally

For each task in the sprint markdown (`- [ ]` and `- [x]`):

- Count completed (`[x]`) vs incomplete (`[ ]`)
- Group by human
- Note carry-overs (incomplete tasks that should move to next sprint)

### Step 3: Velocity calculation

```
velocity = completed_story_points / sprint_duration_days
trend    = compare to last 3 sprints
```

If trend is declining > 20%, surface to captain decision queue.

### Step 4: Per-human summary

For each human, summarize:
- Tasks completed
- Tasks slipped (and why, from blockers)
- Work outside the plan (commits to issues that weren't in the sprint)

### Step 5: Customer feedback synthesis

```bash
# Pilot health summary from Routine output
ls -t ~/.claude/memory/pilot-health-*.jsonl | head -7 | xargs cat | \
  jq -s 'map(select(.status != "ok")) | length'
```

Plus: any new GitHub issues with `report` label since sprint start.

### Step 6: Revenue delta

Compare `.claude/memory/revenue.json.totals.mrr` to the snapshot at sprint start (use the prior `captain_journal.md` entry).

### Step 7: Write the review file

Output: `.claude/sprints/{N}-review.md`

```markdown
# Sprint {N} Review

> Window: {start} → {end}
> Captain: review {today}

## Velocity
- This sprint: {x} story points / {n} days = {x/n}/day
- Trend (last 3): {S{N-2}}, {S{N-1}}, {S{N}} → {↑|→|↓}

## Per-human

### Abdout
- Completed: 5 / 7
- Slipped: 2 (reason: …)
- Outside-plan: 3 commits to hogwarts#115 (admission unblock)

### Ali
- …

### Samia
- …

### Sedon
- …

## Revenue
- MRR start: $0
- MRR end: $0
- Delta: $0
- Pipeline: 1 warm (king-fahad)

## Pilot
- Stage transition: meeting → proposal
- Health: 168/168 hourly checks passed

## Customer reports
- Opened: 3 (hogwarts#268, #269, #270)
- Closed: 2 (auto-fixed via /report)
- Pending: 1 (#270 needs human)

## Carry-overs to next sprint
- [ ] S{N}.ali.3 — admission UAT round 2

## Decisions (captain made this sprint)
- {decision id}: {one-line summary} → {outcome}

## Lessons
- What worked: {bullet}
- What didn't: {bullet}
- Try next sprint: {bullet}
```

### Step 8: Update captain journal

```
## {YYYY-MM-DD} — Sprint {N} review
- Velocity: {x/day} ({trend})
- MRR delta: ${x}
- Carry-overs: {n}
- Lessons: {3-bullet summary}
```

### Step 9: Generate next-sprint draft

Produce a draft Sprint {N+1} skeleton with carry-overs pre-populated. Save as `.claude/sprints/{N+1}-draft.md`. The next Monday `/sprint-plan` will read this draft as a starting point.

### Step 10: Dispatch

Slack `#dispatch`: full review summary. Apple Notes Captain: TL;DR. If revenue delta is negative or pilot stage regressed → `/dispatch --priority decision`.

## Definition of Done

- [ ] `.claude/sprints/{N}-review.md` exists
- [ ] `captain_journal.md` has dated review entry
- [ ] `.claude/sprints/{N+1}-draft.md` exists with carry-overs
- [ ] Slack #dispatch summary posted

## Reference

- Sprint plan skill: `/sprint-plan`
- Standup skill: `/standup`
- Refine skill: `/refine`
- Captain: `.claude/agents/captain.md`
