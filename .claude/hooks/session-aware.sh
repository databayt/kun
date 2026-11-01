#!/bin/bash
# SessionStart — one awareness brief: only what needs attention, silent when green.
# Replaces three briefs (2026-11-01): session-engine-context.sh (sync tiers, jobs,
# bridge), session-maintain-status.sh (heartbeat verdict) and devices.sh --brief
# (disk, memory). They read the same machine three different ways; this reads the
# one snapshot kun's SENSE layer keeps (~/.claude/state/aware.json, refreshed every
# 30 min on the owner Mac, at session start and by the daily heartbeat elsewhere).
# Canonical copy: kun/.claude/hooks/session-aware.sh · installed: ~/.claude/hooks/

[ -n "${KUN_HEADLESS:-}" ] && exit 0   # headless `claude -p` (kun-claude.sh): nobody reads a brief

KUN="${KUN_DIR:-$HOME/kun}"
AWARE="$KUN/.claude/scripts/aware.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$AWARE" ]; then
    node "$AWARE" --brief --project "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null
    exit 0
fi

# No node or no kun checkout: fall back to the three old briefs.
f="${CLAUDE_PROJECT_DIR:-}/.claude/hooks/session-engine-context.sh"
[ -f "$f" ] && bash "$f" </dev/null
[ -f "$HOME/.claude/hooks/session-maintain-status.sh" ] && bash "$HOME/.claude/hooks/session-maintain-status.sh" </dev/null
[ -f "$HOME/.claude/scripts/devices.sh" ] && bash "$HOME/.claude/scripts/devices.sh" --brief
exit 0
