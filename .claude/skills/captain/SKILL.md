---
name: Captain
description: Databayt CEO brain - synthesize identity + state + journal, suggest next action
when_to_use: "Use when the question is what to work on next at company level. Unlike /canon (a principle for one decision) or /weekly (the Friday ritual). Triggers on: what should I do next, company status, brief me, where do I spend this week."
argument-hint: "[brief|status|next|allocate]"
allowed-tools: ["Read", "Glob", "Grep", "Bash(gh *)", "Bash(git status)", "Bash(/Users/abdout/kun/.claude/scripts/dispatch.sh *)"]
lane: captain
effort: xhigh
---

# Captain

Synthesize Databayt's CEO operating state and suggest the next action. Reads the identity layer + state files + journal + Apple Notes Inbox + open issues. Writes nothing without explicit confirmation.

## Usage

```
/captain              # Full synthesis: identity + state + next action
/captain brief        # Top-3 lines: north-star value + runway + one suggested action
/captain status       # Full state report (no action suggestion)
/captain next         # Just the next-action suggestion
/captain allocate     # Weekly allocation prompt (use Monday)
```

## Argument: $ARGUMENTS

## Files this skill reads (in order)

```
/Users/abdout/kun/docs/CONSTITUTION.md       # mission, vision, values
/Users/abdout/kun/docs/PRINCIPLES.md         # the 24 founder principles
/Users/abdout/kun/docs/NORTH-STAR.md         # the one metric

/Users/abdout/kun/.claude/memory/captain_journal.md  (last 5 entries)
/Users/abdout/kun/.claude/memory/runway.json
/Users/abdout/kun/.claude/memory/north_star.json
/Users/abdout/kun/.claude/memory/okrs.json
/Users/abdout/kun/.claude/memory/risks.json   (any score ≥ 11)
/Users/abdout/kun/.claude/memory/customers.json
/Users/abdout/kun/.claude/memory/pipeline.json   (any days_since_contact > 14)
/Users/abdout/kun/.claude/memory/capacity.json
/Users/abdout/kun/.claude/memory/team.json

/Users/abdout/kun/.claude/memory/weekly/   (latest archive)
/Users/abdout/kun/.claude/memory/monthly/  (latest archive)
```

Plus, when accessible:
```
dispatch.sh read inbox    # Apple Notes Dispatch/Inbox (Abdout's instructions)
dispatch.sh read cowork   # Apple Notes Dispatch/Cowork (Cowork ↔ Code bridge)
gh issue list --repo databayt/kun --state open --limit 10
gh issue list --repo databayt/hogwarts --state open --limit 10
```

## What this skill outputs

### `/captain` (default — full synthesis)

```
DATABAYT CAPTAIN — <date>

MISSION
  <mission line from CONSTITUTION.md>

NORTH STAR
  <metric>: <current> (target this quarter: <q-target>; 12mo: <12-target>)
  Δ this week: <delta>
  Status: <on-track | at-risk | off-track>

RUNWAY
  <weeks_remaining> weeks (<months_remaining> months) — <default-alive | default-dead>
  MRR $<mrr> / burn $<burn>

PIPELINE
  Total prospects: <N>  |  Pilots: <P>  |  Paying: <C>
  Cold prospects (>14d no contact): <list with names>

OKRS — current quarter <YYYY-Q>
  - O1: <objective> [<grade>]  ← <next-action if any>
  - O2: ...
  - O3: ...

RISKS (high)
  - R-NNN <title> [score] <next-action>

CAPACITY THIS WEEK
  - abdout: <focus>
  - ali: <focus>  ...

INBOX (Apple Notes from Abdout)
  - <unread items, if any>

JOURNAL — last entries
  - <date>: <title>
  - <date>: <title>

SUGGESTED NEXT ACTION
  <one specific action the captain recommends, with reasoning>
```

### `/captain brief`

```
NS: <value>/<target> · Runway: <weeks>w · <one-line action>
```

### `/captain next`

Just the suggested next action. Single paragraph, with reasoning grounded in what was read.

### `/captain allocate`

Synthesizes capacity.json + okrs.json + pipeline.json into a Monday allocation proposal:

