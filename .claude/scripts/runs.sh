#!/bin/bash
# What's red, what's stale, what needs Abdout — across every scheduled job.
#
#   bash ~/.claude/scripts/runs.sh            table of every job in engine.json → jobs
#   bash ~/.claude/scripts/runs.sh --brief    one line, only when something is red/stale (SessionStart)
#   bash ~/.claude/scripts/runs.sh --json     machine form (maintain.sh step_runs)
#   bash ~/.claude/scripts/runs.sh --notify   send the red/stale digest to this machine's ~/.claude/.kun-notify target (hermes send)
#   bash ~/.claude/scripts/runs.sh --spend [days]  headless claude runs per job (kun-claude.sh ledger lines)
#
# Three signals, no edits to the jobs themselves:
#   1. launchd's last exit code (a crash)           → red
#   2. newest log mtime vs 2× the declared cadence  → stale (it stopped running or stopped writing)
#   3. the ledger (~/.claude/logs/runs.jsonl)       → red on a recorded fail, and needs_human
# Hermes cron jobs are read from engine.json → jobs.$hermes (their own scheduler's state file).
# Daemons (cadence_hours 0) are red when launchd shows no PID; trigger jobs (kind trigger) never go stale.
# Policy (labels, cadences, logs) lives in engine.json → jobs; this script holds none.
# Only jobs whose plist is installed on THIS machine are checked (teammates see nothing).

MODE="${1:---table}"
if [ "$MODE" = "--spend" ]; then
    python3 - "${RUNS_LEDGER:-$HOME/.claude/logs/runs.jsonl}" "${2:-7}" <<'PY2'
import json, sys, time, calendar
path, days = sys.argv[1], int(sys.argv[2]); since = time.time() - days * 86400
agg = {}
try:
    lines = open(path).readlines()
except FileNotFoundError:
    lines = []
for line in lines:
    try: e = json.loads(line)
    except Exception: continue
    if e.get("kind") != "claude": continue
    if calendar.timegm(time.strptime(e["ts"], "%Y-%m-%dT%H:%M:%SZ")) < since: continue
    a = agg.setdefault(e["job"], {"runs": 0, "fail": 0, "fresh": 0, "tokens": 0, "out": 0, "usd": 0.0, "models": set()})
    a["runs"] += 1; a["fail"] += e.get("status") != "ok"
    a["tokens"] += e.get("tokens") or 0; a["out"] += e.get("output_tokens") or 0
    # older lines have no split: count their total as fresh (an overestimate, never an under)
    a["fresh"] += e.get("fresh_tokens", e.get("tokens") or 0) or 0
    a["usd"] += e.get("cost_usd") or 0; a["models"].add(f'{e.get("model")}/{e.get("effort")}')
if not agg:
    print(f"no headless claude runs logged in the last {days}d (ledger: {path})"); sys.exit(0)
print(f"headless claude, last {days}d — $ is plan-equivalent value (Max is flat-rate), not a bill")
print("fresh = input + cache writes + output (the real cost of a run); total adds the cheap cache re-reads")
print(f"{'job':<24}{'runs':>5}{'fail':>5}{'fresh':>11}{'total':>12}{'out':>9}{'$':>9}  model/effort")
tot = [0, 0, 0, 0, 0, 0.0]
for j, a in sorted(agg.items(), key=lambda kv: -kv[1]["fresh"]):
    print(f"{j:<24}{a['runs']:>5}{a['fail']:>5}{a['fresh']:>11,}{a['tokens']:>12,}{a['out']:>9,}{a['usd']:>9.2f}  {', '.join(sorted(a['models']))}")
    for i, k in enumerate(["runs", "fail", "fresh", "tokens", "out", "usd"]): tot[i] += a[k]
print(f"{'TOTAL':<24}{tot[0]:>5}{tot[1]:>5}{tot[2]:>11,}{tot[3]:>12,}{tot[4]:>9,}{tot[5]:>9.2f}")
PY2
    exit 0
fi
ENGINE="${KUN_DIR:-$HOME/kun}/.claude/engine.json"
LEDGER="${RUNS_LEDGER:-$HOME/.claude/logs/runs.jsonl}"
[ -f "$ENGINE" ] || exit 0
command -v python3 >/dev/null 2>&1 || exit 0

OUT=$(python3 - "$ENGINE" "$LEDGER" "$MODE" <<'PY'
import calendar, glob, json, os, re, subprocess, sys, time
engine, ledger, mode = sys.argv[1:4]
jobs = json.load(open(engine)).get("jobs", {})
jobs = {k: v for k, v in jobs.items() if not k.startswith("$")}
now = time.time()

lc = {}
try:
    for row in subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=10).stdout.splitlines()[1:]:
        pid, code, label = (row.split("\t") + ["", "", ""])[:3]
        lc[label] = {"pid": pid if pid != "-" else "", "exit": code}
except Exception:
    pass

