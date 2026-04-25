---
name: captain
description: Run the captain's decision loop — load state, apply decision matrix, optionally dry-run
argument-hint: "[--dry-run | weekly | escalate <topic> | status]"
allowed-tools: Read, Glob, Grep, Bash(jq:*), Bash(gh issue:*), Bash(gh api:*), Bash(bash scripts/runway.sh), Bash(bash scripts/inventory.sh), Bash(cat:*), Agent
context: fork
agent: general-purpose
---

# /captain

Captain's decision loop. Reads state, applies the decision matrix in `.claude/captain/decision-matrix.yaml`, and either acts, delegates, or escalates.

## Modes

`/captain` — full decision loop (default). Reads runway, capacity, pilot stage, open issues, then either delegates to a leadership agent or escalates.

`/captain --dry-run` — same loop but **does not write or dispatch**. Prints what captain would do. Use to verify the matrix and state before letting captain act for real.

`/captain weekly` — Monday plan / Wednesday check / Friday review cycle. Updates `captain_journal.md`, `captain-state.json`, and dispatches the week's allocation.

`/captain escalate <topic>` — explicitly route a topic through the matrix and produce the escalation dispatch (does not send unless `--send` is appended).

`/captain status` — print runway, MRR, pilot stage, open captain issues. Read-only.

## Procedure

### Step 1: Refresh state

```bash
bash scripts/runway.sh                    # update runway.json
bash scripts/inventory.sh                 # update kun-inventory.json
```

Always refresh first. Stale state produces wrong decisions.

### Step 2: Load context (Read tool, in this order)

1. `.claude/captain/decision-matrix.yaml` — the rule set
2. `.claude/memory/captain-state.json` — current sprint, pilot stage, blockers
3. `.claude/memory/runway.json` — capital, burn, weeks remaining
4. `.claude/memory/revenue.json` — MRR, pipeline
5. `.claude/memory/capacity.json` — who has bandwidth
6. `.claude/memory/pilot-king-fahad.json` — pilot stage detail
7. `~/.claude/projects/-Users-abdout-kun/memory/captain_journal.md` — last weekly outcome (auto-loaded by session)

### Step 3: Apply decision matrix

For the topic at hand, walk `decision-matrix.yaml` in document order. First matching rule wins.

- `action: act` → captain executes (e.g. write the weekly plan to `captain_journal.md`)
- `action: delegate` → invoke the named agent via the Agent tool
- `action: escalate` → produce a dispatch (Apple Notes Inbox, Slack DM, or GitHub issue) per `escalation_channels`

### Step 4: Apply guards

Before any escalation:

- If `runway.json.weeksRemaining < 12` → bump priority to `urgent`
- If `runway.json.burn.breakdown.anthropic_max >= 200` → also alert ops agent
- If pilot stage transition pending → include `pilot-king-fahad.json` excerpt in the dispatch body
- If a duplicate dispatch was sent in the last 24h on the same topic → suppress unless explicitly forced

### Step 5: Re-dispatch policy

Per `decision-matrix.yaml.re_dispatch`:

- `decision` priority + 24h no response → re-dispatch as `urgent`
- `urgent` + 72h no response → captain pauses non-essential routines
- Any reply from Abdout → resume

### Step 6: Update journal

Append to `~/.claude/projects/-Users-abdout-kun/memory/captain_journal.md`:

```
## YYYY-MM-DD — <decision summary>
- Trigger: <which rule matched>
- Action: <act | delegate | escalate>
- Outcome: <what happened>
- Follow-up: <next step + deadline>
```

Keep first 200 lines hot. Older entries roll into `captain_journal_<YYYY-MM>.md`.

## --dry-run output format

When `--dry-run` is set, captain prints (not writes/sends):

```
=== Captain Decision Loop (DRY RUN) ===
Date: 2026-04-25 14:30 UTC

State:
  Sprint:    S1 — Foundation Repair (E13, E14, E15)
  Runway:    43 weeks @ $500/mo
  MRR:       $0
  Pilot:     King Fahad — stage: meeting (since 2026-04-04)
  Blockers:  hogwarts#115 (admission QA — 5 items pending)
  Capacity:  abdout=eng-config | ali=qa | samia=research | sedon=saudi-ops

Topic: <topic>
Matched rule: <rule.id>
Action: <act|delegate|escalate>
  → If act: <captain's planned action>
  → If delegate: <agent>
  → If escalate: <channel> <priority> <deadline>

Would write to: <files>
Would dispatch to: <channels>
Would NOT send.
```

## When NOT to use this skill

- For implementation work (use the relevant specialist agent directly)
- For routine sweeps (use the sweep keyword: `/nextjs`, `/react`, etc.)
- When the user is mid-conversation about something else (captain interrupts the wrong context)

Captain is for strategic loops, not tactics.

## Reference

- Agent: `.claude/agents/captain.md`
- Matrix: `.claude/captain/decision-matrix.yaml`
- Runway: `.claude/memory/runway.json` ← updated by `scripts/runway.sh`
- Journal: `~/.claude/projects/-Users-abdout-kun/memory/captain_journal.md`
- Setup: `scripts/setup-apple-notes.sh` (creates dispatch channels)
