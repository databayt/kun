#!/bin/bash
# Kun maintain (macOS/Linux) — daily heartbeat. Mirrors maintain.ps1.
# Spec: github.com/databayt/kun/issues/27
# Usage: maintain.sh [--install] [--uninstall] [--status] [--run] [--dry-run] [--silent] [--schedule HH:MM]

set +e

SCRIPTS_DIR="$HOME/.claude/scripts"
LOGS_DIR="$HOME/.claude/logs"

# macOS: launchd
PLIST_LABEL='com.databayt.kun-maintain'
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

# Linux: systemd user units
SYSTEMD_DIR="$HOME/.config/systemd/user"
SYSTEMD_UNIT='kun-maintain'

# OS detection
IS_MAC=false; IS_LINUX=false
case "$(uname -s)" in
    Darwin) IS_MAC=true ;;
    Linux)  IS_LINUX=true ;;
esac

INSTALL=false; UNINSTALL=false; STATUS=false; DRY_RUN=false; SILENT=false
SCHEDULE='09:00'
for arg in "$@"; do
    case "$arg" in
        --install)   INSTALL=true ;;
        --uninstall) UNINSTALL=true ;;
        --status)    STATUS=true ;;
        --run)       ;;  # default
        --dry-run)   DRY_RUN=true ;;
        --silent)    SILENT=true ;;
        --schedule=*) SCHEDULE="${arg#*=}" ;;
    esac
done

mkdir -p "$LOGS_DIR"
TODAY=$(date '+%Y-%m-%d')
LOG_FILE="$LOGS_DIR/maintain-${TODAY}.log"

log() {
    local level="${2:-INFO}"
    local line="[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [${level}] $1"
    echo "$line" >> "$LOG_FILE"
    if [ "$SILENT" != true ]; then echo "$line"; fi
}

rotate_logs() {
    find "$LOGS_DIR" -name 'maintain-*.log' -type f -mtime +30 -delete 2>/dev/null
}

# ── --install ────────────────────────────────────────────────────
if [ "$INSTALL" = true ]; then
    hour="${SCHEDULE%:*}"
    minute="${SCHEDULE#*:}"

    if $IS_MAC; then
        if [ "$DRY_RUN" = true ]; then
            echo "DRY RUN — would write $PLIST_PATH for daily ${SCHEDULE}"
            exit 0
        fi
        mkdir -p "$(dirname "$PLIST_PATH")"
        cat > "$PLIST_PATH" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${SCRIPTS_DIR}/maintain.sh</string>
        <string>--run</string>
        <string>--silent</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>${hour}</integer>
        <key>Minute</key>
        <integer>${minute}</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOGS_DIR}/maintain-launchd.out</string>
    <key>StandardErrorPath</key>
    <string>${LOGS_DIR}/maintain-launchd.err</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
PLIST_EOF
        # Unload if already loaded, then load fresh — idempotent
        launchctl unload "$PLIST_PATH" 2>/dev/null
        if launchctl load "$PLIST_PATH" 2>/dev/null; then
            echo "✅ Scheduled launchd agent '${PLIST_LABEL}' armed for daily ${SCHEDULE}"
            echo "   plist: $PLIST_PATH"
            exit 0
        else
            echo "❌ Failed to load launchd agent" >&2
            echo "   plist written to $PLIST_PATH — try: launchctl load $PLIST_PATH" >&2
            exit 5
        fi
    fi

    if $IS_LINUX; then
        # systemd user unit + timer
        if ! command -v systemctl >/dev/null 2>&1; then
            echo "❌ systemctl not found — install systemd or use cron manually" >&2
            exit 5
        fi
        if [ "$DRY_RUN" = true ]; then
            echo "DRY RUN — would write $SYSTEMD_DIR/${SYSTEMD_UNIT}.{service,timer} for daily ${SCHEDULE}"
            exit 0
        fi
        mkdir -p "$SYSTEMD_DIR"
        cat > "$SYSTEMD_DIR/${SYSTEMD_UNIT}.service" << SERVICE_EOF