last, last_ok = {}, {}
if os.path.exists(ledger):
    with open(ledger) as f:
        for line in f.readlines()[-5000:]:
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("kind") == "claude":
                continue
            last[e["job"]] = e
            if e.get("status") == "ok":
                last_ok[e["job"]] = e

def age_h(ts):
    return (now - ts) / 3600

def t(s):
    try:
        return calendar.timegm(time.strptime(s, "%Y-%m-%dT%H:%M:%SZ"))
    except Exception:
        return 0

# Each job's own record (lib/runs.sh runs_record / runs_wrap, mkan's recordRun): the truth when it
# exists. launchd's exit code and log mtimes only judge jobs that don't record yet.
statedir = os.path.expanduser(os.environ.get("RUNS_STATE_DIR", "~/.claude/state/runs"))

def state_of(job):
    try:
        return json.load(open(os.path.join(statedir, re.sub(r"[^A-Za-z0-9._-]", "_", job) + ".json")))
    except Exception:
        return None

def alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except Exception:
        return False

def judge(s, cad):
    """(state, why, needs_human, seen) from a job's own record."""
    status, at = s.get("status"), t(s.get("ts", ""))
    last_good = max(t(s.get("last_ok", "")), t(s.get("last_ok_step", "")) if not status else 0)
    window = max(2 * cad, 24) if cad > 0 else 24
    started = t(s.get("started", ""))
    steps = s.get("steps", {})
    human = bool(s.get("needs_human")) or any(v.get("needs_human") and v.get("status") == "fail" for v in steps.values())
    seen = f"ok {age_h(last_good):.1f}h ago" if last_good else "no ok yet"
    st, why = "ok", ""
    if status == "start":
        if s.get("pid") and not alive(s["pid"]):
            return "red", "the run died without recording an end", human, seen
        why = f"running for {age_h(started):.1f}h"
    elif status == "fail" and age_h(at) <= window:
        st, why = "red", s.get("summary") or "failed"
    elif status == "warn" and age_h(at) <= window:
        st, why = "warn", s.get("summary") or "warning"
    elif status == "defer":
        st, why = "defer", f"deferred {age_h(at):.1f}h ago: {s.get('summary') or 'not ready'}"
    # A step that failed since the run started (or inside the window) is the job's state: seek's
    # ingest succeeding no longer hides its console-push failing.
    since = max(started - 60, now - window * 3600) if started else now - window * 3600
    bad = sorted(((k, v) for k, v in steps.items() if v.get("status") in ("fail", "warn") and t(v.get("ts", "")) >= since),
                 key=lambda kv: kv[1].get("status") != "fail")
    if bad and st in ("ok", "defer", "warn"):
        k, v = bad[0]
        if not (st == "warn" and v.get("status") == "warn"):
            st, why = ("red" if v["status"] == "fail" else "warn"), f"{k}: {v.get('summary') or v['status']}"
    if cad > 0 and st in ("ok", "defer") and status != "start" and (not last_good or age_h(last_good) > 2 * cad):
        st, why = "stale", (why + " · " if why else "") + f"no ok for {age_h(last_good):.0f}h (cadence {cad:g}h)" if last_good else (why or "no ok recorded yet")
    return st, why, human, seen

rows = []
for name, j in jobs.items():
    if name.startswith("hermes:"):
        continue  # judged with Hermes' own state below
    label, trigger = j.get("label", ""), j.get("kind") == "trigger"
    # engine.json → jobs is the OWNER machine's schedule. A job is this machine's only
    # if its plist is installed here — so a teammate's Mac, Linux or Windows sees no
    # rows instead of twenty false reds (and a disabled/moved plist reads as retired).
    if not (label and os.path.exists(os.path.expanduser(f"~/Library/LaunchAgents/{label}.plist"))):
        continue
    cad = -1.0 if trigger else float(j.get("cadence_hours", 24))
    state, why, human = "ok", "", False
    info = lc.get(label)
    s = state_of(name)
    if label and info is None:
        state, why = "red", "not loaded in launchd"
    elif label and cad == 0:
        if not info["pid"]:
            state, why = "red", f"daemon not running (last exit {info['exit']})"
    elif s and (s.get("status") or s.get("steps")):
        state, why, human, seen = judge(s, cad)
    elif label and info["exit"] not in ("0", ""):
        state, why = "red", f"last exit {info['exit']}"
    if not (s and (s.get("status") or s.get("steps"))) or cad == 0 or info is None:
        newest = 0
        for g in j.get("logs", []):
            for p in glob.glob(os.path.expanduser(g)):
                try:
                    newest = max(newest, os.path.getmtime(p))
                except OSError:
                    pass
        seen = f"log {age_h(newest):.1f}h ago" if newest else "no log"
        if state == "ok" and cad > 0 and j.get("logs"):
            if not newest or age_h(newest) > 2 * cad:
                state, why = "stale", f"no log for {age_h(newest):.1f}h (cadence {cad:g}h)" if newest else "no log yet"
        e = last.get(name)
        if e:
            human = human or bool(e.get("needs_human"))
            e_age = age_h(t(e.get("ts", "")))
            # A recorded fail counts for max(2x cadence, 24h) — long enough for the daily
            # maintain digest to see it, short enough that a recovered job turns green.
            if state == "ok" and e.get("status") in ("fail", "warn") and e_age <= max(2 * cad, 24):
                state, why = ("red" if e["status"] == "fail" else "warn"), e.get("summary", "") or e["status"]
    rows.append({"job": name, "label": label, "state": state, "why": why,
                 "seen": seen, "needs_human": human, "mac_only": bool(j.get("mac_only", True))})

