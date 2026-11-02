#!/bin/bash
# job-run.sh <job> -- cmd …   every scheduled launchd job's entry point (2026-11-02).
#
# Waits for a real wake and for what the job needs (never fires into a dark wake), never runs a job
# twice at once, caps the run, and records how it went — lib/runs.sh runs_wrap. Policy comes from
# kun/.claude/engine.json → jobs.<job>: needs, max_wait (minutes to wait for the gate before recording
# `defer`), max_minutes (the run cap). A deferred or held run exits 0; supervise.mjs re-fires what is
# still owed once the Mac is up.
#
#   job-run.sh <job> -- cmd …       run it
#   job-run.sh --wrap-plists [--dry] put every scheduled engine job's plist behind job-run.sh (idempotent;
#                                   an installer that rewrites a plist gets re-wrapped by the supervisor)
set -u
if [ "${1:-}" = "--wrap-plists" ]; then
    exec python3 "${KUN_DIR:-$HOME/kun}/.claude/scripts/wrap-plists.py" "${@:2}"
fi
JOB="${1:?usage: job-run.sh <job> -- cmd …}"
shift
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "job-run.sh: no command for $JOB" >&2; exit 64; }
# Without the library this is a plain run, never a lost one.
. "$HOME/.claude/scripts/lib/runs.sh" 2>/dev/null || exec "$@"
ENGINE="${KUN_DIR:-$HOME/kun}/.claude/engine.json"
POL=$(python3 -c 'import json, sys
j = json.load(open(sys.argv[1])).get("jobs", {}).get(sys.argv[2], {})
print(",".join(j.get("needs", [])) or "-", int(j.get("max_wait", 0)), int(j.get("max_minutes", 0)))' "$ENGINE" "$JOB" 2>/dev/null)
read -r NEEDS WAIT MAX <<EOF
${POL:-- 0 0}
EOF
[ "$NEEDS" = "-" ] && NEEDS=""
runs_wrap "$JOB" --needs "$NEEDS" --wait "${WAIT:-0}" --max "${MAX:-0}" -- "$@"
