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
    a = agg.setdefault(e["job"], {"runs": 0, "fail": 0, "tokens": 0, "out": 0, "usd": 0.0, "models": set()})
    a["runs"] += 1; a["fail"] += e.get("status") != "ok"
    a["tokens"] += e.get("tokens") or 0; a["out"] += e.get("output_tokens") or 0
    a["usd"] += e.get("cost_usd") or 0; a["models"].add(f'{e.get("model")}/{e.get("effort")}')
if not agg:
    print(f"no headless claude runs logged in the last {days}d (ledger: {path})"); sys.exit(0)
print(f"headless claude, last {days}d — $ is plan-equivalent value (Max is flat-rate), not a bill")
print(f"{'job':<24}{'runs':>5}{'fail':>5}{'tokens':>12}{'out':>9}{'$':>9}  model/effort")
tot = [0, 0, 0, 0, 0.0]
for j, a in sorted(agg.items(), key=lambda kv: -kv[1]["tokens"]):
    print(f"{j:<24}{a['runs']:>5}{a['fail']:>5}{a['tokens']:>12,}{a['out']:>9,}{a['usd']:>9.2f}  {', '.join(sorted(a['models']))}")
    for i, k in enumerate(["runs", "fail", "tokens", "out", "usd"]): tot[i] += a[k]
print(f"{'TOTAL':<24}{tot[0]:>5}{tot[1]:>5}{tot[2]:>12,}{tot[3]:>9,}{tot[4]:>9.2f}")
PY2
    exit 0
fi
ENGINE="${KUN_DIR:-$HOME/kun}/.claude/engine.json"
LEDGER="${RUNS_LEDGER:-$HOME/.claude/logs/runs.jsonl}"
[ -f "$ENGINE" ] || exit 0
command -v python3 >/dev/null 2>&1 || exit 0

OUT=$(python3 - "$ENGINE" "$LEDGER" "$MODE" <<'PY'
import glob, json, os, subprocess, sys, time
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
            last[e["job"]] = e
            if e.get("status") == "ok":
                last_ok[e["job"]] = e

def age_h(ts):
    return (now - ts) / 3600

rows = []
for name, j in jobs.items():
    label, trigger = j.get("label", ""), j.get("kind") == "trigger"
    # engine.json → jobs is the OWNER machine's schedule. A job is this machine's only
    # if its plist is installed here — so a teammate's Mac, Linux or Windows sees no
    # rows instead of twenty false reds (and a disabled/moved plist reads as retired).
    if not (label and os.path.exists(os.path.expanduser(f"~/Library/LaunchAgents/{label}.plist"))):
        continue
    cad = -1.0 if trigger else float(j.get("cadence_hours", 24))
    state, why, human = "ok", "", False
    info = lc.get(label)
    if label and info is None:
        state, why = "red", "not loaded in launchd"
    elif label and cad == 0:
        if not info["pid"]:
            state, why = "red", f"daemon not running (last exit {info['exit']})"
    elif label and info["exit"] not in ("0", ""):
        state, why = "red", f"last exit {info['exit']}"
    newest = 0
    for g in j.get("logs", []):
        for p in glob.glob(os.path.expanduser(g)):
            try:
                newest = max(newest, os.path.getmtime(p))
            except OSError:
                pass
    seen = f"{age_h(newest):.1f}h ago" if newest else "never"
    if state == "ok" and cad > 0 and j.get("logs"):
        if not newest or age_h(newest) > 2 * cad:
            state, why = "stale", f"no log for {seen} (cadence {cad:g}h)"
    e = last.get(name)
    if e:
        human = bool(e.get("needs_human"))
        try:
            e_age = age_h(time.mktime(time.strptime(e["ts"], "%Y-%m-%dT%H:%M:%SZ")) - time.timezone)
        except Exception:
            e_age = 0
        # A recorded fail counts for max(2x cadence, 24h) — long enough for the daily
        # maintain digest to see it, short enough that a recovered job turns green.
        if state == "ok" and e.get("status") in ("fail", "warn") and e_age <= max(2 * cad, 24):
            state, why = ("red" if e["status"] == "fail" else "warn"), e.get("summary", "") or e["status"]
    rows.append({"job": name, "label": label, "state": state, "why": why,
                 "seen": seen, "needs_human": human, "mac_only": bool(j.get("mac_only", True))})

# Hermes cron (its own scheduler, state in ~/.hermes/cron/jobs.json): red on a last error,
# stale when an enabled job's next run is >2h in the past (the gateway stopped firing).
hpath = os.path.expanduser(json.load(open(engine)).get("jobs", {}).get("$hermes", ""))
if hpath and os.path.exists(hpath):
    try:
        from datetime import datetime, timezone
        for h in json.load(open(hpath)).get("jobs", []):
            if not h.get("enabled"):
                continue
            st, why = "ok", ""
            nxt = h.get("next_run_at")
            late = 0
            if nxt:
                late = (datetime.now(timezone.utc) - datetime.fromisoformat(nxt)).total_seconds() / 3600
            if h.get("last_status") == "error":
                st, why = "red", (h.get("last_error") or "error")[:120]
            elif late > 2:
                st, why = "stale", f"next run was due {late:.0f}h ago — gateway not firing"
            last = h.get("last_run_at")
            seen = "never"
            if last:
                seen = f"{(datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() / 3600:.1f}h ago"
            rows.append({"job": "hermes:" + h.get("name", h.get("id", "?")), "label": "hermes", "state": st,
                         "why": why, "seen": seen, "needs_human": False, "mac_only": True})
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
    for r in sorted(rows, key=lambda r: ("red", "stale", "warn", "ok").index(r["state"])):
        flag = " ⚑ needs Abdout" if r["needs_human"] else ""
        print(f"{r['state']:<6} {r['job']:<{w}}  last log {r['seen']:<12} {r['why']}{flag}")
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
