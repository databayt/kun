#!/usr/bin/env bash
# claude.sh — Hermes hands a task to Claude Code (Opus 5.5) on this Mac.
#
#   scripts/hermes/claude.sh <kun|mkan> [--file <path>]... <<'TASK'
#   <the task, in Abdout's words>
#   TASK
#   scripts/hermes/claude.sh <kun|mkan> "<the task>"          # same, as one argument
#
# Hermes is the ears: a free Nous model listening on Slack. Claude Code is the hands:
# `claude -p` is Claude Code itself on the Max plan, so nothing borrows the login
# (Anthropic bans subscription logins inside third-party agents). The answer goes
# straight into the Slack thread as the kun bot; the free model never reads it.
#
# Hermes runs this from a Slack message (skill: scripts/hermes/skills/kun/SKILL.md).
# It returns at once: the checks run, then the work detaches and posts "on it" and
# the answer to the thread itself. A later task in the same thread resumes the same
# Claude session, so a thread reads like one conversation.
#
# Guards (the free model may be talked into calling this; none of these trust it):
#   - under the gateway, only the Slack users in KUN_BRIDGE_USERS (default Abdout)
#   - one run at a time, KUN_BRIDGE_DAILY (default 15) runs a day, 30 min wall clock
#   - --permission-mode auto, permission prompts refused, never bypass
#   - every run is logged to ~/.hermes/logs/claude-bridge.log
# Without a gateway session (a terminal), it runs in the foreground and prints the answer.
set -uo pipefail

REPO_NAME="${1:-}"
shift || true
case "$REPO_NAME" in
  kun) REPO=/Users/abdout/kun; OTHER=/Users/abdout/mkan ;;
  mkan) REPO=/Users/abdout/mkan; OTHER=/Users/abdout/kun ;;
  *) echo "usage: claude.sh <kun|mkan> [--file <path>]... [\"<task>\"]  (or the task on stdin)"; exit 2 ;;
esac

FILES=()
WORDS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --file) [ -n "${2:-}" ] && FILES+=("$2"); shift 2 || shift ;;
    --file=*) FILES+=("${1#--file=}"); shift ;;
    *) WORDS+=("$1"); shift ;;
  esac
done

STATE="$HOME/.hermes/state/claude-bridge"
LOG="$HOME/.hermes/logs/claude-bridge.log"
LOCK="$STATE/run.lock"
THREADS="$STATE/threads.json"
ALLOWED="${KUN_BRIDGE_USERS:-U0AQ0GLDY04}"
DAILY="${KUN_BRIDGE_DAILY:-15}"
TIMEOUT_S="${KUN_BRIDGE_TIMEOUT:-1800}"
CLAUDE="${KUN_BRIDGE_CLAUDE:-$HOME/.local/bin/claude}"
# The ledger wrapper logs tokens + cost per run (JSON output passes through untouched).
if [ -z "${KUN_BRIDGE_CLAUDE:-}" ] && [ -x "$HOME/.claude/bin/kun-claude.sh" ]; then
  export KUN_CLAUDE_REAL="$CLAUDE" KUN_JOB=hermes:bridge
  CLAUDE="$HOME/.claude/bin/kun-claude.sh"
fi
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
mkdir -p "$STATE" "$(dirname "$LOG")"

PLATFORM="${HERMES_SESSION_PLATFORM:-}"
CHAT="${HERMES_SESSION_CHAT_ID:-}"
THREAD="${HERMES_SESSION_THREAD_ID:-}"
[ -z "$THREAD" ] && THREAD="${HERMES_SESSION_MESSAGE_ID:-}"
USER_ID="${HERMES_SESSION_USER_ID:-}"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }

ARGS=("$REPO_NAME")
for f in ${FILES[@]+"${FILES[@]}"}; do ARGS+=(--file "$f"); done

