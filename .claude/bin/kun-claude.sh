#!/bin/bash
# kun-claude — the one door for every headless `claude -p` run. Drop-in for `claude`:
#
#   ~/.claude/bin/kun-claude.sh -p "…" --model sonnet --max-turns 20
#   KUN_JOB=seek:tailor ~/.claude/bin/kun-claude.sh -p "…"     # name the job explicitly
#
# What it adds, nothing else changes for the caller:
#   1. a ledger line in ~/.claude/logs/runs.jsonl: job, model, effort, tokens, cost_usd,
#      turns, duration, ok — the only record of what the Max pool spends on loops
#   2. an optional daily cap: engine.json → jobs.<job>.claude_runs_per_day (exit 75 when hit)
#   3. an optional budget: engine.json → jobs.<job>.claude_budget {window_hours, window_usd,
#      week_usd} — the job's own ledger cost (notional USD, tracks model price) in a rolling
#      window and in 7 days; over it → exit 75 and a park file saying until when (2026-11-07)
#   4. the plan's limit: a run that dies on "You've hit your weekly limit · resets 5pm (…)" exits
#      75 (not 1) and parks EVERY headless job until that reset — a loop no longer burns runs on
#      6-second failures. Park files: ~/.claude/state/claude-park/{_plan,<job>}.json {until, reason}
# Output contract: text mode (the default) still prints only the result text on stdout;
# a caller that passes --output-format json gets the JSON untouched; stream-json is passed
# through unparsed (logged without tokens). Exit code is claude's own, except 75 (capped/parked).
# Job name: $KUN_JOB, else derived from the calling script (seek/tailor.ts → seek:tailor).
# Readers: .claude/scripts/runs.sh --spend. Orchestration plan phase 2, 2026-11-01.

CLAUDE_BIN="${KUN_CLAUDE_REAL:-$(command -v claude)}"
LEDGER="${RUNS_LEDGER:-$HOME/.claude/logs/runs.jsonl}"
ENGINE="${KUN_DIR:-$HOME/kun}/.claude/engine.json"
[ -n "$CLAUDE_BIN" ] || { echo "kun-claude: claude not on PATH" >&2; exit 127; }

JOB="${KUN_JOB:-}"; JOB_SOURCE=env
if [ -z "$JOB" ]; then
    JOB_SOURCE=parent
    PARENT=$(ps -o args= -p "$PPID" 2>/dev/null)
    JOB=$(printf '%s' "$PARENT" | grep -oE '[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+\.(ts|mjs|js|sh|py)' | tail -1 \
        | sed -E 's/\.(ts|mjs|js|sh|py)$//; s#/#:#')
    [ -n "$JOB" ] || { JOB="adhoc"; JOB_SOURCE=adhoc; }
fi
# Children see both: KUN_JOB names the run in the ledger; KUN_HEADLESS tells the
# context hooks (SessionStart briefs, reports table, prompt router) to stay silent —
# they fire under `claude -p` too, and a headless run has nobody to read them.
export KUN_JOB="$JOB" KUN_HEADLESS=1

MODEL="default"; EFFORT="default"; FORMAT="text"; prev=""
for a in "$@"; do
    case "$prev" in
        --model) MODEL="$a" ;;
        --effort) EFFORT="$a" ;;
        --output-format) FORMAT="$a" ;;
    esac
    prev="$a"
done
[ "$EFFORT" = "default" ] && [ -n "${CLAUDE_CODE_EFFORT_LEVEL:-}" ] && EFFORT="$CLAUDE_CODE_EFFORT_LEVEL"

# Daily cap (only when engine.json declares one for this job).
# the cap lives on the job's engine.json entry: by run name (seek:tailor) or by its launchd
# job name with ':' → '-' (captain:weekly → jobs.captain-weekly)
CAP=$(python3 -c "import json,sys;j=json.load(open('$ENGINE')).get('jobs',{});e=j.get(sys.argv[1]) or j.get(sys.argv[1].replace(':','-')) or {};print(e.get('claude_runs_per_day',''))" "$JOB" 2>/dev/null)
if [ -n "$CAP" ] && [ -f "$LEDGER" ]; then
    USED=$(python3 - "$LEDGER" "$JOB" <<'PY' 2>/dev/null
import json, sys, time
today = time.strftime("%Y-%m-%d", time.gmtime()); n = 0
for line in open(sys.argv[1]):
    try: e = json.loads(line)
    except Exception: continue
    if e.get("job") == sys.argv[2] and e.get("kind") == "claude" and e.get("ts", "").startswith(today): n += 1
print(n)
PY
)
    if [ "${USED:-0}" -ge "$CAP" ]; then
        echo "kun-claude: $JOB hit its daily cap ($USED/$CAP claude runs) — engine.json jobs.$JOB.claude_runs_per_day" >&2
        exit 75
    fi
fi

