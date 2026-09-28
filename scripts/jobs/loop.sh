#!/usr/bin/env bash
# The jobs loop heartbeat: every 30 minutes, run whatever is due.
#
#   bash scripts/jobs/loop.sh --tick        one pass (what launchd calls)
#   bash scripts/jobs/loop.sh --install     arm launchd (replaces com.databayt.jobs-daily)
#   bash scripts/jobs/loop.sh --uninstall
#   bash scripts/jobs/loop.sh --status      armed? last stamps, today's log tail
#   bash scripts/jobs/loop.sh --pause       kill switch on  (touch jobs/.send-off)
#   bash scripts/jobs/loop.sh --resume      kill switch off
#
# Schedule (Kigali, the Mac is on CAT):
#   ≥07:00 daily       discover + ingest                 0 tokens
#   ≥07:00 Mon–Fri     wave: tailor + gate → QUEUED/HOLD  claude -p (Max)
#   ≥10:00 Mon–Fri     send, every tick until 17:00       0 tokens, capped
#   ≥07:00 daily       ATS prepare: form answers + letters   claude -p (Max)
#   09:00–20:00        ATS submit, ≤8 per tick, total cap 100/day
#   08:00–21:00        inbox: read + classify replies     0 tokens
#   ≥16:00 Mon–Fri     follow-ups (templated) + archive   0 tokens
#   Fri ≥17:00         learn --propose --send             claude -p (Max)
#   after the wave     digest → Slack DM via `hermes send`  0 tokens
#
# Stamps in jobs/.state/ make each daily step run once per day and let a Mac
# that slept through a slot catch up on its first tick after waking. A lock
# dir keeps a slow wave from overlapping the next tick.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$REPO/jobs/.state"
LOG_DIR="$HOME/.claude/logs"
LOCK="$HOME/.claude/.jobs-loop.lock"
PLIST_LABEL="com.databayt.jobs-loop"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
MODE="${1:---tick}"

mkdir -p "$STATE" "$LOG_DIR"
LOG_FILE="$LOG_DIR/jobs-loop-$(date +%F).log"
log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG_FILE"; }

