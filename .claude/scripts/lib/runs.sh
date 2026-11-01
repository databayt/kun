#!/bin/bash
# The run ledger: one JSON line per job outcome, so failures stop being silent.
# Source it from any loop, then call runs_record:
#
#   . "$HOME/.claude/scripts/lib/runs.sh" 2>/dev/null || runs_record() { :; }
#   runs_record jobs fail "wave exit 1" 1     # job status [summary] [needs_human 0|1]
#
# status: ok | warn | fail. needs_human=1 means only Abdout can unblock it.
# Readers: .claude/scripts/runs.sh (status / brief / digest), maintain.sh step_runs.
# Best effort: a ledger write must never fail the caller.

RUNS_LEDGER="${RUNS_LEDGER:-$HOME/.claude/logs/runs.jsonl}"

runs_record() {
    local r_job="${1:-unknown}" r_state="${2:-ok}" r_sum="${3:-}" r_human="${4:-0}"
    mkdir -p "$(dirname "$RUNS_LEDGER")" 2>/dev/null
    python3 - "$RUNS_LEDGER" "$r_job" "$r_state" "$r_sum" "$r_human" <<'PY' 2>/dev/null || true
import json, sys, time
path, job, status, summary, human = sys.argv[1:6]
line = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "job": job,
        "status": status, "summary": summary[:300], "needs_human": human == "1"}
with open(path, "a") as f:
    f.write(json.dumps(line, ensure_ascii=False) + "\n")
PY
    return 0
}
