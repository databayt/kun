# Cowork ↔ Claude Code Bridge

Cowork (Claude Desktop, the planning lane) and Claude Code (the build lane) share `~/.claude/`
but not conversation history, loaded tools, hooks or settings.json automation. They hand off
through `~/.claude/bridge.md` + GitHub issues. Cowork's own operating notes (capability table,
its two shells and three path vocabularies, known breakage, desktop MCP config) and the
phone → Mac lanes live in `kun/content/docs/cowork.mdx` — read it before planning Cowork work.

**Don't under-plan Cowork.** It runs bash (a cloud container _and_ Abdout's Mac via
`device_bash`), drives his logged-in Chrome, reads GitHub, pushes to his phone and uses Slack;
it has no hooks, and its GitHub MCP _writes_ fail (it posts via the browser). A table that
said otherwise cost real work until 2026-07-27. Code drives browsers too (Playwright +
DevTools MCP, `claude --chrome`) — Cowork's edge is his own signed-in Chrome.
Code ↔ Code (any of Abdout's machines): `SendMessage` / `ListAgents`; bridge.md stays the
Cowork handoff.

## Session start (Code)

1. Read `~/.claude/bridge.md` — act on any Cowork → Code handoff.
2. `gh issue list --repo databayt/kun --state open --label "from-abdout,priority/blocking" --json title,number` — Abdout's instructions + blockers.
3. `gh issue list --repo databayt/kun --state open` — the full queue. Work the highest priority.

## Handoffs

- **Cowork → Code:** the plan or decision (3–7 lines), the issue numbers, and
  _"Code: pick up issue #N — context above."_ in bridge.md.
- **Code → Cowork:** after building, deploying or fixing, write the results and follow-up
  issue numbers to bridge.md. Work that needs a browser session, a portal or a sign-up in
  Abdout's name goes to Cowork this way.
- Update bridge.md's sections; don't append forever.

## Reaching Abdout asynchronously

- **Built-in push** (`agentPushNotifEnabled` + `inputNeededNotifEnabled`) already reaches his
  iPhone when a long task ends or a question waits — only while Remote Control is connected,
  never while `~/.claude/.present` says he is at the Mac. Don't stack extra pushes on it.
- **`PushNotification`** → only when something needs him _now_ (a blocker, a decision, a deadline).
- **`SendUserFile`** → send the screenshot, PDF, video or report itself; don't describe a file he can't open.
- **Artifact** (private claude.ai page) → a report or dashboard he'll read on the phone or share; publish, then give the link.
- **GitHub issue** labelled `from-captain` or `priority/blocking`, assigned `@abdout` → the durable, mobile-readable record.
- **bridge.md** → Cowork ↔ Code handoffs that don't need him. **Slack DM** (slack MCP) → team-visible async, rarely needed.

## Phone → Mac

Keep going on open work → Remote Control (every interactive session registers). Start new
Mac work from the phone → **Mac · kun** in the Code tab (the `kun-rc` server, 3 sessions max).
Work that must continue with the Mac off → a cloud session or a `/schedule` routine. The Mac
has 16 GB of RAM and each session holds ~10 MCP processes: close sessions when their work is
done. `bash ~/.claude/scripts/devices.sh --status` shows the lane.
