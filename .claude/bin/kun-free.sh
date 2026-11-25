#!/bin/bash
# kun-free.sh — the `f` lane: Claude Code on free models, $0 — through the token pool when it
# is ready, straight to Nous when it is not.
#
#   f [claude args…]     run Claude Code on the free lane, with kun's config
#   f --pool [combo]     force the pool (OmniRoute, combo kun-code unless named: kun-fast, kun-long…)
#   f --direct           force Nous direct, skipping the pool
#   f --setup            create the lane's own config dir (~/.claude-free)
#   f --print-env        show what would be exported (token hidden) and stop
#   f --key              print the key for the current route (the apiKeyHelper; never into a log)
#
# Route (auto): the pool when ~/.claude/state/harvest.json says pool_ready and the gateway is up
# (scripts/harvest/harvest.mjs, every 30 min) — OmniRoute serves combo kun-code and moves to the
# next model when one is exhausted; Nous direct otherwise. KUN_FREE_ROUTE=pool|direct pins it.
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
POOL_URL="${KUN_POOL_URL:-http://127.0.0.1:20128}"
COMBO="${KUN_FREE_COMBO:-kun-code}"
SMALL_COMBO="${KUN_FREE_SMALL_COMBO:-kun-fast}"

pool_ready() {
    python3 -c "import json,sys;d=json.load(open('$HOME/.claude/state/harvest.json'));sys.exit(0 if d.get('pool_ready') and d.get('combos',{}).get('$COMBO',{}).get('ready') else 1)" 2>/dev/null \
        && curl -s -m 2 -o /dev/null "$POOL_URL/api/health"
}
pool_key() { security find-generic-password -s org.databayt.kun.machine -a OMNIROUTE_API_KEY -w 2>/dev/null; }

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
    link_memory
    echo "f lane: config dir $CONFIG is ready (memory shared with ~/.claude)."
    if key >/dev/null; then echo "f lane: Nous login OK (through Hermes)."; else
        echo "f lane: Hermes has no Nous login — run: hermes model   (pick Nous Portal, sign in), then: f"
    fi
}

# Shared intelligence: every project's auto-memory in the free lane IS the primary's (a symlink, so
# one store, never a copy that drifts). Runs on every launch: a new project or a wiped config dir
# re-links itself. A real (non-empty) dir is never deleted — it is moved aside and reported.
link_memory() {
    local src name dst
    for src in "$HOME"/.claude/projects/*/memory; do
        [ -d "$src" ] || continue
        name=$(basename "$(dirname "$src")"); dst="$CONFIG/projects/$name/memory"
        [ -L "$dst" ] && [ "$(readlink "$dst")" = "$src" ] && continue
        mkdir -p "$(dirname "$dst")"
        if [ -L "$dst" ]; then rm "$dst"
        elif [ -d "$dst" ]; then rmdir "$dst" 2>/dev/null || { mv "$dst" "$dst.local-$(date +%s)"; echo "f lane: moved a lane-only memory aside: $dst.local-*" >&2; }
        fi
        ln -s "$src" "$dst"
    done
    # A versioned store: snapshot before the session, so a bad edit by a weak model can be undone
    # (git -C <memory> log / checkout). Local only — the memory is private, never pushed.
    local m="$HOME/.claude/projects/-Users-abdout-kun/memory"
    [ -d "$m/.git" ] && git -C "$m" add -A >/dev/null 2>&1 && \
        git -C "$m" -c user.name=kun -c user.email=noreply@databayt.org commit -qm "snapshot $(date +%F\ %H:%M) before f lane" >/dev/null 2>&1
    return 0
}

# Our own options may come after the alias's --dangerously-skip-permissions: pick them out of
# any position and pass everything else to claude.
MODE=""; PASS=()
while [ $# -gt 0 ]; do
    case "$1" in
        --setup) MODE=setup ;;
        --key) MODE=key ;;
        --print-env) MODE=print-env ;;
        --direct) KUN_FREE_ROUTE=direct ;;
        --pool) KUN_FREE_ROUTE=pool; case "${2:-}" in kun-*) COMBO="$2"; shift ;; esac ;;
        *) PASS+=("$1") ;;
    esac
    shift
done
set -- ${PASS[@]+"${PASS[@]}"}
case "$MODE" in
    setup) setup; exit 0 ;;
    key) if [ "${KUN_FREE_ROUTE:-direct}" = pool ]; then pool_key; else key; fi; exit $? ;;
esac

[ -f "$CONFIG/settings.json" ] || setup >/dev/null
link_memory
ROUTE="${KUN_FREE_ROUTE:-auto}"
if [ "$ROUTE" = auto ]; then if pool_ready; then ROUTE=pool; else ROUTE=direct; fi; fi
export KUN_FREE_ROUTE="$ROUTE"

export CLAUDE_CONFIG_DIR="$CONFIG"
export CLAUDE_CODE_API_KEY_HELPER_TTL_MS=600000
if [ "$ROUTE" = pool ]; then
    pool_key >/dev/null || { echo "f lane: no OmniRoute key — Machine → Providers, or .claude/scripts/harvest/omniroute.sh install" >&2; exit 78; }
    export ANTHROPIC_BASE_URL="$POOL_URL"
    export ANTHROPIC_MODEL="$COMBO"
    export ANTHROPIC_DEFAULT_OPUS_MODEL="$COMBO"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$COMBO"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$SMALL_COMBO"
    export CLAUDE_CODE_SUBAGENT_MODEL="$SMALL_COMBO"
else
    key >/dev/null || { echo "f lane: no Nous login — run: f --setup" >&2; exit 78; }
    export ANTHROPIC_BASE_URL="https://inference-api.nousresearch.com"
    export ANTHROPIC_MODEL="$MODEL"
    export ANTHROPIC_DEFAULT_OPUS_MODEL="$MODEL"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$MODEL"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$SMALL"
    export CLAUDE_CODE_SUBAGENT_MODEL="$SMALL"
fi
export CLAUDE_CODE_AUTO_COMPACT_WINDOW=120000
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX

if [ "$MODE" = print-env ]; then
    env | grep -E '^(KUN_FREE_ROUTE|CLAUDE_CONFIG_DIR|ANTHROPIC_|CLAUDE_CODE_(API_KEY_HELPER_TTL_MS|AUTO_COMPACT_WINDOW|SUBAGENT_MODEL)=)' | sort
    echo "apiKeyHelper=$(python3 -c "import json;print(json.load(open('$CONFIG/settings.json')).get('apiKeyHelper'))")"
    exit 0
fi
exec claude "$@"
