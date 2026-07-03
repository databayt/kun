#!/bin/bash
# chrome-session-agent.sh — keep the session-vault Chrome alive in the
# background via a macOS LaunchAgent, so Claude can always attach and you
# never see a fresh automated login struggle.
#
# Usage:
#   chrome-session-agent.sh install     # write + load the LaunchAgent
#   chrome-session-agent.sh uninstall   # unload + remove it
#   chrome-session-agent.sh status      # is it loaded / running?
#
# The agent starts the vault at login and restarts it if it crashes. A normal
# Quit (Cmd-Q) is respected and won't be fought — it comes back at next login,
# or run `chrome-debug.sh` / `greenlist.sh open` to bring it back immediately.

set -e

LABEL="com.databayt.chrome-session"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
PORT=9222
PROFILE="$HOME/.claude/chrome-debug-profile"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LOG="$HOME/.claude/chrome-session.log"

case "${1:-status}" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents" "$PROFILE"
    # Free the port so launchd's Chrome becomes the owner.
    pkill -f "remote-debugging-port=${PORT}" 2>/dev/null || true
    sleep 1
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${CHROME}</string>
    <string>--remote-debugging-port=${PORT}</string>
    <string>--remote-allow-origins=*</string>
    <string>--user-data-dir=${PROFILE}</string>
    <string>--no-first-run</string>
    <string>--no-default-browser-check</string>
    <string>--restore-last-session</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
EOF
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "Loaded ${LABEL} — session-vault Chrome will stay up on :${PORT}."
    echo "Log into your sites once (greenlist.sh add <url>); Claude reuses them."
    ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    pkill -f "remote-debugging-port=${PORT}" 2>/dev/null || true
    echo "Removed ${LABEL} and stopped the vault."
    ;;
  status)
    if launchctl list | grep -q "$LABEL"; then
      echo "agent: LOADED"
    else
      echo "agent: not loaded"
    fi
    if curl -sf -m 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
      echo "vault: RUNNING on :${PORT}"
    else
      echo "vault: down"
    fi
    ;;
  *)
    echo "usage: chrome-session-agent.sh {install|uninstall|status}"; exit 1;;
esac
