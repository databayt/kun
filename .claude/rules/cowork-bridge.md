# Cowork ↔ Claude Code Bridge

Cowork and Claude Code are two modes of the same brain. They share everything in `~/.claude/` — agents, memory, settings, rules. The difference is posture:

- **Cowork** = Think. Plan. Research. Write. Decide.
- **Claude Code** = Do. Build. Deploy. Fix. Ship.

## Shared State

Both modes read and write to:

| Resource | Path | Purpose |
|----------|------|---------|
| Agents | `~/.claude/agents/*.md` | Same 40 agents available in both modes |
| Memory | `~/.claude/memory/*.json` | Persistent state (team, repos, patterns) |
| Dispatch/Cowork | Notes → Dispatch → Cowork | Handoff note between modes |
| GitHub Issues | databayt/*/issues | Work items created in either mode |

## Handoff: Cowork → Code

When work starts in Cowork (planning, strategy, research):

1. Cowork produces a **deliverable**: plan, architecture, stories, research brief
2. Cowork writes it to Dispatch/Cowork note: `dispatch.sh cowork "Plan complete: [summary]. Issues created: #X, #Y, #Z"`
3. Cowork creates GitHub issues for each actionable item
4. Claude Code reads Cowork note at session start
5. Claude Code picks up the issues and executes

Example flow:
```
[Cowork session]
Abdout: "Plan the hogwarts notification system"
→ Research patterns, design architecture, write stories
→ Create issues: databayt/hogwarts#10, #11, #12
→ dispatch.sh cowork "Notification system planned. 3 issues created. Start with #10."

[Claude Code session]  
Captain: reads Cowork note → sees plan → starts executing #10
```

## Handoff: Code → Cowork

When Code finishes work that needs strategic review:

1. Code writes to Dispatch/Cowork: `dispatch.sh cowork "Built X. Needs review: [what to look at]"`
2. Code creates a GitHub issue if follow-up work is needed
3. Cowork picks up in the next Desktop session

## Session Start Protocol

Every Claude Code session:
1. Read inbox: `dispatch.sh read inbox` — check for Abdout's instructions
2. Read cowork: `dispatch.sh read cowork` — check for Cowork handoffs
3. Check GitHub: `gh issue list --repo databayt/kun --assignee abdout --state open`
4. Proceed with highest priority work

Every Cowork session:
1. Check Dispatch/Cowork note for Code's output
2. Review GitHub issues for completed/blocked items
3. Plan next moves

## Voice Mode Integration

Abdout can use voice in Claude Desktop for:
- Quick decisions: "Yes, ship it" / "No, hold off"
- Brain dumps: Speak a plan, Claude transcribes and structures it
- Review dispatches: "Read me the latest captain dispatch"
- Create issues by voice: "Create an issue for hogwarts about the admission page being slow"

Voice → Cowork → structured plan → issues → Code executes.

## The Key Insight

Cowork doesn't need to know how to code.
Claude Code doesn't need to strategize.
They share a brain through files, notes, and issues.

Abdout switches between them like switching between thinking and doing.
Both are the same Captain — one thinks, one acts.
