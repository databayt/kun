#!/usr/bin/env bash
# <name> loop — <one line: what it does, how often, what it costs>.
#
# THE LOOP CONTRACT (kun, 2026-11-01). Copy this file to scripts/<area>/loop.sh and keep
# every numbered piece; reviewers check for them.
#
#   bash scripts/<area>/loop.sh --tick        one pass (what launchd calls)
#   bash scripts/<area>/loop.sh --install     arm launchd (owner machine only — never onboarding)
#   bash scripts/<area>/loop.sh --uninstall
#   bash scripts/<area>/loop.sh --status      armed? last stamps, today's log tail
#   bash scripts/<area>/loop.sh --pause | --resume   kill switch (a file, survives reboots)
#
#   1. Policy in engine.json → jobs.<name> {label, cadence_hours, logs[, claude_runs_per_day]}
#      — runs.sh watches it (red/stale) and aware.mjs alerts on it; nothing else to wire.
#   2. One log per day in ~/.claude/logs/<name>-YYYY-MM-DD.log (runs.sh reads its age).
#   3. A lock dir, so a slow tick never overlaps the next.
#   4. Stamps in a state dir, so a daily step runs once and a sleeping Mac catches up.
#   5. Every outcome on the ledger: runs_record <name> ok|warn|fail "<summary>" [needs_human].
#   6. Headless Claude only through ~/.claude/bin/kun-claude.sh with KUN_JOB=<name>:<step>
#      (tokens + cost on the ledger; lean mode via engine.json jobs.$lean; daily cap).
#   7. Reaching a person only through kun_notify <me|social|mkan|jobs> "<subject>" "<text>".
#   8. Zero-token work first; a model only where judgment is needed.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
NAME="<name>"
LABEL="com.databayt.$NAME"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STATE="$HOME/.claude/state/$NAME"
LOCK="$HOME/.claude/.$NAME.lock"
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$STATE" "$LOG_DIR"
LOG_FILE="$LOG_DIR/$NAME-$(date +%F).log"
log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG_FILE"; }
. "$HOME/.claude/scripts/lib/runs.sh" 2>/dev/null || . "$REPO/.claude/scripts/lib/runs.sh" 2>/dev/null || runs_record() { :; }
. "$HOME/.claude/scripts/lib/notify.sh" 2>/dev/null || . "$REPO/.claude/scripts/lib/notify.sh" 2>/dev/null || kun_notify() { :; }
KUN_CLAUDE="$HOME/.claude/bin/kun-claude.sh"; [ -x "$KUN_CLAUDE" ] || KUN_CLAUDE=claude

TODAY="$(date +%F)"
done_today() { [ "$(cat "$STATE/$1" 2>/dev/null)" = "$TODAY" ]; }
stamp() { echo "$TODAY" > "$STATE/$1"; }

tick() {
    [ -f "$STATE/.paused" ] && { log "paused — skip"; exit 0; }
    if ! mkdir "$LOCK" 2>/dev/null; then
        [ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ] && { rmdir "$LOCK"; mkdir "$LOCK"; } || { log "previous tick still running"; exit 0; }
    fi
    trap 'rmdir "$LOCK" 2>/dev/null' EXIT
    log "▶ tick"

    # zero-token step (example)
    if ! done_today example; then
        if ( cd "$REPO" && true ); then stamp example; runs_record "$NAME" ok "example done"
        else runs_record "$NAME" fail "example failed"; kun_notify me "$NAME" "example step failed — see $LOG_FILE"; fi
    fi

    # judgment step (example): ledgered, named, capped
    # ( cd "$REPO" && KUN_JOB="$NAME:judge" "$KUN_CLAUDE" -p "<prompt>" --model sonnet --max-turns 20 ) >> "$LOG_FILE" 2>&1 \
    #     || runs_record "$NAME" fail "judge exit $?"

    log "◀ tick done"
}

install() {
    [ "$(uname -s)" = Darwin ] || { echo "launchd is macOS-only"; exit 1; }
    cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
	<key>Label</key><string>$LABEL</string>
	<key>ProgramArguments</key><array><string>/bin/bash</string><string>$REPO/scripts/<area>/loop.sh</string><string>--tick</string></array>
	<key>StartInterval</key><integer>1800</integer>
	<key>StandardOutPath</key><string>$LOG_DIR/$NAME-launchd.out</string>
	<key>StandardErrorPath</key><string>$LOG_DIR/$NAME-launchd.err</string>
	<key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/.claude/bin</string></dict>
</dict></plist>
PL
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
    launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "armed $LABEL"
}

case "${1:---tick}" in
    --tick) tick ;;
    --install) install ;;
    --uninstall) launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null; rm -f "$PLIST"; echo "disarmed $LABEL" ;;
    --status) launchctl list | grep "$LABEL" || echo "not armed"; ls "$STATE"; tail -5 "$LOG_FILE" 2>/dev/null ;;
    --pause) touch "$STATE/.paused"; echo paused ;;
    --resume) rm -f "$STATE/.paused"; echo resumed ;;
    *) echo "usage: $0 --tick|--install|--uninstall|--status|--pause|--resume" >&2; exit 1 ;;
esac
