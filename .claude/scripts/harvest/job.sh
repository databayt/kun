#!/bin/bash
# job.sh — the token-pool heartbeat: every 30 min, refresh the ledger (harvest.mjs), which also
# pushes Hermes's one-hour Nous key into OmniRoute and unlocks connections a dead model locked.
#
#   bash .claude/scripts/harvest/job.sh            run once (what launchd runs)
#   bash .claude/scripts/harvest/job.sh --install  install launchd job com.databayt.harvest (every 30 min)
#   bash .claude/scripts/harvest/job.sh --uninstall
#
# engine.json → jobs.harvest declares it for the supervisor; job-run.sh writes the run ledger.
set -u
KUN="$(cd "$(dirname "$0")/../../.." && pwd)"
LABEL=com.databayt.harvest
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

case "${1:-}" in
  --install)
    mkdir -p "$HOME/.claude/logs" "$HOME/Library/LaunchAgents"
    cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>$LABEL</string>
	<key>ProgramArguments</key>
	<array><string>/bin/bash</string><string>$HOME/.claude/bin/job-run.sh</string><string>harvest</string><string>--</string><string>/bin/bash</string><string>$KUN/.claude/scripts/harvest/job.sh</string></array>
	<key>WorkingDirectory</key><string>$KUN</string>
	<key>StartInterval</key><integer>1800</integer>
	<key>RunAtLoad</key><true/>
	<key>EnvironmentVariables</key>
	<dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
	<key>StandardOutPath</key><string>$HOME/.claude/logs/harvest.out</string>
	<key>StandardErrorPath</key><string>$HOME/.claude/logs/harvest.err</string>
</dict>
</plist>
EOF
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
    launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "installed $LABEL (every 30 min)"
    exit $?
    ;;
  --uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null; rm -f "$PLIST"; echo "removed $LABEL"; exit 0 ;;
esac

echo "--- $(date '+%F %T')"
bash "$KUN/.claude/scripts/harvest/omniroute.sh" status >/dev/null || { echo "gateway down"; }
node "$KUN/.claude/scripts/harvest/harvest.mjs"
