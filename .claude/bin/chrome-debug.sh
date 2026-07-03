#!/bin/bash
# chrome-debug.sh — launch your REAL Chrome with remote debugging so the
# chrome-devtools MCP can attach to it and inherit every site you're already
# logged into (Airbnb, Vercel, GitHub, …). This is the "log in the way I do
# manually" path: no automated login, no CAPTCHA — the automation reuses your
# own live sessions.
#
# Usage:
#   bash ~/.claude/bin/chrome-debug.sh            # launch on port 9222 (default)
#   bash ~/.claude/bin/chrome-debug.sh 9333       # custom port
#
# Then point the chrome-devtools MCP at it by adding to its args in mcp.json:
#   "--browserUrl", "http://127.0.0.1:9222"
# (restart Claude Code so the MCP picks up the new args), OR run the MCP with
#   --autoConnect once Chrome 144+ exposes the debugging endpoint.
#
# Security: this opens a debugging port on localhost only. Close the debug
# Chrome window when done. Uses a SEPARATE user-data-dir so it never disturbs
# your primary Chrome profile — log into it once and its sessions persist.

set -e

PORT="${1:-9222}"
PROFILE="$HOME/.claude/chrome-debug-profile"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME" ]; then
  echo "Google Chrome not found at: $CHROME" >&2
  echo "Install Chrome or edit CHROME= in this script." >&2
  exit 1
fi

mkdir -p "$PROFILE"

echo "Launching Chrome with remote debugging on http://127.0.0.1:$PORT"
echo "Profile: $PROFILE (persistent — log in once, sessions stick)"
echo "Add to chrome-devtools MCP args:  \"--browserUrl\", \"http://127.0.0.1:$PORT\""

exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  "https://www.airbnb.com/login"