```
WEEK OF <date>

FOCUS THIS WEEK
  - North-star delta target: <expected_delta>
  - OKR KRs needing movement: <list>

ALLOCATION (proposed)
  - Abdout → <focus> (<rationale>)
  - Ibrahim → <focus> (<rationale>)
  - Ali → <focus> + <customer interview target>
  - Mutaz → <focus>
  - Samia → <focus>
  - Sedon → <Mon clear map → Fri delivery: list>

ESCALATIONS DUE
  - <list of items past or approaching deadline>

TASKS (one GitHub issue each, shape below — drafted, not created)
  1. <repo>: <title> — dept:<d> · P<n> · after <none|repo#n>

CONFIRM TO POST TO SLACK + DISPATCH + CREATE THE ISSUES? Only Abdout's explicit "send" does any of it.
```

After "send", **distribute work**: create one issue per task in the Task shape below, in the right
databayt repo. Before "send" the tasks stay drafts in the output; nothing is created or posted.

## Task shape (what the machine app reads)

Contract: `src/lib/machine/contract.ts`. A task is a GitHub issue; the machine app lists it for the
person whose department matches, checks readiness, and opens a chat on Start.

- **Repo**: the repo the work lands in (`hogwarts`, `mkan`, `kun`, ...). Work with no repo goes in `kun`.
- **Title**: imperative, under 70 chars. **Body**: Goal, Acceptance (a checklist, each line testable),
  Context (links to docs, issues, files), then the kun block as the last line.
- **Labels**: `dept:<tech|business|sales|marketing|video|support|rnd>` + `P0`..`P3`. Missing label:
  `gh label create "dept:sales" --repo databayt/<repo> --color 0E8A16` (same for `P1`).
- **Milestone**: the current sprint, title `Sprint <yyyy>-W<ww>` (ISO week, `date +%G-W%V`), goal in its
  description. Missing: `gh api repos/databayt/<repo>/milestones -f title="Sprint 2026-W47" -f description="<goal>"`.
- **Kun block**: `<!-- kun: repos=<repos the task needs>; items=<skill:x,agent:y>; after=<ids> -->`.
  `items` come from `departments/<dept>/pack.json` → `items` (only what the task uses, never invent one);
  `repos` are the repos the person must have local; `after` orders the queue: `repo#n` or a bare `#n`
  for the same repo; omit when nothing blocks.
- **Never set** `holder:<login>`, `status:in-progress` or `status:review`: the machines manage them.
  Never close an issue for a person: only the CEO closes, after Done moves it to review.
- **Assignee**: leave it; the holder label is set when a person presses Start.

Example (sales; the quote waits for the pricing issue):

```bash
gh issue create --repo databayt/hogwarts \
  --title "Quote Al-Ibda: 1,152 SAR per year" \
  --label "dept:sales" --label "P1" --milestone "Sprint 2026-W47" \
  --body '## Goal
Send Al-Ibda a quote at the approved rate (24 SAR per student).

## Acceptance
- [ ] Student count confirmed with the school
- [ ] Quote uses the one rate, no VAT, 1-month trial stated
- [ ] Sent after Abdout approves; logged in the CRM

## Context
docs: content/docs/pricing.mdx · pilot: memory project_pilot_status

<!-- kun: repos=hogwarts,kun; items=skill:proposal,skill:pricing; after=#41 -->'
```

## Decision suggestions follow these rules

The captain agent's Decision Matrix governs what counts as ACT vs ESCALATE vs DELEGATE. This skill follows those rules:

- **ACT-tier suggestions**: the captain proceeds (with confirmation prompt for visibility).
- **ESCALATE-tier suggestions**: the captain proposes a dispatch to Apple Notes Dispatch/Inbox with deadline tag — does NOT act.
- **DELEGATE-tier suggestions**: the captain identifies the right agent (revenue / growth / support / product / analyst / tech-lead / ops / guardian) and proposes the handoff.

## Companion skills

- `/weekly [plan|check|review]` — run the weekly cycle
- `/decide` — write a decision journal entry
- `/premortem` — run a Klein-style premortem on a Type-1 decision
- `/risk add|list|review|retire` — manage the risk register
- `/1on1 <person>` — prep + log a 1:1 (when implemented)
- `/monthly` — monthly review (when implemented)
- `/quarterly` — quarterly OKR cycle (when implemented)
- `/founder-retro` — behavioral retrospective on Abdout's last month (when implemented)

## Reference

- Source agent: `/Users/abdout/kun/.claude/agents/captain.md`
- Standard of Performance: see captain.md "Captain's Standard of Performance" section (12 principles)
- Plan: `/Users/abdout/.claude/plans/i-want-you-to-unified-piglet.md`

## Operating mantra

Mission first. Speed last. Truth always. Quality over speed. Mission over survival. Community is the moat.
