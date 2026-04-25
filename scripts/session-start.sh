#!/usr/bin/env bash
# session-start.sh — Bootstrap a Claude Code session with org context.
# Wired via SessionStart hook in .claude/settings.json (Story 15.4).
#
# Reads stdin JSON from Claude Code, writes hookSpecificOutput JSON to stdout.
# Fully read-only. Never blocks the session — any error is swallowed.

# No set -e here on purpose: this is a best-effort bootstrap.
# Hook timeout (30s) is the only hard ceiling.

CONTEXT_PARTS=()

emit() {
  CONTEXT_PARTS+=("$1")
}

is_positive_int() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
    0) return 1 ;;
    *) return 0 ;;
  esac
}

# 1) Bridge — Cowork ↔ Code handoff -------------------------------------------
{
  if [ -f "${HOME}/.claude/bridge.md" ]; then
    pending=$(grep -c '^- \[ \]' "${HOME}/.claude/bridge.md" 2>/dev/null | head -1 | tr -d '[:space:]')
    if is_positive_int "$pending"; then
      emit "## Bridge ($pending pending)"
      sample=$(grep '^- \[ \]' "${HOME}/.claude/bridge.md" 2>/dev/null | head -5)
      [ -n "$sample" ] && emit "$sample"
    fi
  fi
} 2>/dev/null

# 2) Apple Notes inbox (Mac only, non-blocking) -------------------------------
{
  if [ "$(uname 2>/dev/null)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
    inbox_count=$(osascript -e 'tell application "Notes" to count of notes of folder "Dispatch/Inbox"' 2>/dev/null | head -1 | tr -d '[:space:]')
    if is_positive_int "$inbox_count"; then
      emit "## Dispatch/Inbox: $inbox_count note(s) for captain"
    fi
  fi
} 2>/dev/null

# 3) Open report issues across active databayt repos --------------------------
{
  if command -v gh >/dev/null 2>&1; then
    for repo in databayt/kun databayt/hogwarts; do
      issues=$(gh issue list --repo "$repo" --label report --state open --json number,title 2>/dev/null)
      [ -z "$issues" ] && issues='[]'
      count=$(echo "$issues" | jq 'length' 2>/dev/null | head -1 | tr -d '[:space:]')
      if is_positive_int "$count"; then
        emit "## $repo report issues: $count open"
        list=$(echo "$issues" | jq -r '.[] | "- #\(.number) \(.title)"' 2>/dev/null | head -5)
        [ -n "$list" ] && emit "$list"
      fi
    done

    # 4) Captain-tagged decisions awaiting Abdout
    captain_open=$(gh issue list --repo databayt/kun --label captain --state open --json number,title 2>/dev/null)
    [ -z "$captain_open" ] && captain_open='[]'
    cc=$(echo "$captain_open" | jq 'length' 2>/dev/null | head -1 | tr -d '[:space:]')
    if is_positive_int "$cc"; then
      emit "## Captain decisions pending: $cc"
      list=$(echo "$captain_open" | jq -r '.[] | "- #\(.number) \(.title)"' 2>/dev/null | head -3)
      [ -n "$list" ] && emit "$list"
    fi
  fi
} 2>/dev/null

# 5) Runway snapshot ----------------------------------------------------------
{
  runway_file="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/memory/runway.json"
  if [ -f "$runway_file" ] && command -v jq >/dev/null 2>&1; then
    weeks=$(jq -r '.weeksRemaining // empty' "$runway_file" 2>/dev/null)
    burn=$(jq -r '.burn.monthly // empty' "$runway_file" 2>/dev/null)
    if [ -n "$weeks" ] && [ -n "$burn" ]; then
      emit "## Runway: ${weeks} weeks @ \$${burn}/mo burn"
    fi
  fi
} 2>/dev/null

# 6) Active sprint ------------------------------------------------------------
{
  state_file="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/memory/captain-state.json"
  if [ -f "$state_file" ] && command -v jq >/dev/null 2>&1; then
    sprint=$(jq -r '.sprint.current // empty' "$state_file" 2>/dev/null)
    focus=$(jq -r '.sprint.focus // empty' "$state_file" 2>/dev/null)
    if [ -n "$sprint" ]; then
      emit "## Active sprint: ${sprint} — ${focus}"
    fi
  fi
} 2>/dev/null

# Compose output --------------------------------------------------------------
if [ ${#CONTEXT_PARTS[@]} -eq 0 ]; then
  exit 0
fi

context=$(printf '%s\n' "${CONTEXT_PARTS[@]}")

if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$context" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $ctx
    }
  }'
fi

exit 0
