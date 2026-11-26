#!/bin/bash
# kun-oc.sh — the `o` lane: opencode on kun's token pool, so a long session survives one
# provider's daily cap.
#
#   o [opencode args…]          interactive opencode; default model omniroute/kun-long
#   o run -m omniroute/kun-code "<task>"   one headless step
#
# Why: opencode's keyless Zen models (DeepSeek Flash Free…) are ONE daily quota, with no rotation.
# OmniRoute (http://127.0.0.1:20128, .claude/scripts/harvest/) serves combos (kun-long, kun-code,
# kun-fast…) with strategy `priority`. When a member is exhausted or returns 429, the next one
# serves, under the same session. Every free provider you connect (Machine → Providers, then
# combos.mjs) adds its quota to every combo.
#
# The pool key stays in the Keychain. opencode.json reads it as {env:OMNIROUTE_API_KEY}, so it
# is never written to a file. Without the key or the gateway, opencode still starts, on Zen.
# Installed at ~/.claude/bin/kun-oc.sh; canonical copy in kun.
set -u

POOL_URL="${KUN_POOL_URL:-http://127.0.0.1:20128}"

if key=$(security find-generic-password -s org.databayt.kun.machine -a OMNIROUTE_API_KEY -w 2>/dev/null) && [ -n "$key" ]; then
    export OMNIROUTE_API_KEY="$key"
    curl -s -m 2 -o /dev/null "$POOL_URL/api/health" \
        || echo "o lane: the pool gateway is down ($POOL_URL) — pick a Zen model with /models, or: .claude/scripts/harvest/omniroute.sh start" >&2
else
    echo "o lane: no OmniRoute key in the Keychain — Machine → Providers. Zen models only." >&2
fi
exec opencode "$@"
