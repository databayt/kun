#!/usr/bin/env bash
# mandate-guard.sh — PreToolUse(Bash): what an unattended run may never do.
#
# Active only when KUN_MANDATE=1 (set by `gabriel run`, so by every queued task). An attended
# session is untouched: there the person at the keyboard is the gate. Under the mandate, a
# Bash command that matches engine.json → mandate.blocked_commands is blocked (exit 2, the
# reason goes back to the model): a production deploy, a publish, a message to a person,
# spend, a delete, a change to engine or billing settings. The run is told to stop and say
# what is needed; the owner does that part himself.
#
# The contract in the prompt asks for the same thing in words. This hook is what makes it
# hold when the words are ignored. Patterns live in engine.json so the owner can tune them;
# with engine.json or python3 missing the guard fails CLOSED for an unattended run.
# Installed at ~/.claude/hooks/mandate-guard.sh; canonical copy in kun.

[ "${KUN_MANDATE:-}" = 1 ] || { cat >/dev/null; exit 0; }   # drain stdin so the caller never sees a broken pipe
json="$(cat)"
engine="${KUN_DIR:-$HOME/kun}/.claude/engine.json"
verdict=$(HOOK_JSON="$json" python3 - "$engine" <<'PY' 2>/dev/null
import json, os, re, sys
try:
    cmd = (json.loads(os.environ.get("HOOK_JSON") or "{}").get("tool_input") or {}).get("command") or ""
except Exception:
    cmd = os.environ.get("HOOK_JSON") or ""
try:
    rules = (json.load(open(sys.argv[1])).get("mandate") or {}).get("blocked_commands") or []
except Exception:
    print("unreadable"); sys.exit(0)
for r in rules:
    try:
        if re.search(r["pattern"], cmd, re.I):
            print("block\t" + r["rule"]); sys.exit(0)
    except re.error:
        continue
print("allow")
PY
)
case "$verdict" in
    allow) exit 0 ;;
    block*)
        rule="${verdict#block	}"
        {
            echo "BLOCKED by the mandate (engine.json → mandate): this run is unattended, and \"$rule\" always waits for the owner."
            echo "Do not look for another way to do it. Finish what is allowed, then stop and say exactly what is needed."
        } >&2
        exit 2
        ;;
    *)
        echo "BLOCKED: the mandate could not be read (engine.json or python3 missing) — an unattended run does not go on without it." >&2
        exit 2
        ;;
esac
