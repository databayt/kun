#!/usr/bin/env bash
# The daily backlog nudge — the doorbell that rings more than once.
#
# The Friday digest reports the week. This reports one thing only: work the
# machine finished that is waiting on a human. It exists because of a measured
# failure, not a hypothetical one.
#
# 2026-08-26: three finished posts had sat `pending` for 27 days and six
# answered drafts were unclaimed, while every scheduled job reported success —
# each one truthfully draining an empty queue. `sendReview` fires once, at
# staging time, so after the day an item arrives nothing ever mentions it
# again. Green dashboards over a starving queue.
#
# Usage: bash scripts/social-nudge.sh [--run|--install|--uninstall|--status]
#
#   --run        check the queue, nudge if anything is stale (what launchd calls)
#   --install    arm the schedule (launchd, daily 09:00), idempotent
#   --uninstall  disarm
#   --status     is it armed, what did it last say
#
# Silent by default. It speaks only when something has been waiting longer than
# SOCIAL_NUDGE_STALE_DAYS (default 3) — long enough to mean the weekly approval
# session missed it. A daily message about yesterday's draft would be noise,
# and a nudge that is noise stops being read, which is the failure it is here
# to prevent.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/.claude/logs"
PLIST_LABEL="com.databayt.social-nudge"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
STALE_DAYS="${SOCIAL_NUDGE_STALE_DAYS:-3}"

MODE="--run"
for arg in "$@"; do
    case "$arg" in
        --run|--install|--uninstall|--status) MODE="$arg" ;;
        *) echo "Unknown flag: $arg (use --run|--install|--uninstall|--status)" >&2; exit 1 ;;
    esac
done

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/social-nudge-$(date +%F).log"
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
		<string>$REPO/scripts/social-nudge.sh</string>
		<string>--run</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartCalendarInterval</key>
	<dict>
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
	<string>$LOG_DIR/social-nudge-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/social-nudge-launchd.err</string>
</dict>
</plist>
PLIST
}

do_install() {
    mkdir -p "$HOME/Library/LaunchAgents"
    render_plist > "$PLIST_PATH"
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH" 2>/dev/null || true
    echo "armed: $PLIST_LABEL daily 09:00 (plist: $PLIST_PATH)"
}

do_uninstall() {
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "disarmed: $PLIST_LABEL"
}

do_status() {
    if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then
        echo "armed ($PLIST_LABEL, daily 09:00, stale threshold ${STALE_DAYS}d)"
    else
        echo "NOT armed — run: bash scripts/social-nudge.sh --install"
    fi
    tail -n 5 "$LOG_FILE" 2>/dev/null || echo "(nothing logged today)"
}

case "$MODE" in
    --install)   do_install;   exit 0 ;;
    --uninstall) do_uninstall; exit 0 ;;
    --status)    do_status;    exit 0 ;;
esac

# ── One daily check ──────────────────────────────────────────────

cd "$REPO" || exit 0

log "nudge check start (stale threshold ${STALE_DAYS}d)"
node scripts/social-digest.mjs --backlog-only --stale-days "$STALE_DAYS" >> "$LOG_FILE" 2>&1 || {
    log "nudge failed — check DATABASE_URL / network"; exit 0;
}
log "nudge check end"
exit 0
