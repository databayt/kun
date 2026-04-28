#!/usr/bin/env bash
# PostToolUseFailure hook — log Bash failures for captain end-of-session review.
# Story 22.3 in docs/EPICS-V4.md.
#
# Stdin: { "session_id":"...", "tool_name":"...", "tool_input":{...}, "tool_output":{...}, "hook_event_name":"PostToolUseFailure" }

trap 'exit 0' ERR

mem_dir="${HOME}/.claude/projects/-Users-abdout-kun/memory"
mkdir -p "$mem_dir" 2>/dev/null
log="${mem_dir}/failures.jsonl"

if command -v jq >/dev/null 2>&1; then
  ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  jq -r --arg ts "$ts" '{ts: $ts, tool_name, tool_input, tool_output, session_id}' \
    < /dev/stdin >> "$log" 2>/dev/null
fi

exit 0
