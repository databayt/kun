#!/bin/bash
# chrome-scrape.sh — launch (or focus) the DEDICATED scrape Chrome.
#
# The Facebook lanes (hogwarts enrich-fb-about, mkan facebook-rentals) drive a
# logged-in Chrome over CDP. That Chrome must be a separate account in its own
# profile — never the session vault (chrome-debug.sh, :9222), which is Abdout's
# own browser and carries the social pipeline's Page tokens.
#
# chrome-debug.sh hardcodes the vault profile, so `chrome-debug.sh 9333` used
# to open Abdout's own browser on a second port. This launcher reads the same
# FB_SCRAPE_* variables the scripts check and refuses the vault outright.
#
# Usage:
#   export FB_SCRAPE_PORT=9333
#   export FB_SCRAPE_PROFILE="$HOME/.claude/chrome-fbscrape-profile"
#   bash ~/.claude/bin/chrome-scrape.sh [url]      # then log in as the scrape account once

set -e

PORT="${FB_SCRAPE_PORT:-9333}"
PROFILE="${FB_SCRAPE_PROFILE:-$HOME/.claude/chrome-fbscrape-profile}"
URL="${1:-https://www.facebook.com/}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ "$PORT" = "9222" ]; then
  echo "⛔ FB_SCRAPE_PORT is 9222 — that is the session vault. Use 9333." >&2
  exit 1
fi
case "$PROFILE" in
  *chrome-debug-profile*)
    echo "⛔ FB_SCRAPE_PROFILE points at the session vault: $PROFILE" >&2
    exit 1
    ;;
esac
if [ ! -x "$CHROME" ]; then
  echo "Google Chrome not found at: $CHROME" >&2
  exit 1
fi

mkdir -p "$PROFILE"
FLAGS=(
  --remote-debugging-port="$PORT"
  --remote-allow-origins=*
  --user-data-dir="$PROFILE"
  --no-first-run
  --no-default-browser-check
)

if curl -sf -m 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "Scrape Chrome already running on :$PORT ($PROFILE)"
  exit 0
fi

echo "Launching scrape Chrome on http://127.0.0.1:$PORT"
echo "Profile: $PROFILE (the dedicated scrape account — log in once, sessions stick)"
exec "$CHROME" "${FLAGS[@]}" "$URL"