[Unit]
Description=Kun engine daily heartbeat
After=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash ${SCRIPTS_DIR}/maintain.sh --run --silent
StandardOutput=append:${LOGS_DIR}/maintain-systemd.out
StandardError=append:${LOGS_DIR}/maintain-systemd.err
SERVICE_EOF

        cat > "$SYSTEMD_DIR/${SYSTEMD_UNIT}.timer" << TIMER_EOF
[Unit]
Description=Daily Kun engine heartbeat
Requires=${SYSTEMD_UNIT}.service

[Timer]
OnCalendar=*-*-* ${SCHEDULE}:00
Persistent=true
Unit=${SYSTEMD_UNIT}.service

[Install]
WantedBy=timers.target
TIMER_EOF

        systemctl --user daemon-reload 2>/dev/null
        if systemctl --user enable --now "${SYSTEMD_UNIT}.timer" 2>/dev/null; then
            echo "✅ Scheduled systemd timer '${SYSTEMD_UNIT}.timer' armed for daily ${SCHEDULE}"
            echo "   units: $SYSTEMD_DIR/${SYSTEMD_UNIT}.{service,timer}"
            exit 0
        else
            echo "❌ systemctl --user enable failed" >&2
            echo "   units written to $SYSTEMD_DIR — try: systemctl --user enable --now ${SYSTEMD_UNIT}.timer" >&2
            exit 5
        fi
    fi

    echo "❌ Unsupported OS for scheduling" >&2
    exit 5
fi

# ── --uninstall ──────────────────────────────────────────────────
if [ "$UNINSTALL" = true ]; then
    if $IS_MAC; then
        launchctl unload "$PLIST_PATH" 2>/dev/null
        rm -f "$PLIST_PATH"
        echo "✅ Removed launchd agent '${PLIST_LABEL}' (idempotent)"
    elif $IS_LINUX; then
        if command -v systemctl >/dev/null 2>&1; then
            systemctl --user disable --now "${SYSTEMD_UNIT}.timer" 2>/dev/null
        fi
        rm -f "$SYSTEMD_DIR/${SYSTEMD_UNIT}.service" "$SYSTEMD_DIR/${SYSTEMD_UNIT}.timer"
        echo "✅ Removed systemd units '${SYSTEMD_UNIT}.{service,timer}' (idempotent)"
    fi
    exit 0
fi

# ── --status ─────────────────────────────────────────────────────
if [ "$STATUS" = true ]; then
    echo ""
    echo "kun-maintain status"
    if $IS_MAC; then
        if launchctl list 2>/dev/null | grep -q "$PLIST_LABEL"; then
            echo "  Backend:  launchd"
            echo "  State:    loaded"
            echo "  Plist:    $PLIST_PATH"
        else
            echo "  Backend:  launchd"
            echo "  State:    not loaded — run: maintain.sh --install"
        fi
    elif $IS_LINUX; then
        echo "  Backend:  systemd --user"
        if systemctl --user is-enabled "${SYSTEMD_UNIT}.timer" >/dev/null 2>&1; then
            echo "  State:    enabled"
            next=$(systemctl --user list-timers --all --no-pager 2>/dev/null | grep "$SYSTEMD_UNIT" | awk '{print $1, $2}' | head -1)
            [ -n "$next" ] && echo "  Next run: $next"
        else
            echo "  State:    not enabled — run: maintain.sh --install"
        fi
    fi
    echo "  Log dir:  $LOGS_DIR"
    latest=$(ls -t "$LOGS_DIR"/maintain-*.log 2>/dev/null | head -1)
    [ -n "$latest" ] && echo "  Latest:   $latest"
    exit 0
fi

# ── Default: --run ──────────────────────────────────────────────
rotate_logs
log "start ($(hostname -s 2>/dev/null))"

# 1. Sync repos
SYNC_SCRIPT="$SCRIPTS_DIR/sync-repos.sh"
if [ -f "$SYNC_SCRIPT" ]; then
    if [ "$DRY_RUN" = true ]; then
        log "[dry-run] would call sync-repos.sh"
    else
        if bash "$SYNC_SCRIPT" >/dev/null 2>&1; then
            log "sync-repos: ok" "OK"
        else
            log "sync-repos: failed" "WARN"
        fi
    fi
else
    log "sync-repos: script missing, skipped" "WARN"
