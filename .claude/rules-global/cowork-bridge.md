# Cowork ↔ Claude Code Bridge

Cowork and Claude Code are separate sessions sharing the same `~/.claude/` directory. They do NOT share conversation history. The bridge is a file + GitHub Issues + native push.

## How It Actually Works

| What | Cowork Can Do | Code Can Do |
|------|--------------|-------------|
| Read `~/.claude/bridge.md` | Yes (filesystem MCP) | Yes (Read tool) |
| Write `~/.claude/bridge.md` | Yes (filesystem MCP) | Yes (Write tool) |
| Read `~/.claude/memory/` | Yes (filesystem MCP) | Yes (auto-loaded) |
| GitHub issues | Yes (github MCP) | Yes (gh CLI + github MCP) |
| `PushNotification` to Abdout's mobile | Yes (native tool) | Yes (native tool) |
| Slack messages | Yes (slack MCP) | Yes (slack MCP) |
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
2. `gh issue list --repo databayt/kun --state open --label "from-abdout,priority/blocking" --json title,number` — check Abdout's instructions + blockers
3. `gh issue list --repo databayt/kun --state open` — full work queue
4. Proceed with highest priority

### Cowork session
1. Read `~/.claude/bridge.md` via filesystem MCP — check for Code results
2. Check GitHub issues for completed/blocked items (label `from-abdout` or `priority/blocking`)
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

## Reaching Abdout asynchronously

Both Cowork and Code reach Abdout via native primitives — no shell wrapper, no platform-specific dance:

- **`PushNotification`** tool → Anthropic mobile app on his iPhone (instant, attention-grabbing)
- **GitHub issue** with `from-captain` or `priority/blocking` label, assigned `@abdout` (durable record + mobile-readable via `claude.ai/code`)
- **`bridge.md`** for Cowork ↔ Code handoffs that don't need his attention (in-band)
- **Slack DM via slack MCP** for team-visible async (rarely needed for direct Abdout reach)
