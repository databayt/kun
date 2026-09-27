# Cowork ↔ Claude Code Bridge

Cowork and Claude Code are separate sessions sharing the same `~/.claude/` directory. They do NOT share conversation history. The bridge is a file + GitHub Issues + native push.

## How It Actually Works

| What                                  | Cowork Can Do                  | Code Can Do                                                                                                                |
| ------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Read `~/.claude/bridge.md`            | Yes (filesystem MCP)           | Yes (Read tool)                                                                                                            |
| Write `~/.claude/bridge.md`           | Yes (filesystem MCP)           | Yes (Write tool)                                                                                                           |
| Read `~/.claude/memory/`              | Yes (filesystem MCP)           | Yes (auto-loaded)                                                                                                          |
| GitHub issues                         | Yes (github MCP, but see note) | Yes (gh CLI + github MCP)                                                                                                  |
| `PushNotification` to Abdout's mobile | Yes (native tool)              | Yes (native tool)                                                                                                          |
| Slack messages                        | Yes (slack MCP)                | Yes (slack MCP)                                                                                                            |
| Run bash commands                     | Yes — two shells (see below)   | Yes                                                                                                                        |
| Drive a browser                       | Yes (claude-in-chrome MCP)     | Yes — `claude --chrome` (Claude in Chrome, GA 2026-08-26) or the Playwright / Chrome DevTools MCP servers                  |
| Message another session               | —                              | Yes — `SendMessage` / `ListAgents` (2.1.224+), Code ↔ Code on any of Abdout's machines; bridge.md stays the Cowork handoff |
| Use hooks                             | No                             | Yes                                                                                                                        |
| Use skills (/commands)                | Yes                            | Yes                                                                                                                        |

Three of these rows used to read "No" for Cowork, and "Drive a browser" read "No" for Code until 2026-09-26. They were wrong, and the
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

Separately, the **filesystem MCP** addresses the same Mac files by their _real_
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

- **Built-in push** (on since 2026-09-27: `agentPushNotifEnabled` + `inputNeededNotifEnabled`) → his iPhone when a long task ends or a prompt or question waits. Fires only while Remote Control is connected, and never while `~/.claude/.present` says he is at the Mac. Don't stack extra pushes on top of it.
- **`PushNotification`** tool → an explicit push when something needs him _now_ (a blocker, a decision, a deadline)
- **`SendUserFile`** → a screenshot, PDF, video or report put in front of him on the phone; send the file rather than describing one he can't open from there
- **Artifact** (private claude.ai page) → a report or dashboard he will read on the phone or share; publish it, then give the link
- **GitHub issue** with `from-captain` or `priority/blocking` label, assigned `@abdout` (durable record + mobile-readable via `claude.ai/code`)
- **`bridge.md`** for Cowork ↔ Code handoffs that don't need his attention (in-band)
- **Slack DM via slack MCP** for team-visible async (rarely needed for direct Abdout reach)

## Phone → Mac — pick the lane

| He wants                                    | Lane                                                                                                            | Needs                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| To keep going on work that is already open  | Remote Control: every interactive session registers itself (`remoteControlAtStartup`)                           | Mac awake                              |
| To start new work on the Mac from the phone | **Mac · kun** in the Claude app's Code tab: the `kun-rc` server (`devices.sh`, tmux, auto mode, 3 sessions max) | Mac awake: on power with the lid open  |
| Work that must continue with the Mac off    | A cloud session or project in the Code tab (GitHub repos), or a routine (`/schedule`)                           | GitHub connected                       |
| A GUI-only task in a Mac app                | Dispatch → a Desktop Code session with computer use (Dispatch is closed to new users, so treat it as legacy)    | Desktop app open, computer use enabled |

The Mac is the bottleneck, not the plan: it has 16 GB of RAM and each open session holds about 10 MCP processes. Close sessions when their work is done; the `kun-rc` server keeps the phone's way in. `bash ~/.claude/scripts/devices.sh --status` shows the whole lane.
