#!/bin/bash
# chrome-debug.sh — launch (or focus) the persistent "session vault" Chrome.
#
# This ONE Chrome is both the browser you log into by hand AND the browser
# Claude attaches to over the remote-debugging port. Log into any site here
# once — CAPTCHA and OTP included — and the session persists in the profile,
# so Claude reuses it forever with no re-login.
#
# Usage:
#   bash ~/.claude/bin/chrome-debug.sh                 # launch on :9222, hidden
#   bash ~/.claude/bin/chrome-debug.sh 9222 <url>      # bring it to the front and open url
#
# Silent by default (2026-11-14): with no URL the vault starts hidden and takes no focus.
# Passing a URL is how a person says "show me" — a login, a CAPTCHA, a code to type.
#
# Normally you don't run this by hand — the launchd agent keeps it alive
# (see chrome-session-agent.sh). Run it only to start the vault ad-hoc.

set -e

PORT="${1:-9222}"
URL="${2:-about:blank}"
PROFILE="$HOME/.claude/chrome-debug-profile"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME" ]; then
  echo "Google Chrome not found at: $CHROME" >&2
  exit 1
fi

mkdir -p "$PROFILE"

# Common flags — remote-allow-origins is required by Chrome 129+ for CDP ws.
FLAGS=(
  --remote-debugging-port="$PORT"
  --remote-allow-origins=*
  --user-data-dir="$PROFILE"
  --no-first-run
  --no-default-browser-check
  --restore-last-session
  --disable-backgrounding-occluded-windows
  --disable-renderer-backgrounding
  --disable-background-timer-throttling
)

# Already running on this port? Hand the URL to the existing instance (Chrome
# is a singleton per user-data-dir; this adds a tab and returns).
if curl -sf -m 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  [ "$URL" != "about:blank" ] && "$CHROME" "${FLAGS[@]}" "$URL" >/dev/null 2>&1 &
  echo "Session vault already running on :$PORT${URL:+ (opened $URL)}"
  exit 0
fi

echo "Launching session-vault Chrome on http://127.0.0.1:$PORT"
echo "Profile: $PROFILE (persistent — log in once, sessions stick)"
if [ "$URL" = "about:blank" ] && [ "$(uname -s)" = Darwin ]; then
  # nobody asked to look: start hidden, take no focus
  exec /usr/bin/open -g -j -n -W -a "Google Chrome" --args "${FLAGS[@]}"
fi
exec "$CHROME" "${FLAGS[@]}" "$URL"
