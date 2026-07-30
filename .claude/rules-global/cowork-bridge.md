# Cowork ↔ Claude Code Bridge

Cowork and Claude Code are separate sessions sharing the same `~/.claude/` directory. They do NOT share conversation history. The bridge is a file + GitHub Issues + native push.

## How It Actually Works

| What | Cowork Can Do | Code Can Do |
|------|--------------|-------------|
| Read `~/.claude/bridge.md` | Yes (filesystem MCP) | Yes (Read tool) |
| Write `~/.claude/bridge.md` | Yes (filesystem MCP) | Yes (Write tool) |
| Read `~/.claude/memory/` | Yes (filesystem MCP) | Yes (auto-loaded) |
| GitHub issues | Yes (github MCP, but see note) | Yes (gh CLI + github MCP) |
| `PushNotification` to Abdout's mobile | Yes (native tool) | Yes (native tool) |
| Slack messages | Yes (slack MCP) | Yes (slack MCP) |
| Run bash commands | Yes — two shells (see below) | Yes |
| Drive a browser | Yes (claude-in-chrome MCP) | No |
| Use hooks | No | Yes |
| Use skills (/commands) | Yes | Yes |

Three of these rows used to read "No" for Cowork. They were wrong, and the
wrong version cost real work — Code planned around a Cowork that supposedly
couldn't run a command. Corrected 2026-07-27 from a session that did all three.

### The two shells

Cowork has **two** shells, and they see **different filesystems**:

- **`Bash`** runs in an ephemeral Anthropic cloud container. Use it for clones,
  builds, installs, scratch work. Nothing here touches Abdout's Mac. `gh` is
  **not** installed in it.
- **`device_bash`** runs on Abdout's machine, inside the desktop app's Linux VM,
  with his connected folders mounted. `~/kun` appears there as
  `/sessions/<session-id>/mnt/kun/`. It **cannot delete files** — `rm` returns
  "Operation not permitted". To remove something, `mv` it into a `_to_delete/`
  subfolder under the same mounted folder and tell Abdout to empty it.

A file written by one is invisible to the other. Pick one location per file.

Separately, the **filesystem MCP** addresses the same Mac files by their *real*
macOS paths (`/Users/abdout/kun/...`), not the mounted `/sessions/...` ones.
Three path vocabularies, one machine — read the tool name before you write.

### Known breakage

- **github MCP** returns `Authentication Failed: Requires authentication` on
  write calls (`add_issue_comment`, `create_or_update_file`) while read calls
  succeed. Workaround that works today: drive github.com in the browser via the
  claude-in-chrome MCP — `find` the comment box, `form_input` the body, click
  Submit. Slower, but it posts.
- **git in a mounted folder** prints `unable to unlink '.git/index.lock':
  Operation not permitted` on **every** invocation. It is the sandbox's unlink
  restriction, not a stale lock, and clearing the lock does not stop it. The
  command underneath still succeeds. Ignore it; do not go hunting.

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

Cowork's session runs in Anthropic's cloud; it reaches the Mac through the
desktop app's device bridge, which also proxies the MCP servers configured in
`~/Library/Application Support/Claude/claude_desktop_config.json`:
- **filesystem** — reads/writes ~/.claude/, ~/kun, ~/codebase (real macOS paths)
- **github** — repos, issues, PRs in databayt org (reads fine; writes 401 — see
  Known breakage above)

The bridge only works while the desktop app is open. When it isn't, previously
staged files remain readable but nothing new can be fetched or written back.

## Reaching Abdout asynchronously

Both Cowork and Code reach Abdout via native primitives — no shell wrapper, no platform-specific dance:

- **`PushNotification`** tool → Anthropic mobile app on his iPhone (instant, attention-grabbing)
- **GitHub issue** with `from-captain` or `priority/blocking` label, assigned `@abdout` (durable record + mobile-readable via `claude.ai/code`)
- **`bridge.md`** for Cowork ↔ Code handoffs that don't need his attention (in-band)
- **Slack DM via slack MCP** for team-visible async (rarely needed for direct Abdout reach)
