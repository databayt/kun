#!/bin/bash
# SessionStart hook (user-global) — surface maintain-heartbeat staleness.
# Reads ~/.claude/.kun-maintain.json only: no network, no git, <50ms.
# Installed to ~/.claude/hooks/ by setup.sh and wired via $HOME in
# settings.json so it fires in EVERY project, not just inside ~/kun.

STATE="$HOME/.claude/.kun-maintain.json"
[ -f "$STATE" ] || exit 0
command -v python3 >/dev/null 2>&1 || exit 0

python3 - "$STATE" <<'PYEOF' 2>/dev/null
import calendar, json, sys, time

try:
    with open(sys.argv[1]) as f:
        state = json.load(f)
except Exception:
    sys.exit(0)

try:
    ts = time.strptime(state.get("ts", ""), "%Y-%m-%dT%H:%M:%SZ")
    age_h = int((time.time() - calendar.timegm(ts)) / 3600)
except Exception:
    sys.exit(0)

if age_h > 48:
    print(f"kun-maintain heartbeat stale ({age_h}h since last run) — run: bash ~/.claude/scripts/maintain.sh")
if state.get("verdict") == "RED":
    print(f"kun engine health RED since {state.get('ts')} — run: bash ~/.claude/scripts/health.sh")
if state.get("pulled") == "error":
    print("kun-maintain could not pull ~/kun (rebase aborted) — pull manually: git -C ~/kun pull --rebase --autostash")
PYEOF
exit 0
