#!/bin/bash
# PreToolUse (Agent) — route-guard: the last line of lane enforcement for subagents.
#
#   1. A subagent never runs on Fable. An Agent call that names a fable/mythos model is
#      denied: Fable bills usage credits, and the engine keeps it for the attended main loop.
#   2. A general-purpose call that names no model gets the build lane's model
#      (engine.json → lanes.build, sonnet) instead of inheriting the session's — the
#      second most-used subagent used to ride on whatever the main loop was on.
#
# Agents with their own frontmatter are left alone (compile-lanes.mjs stamps those), and so
# is a call that names a model: the caller asked for it. `fork` always runs on the parent's
# model and cannot be rewritten. KUN_ROUTE_GUARD=0 switches the guard off for one run (the
# dispatch bench's inherit stage must ride the session model).
# Installed at ~/.claude/hooks/route-guard.sh; canonical copy in kun. Always exits 0.

[ "${KUN_ROUTE_GUARD:-1}" = 0 ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)" = "Agent" ] || exit 0

model=$(printf '%s' "$input" | jq -r '.tool_input.model // empty' 2>/dev/null)
type=$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null)

case "$(printf '%s' "$model" | tr '[:upper:]' '[:lower:]')" in
    *fable* | *mythos*)
        jq -cn --arg m "$model" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: ("route-guard: a subagent may not run on " + $m + " — Fable is for the attended main loop only (engine.json → lanes.escalate). Name a lane model instead: haiku for a lookup, sonnet for build work, opus for a judgment.")}}'
        exit 0
        ;;
esac

if [ -z "$model" ] && { [ -z "$type" ] || [ "$type" = "general-purpose" ]; }; then
    engine="${KUN_DIR:-$HOME/kun}/.claude/engine.json"
    fill=$(jq -r '.lanes.build.model // empty' "$engine" 2>/dev/null)
    [ -n "$fill" ] || fill=sonnet
    printf '%s' "$input" | jq -c --arg m "$fill" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: ("route-guard: a general-purpose call with no model runs on the build lane (" + $m + ")"), updatedInput: (.tool_input + {model: $m})}}'
fi
exit 0
