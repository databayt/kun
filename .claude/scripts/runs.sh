#!/bin/bash
# What's red, what's stale, what needs Abdout — across every scheduled job.
#
#   bash ~/.claude/scripts/runs.sh            table of every job in engine.json → jobs
#   bash ~/.claude/scripts/runs.sh --brief    one line, only when something is red/stale (SessionStart)
#   bash ~/.claude/scripts/runs.sh --json     machine form (maintain.sh step_runs)
#   bash ~/.claude/scripts/runs.sh --notify   send the red/stale digest to Slack DM via `hermes send`
#
# Three signals, no edits to the jobs themselves:
#   1. launchd's last exit code (a crash)           → red
#   2. newest log mtime vs 2× the declared cadence  → stale (it stopped running or stopped writing)
#   3. the ledger (~/.claude/logs/runs.jsonl)       → red on a recorded fail, and needs_human
# Daemons (cadence_hours 0) are red when launchd shows no PID; trigger jobs (kind trigger) never go stale.
# Policy (labels, cadences, logs) lives in engine.json → jobs; this script holds none.

MODE="${1:---table}"
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
    TARGET=$(python3 -c "import json;print(json.load(open('$HOME/kun/.claude/engine.json')).get('jobs',{}).get('\$notify',''))" 2>/dev/null)
    osascript -e "display notification \"$(echo "$OUT" | head -1)\" with title \"Kun jobs\"" 2>/dev/null || true
    [ -n "$TARGET" ] && [ -x "$HOME/.local/bin/hermes" ] \
        && "$HOME/.local/bin/hermes" send --to "$TARGET" --quiet --subject "Kun jobs" "$OUT" >/dev/null 2>&1
    echo "$OUT"
    exit 0
fi
[ -n "$OUT" ] && echo "$OUT"
exit 0
