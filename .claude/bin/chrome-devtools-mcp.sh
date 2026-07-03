#!/bin/bash
# chrome-devtools-mcp.sh — MCP launcher for the chrome-devtools server.
#
# If a real Chrome is running with remote debugging on :9222 (started via
# chrome-debug.sh), attach to it so Claude reuses your MANUAL logins — no
# automated login, no CAPTCHA. Otherwise fall back to the default persistent
# profile so the browser tooling never breaks when no debug Chrome is up.
#
# Wired into mcp.json as the chrome-devtools "command". The --browserUrl path
# only engages when you've opted in by running chrome-debug.sh.

PORT="${CHROME_DEBUG_PORT:-9222}"
VERSION="chrome-devtools-mcp@1.3.0"

if curl -sf -m 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  # Real Chrome is up on :$PORT — attach and inherit its live sessions.
  exec npx -y "$VERSION" --browserUrl "http://127.0.0.1:${PORT}"
else
  # No debug Chrome — use the default persistent profile.
  exec npx -y "$VERSION"
fi
