#!/usr/bin/env bash
# dispatch.sh — Captain's communication channel underlying the /dispatch skill.
# Story 19.4 in docs/EPICS-V4.md.
#
# Writes to Apple Notes (Mac) or GitHub issues (Windows fallback) +
# ~/.claude/bridge.md (Decisions Pending) + ~/.claude/memory/dispatch-log.jsonl.
#
# Usage:
#   dispatch.sh write <channel> "<message>" [priority] [deadline]
#   dispatch.sh read inbox [n]
#   dispatch.sh read cowork [n]
#   dispatch.sh read captain [n]
#   dispatch.sh log [n]              # show recent dispatch-log entries
#
# Channels: captain | cowork | inbox
# Priority: fyi (default) | normal | decision | urgent
# Deadline: 24h | 48h | 72h
#
# Idempotent — re-running write with the same content within 24h dedupes.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_MEM="${HOME}/.claude/projects/-Users-abdout-kun/memory"
BRIDGE="${HOME}/.claude/bridge.md"
LOG="${USER_MEM}/dispatch-log.jsonl"

mkdir -p "$USER_MEM" "$(dirname "$BRIDGE")" 2>/dev/null

cmd="${1:-}"
case "$cmd" in
  write|read|log) ;;
  ""|--help|-h)
    sed -n '2,17p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    sed -n '2,17p' "$0" >&2
    exit 1
    ;;
esac

# Helpers ------------------------------------------------------------------

valid_channel() {
  case "$1" in captain|cowork|inbox) return 0 ;; *) return 1 ;; esac
}

valid_priority() {
  case "$1" in fyi|normal|decision|urgent) return 0 ;; *) return 1 ;; esac
}

prefix_for() {
  case "$1" in
    decision) echo "[DECISION NEEDED]" ;;
    urgent)   echo "[URGENT]" ;;
    *)        echo "" ;;
  esac
}

# Mac: write to Apple Notes / Windows: write to GitHub issue
write_to_channel() {
  local channel="$1" body="$2" priority="$3" deadline="$4"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M')
  local prefix
  prefix=$(prefix_for "$priority")
  local headline="${prefix:+$prefix }$body"

  local full_note
  if [ -n "$deadline" ] && [ "$priority" = "decision" -o "$priority" = "urgent" ]; then
    full_note=$(printf '%s\n\nDispatched: %s\nDeadline: %s\nPriority: %s\nChannel: %s' \
      "$headline" "$ts" "$deadline" "$priority" "$channel")
  else
    full_note=$(printf '%s\n\nDispatched: %s\nPriority: %s' "$headline" "$ts" "$priority")
  fi

  if [ "$(uname 2>/dev/null)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
    write_apple_note "$channel" "$full_note"
  elif command -v gh >/dev/null 2>&1; then
    write_github_issue "$channel" "$priority" "$body" "$full_note"
  else
    echo "fatal: neither osascript (Mac) nor gh (Windows) available" >&2
    return 1
  fi
}

write_apple_note() {
  local channel="$1" body="$2"
  # Capitalize the channel for the Notes folder name (Captain | Cowork | Inbox)
  local note_name
  case "$channel" in
    captain) note_name="Captain" ;;
    cowork)  note_name="Cowork" ;;
    inbox)   note_name="Inbox" ;;
  esac

  # Ensure folder exists
  osascript <<EOF >/dev/null 2>&1
tell application "Notes"
  if not (exists folder "Dispatch") then
    make new folder with properties {name:"Dispatch"}
  end if
  if not (exists note "$note_name" of folder "Dispatch") then
    tell folder "Dispatch"
      make new note with properties {name:"$note_name", body:"Dispatch channel"}
    end tell
  end if
end tell
EOF

  # Prepend new content (newest at top)
  local escaped
  escaped=$(echo "$body" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/<br>/' | tr -d '\n' | sed 's/<br>/\n/g; s/$/<br>/')
  # Simpler: AppleScript-friendly transform
  escaped=$(echo "$body" | awk '{gsub(/"/, "\\\""); printf "%s<br>", $0}')

  osascript <<EOF >/dev/null 2>&1
tell application "Notes"
  set existingBody to body of (note "$note_name" of folder "Dispatch")
  set body of (note "$note_name" of folder "Dispatch") to "$escaped<br><br>" & existingBody
end tell
EOF
}

