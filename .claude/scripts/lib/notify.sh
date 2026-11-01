#!/bin/bash
# kun's one sink — every script that needs to reach a person goes through here.
#
#   . "$HOME/.claude/scripts/lib/notify.sh" 2>/dev/null || kun_notify() { :; }
#   kun_notify me "Kun jobs" "domains probe failed"          # this machine's owner
#   kun_notify jobs "Weekly jobs report" "$(cat report.md)"  # a team channel
#
# Channels: `me` → this machine's ~/.claude/.kun-notify (first non-# line; per machine,
# never fleet config). Others → engine.json → notify.<channel> (team Slack channels).
# Transport, first that works: `hermes send` (Slack, no LLM) → desktop banner (macOS)
# → stderr. For `me`, presence wins: at the Mac (~/.claude/.present) → banner only.
# Best effort, always returns 0 — an alert that fails must never fail its caller.
# Node twin: scripts/lib/notify.mjs. Canonical: kun/.claude/scripts/lib/notify.sh.

kun_notify() {
    local channel="${1:-me}" subject="${2:-kun}" text="${3:-}" target="" hermes="$HOME/.local/bin/hermes"
    local engine="${KUN_DIR:-$HOME/kun}/.claude/engine.json"
    [ -n "$text" ] || return 0
    if [ "$channel" = me ]; then
        target=$(grep -v '^[[:space:]]*#' "$HOME/.claude/.kun-notify" 2>/dev/null | head -1 | tr -d '[:space:]')
        if [ -f "$HOME/.claude/.present" ] && [ "$(uname -s)" = Darwin ]; then target=""; fi
    else
        target=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('notify',{}).get(sys.argv[2],''))" "$engine" "$channel" 2>/dev/null)
    fi
    if [ -n "$target" ] && [ -x "$hermes" ]; then
        "$hermes" send --to "$target" --quiet --subject "$subject" "$text" >/dev/null 2>&1 && return 0
    fi
    if [ "$(uname -s)" = Darwin ]; then
        local first; first=$(printf '%s' "$text" | head -1 | cut -c1-180 | tr '"' "'")
        osascript -e "display notification \"$first\" with title \"$subject\"" >/dev/null 2>&1 && return 0
    fi
    printf '[%s] %s\n' "$subject" "$text" >&2
    return 0
}
