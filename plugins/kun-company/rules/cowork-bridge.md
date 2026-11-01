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

1. Read `~/.claude/bridge.md` (pointers only, under 3 KB) — act on any Cowork → Code line.
2. `gh issue list --repo databayt/kun --state open --label priority/p0 --json title,number` — blockers.
3. `gh issue list --repo databayt/kun --state open` — work the highest priority.

## Handoffs

Cowork → Code: plan (3–7 lines) + issue numbers + _"Code: pick up issue #N — context above."_
Code → Cowork: results + follow-up issue numbers. bridge.md holds one line per open handoff;
details go on the issue (the pre-2026-11-01 history is in `~/.claude/bridge-archive/`).
Async to Abdout: built-in push already covers task-done/input-needed; `PushNotification` only for
blockers; send the file itself with `SendUserFile`; reports → Artifact link.
