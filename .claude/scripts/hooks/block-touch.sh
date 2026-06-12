#!/bin/bash
# PostToolUse (Write|Edit) — log files touched this session, per session id.
# Feeds the Stop-time block-guard.sh check (block protocol: code changed in a
# registered block must come with record/docs updates).
# Installed at ~/.claude/hooks/block-touch.sh; canonical copy in kun.

input=$(cat)
proj="${CLAUDE_PROJECT_DIR:-$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)}"
[ -f "$proj/.claude/blocks.json" ] || exit 0

sid=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
fp=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$fp" ] && echo "$fp" >> "/tmp/claude-block-touch-${sid}.log"

# Opportunistic cleanup of stale session logs.
find /tmp -maxdepth 1 -name 'claude-block-touch-*.log' -mtime +2 -delete 2>/dev/null
exit 0
