---
name: Premortem
description: Klein-style premortem — imagine a decision/project failed, write the story, surface risks
when_to_use: "Use before committing to a decision or project, to surface risks by assuming it already failed. Unlike /decide (records the call) and /canon (supplies a principle). Triggers on: what could go wrong, imagine this failed, what are the risks, stress-test this plan."
argument-hint: "[decision or project to premortem]"
allowed-tools: ["Read", "Glob", "Grep", "Write", "AskUserQuestion"]
lane: judge
effort: high
---

# Premortem

Run a Gary Klein–style premortem. Imagine the decision or project has failed catastrophically. Write the story explaining why. Surface the risks before they materialize.

## Why this works

Optimism bias makes teams systematically under-weight failure modes. Asking *"how could this fail?"* triggers loyalty-to-the-plan responses. Asking *"it's failed; tell me why"* sidesteps that defense. People who would have stayed silent now generate detailed failure stories.

Source: Gary Klein, "Performing a Project Premortem," *Harvard Business Review*, September 2007.

## Usage

```
/premortem                                        # Interactive
/premortem "King Fahad Schools Q3 conversion"     # Subject inline
```

## Argument: $ARGUMENTS

## Process

1. **Define the subject**
   - What decision or project are we premortem-ing?
   - When is the "failure date" we're imagining? (Default: 6 months out for major decisions; 3 months for sprint-scale projects)
   - Who is involved? (List the people, agents, and customers)

2. **Set the failure scenario**
   - Write one paragraph: *"It is [date]. [Subject] has failed completely. The expected outcome did not occur. The cost was [scale: time / money / opportunity / reputation]."*

3. **Generate failure stories** (the meat of the exercise)
   - Independently brainstorm at least 5 distinct failure stories. Don't merge them.
   - Each story should be specific: who did what, when, what they missed, what surprised them.
   - Use "the failure story" framing: *"The thing that killed it was..."*
   - When stuck, prompt with these failure-mode categories:
     - Customer failure (the customer didn't actually want what we built)
     - Execution failure (the team didn't deliver)
     - Timing failure (we were too early, or too late)
     - Competitive failure (someone else did it better/cheaper)
     - Resource failure (we ran out of money, time, or attention)
     - Trust failure (a key relationship broke)
     - Tech failure (a critical assumption about the tech was wrong)
     - Self failure (the founder/team got in their own way)

4. **Cluster the stories into risks**
   - Group similar failure stories. Each cluster = one risk.
   - For each cluster, write a risk title (1 line) + likelihood (1-5) + impact (1-5).

5. **Decide for each risk**
   - **Mitigate**: define a concrete action that reduces likelihood or impact. Owner. Date.
   - **Accept**: name the residual risk and write down "we know this could happen and we proceed anyway because [reason]."
   - **Defer**: note the trigger that would make us address it later.
   - **Block**: this risk is severe enough that we don't proceed. Re-think the subject.

6. **Output**
   - Write the premortem to `/Users/abdout/kun/.claude/memory/decisions/<date>-premortem-<slug>.md`
   - For each "Mitigate" risk, suggest adding to `risks.json` via `/risk add`
   - For each "Block" risk, escalate to Abdout via Apple Notes Dispatch/Inbox

## File format

Write to `/Users/abdout/kun/.claude/memory/decisions/<YYYY-MM-DD>-premortem-<slug>.md`:

```markdown
# Premortem: <subject>

**Date**: YYYY-MM-DD
**Run by**: <founder | captain | team>
**Failure date imagined**: YYYY-MM-DD (X months out)
**People involved**: ...

## Failure scenario

It is [imagined date]. [Subject] has failed. [One paragraph specifying the failure.]

## Failure stories

### Story 1 — [headline]
[2-3 sentences specifying what happened]

### Story 2 — [headline]
...

(at least 5 stories)

## Risks identified

| ID | Risk | Likelihood (1-5) | Impact (1-5) | Score | Decision |
|---|---|---|---|---|---|
| 1 | ... | 3 | 4 | 12 | Mitigate |
| 2 | ... | 4 | 3 | 12 | Mitigate |
| 3 | ... | 2 | 5 | 10 | Accept (residual) |
| 4 | ... | 3 | 5 | 15 | Mitigate |
| 5 | ... | 4 | 4 | 16 | BLOCK — escalate |

## Mitigations

### Risk 1: ...
- **Action**: ...
- **Owner**: ...
- **Due**: ...
- **Logged in risks.json**: yes (R-NNN)

### Risk 2: ...
...

## Accepted residual risks

- Risk 3: We accept this because... If it materializes, the recovery plan is...

## Blocked

- Risk 5: We do not proceed with [subject] until this risk is reduced. Escalation to Abdout: ...

## Decision

Based on this premortem:
- [ ] Proceed as planned
- [ ] Proceed with mitigations
- [ ] Defer until X is true
- [ ] Block — re-think the subject

**Reviewed-by**: <date> — at the failure date, return here and grade the premortem (which risks materialized? which mitigations worked? what did we miss?)
```

## After writing

1. Append a one-line entry to `/Users/abdout/kun/.claude/memory/captain_journal.md` with `#premortem` tag.
2. For each "Mitigate" risk, write to `/Users/abdout/kun/.claude/memory/risks.json` (via `/risk add`).
3. If "Block" decided, dispatch to Apple Notes Dispatch/Inbox with deadline.

## Reference

- Gary Klein, *Performing a Project Premortem*, Harvard Business Review (September 2007)
- Daniel Kahneman, *Thinking, Fast and Slow* (chapter on planning fallacy)
- Annie Duke, *Thinking in Bets* (premortem as decision-quality tool)
