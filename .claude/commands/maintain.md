# Maintain — Daily Heartbeat

Compose sync-repos + self-update + doctor + notify into one autonomous run. Schedule it daily; forget it.

## Usage
- `/maintain` — run now (default)
- `/maintain install` — create the scheduled task / launchd agent
- `/maintain uninstall` — remove the scheduled task
- `/maintain status` — show next run, last result, log path
- `/maintain dry-run` — print what would happen without doing it

## Argument: $ARGUMENTS

## Instructions

1. Detect OS — Windows uses `~/.claude/scripts/maintain.ps1`, macOS/Linux uses `~/.claude/scripts/maintain.sh`.
2. Translate `$ARGUMENTS` to the appropriate flag form:
   - PowerShell: `-Install`, `-Uninstall`, `-Status`, `-Run`, `-DryRun`
   - Bash: `--install`, `--uninstall`, `--status`, `--run`, `--dry-run`
3. Invoke the script and surface output.
4. For `install`:
   - Warn: requires admin (Windows) or write access to `~/Library/LaunchAgents/` (macOS).
   - Confirms armed for daily 09:00 by default.
5. For `status`:
   - Show next run, last exit, log location.
6. For default `run`:
   - Walks 5-step flow: sync → self-update → doctor → notify → log.
   - Exits with doctor's exit code (0/1/2/3).

## Notification matrix

| `doctor` exit | Toast | Slack | GitHub |
|---|---|---|---|
| 0 (green) | — | — | Weekly (Mondays) |
| 2 (warnings) | ⚠️ | — | — |
| 3 (updates) | 🔄 with action button | — | — |
| 1/4 (errors) | ❌ | Yes (`SLACK_WEBHOOK_URL`) | Same as `/doctor report` |

Silent on green — no notification fatigue.

## Reference

- Spec: https://github.com/databayt/kun/issues/27
- Source: `.claude/scripts/maintain.ps1` (Windows) / `.claude/scripts/maintain.sh` (macOS/Linux)
