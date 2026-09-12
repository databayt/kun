# Session Start Protocol — the report queue

The `SessionStart` hook (`~/.claude/hooks/session-start-reports.sh`, canonical copy in
`kun/.claude/scripts/hooks/`) lists the open report-an-issue items across the databayt
repos in one GitHub search call.

## The human gate (since 2026-09-13)

**The hook lists. Abdout chooses. Nothing is auto-processed.**

The credibility pipeline (`kun/src/lib/report/`) still scores every submission and
kills junk before an issue exists, but its buckets are _signals that order the list_,
not verdicts. AI triage never ran in production (no API-key spend under the
subscription-only billing posture), so every real report scored on reporter + content
signals only and the "auto-fix" bucket was unreachable. The gate replaces it.

| Hook output line                                                          | Meaning                                                                                                           | Action                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `📋 Open reports: N (A accepted, T from the team). Say "report" …` + rows | The queue, ordered accepted → verified → team → needs-human → low-confidence → legacy, oldest first within a lane | **Do nothing yet.** Mention the count if relevant. When Abdout says `report` (or "list the reports", "what did the team report", "البلاغات"), run the `report` skill: render the numbered table, take his take/reject choices, then fix what he accepted. |
| a row whose lane is `accepted`                                            | Abdout already took it in an earlier session                                                                      | Fair game for the `report` agent as soon as he says `report`; still never on session start.                                                                                                                                                               |
| (no output)                                                               | No open report items in databayt repos                                                                            | Proceed normally.                                                                                                                                                                                                                                         |

### Lanes

- `accepted` — a human said yes. The report agent may read, verify, fix, close.
- `verified` — score ≥ 75 with an AI-confirmed bug, or three corroborating reporters.
  Treated like `accepted`.
- `team` — the reporter is a databayt team member (kun contributor session, hogwarts
  DEVELOPER / team account / demo-tenant admin). Never sinks below `needs-human`;
  shown first among the undecided.
- `needs-human` / `low-confidence` — undecided; the score is a hint, Abdout decides.
- `legacy` — bare `report` label from before the scoring pipeline.

### What "reject" means

Closed as _not planned_ with a one-line comment naming the reason. The reporter sees
why. No label games.

## Out-of-band invocations

`report` / "fix reports" / "list the reports" → the `report` skill (list → choose →
apply → fix). `report <repo>#N` skips the list and treats that issue as accepted.
`report --status` renders the table and stops.