# Parked (the plan's limit, for every job) or over this job's budget: exit 75 before a run starts.
PARK_DIR="${KUN_PARK_DIR:-$HOME/.claude/state/claude-park}"
PARKED=$(python3 - "$PARK_DIR" "$JOB" "$ENGINE" "$LEDGER" <<'PY' 2>/dev/null
import json, os, sys, time, datetime
park_dir, job, engine, ledger = sys.argv[1:5]
now = time.time()
def iso(t): return datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
# 1. the plan's own limit, written by the run that hit it
try:
    p = json.load(open(os.path.join(park_dir, "_plan.json")))
    if float(p.get("until", 0)) > now:
        print(f"{iso(float(p['until']))}\tplan limit: {p.get('reason', '')}"); sys.exit(0)
except Exception:
    pass
# 2. this job's budget
try:
    jobs = json.load(open(engine)).get("jobs", {})
    b = (jobs.get(job) or jobs.get(job.replace(":", "-")) or {}).get("claude_budget") or {}
except Exception:
    b = {}
if not b or not os.path.exists(ledger):
    sys.exit(0)
wh = float(b.get("window_hours", 5)); wu = b.get("window_usd"); ku = b.get("week_usd")
# A plan-limit hit in the last 7 days halves the budget: the pool is tighter than it looked.
try:
    hit = float(json.load(open(os.path.join(park_dir, "_plan.json"))).get("at", 0))
except Exception:
    hit = 0
scale = 0.5 if hit and now - hit < 7 * 86400 else 1.0
runs = []
for line in open(ledger):
    try: e = json.loads(line)
    except Exception: continue
    if e.get("job") != job or e.get("kind") != "claude": continue
    try: t = datetime.datetime.strptime(e["ts"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc).timestamp()
    except Exception: continue
    if now - t < 7 * 86400: runs.append((t, float(e.get("cost_usd") or 0)))
def over(limit, span):
    if limit is None: return None
    inside = sorted(r for r in runs if now - r[0] < span)
    total = sum(c for _, c in inside)
    if total < float(limit) * scale: return None
    # Free again once enough of the oldest runs leave the window.
    need = total - float(limit) * scale
    for t, c in inside:
        need -= c
        if need < 0: return t + span
    return now + span
for limit, span, name in ((wu, wh * 3600, f"{wh:g} h"), (ku, 7 * 86400, "7 days")):
    until = over(limit, span)
    if until:
        until = max(until, now + 60)
        reason = f"budget: {job} spent its {name} share (${float(limit) * scale:g}{' — halved after a plan-limit hit' if scale < 1 else ''})"
        os.makedirs(park_dir, exist_ok=True)
        json.dump({"until": until, "reason": reason, "at": now}, open(os.path.join(park_dir, job.replace(":", "-").replace("/", "-") + ".json"), "w"))
        print(f"{iso(until)}\t{reason}"); sys.exit(0)
PY
)
if [ -n "$PARKED" ]; then
    echo "kun-claude: $JOB parked until ${PARKED%%	*} — ${PARKED#*	}" >&2
    exit 75
fi

record() {  # record <exit> <json-file-or-empty> <started-epoch>
    python3 - "$LEDGER" "$JOB" "$MODEL" "$EFFORT" "$1" "$2" "$3" "$JOB_SOURCE" <<'PY' 2>/dev/null || true
import json, os, sys, time
ledger, job, model, effort, rc, jf, started, source = sys.argv[1:9]
r = {}
if jf and os.path.exists(jf):
    try:
        r = json.load(open(jf))
        if isinstance(r, list):  # some versions emit an array of events
            r = next((x for x in reversed(r) if x.get("type") == "result"), {})
    except Exception:
        r = {}
u = r.get("usage") or {}
tokens = sum(int(u.get(k) or 0) for k in ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
ok = rc == "0" and not r.get("is_error")
line = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "kind": "claude", "job": job, "job_source": source,
        "status": "ok" if ok else "fail", "model": model, "effort": effort,
        "tokens": tokens, "output_tokens": int(u.get("output_tokens") or 0),
        # fresh = input + cache writes + output (what a run really costs); cache_read = context
        # re-read every turn (cheap per token). The first Monday routine: 120K fresh, 2.15M cached.
        "fresh_tokens": int(u.get("input_tokens") or 0) + int(u.get("cache_creation_input_tokens") or 0) + int(u.get("output_tokens") or 0),
        "cache_read_tokens": int(u.get("cache_read_input_tokens") or 0),
        "cost_usd": round(float(r.get("total_cost_usd") or 0), 4), "turns": r.get("num_turns"),
        "duration_s": round(time.time() - float(started)), "summary": "" if ok else f"claude exit {rc}",
        "needs_human": False}
os.makedirs(os.path.dirname(ledger), exist_ok=True)
with open(ledger, "a") as f:
    f.write(json.dumps(line) + "\n")
PY
}

# Lean mode (KUN_LEAN=1, or the job matches engine.json jobs.$lean prefixes): no MCP servers, no skill listing. Measured 2026-11-01 on a
# one-word haiku reply: 50.3K → 28.7K tokens (-43%). Only for callers that use neither
# skills/Workflow nor MCP tools. (--bare would cut more but drops OAuth → API billing.)
if [ -z "${KUN_LEAN:-}" ]; then
    KUN_LEAN=$(python3 -c "import json,sys;l=json.load(open('$ENGINE')).get('jobs',{}).get('\$lean',[]);print(1 if any(sys.argv[1].startswith(x) for x in l) else 0)" "$JOB" 2>/dev/null)
fi
if [ "${KUN_LEAN:-0}" = 1 ]; then
    EMPTY_MCP="$HOME/.claude/.kun-empty-mcp.json"
    [ -f "$EMPTY_MCP" ] || echo '{"mcpServers":{}}' > "$EMPTY_MCP"
    set -- "$@" --strict-mcp-config --mcp-config "$EMPTY_MCP" --disable-slash-commands
fi

# The plan's limit ("You've hit your weekly limit · resets 5pm (Africa/Kigali)"): park every headless
# job until the reset and exit 75, so callers give their work back instead of counting a failure.
# Matched only on a run that failed or barely ran — a session's own summary may say "limit".
limit_check() {  # limit_check <rc> <json-file> → prints 75 when the plan's limit stopped the run
    python3 - "$1" "$2" "$PARK_DIR" "$JOB" <<'PY' 2>/dev/null
import json, os, re, sys, time, datetime
rc, jf, park_dir, job = sys.argv[1:5]
raw = open(jf).read() if jf and os.path.exists(jf) else ""
try:
    r = json.loads(raw)
    if isinstance(r, list): r = next((x for x in reversed(r) if x.get("type") == "result"), {})
except Exception:
    r = {}
text = str(r.get("result") or raw)[-2000:]
if not re.search(r"hit your [\w -]{0,30}limit|usage limit reached|limit reached[^\n]{0,40}reset|out of extra usage", text, re.I):
    sys.exit(0)
if not (rc != "0" or r.get("is_error") or (r.get("num_turns") or 0) <= 2):
    sys.exit(0)
now = time.time(); until = now + 3600
m = re.search(r"resets\s+(?:(?P<mon>[A-Z][a-z]{2})\w*\s+(?P<day>\d{1,2}),?\s+(?:at\s+)?)?(?P<h>\d{1,2})(?::(?P<mi>\d{2}))?\s*(?P<ap>am|pm)?\s*(?:\((?P<tz>[A-Za-z_]+/[A-Za-z_]+)\))?", text, re.I)
if m:
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(m["tz"]) if m["tz"] else None
        local = datetime.datetime.now(tz) if tz else datetime.datetime.now().astimezone()
        h = int(m["h"]); mi = int(m["mi"] or 0); ap = (m["ap"] or "").lower()
        if ap == "pm" and h < 12: h += 12
        if ap == "am" and h == 12: h = 0
        if m["mon"]:
            month = datetime.datetime.strptime(m["mon"][:3], "%b").month
            dt = local.replace(month=month, day=int(m["day"]), hour=h, minute=mi, second=0, microsecond=0)
            if dt < local - datetime.timedelta(days=1): dt = dt.replace(year=dt.year + 1)
        else:
            dt = local.replace(hour=h, minute=mi, second=0, microsecond=0)
            if dt <= local: dt += datetime.timedelta(days=1)
        until = dt.timestamp() + 120  # two minutes past the reset
    except Exception:
        pass
os.makedirs(park_dir, exist_ok=True)
reason = re.sub(r"\s+", " ", (m.group(0) if m else text.strip()[:120]))
json.dump({"until": until, "reason": reason, "at": now, "job": job}, open(os.path.join(park_dir, "_plan.json"), "w"))
print(75)
PY
}

STARTED=$(date +%s)
case "$FORMAT" in
    stream-json)
        "$CLAUDE_BIN" "$@"; RC=$?
        record "$RC" "" "$STARTED"; exit $RC ;;
    json)
        TMP=$(mktemp -t kun-claude.XXXXXX)
        "$CLAUDE_BIN" "$@" > "$TMP"; RC=$?
        cat "$TMP"; record "$RC" "$TMP" "$STARTED"
        [ "$(limit_check "$RC" "$TMP")" = 75 ] && { echo "kun-claude: plan limit — every headless job parks until the reset (~/.claude/state/claude-park/_plan.json)" >&2; RC=75; }
        rm -f "$TMP"; exit $RC ;;
    *)
        TMP=$(mktemp -t kun-claude.XXXXXX)
        "$CLAUDE_BIN" "$@" --output-format json > "$TMP"; RC=$?
        # Text-mode contract: print what `claude -p` would have printed — the result text.
        python3 -c "
import json,sys
raw=open(sys.argv[1]).read()
try:
    r=json.loads(raw)
    if isinstance(r,list): r=next((x for x in reversed(r) if x.get('type')=='result'),{})
    sys.stdout.write((r.get('result') or '') + ('\n' if r.get('result') else ''))
except Exception:
    sys.stdout.write(raw)
" "$TMP"
        record "$RC" "$TMP" "$STARTED"
        [ "$(limit_check "$RC" "$TMP")" = 75 ] && { echo "kun-claude: plan limit — every headless job parks until the reset (~/.claude/state/claude-park/_plan.json)" >&2; RC=75; }
        rm -f "$TMP"; exit $RC ;;
esac
