#!/usr/bin/env bash
# FileChanged hook — invalidate captain cache when coverage or runway changes.
# Story 22.6 in docs/EPICS-V4.md.
#
# Stdin: { "session_id":"...", "file_path":"...", "hook_event_name":"FileChanged" }

trap 'exit 0' ERR

input=$(cat)
file=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null)

# Touch a marker so /captain re-reads runway & inventory next invocation.
mem_dir="${HOME}/.claude/projects/-Users-abdout-kun/memory"
mkdir -p "$mem_dir" 2>/dev/null
touch "${mem_dir}/.captain-cache-invalidated" 2>/dev/null

# Inject a hint into Claude's context so the user/captain knows state changed.
case "$file" in
  *coverage/keywords.json|*memory/runway.json|*memory/captain-state.json)
    jq -n --arg f "$file" '{
      hookSpecificOutput: {
        hookEventName: "FileChanged",
        additionalContext: ("Captain state file changed: " + $f + " — captain cache invalidated.")
      }
    }'
    ;;
esac

exit 0
