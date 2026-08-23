#!/bin/bash
# SessionStart hook (kun repo) — inject engine status as session context.
# Emits: overdue sync tiers from engine.json + a bridge.md handoff note if fresh.
# stdout on exit 0 becomes additional context for the session.

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ENGINE="$ROOT/.claude/engine.json"
[ -f "$ENGINE" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

NOW=$(date +%s)
OVERDUE=""
for tier in anthropic stack services practice; do
    STAMP=$(jq -r ".sync.\"$tier\" // empty" "$ENGINE")
    CADENCE=$(jq -r ".sync.cadence_days.\"$tier\" // 30" "$ENGINE")
    if [ -z "$STAMP" ]; then
        OVERDUE="$OVERDUE $tier(never)"
    else
        STAMP_EPOCH=$(date -j -f "%Y-%m-%d" "$STAMP" +%s 2>/dev/null || date -d "$STAMP" +%s 2>/dev/null || echo "$NOW")
        AGE=$(( (NOW - STAMP_EPOCH) / 86400 ))
        [ "$AGE" -gt "$CADENCE" ] && OVERDUE="$OVERDUE $tier(${AGE}d)"
    fi
done
[ -n "$OVERDUE" ] && echo "Engine sync overdue:$OVERDUE — consider running /sync for those tiers."

# Bridge handoff (Cowork ↔ Code) — surface only if touched in the last 24h
BRIDGE="$HOME/.claude/bridge.md"
if [ -f "$BRIDGE" ]; then
    MOD=$(stat -f %m "$BRIDGE" 2>/dev/null || stat -c %Y "$BRIDGE" 2>/dev/null || echo 0)
    if [ $(( NOW - MOD )) -lt 86400 ]; then
        echo "bridge.md was updated in the last 24h — check ~/.claude/bridge.md for a Cowork handoff."
    fi
fi
exit 0