# ── the parent: check, then hand over ──────────────────────────────────────────
if [ -z "${KUN_BRIDGE_CHILD:-}" ]; then
  if [ -n "$PLATFORM" ]; then
    [ "$PLATFORM" = "slack" ] || { echo "The Claude Code bridge answers on Slack only."; exit 0; }
    case ",$ALLOWED," in
      *",$USER_ID,"*) ;;
      *) log "REFUSED user=$USER_ID chat=$CHAT"; echo "Only Abdout can start Claude Code from here."; exit 0 ;;
    esac
  fi
  # One run at a time: mkdir is atomic; a lock whose process is gone is stale.
  if ! mkdir "$LOCK" 2>/dev/null; then
    if kill -0 "$(cat "$LOCK/pid" 2>/dev/null)" 2>/dev/null; then
      echo "Claude Code is busy with another task — send this again when that one answers."
      exit 0
    fi
    rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || { echo "Claude Code is busy — try again in a minute."; exit 0; }
  fi
  echo $$ >"$LOCK/pid"
  COUNT_FILE="$STATE/count-$(date +%F)"
  COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)
  if [ "$COUNT" -ge "$DAILY" ]; then
    rm -rf "$LOCK"
    echo "Claude Code has done $COUNT tasks from Slack today (the cap is $DAILY, to protect the Max plan's limits). Try tomorrow or from a terminal session."
    exit 0
  fi
  TASK_FILE="$(mktemp "$STATE/task.XXXXXX")"
  if [ ${#WORDS[@]} -gt 0 ]; then printf '%s\n' "${WORDS[*]}" >"$TASK_FILE"
  elif [ ! -t 0 ]; then cat >"$TASK_FILE"
  fi
  if [ ! -s "$TASK_FILE" ]; then rm -rf "$LOCK" "$TASK_FILE"; echo "No task given — pass it as text or on stdin."; exit 2; fi
  echo $((COUNT + 1)) >"$COUNT_FILE"
  if [ -z "$PLATFORM" ]; then
    KUN_BRIDGE_CHILD=1 KUN_BRIDGE_TASK="$TASK_FILE" "$0" "${ARGS[@]}"
    exit $?
  fi
  KUN_BRIDGE_CHILD=1 KUN_BRIDGE_TASK="$TASK_FILE" nohup "$0" "${ARGS[@]}" >/dev/null 2>&1 &
  echo $! >"$LOCK/pid"
  echo "Started — Claude Code (Opus 5.5) is working in $REPO_NAME; the answer lands in this thread."
  exit 0
fi

# ── the child: do the work ─────────────────────────────────────────────────────
mkdir -p "$LOCK"; echo $$ >"$LOCK/pid"
trap 'rm -rf "$LOCK"; rm -f "${KUN_BRIDGE_TASK:-}"' EXIT
TASK="$(cat "${KUN_BRIDGE_TASK:-/dev/null}")"

TOKEN=""
if [ -n "$PLATFORM" ]; then
  TOKEN="$(security find-generic-password -s cf-mkan-SLACK_BOT_TOKEN -w 2>/dev/null ||
    sed -n 's/^SLACK_BOT_TOKEN=//p' "$HOME/.hermes/.env" 2>/dev/null | head -1)"
  TOKEN="$(printf '%s' "$TOKEN" | tr -d '\r\n')"
fi

# Post to the thread, split under Slack's limit (a terminal run prints instead).
say() {
  [ -z "$PLATFORM" ] && { printf '%s\n' "$1"; return 0; }
  SAY_TEXT="$1" SAY_TOKEN="$TOKEN" SAY_CHAT="$CHAT" SAY_THREAD="$THREAD" /usr/bin/python3 - >>"$LOG" 2>&1 <<'PY'
import json, os, urllib.request
text, token = os.environ["SAY_TEXT"], os.environ["SAY_TOKEN"]
chunks, buf = [], ""
for line in text.splitlines(keepends=True):
    while len(line) > 3500:
        chunks.append(buf + line[:3500]); buf, line = "", line[3500:]
    if len(buf) + len(line) > 3500:
        chunks.append(buf); buf = ""
    buf += line
if buf.strip(): chunks.append(buf)
for c in chunks or ["(empty answer)"]:
    body = {"channel": os.environ["SAY_CHAT"], "text": c, "unfurl_links": False}
    if os.environ.get("SAY_THREAD"): body["thread_ts"] = os.environ["SAY_THREAD"]
    req = urllib.request.Request("https://slack.com/api/chat.postMessage", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"})
    r = json.load(urllib.request.urlopen(req, timeout=20))
    if not r.get("ok"): print("slack post failed:", r.get("error"))
PY
}

# A thread that already has a Claude session continues it.
SESSION=""
if [ -n "$THREAD" ] && [ -f "$THREADS" ]; then
  SESSION="$(KEY="$CHAT:$THREAD" /usr/bin/python3 -c 'import json,os,sys; print(json.load(open(sys.argv[1])).get(os.environ["KEY"],""))' "$THREADS" 2>/dev/null)"
fi

ATTACH=""
for f in ${FILES[@]+"${FILES[@]}"}; do
  [ -f "$f" ] && ATTACH="$ATTACH
- $f"
done

PROMPT="This task comes from Abdout on Slack, relayed by Hermes (the kun Slack gateway). You are running headless: nobody can answer a question mid-run, and anything that would need a permission prompt is refused — choose the safe path and say what you could not do.
Skip the session-start rituals (bridge.md, issue queue, report list) unless the task needs them.
Do the task completely, following this repo's CLAUDE.md (commit straight to main with pathspecs; never force-push; never touch production data unless the task says so).
Your final message is posted to the Slack thread as is: lead with the outcome in one or two plain sentences, then at most 12 short lines of detail, links as plain URLs, no tables, no headings.
${ATTACH:+
Files Abdout attached (read them):$ATTACH
}
The task:
$TASK"

say ":hourglass_flowing_sand: Claude Code (Opus 5.5) is on it in \`$REPO_NAME\`${SESSION:+, continuing this thread}."
log "START repo=$REPO_NAME user=$USER_ID chat=$CHAT thread=$THREAD resume=${SESSION:-no} task=$(printf '%s' "$TASK" | tr '\n' ' ' | cut -c1-160)"

OUT="$(mktemp "$STATE/out.XXXXXX")"
START=$(date +%s)
cd "$REPO" || { say "⚠️ No repo at $REPO."; exit 1; }
printf '%s' "$PROMPT" | /usr/bin/perl -e 'alarm shift; exec @ARGV' "$TIMEOUT_S" \
  "$CLAUDE" -p --model opus --effort high --output-format json \
  --permission-mode auto --permission-prompts none \
  --add-dir "$OTHER" ${SESSION:+--resume "$SESSION"} >"$OUT" 2>>"$LOG"
CODE=$?
SECS=$(( $(date +%s) - START ))

READ="$(/usr/bin/python3 - "$OUT" <<'PY'
import json, sys
raw = open(sys.argv[1]).read().strip()
try:
    d = json.loads(raw.splitlines()[-1])
except Exception:
    print("ERR\t\t" + (raw[-600:] or "no output")); sys.exit()
status = "ERR" if d.get("is_error") else "OK"
print(f"{status}\t{d.get('session_id','')}\t{d.get('result') or d.get('subtype') or ''}")
PY
)"
STATUS="${READ%%$'\t'*}"; REST="${READ#*$'\t'}"
SID="${REST%%$'\t'*}"; ANSWER="${REST#*$'\t'}"
rm -f "$OUT"

if [ -n "$SID" ] && [ -n "$THREAD" ]; then
  KEY="$CHAT:$THREAD" SID="$SID" /usr/bin/python3 - "$THREADS" <<'PY'
import json, os, sys
p = sys.argv[1]
try: m = json.load(open(p))
except Exception: m = {}
m[os.environ["KEY"]] = os.environ["SID"]
json.dump(dict(list(m.items())[-200:]), open(p, "w"))
PY
fi

if [ "$CODE" -eq 142 ] || [ "$CODE" -eq 14 ]; then
  say "⚠️ Claude Code ran out of time ($((TIMEOUT_S / 60)) min) and was stopped. Ask again with a smaller task, or continue in a terminal session."
elif [ "$STATUS" = "OK" ]; then
  say "$ANSWER"
else
  say "⚠️ Claude Code stopped with an error after ${SECS}s: $(printf '%s' "$ANSWER" | cut -c1-500)"
fi
log "END repo=$REPO_NAME status=$STATUS code=$CODE secs=$SECS session=$SID"
exit 0
