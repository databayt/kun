# Cowork ↔ Claude Code Bridge

Cowork and Claude Code are separate sessions sharing the same `~/.claude/` directory. They do NOT share conversation history. The bridge is a file + GitHub Issues.

## How It Actually Works

| What | Cowork Can Do | Code Can Do |
|------|--------------|-------------|
| Read `~/.claude/bridge.md` | Yes (filesystem MCP) | Yes (Read tool) |
| Write `~/.claude/bridge.md` | Yes (filesystem MCP) | Yes (Write tool) |
| Read `~/.claude/memory/` | Yes (filesystem MCP) | Yes (auto-loaded) |
| GitHub issues | Yes (github MCP) | Yes (gh CLI + github MCP) |
| Apple Notes (dispatch.sh) | No (needs bash) | Yes (osascript) |
| Run bash commands | No | Yes |
| Use hooks | No | Yes |
| Use skills (/commands) | No | Yes |

## The Bridge File

`~/.claude/bridge.md` is the handoff point. Both modes read and write it directly.

### Cowork → Code handoff

1. Cowork plans, researches, decides
2. Cowork writes results to `~/.claude/bridge.md` via filesystem MCP
3. Cowork creates GitHub issues for actionable work
4. Code reads bridge.md at session start → sees plan → executes

### Code → Cowork handoff

1. Code builds, deploys, fixes
2. Code writes results to `~/.claude/bridge.md`
3. Code creates GitHub issues for follow-up
4. Cowork reads bridge.md at session start → sees results → plans next

## Session Start Protocol

### Claude Code session
1. Read `~/.claude/bridge.md` — check for Cowork handoffs
2. `dispatch.sh read inbox` — check Abdout's Apple Notes instructions
3. `gh issue list --repo databayt/kun --state open` — check work queue
4. Proceed with highest priority

### Cowork session
1. Read `~/.claude/bridge.md` via filesystem MCP — check for Code results
2. Check GitHub issues for completed/blocked items
3. Plan next moves, update bridge.md with plan

## What's NOT Shared

- Conversation history (each session is independent)
- Active context (tools loaded, files read)
- Hooks and settings.json automation
- Slash commands (/dev, /build, etc.)

## Desktop MCP Config

Cowork has tool access via `~/Library/Application Support/Claude/claude_desktop_config.json`:
- **filesystem** — reads/writes ~/.claude/, ~/kun, ~/codebase
- **github** — repos, issues, PRs in databayt org

## Apple Notes (Code-Only)

dispatch.sh requires bash/osascript — only works from Claude Code:
- `dispatch.sh captain "update"` — write to Notes for Abdout's iPhone
- `dispatch.sh read inbox` — read Abdout's instructions

Cowork cannot use dispatch.sh. If Cowork needs to reach Abdout asynchronously, write to bridge.md or create a GitHub issue.
