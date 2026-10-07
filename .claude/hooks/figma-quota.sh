#!/usr/bin/env bash
# figma-quota.sh — PostToolUse(mcp__figma__.*): count Figma MCP calls against the free plan's cap.
#
# WHY: the Figma MCP free tier allows ~20 calls a month and kept hitting the wall mid-task; Figma
# Weave image/video runs now go through the same MCP. One counter file per month; from the 15th call
# on, Claude is told how many remain so it can fall back (rendered PNGs, Adobe/Canva/Claude Design)
# before the cap bites. Override the cap with FIGMA_MCP_MONTHLY_CAP.
set -uo pipefail
cap="${FIGMA_MCP_MONTHLY_CAP:-20}"
dir="$HOME/.claude/state"; mkdir -p "$dir"
f="$dir/figma-mcp-$(date +%Y-%m).count"
n=$(( $(cat "$f" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$f"
if [ "$n" -ge $(( cap - 5 )) ]; then
  left=$(( cap - n )); [ "$left" -lt 0 ] && left=0
  msg="Figma MCP: call $n of ~$cap this month ($left left on the free plan). Prefer rendered PNGs, Adobe/Canva/Claude Design, or HTML templates for the rest of the month."
  printf '{"systemMessage":%s,"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":%s}}\n' \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$msg")" "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$msg")"
fi
exit 0
