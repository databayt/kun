---
name: Decide
description: Write a decision journal entry — Type 1/2 classification, premortem, expected outcome, reviewed-by date
when_to_use: "Use when a choice worth remembering needs recording in the decision journal. Unlike /canon (surfaces a principle) and /premortem (only the failure story). Triggers on: log this decision, we decided to, record the call."
argument-hint: "[brief decision summary]"
allowed-tools: ["Read", "Glob", "Grep", "Write", "AskUserQuestion"]
lane: judge
effort: high
---

# Decide

Write a structured decision journal entry to `/Users/abdout/kun/.claude/memory/decisions/<YYYY-MM-DD>-<slug>.md`. Forces the writer to confront the difference between decision and outcome (Annie Duke). Surfaces failure modes (Klein premortem). Schedules a review (Bezos / Grove "what was your prediction").

## Usage

```
/decide                          # Interactive — prompts for the decision
/decide "Accept Ahmed Baha free pilot extension"     # Provide summary inline
```

## Argument: $ARGUMENTS

## Process

1. **Capture the decision**
   - Title (short slug)
   - Decision (one paragraph — what is being decided)
   - Decided by: founder | captain | team
   - Date

2. **Consult the canon** (Databayt operating layer)
   - Consult the canon (`docs/CANON.md`) for the book + operating move relevant to this decision — surfaced automatically by decision type; `/canon <decision-type>` also works.
   - Examples: hiring → CEO Excellence / High Output Mgmt; a hard irreversible call → The Hard Thing; build-or-not → The Lean Startup; a customer-facing bet → The Mom Test / Crossing the Chasm.
   - Carry the surfaced operating move into the premortem and alternatives below.

3. **Classify Type 1 vs Type 2** (Bezos)
   - **Type 1 — irreversible** (or nearly so): hires, license changes, public commitments, product launches, brand changes, partnerships, anything that changes the company's posture. Slow down. Premortem required.
   - **Type 2 — reversible** (two-way door): sprint priorities, pricing tiers, feature scope, internal tooling. Decide fast. Reverse if wrong.

4. **Premortem** (only required for Type 1)
   - _"It's 6 months from now. This decision failed catastrophically. Why?"_
   - Write the failure story.
   - List 3 risks the failure story exposes.
   - For each risk, name a mitigation OR accept the residual risk.

5. **Expected outcome**
   - What success looks like (concrete, observable)
   - What failure looks like (concrete, observable)
   - Probability of success (0.0–1.0) — write the number, no hedging
   - Why this probability (the reasoning, in 2-3 sentences)

6. **Reviewed-by date**
   - Type 1: 30, 60, or 90 days out (capture in the file)
   - Type 2: 7-14 days out
   - At review: was the prediction right? Was the decision right (independent of outcome)?

7. **Alternatives considered and rejected**
   - At least 2 alternatives. For each, why rejected.
   - "Do nothing" is always one alternative.

8. **Status**
   - `proposed` — not yet executed
   - `decided` — committed
   - `executed` — action taken
   - `under-review` — at the reviewed-by date
   - `superseded` — replaced by a later decision (link to it)
   - `reversed` — reversed (link to reversal decision)

## File format

Write to `/Users/abdout/kun/.claude/memory/decisions/<YYYY-MM-DD>-<slug>.md`:

```markdown
# <Decision title>

**ID**: D-YYYYMMDD-<slug>
**Date**: YYYY-MM-DD
**Decided by**: <founder | captain | team>
**Type**: 1 (irreversible) | 2 (reversible)
**Status**: proposed | decided | executed | under-review | superseded | reversed
**Reviewed-by**: YYYY-MM-DD
**Tags**: #domain #domain

## Decision

One paragraph. Plain English.

## Context

What's true that makes this decision needed now? Reference any state files (runway.json, pipeline.json, risks.json) by their data.

## Premortem (Type 1 only)

> It's [reviewed-by date] and this decision failed catastrophically. Here's why:

[failure story — be specific]

### Risks exposed

1. **<risk>**: <mitigation or accepted>
2. **<risk>**: <mitigation or accepted>
3. **<risk>**: <mitigation or accepted>

## Expected outcome

- **Success looks like**: ...
- **Failure looks like**: ...
- **Probability of success**: 0.X
- **Reasoning**: ...

## Alternatives considered

1. **<alternative 1>**: <why rejected>
2. **<alternative 2>**: <why rejected>
3. **Do nothing**: <why rejected>

## Action

- Owner: <person/agent>
- Due: <date>
- Next checkpoint: <date>

## Review (filled at reviewed-by date)

- **Actual outcome**: ...
- **Was the prediction right?** (yes/no/partially)
- **Was the decision right** (independent of outcome)? (yes/no)
- **Lesson**: ... [tag #lesson if generalizable; promote to PRINCIPLES.md via /principle]
```

## After writing

1. Append a one-line entry to `/Users/abdout/kun/.claude/memory/captain_journal.md` with `#decision` tag and a link to the file.
2. If the decision is `escalated to Abdout`, dispatch to Apple Notes Dispatch/Inbox with deadline.
3. Print the file path so the user can edit if needed.

## Companion skills

- `/canon` — surface the operating move (book) for this decision type before classifying
- `/premortem` — run a standalone premortem (without writing a full decision)
- `/risk add` — log a risk surfaced by the premortem
- `/captain` — re-synthesize state after a major decision

## Reference

- Bezos 1997 shareholder letter: Type 1 vs Type 2 doors
- Annie Duke, _Thinking in Bets_: decisions ≠ outcomes; predict before, grade after
- Gary Klein, _PreMortem_ (HBR 2007): imagine the failure first
- Daniel Kahneman, _Thinking Fast and Slow_: write the prediction down to fight hindsight bias
