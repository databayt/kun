#!/bin/bash
# kun-d.sh — the `d` lane: Claude Code on DeepSeek's Anthropic-compatible endpoint.
#
#   d [claude args…]     run Claude Code on DeepSeek, with kun's config
#   d --setup            create the lane's own config dir (~/.claude-d) and say how to store a key
#   d --print-env        show what would be exported (key masked) and stop
#
# Why it exists: a teammate works on their own lane, with their own key, and never holds
# Abdout's Claude login (Anthropic's consumer terms forbid sharing it). Work that needs
# Claude itself goes through `gabriel queue`.
#
# How the lanes carry over: kun's agents and skills ask for `opus`, `sonnet` or `haiku`. Here
# `opus` is DeepSeek's pro model and the other two are flash, so judge work runs on pro and
# build and mechanical work on flash — the lane table needs no second copy.
#
# What to know before relying on it (DeepSeek's docs, read 2026-11-14):
#   - Anthropic does not support third-party endpoints. Remote Control, cloud sessions, the
#     Slack app and the desktop app do not work on this lane.
#   - cache_control is ignored, so there is no prompt-cache discount. The pro model does not
#     read images (it sees "[Unsupported Image]"); flash does.
#   - The lane has its own config dir, so it never touches a claude.ai login on this machine.
#   - The key: $DEEPSEEK_API_KEY, else the macOS Keychain item `deepseek-api-key`, else
#     ~/.config/kun/deepseek.key (mode 600). It is the teammate's own key and own bill.
# Installed at ~/.claude/bin/kun-d.sh (and as the command `d`); canonical copy in kun.
set -u

CONFIG="${KUN_D_CONFIG:-$HOME/.claude-d}"

key() {
    if [ -n "${DEEPSEEK_API_KEY:-}" ]; then printf '%s' "$DEEPSEEK_API_KEY"; return 0; fi
    if command -v security >/dev/null 2>&1; then
        local k; k=$(security find-generic-password -s deepseek-api-key -w 2>/dev/null) && [ -n "$k" ] && { printf '%s' "$k"; return 0; }
    fi
    [ -r "$HOME/.config/kun/deepseek.key" ] && { tr -d '[:space:]' < "$HOME/.config/kun/deepseek.key"; return 0; }
    return 1
}

setup() {
    mkdir -p "$CONFIG"
    # The engine is shared, not copied: one place to update. settings.json is the lane's own.
    for item in skills agents rules hooks scripts bin memory CLAUDE.md; do
        [ -e "$HOME/.claude/$item" ] && [ ! -e "$CONFIG/$item" ] && ln -s "$HOME/.claude/$item" "$CONFIG/$item"
    done
    if [ ! -f "$CONFIG/settings.json" ] && [ -f "$HOME/.claude/settings.json" ] && command -v python3 >/dev/null 2>&1; then
        python3 - "$HOME/.claude/settings.json" "$CONFIG/settings.json" <<'PY'
import json, sys
src = json.load(open(sys.argv[1]))
# hooks and permission rules travel; the model, plugins and anything account-bound do not
out = {k: src[k] for k in ("hooks", "permissions", "env") if k in src}
json.dump(out, open(sys.argv[2], "w"), indent=2)
PY
        chmod 600 "$CONFIG/settings.json"
    fi
    echo "d lane: config dir $CONFIG is ready."
    if key >/dev/null; then echo "d lane: a DeepSeek key is configured."; else
        echo "d lane: no key yet. Store your own DeepSeek key one of these ways, then run: d"
        echo "  macOS:  security add-generic-password -s deepseek-api-key -a \"\$USER\" -w      (it asks for the key)"
        echo "  other:  mkdir -p ~/.config/kun && (umask 077; cat > ~/.config/kun/deepseek.key)   then paste the key and press ctrl-d"
    fi
}

case "${1:-}" in
    --setup) setup; exit 0 ;;
esac

K=$(key) || { echo "d lane: no DeepSeek key found — run: d --setup" >&2; exit 78; }
[ -d "$CONFIG" ] || setup >/dev/null

export CLAUDE_CONFIG_DIR="$CONFIG"
export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="$K"
export ANTHROPIC_MODEL="deepseek-flash[1m]"
export ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro"
export ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-flash[1m]"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-flash"
export CLAUDE_CODE_SUBAGENT_MODEL="deepseek-flash"
export CLAUDE_CODE_AUTO_COMPACT_WINDOW=786432
unset ANTHROPIC_API_KEY CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX

if [ "${1:-}" = "--print-env" ]; then
    env | grep -E '^(CLAUDE_CONFIG_DIR|ANTHROPIC_|CLAUDE_CODE_SUBAGENT_MODEL|CLAUDE_CODE_AUTO_COMPACT_WINDOW)' | sed -E 's/^(ANTHROPIC_AUTH_TOKEN=).*/\1(set, hidden)/' | sort
    exit 0
fi
exec claude "$@"