# Hermes cron (its own scheduler, state in ~/.hermes/cron/jobs.json). A job that records its own
# runs (mkan's detached lanes: Hermes says "ok" the moment they start) is judged by that record;
# the rest: red on a last error, warn when the run was ok but its output never reached Slack,
# stale when an enabled job's next run is >2h in the past (the gateway stopped firing).
hpath = os.path.expanduser(json.load(open(engine)).get("jobs", {}).get("$hermes", ""))
if hpath and os.path.exists(hpath):
    try:
        from datetime import datetime, timezone
        for h in json.load(open(hpath)).get("jobs", []):
            if not h.get("enabled"):
                continue
            key = "hermes:" + h.get("name", h.get("id", "?"))
            cad = float((jobs.get(key) or {}).get("cadence_hours", 24))
            st, why, human = "ok", "", False
            nxt = h.get("next_run_at")
            late = 0
            if nxt:
                late = (datetime.now(timezone.utc) - datetime.fromisoformat(nxt)).total_seconds() / 3600
            last_run = h.get("last_run_at")
            seen = "never"
            if last_run:
                seen = f"run {(datetime.now(timezone.utc) - datetime.fromisoformat(last_run)).total_seconds() / 3600:.1f}h ago"
            s = state_of(key)
            if s and (s.get("status") or s.get("steps")):
                st, why, human, seen = judge(s, cad)
                # The script ran fine but Hermes could not deliver its output (Slack unreachable).
                lr = datetime.fromisoformat(last_run).timestamp() if last_run else 0
                if st == "ok" and h.get("last_delivery_error") and lr >= t(s.get("last_ok", "")) - 300:
                    st, why = "warn", f"ran, but not delivered: {str(h.get('last_delivery_error'))[:100]}"
            elif h.get("last_status") == "error":
                st, why = "red", (h.get("last_error") or "error")[:120]
            elif h.get("last_delivery_error"):
                st, why = "warn", f"ran, but not delivered: {str(h.get('last_delivery_error'))[:100]}"
            if st in ("ok", "warn", "defer") and late > 2:
                st, why = "stale", f"next run was due {late:.0f}h ago — gateway not firing"
            rows.append({"job": key, "label": "hermes", "state": st,
                         "why": why, "seen": seen, "needs_human": human, "mac_only": True})
    except Exception as ex:
        rows.append({"job": "hermes", "label": "hermes", "state": "warn", "why": f"jobs.json unreadable: {ex}",
                     "seen": "?", "needs_human": False, "mac_only": True})

bad = [r for r in rows if r["state"] in ("red", "stale")]
if mode == "--json":
    print(json.dumps({"red": [r["job"] for r in rows if r["state"] == "red"],
                      "stale": [r["job"] for r in rows if r["state"] == "stale"],
                      "needs_human": [r["job"] for r in rows if r["needs_human"]],
                      "rows": rows}))
elif mode == "--brief":
    if bad:
        print("Jobs needing attention: " + "; ".join(f"{r['job']} {r['state']} ({r['why']})" for r in bad)
              + " — detail: bash ~/.claude/scripts/runs.sh")
elif mode == "--notify":
    if bad:
        print("Kun jobs — " + str(len(bad)) + " need attention\n" +
              "\n".join(f"• {r['job']}: {r['state']} — {r['why']}" for r in bad))
else:
    w = max(len(r["job"]) for r in rows) if rows else 4
    for r in sorted(rows, key=lambda r: ("red", "stale", "warn", "defer", "ok").index(r["state"])):
        flag = " ⚑ needs Abdout" if r["needs_human"] else ""
        print(f"{r['state']:<6} {r['job']:<{w}}  {r['seen']:<15} {r['why']}{flag}")
PY
)

if [ "$MODE" = "--notify" ]; then
    [ -n "$OUT" ] || exit 0
    # kun's one sink: this machine's `me` target (~/.claude/.kun-notify) via hermes,
    # a banner when the owner is at the Mac — never fleet config.
    . "$HOME/.claude/scripts/lib/notify.sh" 2>/dev/null || . "${KUN_DIR:-$HOME/kun}/.claude/scripts/lib/notify.sh" 2>/dev/null || kun_notify() { :; }
    kun_notify me "Kun jobs" "$OUT"
    echo "$OUT"
    exit 0
fi
[ -n "$OUT" ] && echo "$OUT"
exit 0
