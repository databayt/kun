#!/bin/bash
# Every scheduled job records how it really went, starts only in a real wake, and never runs twice.
# Source it from any job (bash 3.2 safe — launchd runs /bin/bash), then:
#
#   . "$HOME/.claude/scripts/lib/runs.sh" 2>/dev/null || runs_record() { :; }
#   runs_record <job> ok|warn|fail|defer|start [summary] [needs_human 0|1] [step]
#   runs_ready  <wait_min> [network|twenty|vault|docker|neon|github|slack …]  # 0 = full wake, online, needs up
#   runs_lock   <job>  /  runs_unlock <job>                                # PID + command-line lock
#   runs_wrap   <job> [--needs a,b] [--wait MIN] [--max MIN] -- cmd …       # lock → ready → start → run → end
#
# <job> is the job's key in kun/.claude/engine.json → jobs (hermes jobs: `hermes:<name>`).
# status: ok | warn | fail | defer (could not run now: dark wake, offline, a dependency down) | start.
# needs_human=1 means only Abdout can unblock it. step: one part of a job (seek's console-push), so
# one step's success never hides another's failure.
#
# Exit codes of a wrapped command: 0 ok · 75 defer (temporary; the supervisor retries) ·
# 77 fail that needs Abdout · anything else fail.
#
# Two records:
#   ~/.claude/state/runs/<job>.json   the job's truth now: status, last ok, the live pid, the last 10
#                                     runs (slept: true when the Mac slept mid-run), per-step results.
#                                     Read by runs.sh (the judge) and supervise.mjs (the one that acts).
#   ~/.claude/logs/runs.jsonl         history: every non-ok (repeats folded for an hour), every
#                                     recovery, at most one ok per job per 20 h — frequent jobs used to
#                                     push weekly ones out of runs.sh's window.
# Why the gate (2026-11-02): with the lid shut the Mac makes ~50 dark wakes a day, 2–30 s each
# without real network; launchd and Hermes fired jobs into them and every one failed.
# Best effort: a record never fails the caller. Test hooks: RUNS_FAKE_SYSTEMSTATE, LANE_ONLINE_URL,
# RUNS_STATE_DIR, RUNS_LOCK_DIR, RUNS_LEDGER, RUNS_READY_POLL, RUNS_MAX_UNIT (seconds per --max unit).

RUNS_LEDGER="${RUNS_LEDGER:-$HOME/.claude/logs/runs.jsonl}"
RUNS_STATE_DIR="${RUNS_STATE_DIR:-$HOME/.claude/state/runs}"
RUNS_LOCK_DIR="${RUNS_LOCK_DIR:-$HOME/.claude/state/locks}"

