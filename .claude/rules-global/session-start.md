# Session Start — the report queue

A `SessionStart` hook (`~/.claude/hooks/session-start-reports.sh`, canonical copy
`kun/.claude/hooks/`) lists the open report-an-issue items across the databayt repos in one
GitHub search: `📋 Open reports: N (A accepted, T from the team). Say "report" …` plus rows
ordered accepted → verified → team → needs-human → low-confidence → legacy, oldest first
within a lane. No output means no open reports.

**The hook lists. Abdout chooses. Nothing is auto-processed** (the human gate, since
2026-09-13). At session start do nothing with the list — mention the count if relevant. When
he says `report` ("list the reports", "what did the team report", "البلاغات"), run the
`report` skill: numbered table → his take / reject choices → fix what he accepted.
`report <repo>#N` treats that issue as accepted and skips the list; `report --status` renders
the table and stops.

Lanes: **accepted** — a human said yes; fixable once he says `report`, never on session start ·
**verified** — score ≥ 75 with an AI-confirmed bug, or three corroborating reporters; treated
like accepted · **team** — reported by a databayt team member (kun contributor session,
hogwarts DEVELOPER / team account / demo-tenant admin); never sinks below needs-human, shown
first among the undecided · **needs-human** / **low-confidence** — undecided; the score is a
hint, he decides · **legacy** — bare `report` label from before scoring. The credibility
pipeline (`kun/src/lib/report/`) kills junk before an issue exists; its scores order the list,
they are not verdicts.

**Reject** = close as _not planned_ with a one-line comment naming the reason, so the reporter
sees why. No label games.