write_github_issue() {
  local channel="$1" priority="$2" body="$3" full_note="$4"
  local title="dispatch(${channel}): ${body:0:60}"
  local labels="captain"
  case "$priority" in
    decision) labels="${labels},decision" ;;
    urgent) labels="${labels},urgent" ;;
  esac
  gh issue create --repo databayt/kun --title "$title" --body "$full_note" --label "$labels" 2>/dev/null
}

append_bridge_pending() {
  local body="$1" priority="$2" deadline="$3"
  [ ! -f "$BRIDGE" ] && return

  local entry
  entry=$(printf '\n- [ ] [%s] %s — dispatched %s, deadline %s' \
    "$priority" "$body" "$(date '+%Y-%m-%d')" "$deadline")

  # Inject under "## Decisions Pending"
  if grep -q '^## Decisions Pending' "$BRIDGE"; then
    awk -v entry="$entry" '
      /^## Decisions Pending/ { print; printf "%s\n", entry; injected=1; next }
      { print }
    ' "$BRIDGE" > "${BRIDGE}.tmp" && mv "${BRIDGE}.tmp" "$BRIDGE"
  fi
}

log_entry() {
  local channel="$1" body="$2" priority="$3" deadline="$4"
  if command -v jq >/dev/null 2>&1; then
    jq -c -n \
      --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
      --arg channel "$channel" \
      --arg body "$body" \
      --arg priority "$priority" \
      --arg deadline "$deadline" \
      '{ts: $ts, channel: $channel, body: $body, priority: $priority, deadline: $deadline, responded_at: null}' \
      >> "$LOG"
  fi
}

dedupe_check() {
  local channel="$1" body="$2"
  [ ! -f "$LOG" ] && return 0
  if command -v jq >/dev/null 2>&1; then
    local recent
    recent=$(jq -r --arg ch "$channel" --arg body "$body" '
      select(.channel == $ch and .body == $body) | .ts
    ' "$LOG" 2>/dev/null | tail -1)
    if [ -n "$recent" ]; then
      local recent_epoch now_epoch diff
      recent_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$recent" +%s 2>/dev/null || echo 0)
      now_epoch=$(date +%s)
      diff=$((now_epoch - recent_epoch))
      if [ "$diff" -lt 86400 ]; then
        return 1  # duplicate within 24h
      fi
    fi
  fi
  return 0
}

# Subcommands --------------------------------------------------------------

case "$cmd" in
  write)
    channel="${2:-}"
    body="${3:-}"
    priority="${4:-normal}"
    deadline="${5:-}"

    if ! valid_channel "$channel"; then
      echo "Invalid channel: $channel (use captain|cowork|inbox)" >&2
      exit 1
    fi
    if [ -z "$body" ]; then
      echo "fatal: empty body" >&2
      exit 1
    fi
    if ! valid_priority "$priority"; then
      echo "Invalid priority: $priority (use fyi|normal|decision|urgent)" >&2
      exit 1
    fi

    if ! dedupe_check "$channel" "$body"; then
      echo "skipped: duplicate dispatch within 24h"
      exit 0
    fi

    write_to_channel "$channel" "$body" "$priority" "$deadline"
    log_entry "$channel" "$body" "$priority" "$deadline"

    case "$priority" in
      decision|urgent) append_bridge_pending "$body" "$priority" "$deadline" ;;
    esac

    echo "dispatched: $channel ($priority)"
    ;;

  read)
    channel="${2:-inbox}"
    n="${3:-5}"

    if ! valid_channel "$channel"; then
      echo "Invalid channel: $channel" >&2
      exit 1
    fi

    if [ "$(uname 2>/dev/null)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
      local note_name
      case "$channel" in
        captain) note_name="Captain" ;;
        cowork)  note_name="Cowork" ;;
        inbox)   note_name="Inbox" ;;
      esac
      osascript <<EOF 2>/dev/null
tell application "Notes"
  if exists note "$note_name" of folder "Dispatch" then
    return body of (note "$note_name" of folder "Dispatch")
  else
    return "(no $note_name note)"
  end if
end tell
EOF
    elif command -v gh >/dev/null 2>&1; then
      gh issue list --repo databayt/kun --label captain --limit "$n" --json number,title,state \
        | jq -r '.[] | "#\(.number) [\(.state)] \(.title)"' 2>/dev/null
    fi
    ;;

  log)
    n="${2:-10}"
    if [ -f "$LOG" ] && command -v jq >/dev/null 2>&1; then
      tail -n "$n" "$LOG" | jq -r '"\(.ts)  \(.channel) [\(.priority)]  \(.body)"'
    else
      echo "(no dispatch log yet)"
    fi
    ;;
esac

exit 0