_runs_safe() { printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_'; }
# _runs_mypid VAR: this shell's own pid, in a subshell too. bash 3.2 has no $BASHPID, $$ there is
# the parent's, and $(…) adds a fork of its own — so sh writes its parent's pid to a file.
_runs_mypid() {
    local f
    f=$(mktemp -t runs-pid.XXXXXX)
    sh -c 'echo $PPID' >"$f"
    eval "$1=\$(cat \"\$f\")"
    rm -f "$f"
}

runs_record() {
    local r_job="${1:-unknown}" r_state="${2:-ok}" r_sum="${3:-}" r_human="${4:-0}" r_step="${5:-}" r_pid="${6:-}" r_slept="${7:-}"
    python3 - "$RUNS_LEDGER" "$RUNS_STATE_DIR" "$r_job" "$r_state" "$r_sum" "$r_human" "$r_step" "$r_pid" "$r_slept" <<'PY' 2>/dev/null || true
import calendar, fcntl, json, os, re, sys, time
ledger, statedir, job, status, summary, human, step, pid, slept = (sys.argv[1:] + [""] * 9)[:9]
now = time.time()
ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
summary = " ".join(summary.split())[:300]
human_b = human == "1"
os.makedirs(statedir, exist_ok=True)
os.makedirs(os.path.dirname(ledger) or ".", exist_ok=True)
path = os.path.join(statedir, re.sub(r"[^A-Za-z0-9._-]", "_", job) + ".json")

def t(s):
    try:
        return calendar.timegm(time.strptime(s, "%Y-%m-%dT%H:%M:%SZ"))
    except Exception:
        return 0

with open(path + ".lock", "a") as lk:
    fcntl.flock(lk, fcntl.LOCK_EX)
    try:
        st = json.load(open(path))
    except Exception:
        st = {}
    st["job"] = job
    if step:
        steps = st.setdefault("steps", {})
        steps[step] = {"status": status, "ts": ts, "summary": summary, "needs_human": human_b}
        for k in [k for k, v in steps.items() if t(v.get("ts", "")) < now - 48 * 3600]:
            del steps[k]
        if status == "ok":
            st["last_ok_step"] = ts
    elif status == "start":
        st.update(status="start", ts=ts, started=ts, summary="", needs_human=False,
                  pid=int(pid) if pid.isdigit() else None)
        st["runs"] = (st.get("runs", []) + [{"started": ts}])[-10:]
    else:
        st.update(status=status, ts=ts, summary=summary, needs_human=human_b, pid=None)
        if status in ("ok", "warn"):
            st["last_ok"] = ts
        elif status == "fail":
            st["last_fail"] = ts
        runs = st.get("runs", [])
        if status == "defer":
            runs.append({"deferred": ts, "why": summary[:120]})
        elif runs and "started" in runs[-1] and "ended" not in runs[-1]:
            runs[-1].update(ended=ts, status=status)
            if slept == "slept":
                runs[-1]["slept"] = True
        else:
            runs.append({"ended": ts, "status": status})
        st["runs"] = runs[-10:]
    # The ledger is history, not state: non-ok lines (the same one folded for an hour), recoveries,
    # one ok per job (or step) per 20 h. Starts and defers live only in the state file.
    key = step or ""
    led = st.setdefault("ledger", {})
    last = led.get(key, {})
    write = False
    if status in ("fail", "warn"):
        write = not (last.get("status") == status and last.get("summary") == summary and now - last.get("at", 0) < 3600)
    elif status == "ok":
        write = last.get("status") in ("fail", "warn") or now - last.get("ok_at", 0) > 20 * 3600
    if write:
        rec = {"ts": ts, "job": job, "status": status, "summary": summary, "needs_human": human_b}
        if step:
            rec["step"] = step
        with open(ledger, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        led[key] = {"status": status, "summary": summary, "at": now, "ok_at": now if status == "ok" else last.get("ok_at", 0)}
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(st, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
PY
    return 0
}

# ── the gate ─────────────────────────────────────────────────────────────────
# A full wake has the Graphics capability; a dark wake (lid shut, maintenance) does not. A sleeping
# display keeps it. Not a Mac (no pmset): always awake.
_runs_awake() {
    local s="${RUNS_FAKE_SYSTEMSTATE:-}"
    [ -n "$s" ] || s=$(pmset -g systemstate 2>/dev/null) || return 0
    [ -n "$s" ] || return 0
    case "$s" in *Graphics*) return 0 ;; esac
    return 1
}
_runs_up() {
    case "$1" in
        network) /usr/bin/curl -s -o /dev/null --max-time 10 "${LANE_ONLINE_URL:-https://www.cloudflare.com/cdn-cgi/trace}" ;;
        twenty) [ "$(/usr/bin/curl -s -o /dev/null -w '%{http_code}' --max-time 8 "${RUNS_TWENTY_URL:-http://localhost:3100}/healthz")" = 200 ] ;;
        vault) /usr/bin/curl -s -o /dev/null --max-time 5 "${RUNS_VAULT_URL:-http://127.0.0.1:9222}/json/version" ;;
        docker) PATH="/opt/homebrew/bin:$PATH" colima status >/dev/null 2>&1 ;;
        neon) /usr/bin/curl -s -o /dev/null --max-time 10 "https://${RUNS_NEON_HOST:-console.neon.tech}" ;;
        github) /usr/bin/curl -s -o /dev/null --max-time 10 https://api.github.com ;;
        slack) /usr/bin/curl -s -o /dev/null --max-time 10 https://slack.com/api/api.test ;;
        *) return 0 ;;
    esac
}
# Why the gate is shut, in a few words (the defer record's summary).
runs_not_ready() {
    _runs_awake || { echo "dark wake (lid shut)"; return; }
    _runs_up network || { echo "offline"; return; }
    local n
    for n in "$@"; do _runs_up "$n" || { echo "$n down"; return; }; done
    echo "ready"
}
# Wait (wall clock: sleep does not stop the deadline) until a full wake, the network and every need.
runs_ready() {
    local wait_min="${1:-0}" n ok deadline
    shift
    deadline=$(( $(date +%s) + wait_min * 60 ))
    while :; do
        ok=1
        if _runs_awake && _runs_up network; then
            for n in "$@"; do _runs_up "$n" || { ok=0; break; }; done
        else
            ok=0
        fi
        [ "$ok" = 1 ] && return 0
        [ "$(date +%s)" -ge "$deadline" ] && return 1
        sleep "${RUNS_READY_POLL:-30}"
    done
}

