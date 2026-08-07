#!/usr/bin/env bash
# The Friday digest on a timer — architecture.mdx's "Weekly content nudge"
# candidate, built.
#
# Friday 09:00 local, this runs scripts/social-digest.mjs: planned vs shipped
# for the ISO week, the Facebook numbers, the 60-day dismissal lessons, and
# lane health — delivered via Hermes to Slack #social (Telegram review chat as
# fallback). Deterministic, zero tokens; it feeds the captain's Friday review
# rather than replacing it.
#
# Friday because the weekend is Fri-Sat in both Saudi Arabia and Sudan: the
# digest closes the working week and sits at the top of the channel when
# planning resumes.
#
# Usage: bash scripts/weekly-digest.sh [--run|--install|--uninstall|--status]
#
#   --run        compose + deliver one digest (what launchd calls)
#   --install    arm the schedule (launchd, Fridays 09:00), idempotent
#   --uninstall  disarm
#   --status     is it armed, when did it last post
#
# Failure modes, visible rather than papered over:
#   Mac asleep Friday 09:00 → launchd fires the job on next wake.
#   Hermes down → Telegram review chat; both down → the log carries the digest
#   and a DELIVERED NOWHERE warning.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
LOG_DIR="$CLAUDE_DIR/logs"
PLIST_LABEL="com.databayt.social-digest"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

MODE="--run"
for arg in "$@"; do
    case "$arg" in
        --run|--install|--uninstall|--status) MODE="$arg" ;;
        *) echo "Unknown flag: $arg (use --run|--install|--uninstall|--status)" >&2; exit 1 ;;
    esac
done

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/social-digest-$(date +%F).log"
log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG_FILE"; }

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
		<string>$REPO/scripts/weekly-digest.sh</string>
		<string>--run</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Weekday</key>
		<integer>5</integer>
		<key>Hour</key>
		<integer>9</integer>
		<key>Minute</key>
		<integer>0</integer>
	</dict>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/social-digest-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/social-digest-launchd.err</string>
</dict>
</plist>
PLIST
}

do_install() {
    mkdir -p "$HOME/Library/LaunchAgents"
    render_plist > "$PLIST_PATH"
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH" 2>/dev/null || true
    echo "armed: $PLIST_LABEL Fridays 09:00 (plist: $PLIST_PATH)"
}

do_uninstall() {
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "disarmed: $PLIST_LABEL"
}

do_status() {
    if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then
        echo "armed ($PLIST_LABEL, Fridays 09:00)"
    else
        echo "NOT armed — run: bash scripts/weekly-digest.sh --install"
    fi
    tail -n 3 "$LOG_FILE" 2>/dev/null || echo "(no digests logged today)"
}

case "$MODE" in
    --install)   do_install;   exit 0 ;;
    --uninstall) do_uninstall; exit 0 ;;
    --status)    do_status;    exit 0 ;;
esac

# ── One weekly run ───────────────────────────────────────────────

cd "$REPO" || exit 0

log "digest start"
node scripts/social-digest.mjs >> "$LOG_FILE" 2>&1 || {
    log "digest failed — check DATABASE_URL / network"; exit 0;
}
log "digest end"
exit 0
