#!/bin/bash
# Kun Devices — the MacBook, the iPhone and every Claude surface, working as one.
#
# Two small launchd services turn the Claude iPhone app into a real remote for this Mac:
#
#   presence  keeps ~/.claude/.present while you are at the Mac (input in the last N
#             seconds, screen unlocked). Claude Code reads it through
#             CLAUDE_CLIENT_PRESENCE_FILE and skips mobile pushes while it exists, so the
#             phone buzzes only when you are away. When in doubt it removes the file:
#             a stray push is cheaper than a missed one.
#   server    keeps one `claude remote-control` server alive in tmux, rooted at ~/kun.
#             The Claude app's Code tab can start new sessions on the Mac through it, so
#             no terminal session has to stay open "in case" — idle sessions each hold
#             ~10 MCP processes, which is what exhausts a 16 GB Mac.
#
# Usage: bash ~/.claude/scripts/devices.sh [--status|--brief|--install|--uninstall]
#   --status     the whole lane: Mac headroom, Remote Control, push, services, next steps
#   --brief      SessionStart one-liners, printed only when something needs attention
#   --install    arm both services (idempotent; installs tmux with Homebrew if missing)
#   --uninstall  disarm both services and stop the server
#   --presence / --server / --serve-once are the loops launchd and tmux run.
#
# Policy (capacity, permission mode, thresholds) lives in kun/.claude/engine.json → devices.
# Facts verified against code.claude.com docs on 2026-09-27: remote-control, mobile,
# settings-reference (agentPushNotifEnabled, inputNeededNotifEnabled), env-vars
# (CLAUDE_CLIENT_PRESENCE_FILE). macOS only; elsewhere every mode says so and exits 0.
#
# Everything runs inside main(): bash parses a function whole before running it, so the
# daily setup.sh re-copy of this file cannot corrupt a loop that has been up for days.

main() {
    CLAUDE_DIR="$HOME/.claude"
    KUN_DIR="$HOME/kun"
    ENGINE_JSON="$KUN_DIR/.claude/engine.json"
    LOG_DIR="$CLAUDE_DIR/logs"
    SELF="$CLAUDE_DIR/scripts/devices.sh"
    SETTINGS="$CLAUDE_DIR/settings.json"
    DESKTOP_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    PRESENCE_LABEL="com.databayt.presence"
    SERVER_LABEL="com.databayt.claude-rc"
    SERVICE_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$HOME/.claude/bin"

    local mode="${1:---status}"
    if [ "$(uname -s)" != "Darwin" ]; then
        [ "$mode" = "--brief" ] || echo "devices.sh: macOS only — nothing to do on $(uname -s)"
        return 0
    fi

    PRESENCE_FILE="$(policy presence.file "$CLAUDE_DIR/.present")"
    PRESENCE_FILE="${PRESENCE_FILE/#\~/$HOME}"
    IDLE_LIMIT="$(policy presence.idle_seconds 180)"
    RC_SESSION="$(policy rc_server.tmux_session kun-rc)"
    RC_NAME="$(policy rc_server.name "Mac · kun")"
    RC_PREFIX="$(policy rc_server.name_prefix mac)"
    RC_CAPACITY="$(policy rc_server.capacity 3)"
    RC_MODE="$(policy rc_server.permission_mode auto)"
    WARN_DISK_GB="$(policy warn.disk_free_gb 20)"
    WARN_SESSIONS="$(policy warn.sessions 6)"
    WARN_SWAP_PCT="$(policy warn.swap_used_pct 80)"

    case "$mode" in
        --status)     do_status ;;
        --brief)      do_brief ;;
        --install)    do_install ;;
        --uninstall)  do_uninstall ;;
        --presence)   run_presence ;;
        --server)     run_server ;;
        --serve-once) serve_once ;;
        *) echo "Unknown flag: $mode (use --status|--brief|--install|--uninstall)" >&2; return 1 ;;
    esac
}

# ── Helpers ──────────────────────────────────────────────────────