fi

# 2. Self-update ~/kun
KUN_PATH="$HOME/kun"
if [ -d "$KUN_PATH/.git" ]; then
    if [ "$DRY_RUN" = true ]; then
        log "[dry-run] would git pull ~/kun"
    else
        before=$(cd "$KUN_PATH" && git rev-parse HEAD 2>/dev/null)
        (cd "$KUN_PATH" && git pull --quiet --rebase >/dev/null 2>&1)
        after=$(cd "$KUN_PATH" && git rev-parse HEAD 2>/dev/null)
        if [ "$before" = "$after" ]; then
            log "self-update: no changes on ~/kun" "OK"
        else
            changed=$(cd "$KUN_PATH" && git diff --name-only "$before" "$after" 2>/dev/null | grep -c '^\.claude/' || echo 0)
            if [ "$changed" -gt 0 ]; then
                INSTALLER="$KUN_PATH/.claude/scripts/install.sh"
                if [ -f "$INSTALLER" ]; then
                    bash "$INSTALLER" engineer >/dev/null 2>&1
                fi
                log "self-update: applied ${changed} config changes" "OK"
            else
                log "self-update: pulled ${before:0:7}..${after:0:7} (no config changes)" "OK"
            fi
        fi
    fi
else
    log "self-update: ~/kun not cloned, skipped" "WARN"
fi

# 3. Doctor
DOCTOR_SCRIPT="$SCRIPTS_DIR/doctor.sh"
DOCTOR_EXIT=-1
if [ -f "$DOCTOR_SCRIPT" ]; then
    if [ "$DRY_RUN" = true ]; then
        log "[dry-run] would run doctor.sh"
        DOCTOR_EXIT=0
    else
        bash "$DOCTOR_SCRIPT" --quiet >> "$LOG_FILE" 2>&1
        DOCTOR_EXIT=$?
        log "doctor: exit ${DOCTOR_EXIT}"
    fi
else
    log "doctor: script missing (run install.sh)" "ERROR"
    DOCTOR_EXIT=1
fi

# 4. Notify based on doctor exit
notify_toast() {
    local title="$1" subtitle="$2"
    if command -v osascript >/dev/null 2>&1; then
        osascript -e "display notification \"${subtitle}\" with title \"${title}\"" 2>/dev/null
    fi
}

notify_slack() {
    local message="$1"
    local webhook=""
    if [ -f "$HOME/.claude/.env" ]; then
        webhook=$(grep -E '^SLACK_WEBHOOK_URL\s*=' "$HOME/.claude/.env" | head -1 | cut -d= -f2- | tr -d ' "')
    fi
    [ -z "$webhook" ] && return
    local payload
    payload=$(printf '{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":%q}}]}' "$message")
    curl -fsSL --max-time 5 -X POST -H 'Content-Type: application/json' \
         -d "$payload" "$webhook" >/dev/null 2>&1
}

HOST=$(hostname -s 2>/dev/null)
if [ "$DRY_RUN" != true ]; then
    case "$DOCTOR_EXIT" in
        0)
            log "notify: silent (all green)" "OK"
            # Weekly snapshot on Mondays
            if [ "$(date +%u)" = "1" ] && command -v gh >/dev/null 2>&1; then
                log "notify: posting weekly snapshot to databayt/kun#config-health"
                bash "$DOCTOR_SCRIPT" --report >/dev/null 2>&1
            fi
            ;;
        2)
            notify_toast "Kun maintenance" "Warnings — run 'doctor' for details"
            log "notify: toast (warnings)" "WARN"
            ;;
        3)
            notify_toast "Kun maintenance" "Updates available — run 'doctor --update'"
            log "notify: toast (update available)" "OK"
            ;;
        *)
            notify_toast "Kun maintenance" "Errors — run 'doctor' to investigate"
            notify_slack "❌ *kun-maintain @ ${HOST}* — doctor exit ${DOCTOR_EXIT}\nLog: \`${LOG_FILE}\`\nRepair: \`doctor --fix\`"
            log "notify: slack + toast (errors)" "ERROR"
            ;;
    esac
fi

log "end"
exit $DOCTOR_EXIT
