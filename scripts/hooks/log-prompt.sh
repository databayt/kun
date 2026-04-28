#!/usr/bin/env bash
# UserPromptSubmit hook — log every prompt to JSONL for the learn agent.
# Story 22.2 in docs/EPICS-V4.md.
#
# Stdin: { "session_id":"...", "prompt":"...", "cwd":"...", "hook_event_name":"UserPromptSubmit" }
# Stdout: nothing (hook is observability only)

# Defensive: never block the prompt.
trap 'exit 0' ERR

mem_dir="${HOME}/.claude/projects/-Users-abdout-kun/memory"
mkdir -p "$mem_dir" 2>/dev/null

today=$(date '+%Y-%m-%d')
log="${mem_dir}/prompts-${today}.jsonl"

# Honor cost-watcher throttle (Story 23.4 / 28.5).
throttle="${CLAUDE_PROJECT_DIR:-}/.claude/routines/throttle.json"
if [ -n "$CLAUDE_PROJECT_DIR" ] && [ -f "$throttle" ] && command -v jq >/dev/null 2>&1; then
  if jq -e '.skip_prompt_logging == true' "$throttle" >/dev/null 2>&1; then
    exit 0
  fi
fi

if command -v jq >/dev/null 2>&1; then
  ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  jq -r --arg ts "$ts" '. + {ts: $ts}' < /dev/stdin >> "$log" 2>/dev/null
fi

exit 0
