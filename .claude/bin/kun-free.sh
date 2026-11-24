#!/bin/bash
# kun-free.sh — the `f` lane: Claude Code on Nous Portal's free models, $0.
#
#   f [claude args…]     run Claude Code on the free lane, with kun's config
#   f --setup            create the lane's own config dir (~/.claude-free)
#   f --print-env        show what would be exported (token hidden) and stop
#   f --key              print a fresh Nous key (the apiKeyHelper; never run it into a log)
#
# Why Nous: its inference API speaks the Anthropic Messages format at /v1/messages (probed
# 2026-11-24), so Claude Code talks to it directly — no proxy. Hermes already holds the Nous
# Portal login (~/.hermes/auth.json); its key lives one hour, so the lane never stores it:
# Claude Code's apiKeyHelper asks Hermes's own resolver for a fresh one every 10 minutes.
#
# Models (free-bench 2026-11-24, tool-use bug fix): meituan/longcat-2.5:free passed in 26 s,
# tencent/hy4-flash:free in 28 s, upstage/solar-mini4:free in 50 s, stepfun/step-3.7-flash:free
# timed out. opus + sonnet → longcat, haiku + subagents → hy4-flash. Override with
# KUN_FREE_MODEL / KUN_FREE_SMALL_MODEL.
#
# What to know: Anthropic does not support third-party endpoints — Remote Control, cloud
# sessions and the desktop app do not work here; free models are rate-limited and slower than
# Claude; no prompt-cache discount (it is free anyway). The lane has its own config dir, so it
# never touches the claude.ai login. Installed at ~/.claude/bin/kun-free.sh (and as `f`);
# canonical copy in kun.
set -u

CONFIG="${KUN_FREE_CONFIG:-$HOME/.claude-free}"
HERMES_DIR="${HERMES_HOME:-$HOME/.hermes}/hermes-agent"
SELF="$HOME/.claude/bin/kun-free.sh"
MODEL="${KUN_FREE_MODEL:-meituan/longcat-2.5:free}"
SMALL="${KUN_FREE_SMALL_MODEL:-tencent/hy4-flash:free}"

key() {
    [ -x "$HERMES_DIR/venv/bin/python" ] || { echo "f lane: Hermes is not installed ($HERMES_DIR)" >&2; return 1; }
    (cd /tmp && env -u PYTHONPATH -u PYTHONHOME "$HERMES_DIR/venv/bin/python" -I -c "
import sys; sys.path.insert(0, '$HERMES_DIR')
from hermes_cli.auth import resolve_nous_runtime_credentials as r
sys.stdout.write(r()['api_key'])" 2>/dev/null)
}

setup() {
    mkdir -p "$CONFIG"
    # The engine is shared, not copied: one place to update. settings.json is the lane's own.
    for item in skills agents rules hooks scripts bin memory CLAUDE.md; do
        [ -e "$HOME/.claude/$item" ] && [ ! -e "$CONFIG/$item" ] && ln -s "$HOME/.claude/$item" "$CONFIG/$item"
    done
    if [ ! -f "$CONFIG/settings.json" ]; then
        python3 - "$HOME/.claude/settings.json" "$CONFIG/settings.json" "$SELF" <<'PY'
import json, os, sys
src = json.load(open(sys.argv[1])) if os.path.exists(sys.argv[1]) else {}
# hooks and permission rules travel; the model, plugins and anything account-bound do not
out = {k: src[k] for k in ("hooks", "permissions", "env") if k in src}
out["apiKeyHelper"] = sys.argv[3] + " --key"
json.dump(out, open(sys.argv[2], "w"), indent=2)
PY
        chmod 600 "$CONFIG/settings.json"
    fi
    echo "f lane: config dir $CONFIG is ready."
    if key >/dev/null; then echo "f lane: Nous login OK (through Hermes)."; else
        echo "f lane: Hermes has no Nous login — run: hermes model   (pick Nous Portal, sign in), then: f"
    fi
}

case "${1:-}" in
    --setup) setup; exit 0 ;;
    --key) key; exit $? ;;
esac

[ -f "$CONFIG/settings.json" ] || setup >/dev/null
key >/dev/null || { echo "f lane: no Nous login — run: f --setup" >&2; exit 78; }

export CLAUDE_CONFIG_DIR="$CONFIG"
export ANTHROPIC_BASE_URL="https://inference-api.nousresearch.com"
export CLAUDE_CODE_API_KEY_HELPER_TTL_MS=600000
export ANTHROPIC_MODEL="$MODEL"
export ANTHROPIC_DEFAULT_OPUS_MODEL="$MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$SMALL"
export CLAUDE_CODE_SUBAGENT_MODEL="$SMALL"
export CLAUDE_CODE_AUTO_COMPACT_WINDOW=120000
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX

if [ "${1:-}" = "--print-env" ]; then
    env | grep -E '^(CLAUDE_CONFIG_DIR|ANTHROPIC_|CLAUDE_CODE_(API_KEY_HELPER_TTL_MS|AUTO_COMPACT_WINDOW|SUBAGENT_MODEL)=)' | sort
    echo "apiKeyHelper=$(python3 -c "import json;print(json.load(open('$CONFIG/settings.json')).get('apiKeyHelper'))")"
    exit 0
fi
exec claude "$@"