TODAY="$(date +%F)"
HOUR=$((10#$(date +%H)))
DOW="$(date +%u)"            # 1 = Monday … 7 = Sunday
WEEK="$(date +%G-W%V)"

done_today() { [ "$(cat "$STATE/$1" 2>/dev/null)" = "$TODAY" ]; }
stamp() { echo "$TODAY" > "$STATE/$1"; }
weekday() { [ "$DOW" -le 5 ]; }

run() {  # run <name> <cmd...> — logs, never aborts the tick
    local name="$1"; shift
    log "▶ $name"
    ( cd "$REPO" && "$@" ) >> "$LOG_FILE" 2>&1
    local rc=$?
    log "◀ $name exit $rc"
    return $rc
}

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
		<string>$REPO/scripts/jobs/loop.sh</string>
		<string>--tick</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartInterval</key>
	<integer>1800</integer>
	<key>RunAtLoad</key>
	<true/>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin</string>
		<key>DISABLE_AUTOUPDATER</key>
		<string>1</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/jobs-loop-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/jobs-loop-launchd.err</string>
</dict>
</plist>
PLIST
}

case "$MODE" in
    --install)
        # The morning scrape moves into this loop; the old single-purpose job goes.
        launchctl bootout "gui/$(id -u)/com.databayt.jobs-daily" 2>/dev/null || true
        rm -f "$HOME/Library/LaunchAgents/com.databayt.jobs-daily.plist"
        mkdir -p "$HOME/Library/LaunchAgents"
        render_plist > "$PLIST_PATH"
        launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
        launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH"
        echo "armed: $PLIST_LABEL every 30 min (plist: $PLIST_PATH); com.databayt.jobs-daily removed"
        ;;
    --uninstall)
        launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
        rm -f "$PLIST_PATH"
        echo "disarmed: $PLIST_LABEL"
        ;;
    --pause)
        touch "$REPO/jobs/.send-off"; echo "sending paused (jobs/.send-off). Everything else keeps running."
        ;;
    --resume)
        rm -f "$REPO/jobs/.send-off"; echo "sending resumed."
        ;;
    --status)
        if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then echo "armed ($PLIST_LABEL, every 30 min)"; else echo "not armed"; fi
        [ -f "$REPO/jobs/.send-off" ] && echo "⛔ sending paused (jobs/.send-off)"
        for s in discover wave ats-prepare digest followup learn; do printf "  %-9s %s\n" "$s" "$(cat "$STATE/$s" 2>/dev/null || echo never)"; done
        [ -f "$LOG_FILE" ] && tail -8 "$LOG_FILE"
        ;;
    --tick)
        if ! mkdir "$LOCK" 2>/dev/null; then
            # A lock older than 2h is a crashed tick, not a running one.
            if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then rmdir "$LOCK"; mkdir "$LOCK"; else log "tick skipped — previous tick still running"; exit 0; fi
        fi
        trap 'rmdir "$LOCK" 2>/dev/null' EXIT
        log "tick (dow $DOW, hour $HOUR)"

        # Right after a wake Docker needs a minute before the CRM answers — the
        # 2026-09-28 log shows ticks lost to exactly that. Wait up to 2 min;
        # still down = nothing to do; say so once per tick and stop.
        crm_up=""
        for _ in 1 2 3 4 5 6 7 8; do
            if curl -sf -o /dev/null --max-time 10 http://localhost:3100/healthz; then crm_up=1; break; fi
            sleep 15
        done
        if [ -z "$crm_up" ]; then
            log "CRM (localhost:3100) unreachable — tick stops"; exit 0
        fi

        # Working hours on mains power: hold the Mac awake until the next tick,
        # so an idle sleep can't skip the send windows (it lost 14:30–18:10 on
        # 2026-09-28). Never on battery — a drained Mac runs nothing at all.
        if [ "$HOUR" -ge 7 ] && [ "$HOUR" -lt 21 ] && pmset -g batt 2>/dev/null | grep -q "AC Power"; then
            pkill -f "caffeinate -i -t 1900" 2>/dev/null
            nohup caffeinate -i -t 1900 >/dev/null 2>&1 &
        fi

        if [ "$HOUR" -ge 7 ] && ! done_today discover; then
            run discover node scripts/jobs/discover.mjs && run ingest pnpm -s jobs:ingest && stamp discover
        fi
        if weekday && [ "$HOUR" -ge 7 ] && [ "$HOUR" -lt 17 ] && done_today discover && ! done_today wave; then
            run facts pnpm -s jobs:facts
            run wave pnpm -s jobs:wave && stamp wave
        fi
        # The digest follows the wave so it shows what will actually go out;
        # on weekends (no wave) it follows discover. Delivered by Hermes.
        if [ "$HOUR" -ge 7 ] && done_today discover && ! done_today digest && { ! weekday || done_today wave || [ "$HOUR" -ge 17 ]; }; then
            run digest pnpm -s jobs:digest --send && stamp digest
        fi
        if weekday && [ "$HOUR" -ge 10 ] && [ "$HOUR" -lt 17 ]; then
            run send pnpm -s jobs:send --apply --limit 10
        fi
        # ATS lane (Abdout, 2026-09-27: auto-submit portal forms toward
        # 100/day): prepare once a day after discovery, then submit a few per
        # tick through the working day. The daily total cap is in config.
        if [ "$HOUR" -ge 7 ] && done_today discover && ! done_today ats-prepare; then
            run ats-prepare pnpm -s jobs:ats prepare --limit 80 && stamp ats-prepare
        fi
        if [ "$HOUR" -ge 9 ] && [ "$HOUR" -lt 20 ]; then
            run ats-submit pnpm -s jobs:ats submit --apply --limit 8
        fi
        if [ "$HOUR" -ge 8 ] && [ "$HOUR" -lt 22 ]; then
            run inbox pnpm -s jobs:inbox
        fi
        if weekday && [ "$HOUR" -ge 16 ] && [ "$HOUR" -lt 17 ] && ! done_today followup; then
            run followup pnpm -s jobs:followup --apply && stamp followup
        fi
        if [ "$DOW" -eq 5 ] && [ "$HOUR" -ge 17 ] && [ "$(cat "$STATE/learn" 2>/dev/null)" != "$WEEK" ]; then
            run learn pnpm -s jobs:learn --propose --send && echo "$WEEK" > "$STATE/learn"
        fi
        log "tick done"
        ;;
    *)
        echo "Unknown flag: $MODE (use --tick|--install|--uninstall|--status|--pause|--resume)" >&2; exit 1
        ;;
esac
