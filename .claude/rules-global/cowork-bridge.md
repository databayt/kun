# Cowork ↔ Claude Code Bridge

Cowork (Claude Desktop, planning) and Claude Code (build) share `~/.claude/` but not history,
tools, hooks or settings. They hand off through `~/.claude/bridge.md` + GitHub issues. Full
operating notes — capability table, shells, known breakage, how to reach Abdout async, phone → Mac
lanes — live in `kun/content/docs/cowork.mdx`; read it before planning Cowork work.

- **Don't under-plan Cowork**: it runs bash on Abdout's Mac (`device_bash`), drives his signed-in
  Chrome, reads GitHub, pushes to his phone; its GitHub MCP writes fail (it posts via browser).
- **Errands in his name** (sign-ups, confirmations, portals, keys) run in Code first via `/behalf`;
  Cowork is the fallback. Code ↔ Code: `SendMessage` / `ListAgents`.

## Session start (Code)

1. Read `~/.claude/bridge.md` — act on any Cowork → Code handoff.
2. `gh issue list --repo databayt/kun --state open --label "from-abdout,priority/blocking" --json title,number`.
3. `gh issue list --repo databayt/kun --state open` — work the highest priority.

## Handoffs

Cowork → Code: plan (3–7 lines) + issue numbers + _"Code: pick up issue #N — context above."_
Code → Cowork: results + follow-up issue numbers. Update bridge.md's sections; don't append forever.
Async to Abdout: built-in push already covers task-done/input-needed; `PushNotification` only for
blockers; send the file itself with `SendUserFile`; reports → Artifact link.
