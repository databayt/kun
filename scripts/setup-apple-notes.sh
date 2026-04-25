#!/usr/bin/env bash
# setup-apple-notes.sh — Create the "Dispatch" folder + 3 notes in Apple Notes.
# Story 19.2 in docs/EPICS-V4.md. Also creates ~/.claude/bridge.md per Story 19.3.
#
# Mac-only. Windows users: see scripts/setup-windows.ps1 (GitHub-issue fallback).
#
# Idempotent — re-running detects existing folder/notes and only fills gaps.
#
# Usage: bash scripts/setup-apple-notes.sh

set -uo pipefail

# Mac check ---------------------------------------------------------------
if [ "$(uname)" != "Darwin" ]; then
  echo "This script is Mac-only. For Windows, run: powershell scripts/setup-windows.ps1" >&2
  exit 1
fi

if ! command -v osascript >/dev/null 2>&1; then
  echo "fatal: osascript not found (Mac without AppleScript?)" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${REPO_ROOT}/.claude/memory/bridge.template.md"
BRIDGE="${HOME}/.claude/bridge.md"

echo "Setting up Apple Notes Dispatch channels for captain..."
echo

# 1) Folder ---------------------------------------------------------------
folder_exists=$(osascript <<'EOF' 2>/dev/null
tell application "Notes"
  if exists folder "Dispatch" then
    return "yes"
  else
    return "no"
  end if
end tell
EOF
)

if [ "$folder_exists" = "yes" ]; then
  echo "✓ Folder 'Dispatch' already exists"
else
  osascript <<'EOF' >/dev/null 2>&1
tell application "Notes"
  make new folder with properties {name:"Dispatch"}
end tell
EOF
  echo "✓ Created folder 'Dispatch'"
fi

# 2) Three notes ----------------------------------------------------------
create_note_if_missing() {
  local title="$1"
  local body="$2"

  local exists
  exists=$(osascript <<EOF 2>/dev/null
tell application "Notes"
  set foundCount to count of (notes of folder "Dispatch" whose name is "$title")
  if foundCount > 0 then
    return "yes"
  else
    return "no"
  end if
end tell
EOF
  )

  if [ "$exists" = "yes" ]; then
    echo "✓ Note 'Dispatch/$title' already exists"
  else
    osascript <<EOF >/dev/null 2>&1
tell application "Notes"
  tell folder "Dispatch"
    make new note with properties {name:"$title", body:"$body"}
  end tell
end tell
EOF
    echo "✓ Created note 'Dispatch/$title'"
  fi
}

create_note_if_missing "Captain" \
  "Captain → Abdout updates, decisions, summaries.<br><br>Newest at top. Captain prepends entries here."

create_note_if_missing "Cowork" \
  "Cowork ↔ Code bridge. Samia/Cowork writes plans here for Code to pick up. Code writes results back.<br><br>Mirrored at ~/.claude/bridge.md."

create_note_if_missing "Inbox" \
  "Abdout → Captain. Leave instructions, priorities, approvals here. Captain checks at every session start.<br><br>Newest at top."

# 3) Bridge file ----------------------------------------------------------
mkdir -p "${HOME}/.claude"

if [ -f "$BRIDGE" ]; then
  echo "✓ Bridge file already exists at ${BRIDGE}"
elif [ -f "$TEMPLATE" ]; then
  cp "$TEMPLATE" "$BRIDGE"
  echo "✓ Created ${BRIDGE} from template"
else
  cat > "$BRIDGE" <<'EOF'
# Cowork ↔ Code Bridge

> Live bridge file. Both Cowork (Claude Desktop) and Claude Code read/write this.
> SessionStart hook reads it; new entries roll up to a session's `additionalContext`.

## Cowork → Code

_(empty)_

## Code → Cowork

_(empty)_

## Decisions Pending

_(empty)_
EOF
  echo "✓ Created ${BRIDGE} (default schema)"
fi

# 4) Verify ---------------------------------------------------------------
echo
echo "Verification:"
osascript <<'EOF' 2>/dev/null
tell application "Notes"
  set noteList to ""
  repeat with n in (notes of folder "Dispatch")
    set noteList to noteList & "  - " & (name of n) & linefeed
  end repeat
  return noteList
end tell
EOF

echo
echo "Setup complete."
echo
echo "Next steps:"
echo "  1. Open Notes.app and verify the 'Dispatch' folder shows 3 notes"
echo "  2. Confirm ~/.claude/bridge.md exists: cat ~/.claude/bridge.md"
echo "  3. SessionStart hook will read these on next session"
echo "  4. Use /dispatch from any session to write to them"
exit 0