policy() {  # policy <dotted.key.under.devices> <default>
    local v=""
    if command -v jq >/dev/null 2>&1 && [ -f "$ENGINE_JSON" ]; then
        v="$(jq -r ".devices.$1 // empty" "$ENGINE_JSON" 2>/dev/null)"
    fi
    echo "${v:-$2}"
}

log() {
    mkdir -p "$LOG_DIR"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/devices-$(date '+%Y-%m-%d').log"
    find "$LOG_DIR" -name 'devices-*.log' -mtime +14 -delete 2>/dev/null || true
}

setting_true() {  # setting_true <key> — true when ~/.claude/settings.json sets <key>: true
    grep -Eq "\"$1\"[[:space:]]*:[[:space:]]*true" "$SETTINGS" 2>/dev/null
}

desktop_pref() {  # desktop_pref <key> — a Claude Desktop preference, or empty
    plutil -extract "preferences.$1" raw -o - "$DESKTOP_CONFIG" 2>/dev/null
}

disk_free_gb() { df -g /System/Volumes/Data 2>/dev/null | awk 'NR==2 {print $4}'; }

swap_used_pct() {
    sysctl -n vm.swapusage 2>/dev/null | awk '{
        for (i = 1; i <= NF; i++) {
            if ($i == "total") t = $(i + 2) + 0
            if ($i == "used")  u = $(i + 2) + 0
        }
        if (t > 0) printf "%d", u * 100 / t; else print 0
    }'
}

swap_used_gb() { sysctl -n vm.swapusage 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "used") printf "%.0f", ($(i + 2) + 0) / 1024}'; }

# Interactive Claude Code sessions: the CLI binary attached to a terminal (tmux included).
session_count() { ps -axo tty=,comm= 2>/dev/null | awk '$1 != "??" && $2 == "claude"' | wc -l | tr -d ' '; }

mcp_process_count() { ps -axo command= 2>/dev/null | grep -Ec '[m]cp|[p]laywright|[m]arkitdown|[c]ontext7|[r]ef-tools|shadcn@' | tr -d ' '; }

service_armed() { launchctl list 2>/dev/null | awk '{print $3}' | grep -qx "$1"; }

server_up() { command -v tmux >/dev/null 2>&1 && tmux has-session -t "$RC_SESSION" 2>/dev/null; }

