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
# Output contract: text mode (the default) still prints only the result text on stdout;
# a caller that passes --output-format json gets the JSON untouched; stream-json is passed
# through unparsed (logged without tokens). Exit code is claude's own.
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
CAP=$(python3 -c "import json,sys;print(json.load(open('$ENGINE')).get('jobs',{}).get(sys.argv[1],{}).get('claude_runs_per_day',''))" "$JOB" 2>/dev/null)
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

STARTED=$(date +%s)
case "$FORMAT" in
    stream-json)
        "$CLAUDE_BIN" "$@"; RC=$?
        record "$RC" "" "$STARTED"; exit $RC ;;
    json)
        TMP=$(mktemp -t kun-claude.XXXXXX)
        "$CLAUDE_BIN" "$@" > "$TMP"; RC=$?
        cat "$TMP"; record "$RC" "$TMP" "$STARTED"; rm -f "$TMP"; exit $RC ;;
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
        record "$RC" "$TMP" "$STARTED"; rm -f "$TMP"; exit $RC ;;
esac
