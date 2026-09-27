#!/usr/bin/env bash
# The scheduled half of the jobs lane: every morning, scrape the boards that
# plain fetch can reach and put anything new on the sales.databayt.org board.
#
# No claude -p here, on purpose: discover + ingest are deterministic scripts,
# so a tick costs zero tokens. The connector lanes (Indeed, Gmail drafts,
# replies) need claude.ai connectors, which headless runs don't have — they
# run when Abdout says "jobs" in a session.
#
# Usage: bash scripts/jobs/daily.sh [--run|--install|--uninstall|--status]
#
#   --run        one pass: discover → ingest → macOS notification with the count
#   --install    arm launchd, daily 07:00 local (the Mac is on CAT = Kigali)
#   --uninstall  disarm
#   --status     armed or not, last log line
#
# Failure modes, visible rather than silent:
#   Mac asleep at 07:00 → launchd runs the missed calendar job on wake.
#   CRM down (Docker)   → ingest reports "CRM push failed" per row; rows stay in
#                         Neon without a board id and the next run retries them.
#   a board changed its markup → discover logs "0 cards … markup changed?".
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$HOME/.claude/logs"
PLIST_LABEL="com.databayt.jobs-daily"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
MODE="${1:---run}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/jobs-daily-$(date +%F).log"

render_plist() {
    cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$PLIST_LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>$REPO/scripts/jobs/daily.sh</string>
		<string>--run</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>7</integer>
		<key>Minute</key>
		<integer>0</integer>
	</dict>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/jobs-daily-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/jobs-daily-launchd.err</string>
</dict>
</plist>
PLIST
}

case "$MODE" in
    --install)
        mkdir -p "$HOME/Library/LaunchAgents"
        render_plist > "$PLIST_PATH"
        launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
        launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH"
        echo "armed: $PLIST_LABEL daily 07:00 (plist: $PLIST_PATH)"
        ;;
    --uninstall)
        launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
        rm -f "$PLIST_PATH"
        echo "disarmed: $PLIST_LABEL"
        ;;
    --status)
        if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then echo "armed ($PLIST_LABEL, daily 07:00)"; else echo "not armed"; fi
        LAST="$(ls -t "$LOG_DIR"/jobs-daily-2*.log 2>/dev/null | head -1)"
        [ -n "$LAST" ] && echo "last run: $LAST" && tail -3 "$LAST"
        ;;
    --run)
        cd "$REPO" || exit 1
        {
            echo "── $(date '+%F %T') discover"
            node scripts/jobs/discover.mjs
            echo "── ingest"
            pnpm -s jobs:ingest
        } >> "$LOG_FILE" 2>&1
        STATUS=$?
        SUMMARY="$(grep -E '^Done:' "$LOG_FILE" | tail -1)"
        [ -z "$SUMMARY" ] && SUMMARY="run failed (exit $STATUS) — see $LOG_FILE"
        osascript -e "display notification \"$SUMMARY\" with title \"Jobs — new opportunities\" subtitle \"sales.databayt.org\"" 2>/dev/null || true
        echo "$SUMMARY"
        exit $STATUS
        ;;
    *)
        echo "Unknown flag: $MODE (use --run|--install|--uninstall|--status)" >&2
        exit 1
        ;;
esac
