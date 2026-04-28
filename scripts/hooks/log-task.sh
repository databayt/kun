#!/usr/bin/env bash
# TaskCreated / TaskCompleted hook — audit log for captain review.
# Story 22.4 in docs/EPICS-V4.md.
#
# Stdin: { "session_id":"...", "task":{...}, "hook_event_name":"TaskCreated|TaskCompleted" }

trap 'exit 0' ERR

audit_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/audit"
mkdir -p "$audit_dir" 2>/dev/null

if command -v jq >/dev/null 2>&1; then
  session_id=$(jq -r '.session_id // "unknown"' < /dev/stdin <<< "$(cat)")
fi

# Re-read stdin via tee (we already consumed). Simpler: pass through.
# Strategy: capture stdin once, then derive session_id.
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
log="${audit_dir}/${session_id}.jsonl"

if command -v jq >/dev/null 2>&1; then
  ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  echo "$input" | jq -r --arg ts "$ts" '{ts: $ts} + .' >> "$log" 2>/dev/null
fi

exit 0
