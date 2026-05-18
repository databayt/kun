#!/bin/bash
# Kun auto-sync installer — registers auto-sync.sh as a long-running background
# service. macOS uses launchd (KeepAlive=true); Linux uses systemd user units
# (Restart=always). No sudo required — user-scoped on both.
#
# Usage:
#   auto-sync-install.sh --install
#   auto-sync-install.sh --uninstall
#   auto-sync-install.sh --status
#   auto-sync-install.sh --run

set -uo pipefail

SCRIPT_PATH="$HOME/.claude/scripts/auto-sync.sh"
LOG_DIR="$HOME/.claude/logs"

# macOS launchd
PLIST_LABEL='com.databayt.kun-auto-sync'
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

# Linux systemd user
SYSTEMD_DIR="$HOME/.config/systemd/user"
SYSTEMD_UNIT='kun-auto-sync'

# Detect OS
case "$(uname -s)" in
    Darwin) IS_MAC=true;  IS_LINUX=false ;;
    Linux)  IS_MAC=false; IS_LINUX=true  ;;
    *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

# Parse args
ACTION='status'
for arg in "$@"; do
    case "$arg" in
        --install)   ACTION='install' ;;
        --uninstall) ACTION='uninstall' ;;
        --status)    ACTION='status' ;;
        --run)       ACTION='run' ;;
    esac
done

show_status() {
    if $IS_MAC; then
        if launchctl list | grep -q "$PLIST_LABEL"; then
            echo "kun-auto-sync: loaded (launchd)"
            echo "  Plist: $PLIST_PATH"
            echo "  Logs:  $LOG_DIR/auto-sync-<date>.log"
        else
            echo "kun-auto-sync: not installed"
            echo "  Install with: auto-sync-install.sh --install"
        fi
    elif $IS_LINUX; then
        if systemctl --user is-active "$SYSTEMD_UNIT" >/dev/null 2>&1; then
            echo "kun-auto-sync: active (systemd --user)"
            echo "  Unit: $SYSTEMD_DIR/${SYSTEMD_UNIT}.service"
            systemctl --user status "$SYSTEMD_UNIT" --no-pager --lines=3 | sed 's/^/  /'
        else
            echo "kun-auto-sync: not active"
            echo "  Install with: auto-sync-install.sh --install"
        fi
    fi
}

install_mac() {
    mkdir -p "$(dirname "$PLIST_PATH")" "$LOG_DIR"
    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${SCRIPT_PATH}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/auto-sync-launchd.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/auto-sync-launchd.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"
    echo "✅ Installed kun-auto-sync (launchd)"
    echo "  Plist:  $PLIST_PATH"
    echo "  Logs:   $LOG_DIR/auto-sync-<date>.log"
    echo ""
    echo "Status:    auto-sync-install.sh --status"
    echo "Uninstall: auto-sync-install.sh --uninstall"
}

install_linux() {
    command -v systemctl >/dev/null 2>&1 || {
        echo "❌ systemctl not found — auto-sync needs systemd or run auto-sync.sh from cron manually" >&2
        exit 5
    }
    mkdir -p "$SYSTEMD_DIR" "$LOG_DIR"
    cat > "$SYSTEMD_DIR/${SYSTEMD_UNIT}.service" <<EOF
[Unit]
Description=Kun auto-sync — real-time git sync for databayt repos
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/bin/bash ${SCRIPT_PATH}
Restart=always
RestartSec=10
StandardOutput=append:${LOG_DIR}/auto-sync-systemd.log
StandardError=append:${LOG_DIR}/auto-sync-systemd.err

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable --now "$SYSTEMD_UNIT"
    echo "✅ Installed kun-auto-sync (systemd --user)"
    echo "  Unit:   $SYSTEMD_DIR/${SYSTEMD_UNIT}.service"
    echo "  Logs:   $LOG_DIR/auto-sync-<date>.log"
    echo "  systemctl --user status $SYSTEMD_UNIT"
}

uninstall_mac() {
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "✅ Uninstalled kun-auto-sync (launchd)"
}

uninstall_linux() {
    systemctl --user disable --now "$SYSTEMD_UNIT" 2>/dev/null || true
    rm -f "$SYSTEMD_DIR/${SYSTEMD_UNIT}.service"
    systemctl --user daemon-reload 2>/dev/null || true
    echo "✅ Uninstalled kun-auto-sync (systemd --user)"
}

case "$ACTION" in
    install)
        [ -f "$SCRIPT_PATH" ] || { echo "❌ Script not found: $SCRIPT_PATH"; echo "   Run install.sh first to deploy ~/.claude/scripts/"; exit 1; }
        if $IS_MAC; then install_mac; else install_linux; fi
        ;;
    uninstall)
        if $IS_MAC; then uninstall_mac; else uninstall_linux; fi
        ;;
    run)
        if $IS_MAC; then
            launchctl kickstart -k "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || \
                { echo "❌ Not installed — run --install first"; exit 1; }
            echo "✅ Started kun-auto-sync"
        elif $IS_LINUX; then
            systemctl --user restart "$SYSTEMD_UNIT" || \
                { echo "❌ Not installed — run --install first"; exit 1; }
            echo "✅ Started kun-auto-sync"
        fi
        ;;
    status|*)
        show_status
        ;;
esac
