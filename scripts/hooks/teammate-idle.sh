#!/usr/bin/env bash
# TeammateIdle hook — when an agent-team teammate goes idle, prevent shutdown
# if the shared task list still has work. Story 22.5 / E24.4 in docs/EPICS-V4.md.
#
# Stdin: { "session_id":"...", "teammate_name":"...", "hook_event_name":"TeammateIdle" }
# Stdout: { "decision": "block", "reason": "..." } to keep teammate alive

trap 'exit 0' ERR

input=$(cat)

# Read shared task list state. If unassigned tasks remain, block idle.
# Anthropic agent teams write task list to ~/.claude/tasks/{team-name}/
team_name=$(echo "$input" | jq -r '.team_name // empty' 2>/dev/null)
if [ -z "$team_name" ]; then
  exit 0
fi

task_dir="${HOME}/.claude/tasks/${team_name}"
[ -d "$task_dir" ] || exit 0

# Count pending unassigned tasks (rough heuristic — schema TBD).
unassigned=$(find "$task_dir" -name '*.json' -exec jq -r 'select(.status == "pending" and (.assigned_to // "") == "") | .id' {} \; 2>/dev/null | wc -l | tr -d ' ')

if [ "$unassigned" -gt 0 ] 2>/dev/null; then
  jq -n --arg n "$unassigned" '{
    decision: "block",
    reason: ("Re-dispatch: " + $n + " unassigned task(s) remain")
  }'
  exit 0
fi

exit 0