# Any HTTP answer means the network is up — no -f: claude.ai answers curl with 403
# and api.anthropic.com's root with 404, and both mean "reachable".
have_net() { curl -m 8 -s -o /dev/null https://api.anthropic.com 2>/dev/null; }

idle_seconds() { ioreg -c IOHIDSystem 2>/dev/null | awk '/HIDIdleTime/ {print int($NF / 1000000000); exit}'; }

# The key exists only while the screen is locked; absent means unlocked.
screen_locked() {
    [ "$(ioreg -n Root -d1 -a 2>/dev/null | plutil -extract IOConsoleUsers.0.CGSSessionScreenIsLocked raw - 2>/dev/null)" = "true" ]
}

# ── Services ─────────────────────────────────────────────────────

run_presence() {
    trap 'rm -f "$PRESENCE_FILE"; exit 0' TERM INT
    log "presence started (idle limit ${IDLE_LIMIT}s, file $PRESENCE_FILE)"
    local idle
    while :; do
        idle="$(idle_seconds)"
        if ! screen_locked && [ "${idle:-999999}" -lt "$IDLE_LIMIT" ]; then
            [ -f "$PRESENCE_FILE" ] || : > "$PRESENCE_FILE"
        else
            rm -f "$PRESENCE_FILE"
        fi
        sleep 15
    done
}

# Supervisor: the server exits after ~10 minutes offline (documented), so keep it up,
# back off while it keeps dying young, and never start it without a network.
run_server() {
    command -v tmux >/dev/null 2>&1 || { log "server: tmux missing — run devices.sh --install"; sleep 3600; return 0; }
    log "server supervisor started (session $RC_SESSION, capacity $RC_CAPACITY, mode $RC_MODE)"
    local started=0 wait=60
    while :; do
        if ! tmux has-session -t "$RC_SESSION" 2>/dev/null; then
            if [ "$started" -gt 0 ] && [ $(( $(date +%s) - started )) -lt 180 ]; then
                wait=$(( wait * 2 )); [ "$wait" -gt 900 ] && wait=900
            else
                wait=60
            fi
            if have_net; then
                tmux new-session -d -s "$RC_SESSION" -c "$KUN_DIR" "/bin/bash '$SELF' --serve-once"
                started="$(date +%s)"
                log "server started in tmux:$RC_SESSION (next check in ${wait}s)"
            else
                log "server: offline — retry in ${wait}s"
            fi
        fi
        sleep "$wait"
    done
}

# What tmux runs: the interactive shell's environment, then the server itself.
serve_once() {
    set -a
    [ -f "$CLAUDE_DIR/.env" ] && . "$CLAUDE_DIR/.env"
    set +a
    export PATH="$SERVICE_PATH:$PATH"
    cd "$KUN_DIR" || exit 1
    # same-dir, never worktree: databayt works on main in one tree (github-workflow rule).
    exec claude remote-control \
        --name "$RC_NAME" \
        --remote-control-session-name-prefix "$RC_PREFIX" \
        --permission-mode "$RC_MODE" \
        --capacity "$RC_CAPACITY" \
        --spawn same-dir
}

render_plist() {  # render_plist <label> <mode>
    cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$1</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>$SELF</string>
		<string>$2</string>
	</array>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>$SERVICE_PATH</string>
	</dict>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>ThrottleInterval</key>
	<integer>30</integer>
	<key>ProcessType</key>
	<string>Background</string>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/$1.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/$1.err</string>
</dict>
</plist>
PLIST
}

arm() {  # arm <label> <mode>
    local path="$HOME/Library/LaunchAgents/$1.plist" rendered
    rendered="$(render_plist "$1" "$2")"
    if [ -f "$path" ] && [ "$rendered" = "$(cat "$path")" ] && service_armed "$1"; then
        echo "  ✓ $1 already armed"
        return 0
    fi
    printf '%s\n' "$rendered" > "$path"
    launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$path" 2>/dev/null || launchctl load "$path" 2>/dev/null || true
    echo "  ✓ $1 armed"
    log "$1 armed"
}

disarm() {
    launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
    rm -f "$HOME/Library/LaunchAgents/$1.plist"
    echo "  ✓ $1 disarmed"
    log "$1 disarmed"
}

do_install() {
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
    [ -f "$SELF" ] || { echo "devices.sh is not installed at $SELF — run kun's setup.sh first" >&2; return 1; }
    if ! command -v tmux >/dev/null 2>&1; then
        if command -v brew >/dev/null 2>&1; then
            echo "  installing tmux (keeps the Remote Control server alive)…"
            brew install tmux >/dev/null 2>&1 || { echo "  ✗ brew install tmux failed — server not armed" >&2; }
        else
            echo "  ✗ tmux missing and Homebrew unavailable — server not armed" >&2
        fi
    fi
    arm "$PRESENCE_LABEL" --presence
    command -v tmux >/dev/null 2>&1 && arm "$SERVER_LABEL" --server
    echo
    do_status
}

do_uninstall() {
    disarm "$PRESENCE_LABEL"
    disarm "$SERVER_LABEL"
    command -v tmux >/dev/null 2>&1 && tmux kill-session -t "$RC_SESSION" 2>/dev/null
    rm -f "$PRESENCE_FILE"
    echo "  ✓ server stopped, presence file removed (pushes go out as Claude Code's default)"
}

# ── Reports ──────────────────────────────────────────────────────

do_brief() {
    local free swap sessions
    free="$(disk_free_gb)"; swap="$(swap_used_pct)"; sessions="$(session_count)"
    if [ -n "$free" ] && [ "$free" -lt "$WARN_DISK_GB" ]; then
        echo "Mac disk: ${free} GB free (under ${WARN_DISK_GB}) — builds and swap fail near zero. Tell Abdout; run: bash ~/.claude/scripts/devices.sh --status"
    fi
    if [ -n "$sessions" ] && [ "$sessions" -gt "$WARN_SESSIONS" ] && [ "${swap:-0}" -ge "$WARN_SWAP_PCT" ]; then
        echo "Mac memory: ${sessions} Claude sessions open with swap ${swap}% used — suggest closing idle ones; the phone reaches the Mac through the $RC_SESSION Remote Control server."
    fi
    if service_armed "$SERVER_LABEL" && ! server_up; then
        echo "Remote Control server ($RC_SESSION) is down — the phone cannot start sessions on this Mac. Check: bash ~/.claude/scripts/devices.sh --status"
    fi
    return 0
}

mark() { if [ "$1" = ok ]; then printf '  ✓ %s\n' "$2"; else printf '  ✗ %s\n' "$2"; fi; }

do_status() {
    local free swap swapgb sessions mcp awake ac_sleep
    free="$(disk_free_gb)"; swap="$(swap_used_pct)"; swapgb="$(swap_used_gb)"
    sessions="$(session_count)"; mcp="$(mcp_process_count)"
    echo "── Mac"
    [ "${free:-0}" -ge "$WARN_DISK_GB" ] && mark ok "disk: ${free} GB free" || mark bad "disk: ${free} GB free (keep ≥ ${WARN_DISK_GB} GB — builds, swap and Docker need it)"
    [ "${swap:-0}" -lt "$WARN_SWAP_PCT" ] && mark ok "swap: ${swapgb} GB used (${swap}%)" || mark bad "swap: ${swapgb} GB used (${swap}%) — memory pressure; close idle sessions"
    [ "${sessions:-0}" -le "$WARN_SESSIONS" ] && mark ok "Claude sessions open: $sessions" || mark bad "Claude sessions open: $sessions (each holds ~10 MCP processes; keep ≤ $WARN_SESSIONS)"
    echo "    MCP helper processes: $mcp"
    ac_sleep="$(pmset -g custom 2>/dev/null | awk '/^AC Power/ {ac=1} ac && $1 == "sleep" {print $2; exit}')"
    [ "$ac_sleep" = "0" ] && mark ok "on power the Mac never idle-sleeps (lid open)" || mark bad "on power the Mac idle-sleeps after ${ac_sleep} min — the phone loses it"
    awake="$(desktop_pref keepAwakeEnabled)"
    [ "$awake" = "true" ] && mark ok "Claude Desktop keeps the Mac awake" || mark bad "Claude Desktop keep-awake is off (Settings → General → Keep computer awake)"

    echo "── Phone lane (Remote Control)"
    setting_true remoteControlAtStartup && mark ok "every session registers with Remote Control" || mark bad "remoteControlAtStartup is off — /config → Enable Remote Control for all sessions"
    setting_true agentPushNotifEnabled && mark ok "push when Claude decides" || mark bad "push when Claude decides is off — /config"
    setting_true inputNeededNotifEnabled && mark ok "push when actions are required" || mark bad "push when actions are required is off — /config"
    if service_armed "$PRESENCE_LABEL"; then
        if [ -f "$PRESENCE_FILE" ]; then mark ok "presence: at the Mac → pushes held"; else mark ok "presence: away → pushes go to the phone"; fi
    else
        mark bad "presence service not armed — run: bash ~/.claude/scripts/devices.sh --install"
    fi
    if server_up; then
        mark ok "Remote Control server up (tmux:$RC_SESSION, \"$RC_NAME\", capacity $RC_CAPACITY, $RC_MODE) — attach: tmux attach -t $RC_SESSION"
    elif service_armed "$SERVER_LABEL"; then
        mark bad "Remote Control server armed but not running — see $LOG_DIR/devices-$(date '+%Y-%m-%d').log"
    else
        mark bad "Remote Control server not armed — run: bash ~/.claude/scripts/devices.sh --install"
    fi
    echo "── Only you can flip (phone + desktop)"
    echo "    iPhone: Settings → Notifications → Claude → Allow, Time Sensitive; add Claude to your Focus allow-list"
    echo "    iPhone: open the Claude app once after this so /config stops saying \"No mobile registered\""
    echo "    Desktop: Settings → Claude Code → Enable remote control by default"
    echo "    Desktop: Settings → General → Computer use (plus Accessibility + Screen Recording) for Dispatch/GUI work"
    return 0
}

main "$@"; exit $?