# ── the lock ─────────────────────────────────────────────────────────────────
# Held while its owner lives (a run paused by sleep keeps it, however old); a dead owner or a reused
# PID (different command line) frees it. No age rule: the age rule stole locks from sleeping runs.
runs_lock() {
    local d opid ocmd me
    d="$RUNS_LOCK_DIR/$(_runs_safe "$1").lock"
    mkdir -p "$RUNS_LOCK_DIR" 2>/dev/null
    if ! mkdir "$d" 2>/dev/null; then
        opid=$(cat "$d/pid" 2>/dev/null)
        ocmd=$(cat "$d/cmd" 2>/dev/null)
        if [ -n "$opid" ] && [ "$(ps -ww -p "$opid" -o command= 2>/dev/null)" = "$ocmd" ]; then
            return 1
        fi
        # No pid yet: the owner is between mkdir and writing it — a minute's grace.
        if [ -z "$opid" ] && [ -z "$(find "$d" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
            return 1
        fi
        rm -rf "$d"
        mkdir "$d" 2>/dev/null || return 1
    fi
    _runs_mypid me
    echo "$me" >"$d/pid"
    ps -ww -p "$me" -o command= >"$d/cmd" 2>/dev/null
    return 0
}
runs_unlock() {
    local d me
    d="$RUNS_LOCK_DIR/$(_runs_safe "$1").lock"
    _runs_mypid me
    [ "$(cat "$d/pid" 2>/dev/null)" = "$me" ] && rm -rf "$d"
    return 0
}
# The pid holding a job's lock, if that run is alive (the supervisor's "is it live?").
runs_live_pid() {
    local d opid
    d="$RUNS_LOCK_DIR/$(_runs_safe "$1").lock"
    opid=$(cat "$d/pid" 2>/dev/null)
    [ -n "$opid" ] && [ "$(ps -ww -p "$opid" -o command= 2>/dev/null)" = "$(cat "$d/cmd" 2>/dev/null)" ] && echo "$opid"
}

_runs_waketime() { sysctl -n kern.waketime 2>/dev/null | sed -n 's/^{ sec = \([0-9]*\),.*/\1/p'; }

# ── the wrapper ──────────────────────────────────────────────────────────────
# lock (a live run → leave quietly) → ready (wait up to --wait min; else record defer, exit 0) →
# start → the command (capped at --max min, its whole process group) → ok/warn/fail/defer.
# It never retries: the supervisor alone decides what runs again.
runs_wrap() {
    local job="$1" needs="" wait=0 max=0 started errf pid wd rc st sum human=0 slept="" wake me
    shift
    while [ $# -gt 0 ]; do
        case "$1" in
            --needs) needs="$2"; shift 2 ;;
            --wait) wait="$2"; shift 2 ;;
            --max) max="$2"; shift 2 ;;
            --) shift; break ;;
            *) break ;;
        esac
    done
    runs_lock "$job" || return 0
    # shellcheck disable=SC2086
    if ! runs_ready "$wait" ${needs//,/ }; then
        runs_record "$job" defer "$(runs_not_ready ${needs//,/ })"
        runs_unlock "$job"
        return 0
    fi
    started=$(date +%s)
    errf=$(mktemp -t runs-err.XXXXXX)
    _runs_mypid me
    runs_record "$job" start "" 0 "" "$me"
    export RUNS_JOB="$job"
    set -m
    "$@" 2> >(tee "$errf" >&2) &
    pid=$!
    wd=""
    if [ "${max:-0}" -gt 0 ] 2>/dev/null; then
        ( sleep $((max * ${RUNS_MAX_UNIT:-60})); kill -TERM -- "-$pid" 2>/dev/null && echo "stopped after $max min" >>"$errf" ) &
        wd=$!
        disown "$wd" 2>/dev/null  # stopping it later is not news for the log
    fi
    wait "$pid"
    rc=$?
    [ -n "$wd" ] && kill -- "-$wd" 2>/dev/null
    set +m
    wake=$(_runs_waketime)
    [ -n "$wake" ] && [ "$wake" -gt "$started" ] && slept=slept
    sum=$(grep -v '^[[:space:]]*$' "$errf" 2>/dev/null | tail -n 1 | cut -c1-200)
    case "$rc" in
        0) st=ok; sum="" ;;
        75) st=defer; [ -n "$sum" ] || sum="not now (exit 75)" ;;
        77) st=fail; human=1; [ -n "$sum" ] || sum="needs Abdout (exit 77) — see the job's log" ;;
        *) st=fail; [ -n "$sum" ] || sum="exit $rc" ;;
    esac
    runs_record "$job" "$st" "$sum" "$human" "" "" "$slept"
    rm -f "$errf"
    runs_unlock "$job"
    case "$rc" in 0 | 75) return 0 ;; *) return "$rc" ;; esac
}
