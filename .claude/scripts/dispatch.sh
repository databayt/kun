#!/bin/bash
# Dispatch — Read/write to Apple Notes → Dispatch folder
# Usage: dispatch.sh <channel> <message> [priority]
#
# Channels:
#   captain  — Captain writes updates to Abdout (default)
#   cowork   — Bridge between Cowork sessions and Claude Code sessions
#   inbox    — Read what Abdout wrote for Captain
#
# Priority: normal (default), urgent, decision, fyi

CHANNEL="${1:-captain}"
MESSAGE="$2"
PRIORITY="${3:-normal}"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")

# Map channel to note name
case "$CHANNEL" in
  captain|cap|c)  NOTE_NAME="Captain" ;;
  cowork|cw|w)    NOTE_NAME="Cowork" ;;
  inbox|in|i)     NOTE_NAME="Inbox" ;;
  read)
    # Read mode — read a note
    TARGET="${2:-inbox}"
    case "$TARGET" in
      captain|cap|c) TARGET_NOTE="Captain" ;;
      cowork|cw|w)   TARGET_NOTE="Cowork" ;;
      inbox|in|i)    TARGET_NOTE="Inbox" ;;
      *)             TARGET_NOTE="$TARGET" ;;
    esac
    osascript -e "
    tell application \"Notes\"
      tell folder \"Dispatch\"
        set noteBody to plaintext of note \"$TARGET_NOTE\"
        return noteBody
      end tell
    end tell
    " 2>/dev/null
    exit $?
    ;;
  *)
    echo "Dispatch — Apple Notes Communication"
    echo ""
    echo "Write:"
    echo "  dispatch.sh captain \"message\" [priority]   — Captain → Abdout"
    echo "  dispatch.sh cowork \"message\"               — Cowork ↔ Code bridge"
    echo "  dispatch.sh inbox \"message\"                — Abdout → Captain"
    echo ""
    echo "Read:"
    echo "  dispatch.sh read inbox     — Read what Abdout wrote"
    echo "  dispatch.sh read cowork    — Read Cowork bridge state"
    echo "  dispatch.sh read captain   — Read Captain dispatch log"
    echo ""
    echo "Priority: fyi, normal (default), decision, urgent"
    echo ""
    echo "Location: Notes → Dispatch → {Captain, Cowork, Inbox}"
    exit 0
    ;;
esac

# Validate message
if [ -z "$MESSAGE" ]; then
  echo "Usage: dispatch.sh <channel> \"message\" [priority]"
  exit 1
fi

# Format based on priority
case "$PRIORITY" in
  urgent)   PREFIX="🔴 URGENT" ;;
  decision) PREFIX="🟡 DECISION" ;;
  fyi)      PREFIX="🔵 FYI" ;;
  *)        PREFIX="📋" ;;
esac

# Escape for AppleScript
ESCAPED_MSG=$(echo "$MESSAGE" | sed 's/"/\\"/g' | sed "s/'/\\\\'/g")

# Append to note
osascript -e "
tell application \"Notes\"
  tell folder \"Dispatch\"
    set theNote to note \"$NOTE_NAME\"
    set noteBody to body of theNote
    set body of theNote to noteBody & \"<hr><p><b>[$TIMESTAMP] $PREFIX</b></p><p>$ESCAPED_MSG</p>\"
  end tell
end tell
" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "→ Dispatch/$NOTE_NAME: [$PREFIX] $MESSAGE"
else
  echo "ERROR: Failed to dispatch to $NOTE_NAME"
  exit 1
fi
