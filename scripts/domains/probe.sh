#!/bin/bash
# Mac-side half of the domains tracer: the weekly SMTP inbox probe.
#
# GitHub runners can't open outbound :25, so the "does hi@/sales@ still accept
# mail" check runs here, from launchd, once a week (Mon 09:30). Weekly on
# purpose: mail providers block home IPs that RCPT-probe often — Namecheap
# Private Email refused this Mac after a few probes on 2026-10-03.
#
#   bash scripts/domains/probe.sh            run once
#   bash scripts/domains/probe.sh --install  install the launchd job
set -u
KUN="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL=com.databayt.domains-probe
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "${1:-}" = "--install" ]; then
  mkdir -p "$HOME/.claude/logs"
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>$LABEL</string>
	<key>ProgramArguments</key>
	<array><string>/bin/bash</string><string>$KUN/scripts/domains/probe.sh</string></array>
	<key>WorkingDirectory</key><string>$KUN</string>
	<key>StartCalendarInterval</key>
	<dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>30</integer></dict>
	<key>EnvironmentVariables</key>
	<dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
	<key>StandardOutPath</key><string>$HOME/.claude/logs/domains-probe.out</string>
	<key>StandardErrorPath</key><string>$HOME/.claude/logs/domains-probe.err</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "installed $LABEL (Mondays 09:30)"
  exit $?
fi

# Only the Slack webhook is read from .env — never export the whole file.
SLACK_WEBHOOK_URL="$(grep -E '^SLACK_WEBHOOK_URL=' "$KUN/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r\n')"
export SLACK_WEBHOOK_URL

echo "--- $(date '+%F %T')"
node "$KUN/scripts/domains/check.mjs" --smtp --alert
code=$?
if [ "$code" = "2" ]; then
  osascript -e 'display notification "A domain or inbox is failing — see the domains issue in databayt/kun" with title "Domains & mail" sound name "Basso"' 2>/dev/null
fi
exit "$code"
