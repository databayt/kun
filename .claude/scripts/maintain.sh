#!/bin/bash
# Kun Maintain — the machine supervises itself.
# Daily heartbeat: pull ~/kun → refresh ~/.claude (setup.sh) → health check →
# state file → weekly/on-RED report to the Config Health Dashboard issue.
#
# Usage: bash ~/.claude/scripts/maintain.sh [--run|--install|--uninstall|--status] [--quiet]
#   --run        execute one heartbeat (default)
#   --install    arm the scheduler (macOS launchd / Linux cron), idempotent
#   --uninstall  disarm the scheduler
#   --status     print last state + scheduler status
#
# The run path never dies halfway: every step records its outcome into
# ~/.claude/.kun-maintain.json and the script always exits 0 — the state file
# (read by the session-maintain-status hook and health.sh) carries the verdict.
# Windows mirror: maintain.ps1 — keep the two in lockstep.

# Self-reexec: step_setup re-copies this very file into ~/.claude/scripts/
# while it is running, and bash reads scripts lazily — cp truncates the
# running file mid-read. Execute from a temp copy instead.
if [ -z "${KUN_MAINTAIN_REEXEC:-}" ]; then
    _tmp="$(mktemp -t kun-maintain.XXXXXX)" || exit 1
    cp "$0" "$_tmp"
    KUN_MAINTAIN_REEXEC=1 KUN_MAINTAIN_SELF="$_tmp" exec bash "$_tmp" "$@"
fi
trap 'rm -f "${KUN_MAINTAIN_SELF:-}" 2>/dev/null; true' EXIT

CLAUDE_DIR="$HOME/.claude"
KUN_DIR="$HOME/kun"
STATE_FILE="$CLAUDE_DIR/.kun-maintain.json"
LOCK_DIR="$CLAUDE_DIR/.kun-maintain.lock"
LOG_DIR="$CLAUDE_DIR/logs"
PLIST_LABEL="com.databayt.kun-maintain"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

MODE="--run"
QUIET=0
for arg in "$@"; do
    case "$arg" in
        --run|--install|--uninstall|--status) MODE="$arg" ;;
        --quiet) QUIET=1 ;;
        *) echo "Unknown flag: $arg (use --run|--install|--uninstall|--status [--quiet])" >&2; exit 1 ;;
    esac
done

log() {
    mkdir -p "$LOG_DIR"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/maintain-$(date '+%Y-%m-%d').log"
    [ "$QUIET" = 1 ] || echo "$1"
}

rotate_logs() { find "$LOG_DIR" -name 'maintain-*.log' -mtime +30 -delete 2>/dev/null || true; }

# Probe the one host that matters, bounded — no DNS-only false positives.
have_net() { curl -m 8 -sfI https://github.com >/dev/null 2>&1; }

# ── Scheduler: install / uninstall ───────────────────────────────

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
		<string>$HOME/.claude/scripts/maintain.sh</string>
		<string>--run</string>
		<string>--quiet</string>
	</array>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin</string>
		<key>KUN_MAINTAIN_VIA_LAUNCHD</key>
		<string>1</string>
	</dict>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>9</integer>
		<key>Minute</key>
		<integer>17</integer>
	</dict>
	<key>StandardOutPath</key>
	<string>$HOME/.claude/logs/maintain-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$HOME/.claude/logs/maintain-launchd.err</string>
	<key>RunAtLoad</key>
	<false/>
</dict>
</plist>
PLIST
}

install_launchd() {
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
    local rendered
    rendered="$(render_plist)"
    if [ -f "$PLIST_PATH" ] && [ "$rendered" = "$(cat "$PLIST_PATH")" ]; then
        log "maintain heartbeat already armed (launchd, daily 09:17)"
        return 0
    fi
    printf '%s\n' "$rendered" > "$PLIST_PATH"
    # Re-entrancy: when THIS run was started by launchd (setup → maintain
    # --install), bootout would kill the running job. Write-only and defer.
    if [ -n "${KUN_MAINTAIN_VIA_LAUNCHD:-}" ]; then
        log "plist updated — reload deferred to next login (running under launchd)"
        return 0
    fi
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH" 2>/dev/null || true
    log "maintain heartbeat armed (launchd, daily 09:17)"
}

install_cron() {
    command -v crontab >/dev/null 2>&1 || { log "crontab not available — heartbeat not armed"; return 0; }
    local line="17 9 * * * /bin/bash $HOME/.claude/scripts/maintain.sh --run --quiet # kun-maintain"
    if crontab -l 2>/dev/null | grep -Fxq "$line"; then
        log "maintain heartbeat already armed (cron, daily 09:17)"
        return 0
    fi
    ( crontab -l 2>/dev/null | grep -v '# kun-maintain'; echo "$line" ) | crontab -
    log "maintain heartbeat armed (cron, daily 09:17)"
}

do_install() {
    case "$(uname -s)" in
        Darwin) install_launchd ;;
        Linux)  install_cron ;;
        *)      log "no scheduler for $(uname -s) — Windows uses maintain.ps1 -Install" ;;
    esac
}

do_uninstall() {
    case "$(uname -s)" in
        Darwin)
            launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
            rm -f "$PLIST_PATH"
            log "maintain heartbeat disarmed (launchd)"
            ;;
        Linux)
            crontab -l 2>/dev/null | grep -v '# kun-maintain' | crontab - 2>/dev/null || true
            log "maintain heartbeat disarmed (cron)"
            ;;
    esac
}

do_status() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    else
        echo "no state — maintain has not run yet"
    fi
    case "$(uname -s)" in
        Darwin)
            launchctl list 2>/dev/null | grep -q "$PLIST_LABEL" \
                && echo "scheduler: launchd armed ($PLIST_LABEL, daily 09:17)" \
                || echo "scheduler: not armed — run: bash ~/.claude/scripts/maintain.sh --install"
            ;;
        Linux)
            crontab -l 2>/dev/null | grep -q '# kun-maintain' \
                && echo "scheduler: cron armed (daily 09:17)" \
                || echo "scheduler: not armed — run: bash ~/.claude/scripts/maintain.sh --install"
            ;;
    esac
}

# ── The heartbeat ────────────────────────────────────────────────

PULLED="skipped"
HEAD_REV=""
SETUP_STATUS="skipped"
VERDICT="GREEN"
HEALTH_LINE=""
DISK_FREE_GB=0
REPORT_STATUS="not-due"
LAST_REPORT_TS=""

step_pull() {
    if [ ! -d "$KUN_DIR/.git" ]; then
        PULLED="no-repo"
    elif [ -e "$KUN_DIR/.git/rebase-merge" ] || [ -e "$KUN_DIR/.git/rebase-apply" ] || [ -e "$KUN_DIR/.git/MERGE_HEAD" ]; then
        # A human is mid-rebase/merge — never touch the tree under them.
        PULLED="skipped-mid-operation"
    elif [ "$(git -C "$KUN_DIR" symbolic-ref --short HEAD 2>/dev/null)" != "main" ]; then
        PULLED="skipped-branch"
    elif ! have_net; then
        PULLED="offline"
    else
        local before after
        before=$(git -C "$KUN_DIR" rev-parse HEAD 2>/dev/null)
        if git -C "$KUN_DIR" pull --rebase --autostash --quiet origin main >/dev/null 2>&1; then
            after=$(git -C "$KUN_DIR" rev-parse HEAD 2>/dev/null)
            if [ "$before" = "$after" ]; then PULLED="current"; else PULLED="updated"; fi
        else
            git -C "$KUN_DIR" rebase --abort >/dev/null 2>&1
            PULLED="error"
        fi
    fi
    HEAD_REV=$(git -C "$KUN_DIR" rev-parse --short HEAD 2>/dev/null || echo "")
    log "pull: $PULLED (${HEAD_REV:-no-rev})"
}

step_setup() {
    if [ ! -f "$KUN_DIR/.claude/scripts/setup.sh" ]; then
        SETUP_STATUS="no-setup"
    elif [ ! -f "$CLAUDE_DIR/.kun-role" ]; then
        # setup.sh with no role prints usage — don't mistake that for a refresh
        SETUP_STATUS="no-role"
    elif bash "$KUN_DIR/.claude/scripts/setup.sh" --quiet >/dev/null 2>&1; then
        SETUP_STATUS="ok"
    else
        SETUP_STATUS="error"
    fi
    log "setup: $SETUP_STATUS"
}

step_health() {
    local health_script="$CLAUDE_DIR/scripts/health.sh"
    [ -f "$health_script" ] || health_script="$KUN_DIR/.claude/scripts/health.sh"
    if [ -f "$health_script" ]; then
        # Word-match the status line ("healthy" / "N warnings" / "N errors")
        # — encoding-immune, unlike the emoji icons; mirrors maintain.ps1.
        HEALTH_LINE=$(bash "$health_script" 2>/dev/null | head -1)
        case "$HEALTH_LINE" in
            *healthy*) VERDICT="GREEN" ;;
            *warning*) VERDICT="YELLOW" ;;
            *error*)   VERDICT="RED" ;;
            *)         VERDICT="YELLOW"; HEALTH_LINE="${HEALTH_LINE:-health.sh produced no status line}" ;;
        esac
    else
        VERDICT="YELLOW"
        HEALTH_LINE="health.sh missing"
    fi
    log "health: $VERDICT ($HEALTH_LINE)"
}

disk_free_gb() { df -Pk "$HOME" 2>/dev/null | awk 'NR==2 {print int($4/1048576)}'; }

# Only caches that rebuild themselves — nothing a running container, a repo or an
# installed tool needs. Each command is optional; a failure just skips that cache.
prune_caches() {
    command -v uv >/dev/null 2>&1 && UV_LOCK_TIMEOUT=10 uv cache prune >/dev/null 2>&1 && log "  pruned the uv cache"
    # sim takes, media scratch and assembled recordings past their keep window (engine.json → media)
    local media="$HOME/.claude/skills/edit/scripts/media.sh"
    [ -x "$media" ] && "$media" purge >/dev/null 2>&1 && log "  purged stale media render caches"
    command -v pnpm >/dev/null 2>&1 && pnpm store prune >/dev/null 2>&1 && log "  pruned the pnpm store"
    # Cloudflare build copies (~/.cache/cf-build/<repo>): every deploy rm -rf's its own
    # folder before building, so an idle one is a pure leftover — 29 GB of them on
    # 2026-11-01. Folders only, idle past devices.hygiene.cf_build_keep_days; files and
    # anything named *env* (production dotenvs live here) are never touched.
    local cfb="$HOME/.cache/cf-build" d
    if [ -d "$cfb" ]; then
        while IFS= read -r d; do
            case "$(basename "$d")" in *env*) continue ;; esac
            # -mtime is portable across BSD find, GNU find and bfs (-newermt "-N days" is
            # not: bfs rejects it, the empty answer read as idle, and fresh folders went).
            # Fail safe: if find errors, we cannot tell, so nothing is removed.
            local recent rc
            recent=$(find "$d" -type f -mtime "-${CF_BUILD_KEEP_DAYS}" -print -quit 2>/dev/null); rc=$?
            [ "$rc" -ne 0 ] && continue
            [ -n "$recent" ] && continue
            rm -rf -- "$d" && log "  removed idle build copy $(basename "$d")"
        done < <(find "$cfb" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
    fi
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        docker builder prune -af --max-used-space "${DOCKER_CACHE_CAP_GB}gb" >/dev/null 2>&1 \
            && log "  capped the Docker build cache at ${DOCKER_CACHE_CAP_GB}GB"
        docker image prune -af --filter "until=${DOCKER_IMAGE_AGE}" >/dev/null 2>&1 \
            && log "  removed Docker images older than ${DOCKER_IMAGE_AGE} that no container uses"
        # A VM disk gives freed blocks back to the host only after a TRIM.
        command -v colima >/dev/null 2>&1 && colima status >/dev/null 2>&1 \
            && colima ssh -- sudo fstrim -a >/dev/null 2>&1 && log "  trimmed the colima disk"
    fi
}

step_disk() {
    DISK_FREE_GB=$(disk_free_gb)
    DISK_FREE_GB="${DISK_FREE_GB:-0}"
    DISK_PRUNED="no"
    local engine="$KUN_DIR/.claude/engine.json" floor=30 before
    DOCKER_CACHE_CAP_GB=8; DOCKER_IMAGE_AGE=72h; CF_BUILD_KEEP_DAYS=3
    if command -v jq >/dev/null 2>&1 && [ -f "$engine" ]; then
        floor=$(jq -r '.devices.hygiene.prune_below_gb // 30' "$engine")
        DOCKER_CACHE_CAP_GB=$(jq -r '.devices.hygiene.docker_cache_cap_gb // 8' "$engine")
        DOCKER_IMAGE_AGE=$(jq -r '.devices.hygiene.docker_image_age // "72h"' "$engine")
        CF_BUILD_KEEP_DAYS=$(jq -r '.devices.hygiene.cf_build_keep_days // 3' "$engine")
    fi
    if [ "$DISK_FREE_GB" -lt "$floor" ]; then
        before="$DISK_FREE_GB"
        log "disk: ${before}GB free, under ${floor}GB — pruning caches"
        prune_caches
        DISK_FREE_GB=$(disk_free_gb); DISK_FREE_GB="${DISK_FREE_GB:-0}"
        DISK_PRUNED="${before}GB->${DISK_FREE_GB}GB"
    fi
    if [ "$DISK_FREE_GB" -lt 5 ] && [ "$VERDICT" = "GREEN" ]; then
        VERDICT="YELLOW"
        log "disk: ${DISK_FREE_GB}GB free — low, verdict floored to YELLOW"
    else
        log "disk: ${DISK_FREE_GB}GB free"
    fi
}

step_aware() {
    # Refresh kun's SENSE snapshot (~/.claude/state/aware.json + aware.md). On machines
    # without the 30-min launchd refresher (every teammate), this daily run is what keeps
    # awareness, the reports cache and #133's awareness block current. Zero tokens.
    local aware="$KUN_DIR/.claude/scripts/aware.mjs" resolver="$KUN_DIR/.claude/scripts/resolve.mjs"
    # the prompt router's index (repos, blocks, aliases) — rebuilt daily so new repos and
    # blocks route without anyone remembering to run --build
    if command -v node >/dev/null 2>&1 && [ -f "$resolver" ]; then
        KUN_DIR="$KUN_DIR" node "$resolver" --build >/dev/null 2>&1 && log "resolve: index rebuilt" || log "resolve: index build failed (non-fatal)"
    fi
    if command -v node >/dev/null 2>&1 && [ -f "$aware" ]; then
        if KUN_DIR="$KUN_DIR" node "$aware" --refresh --quiet >/dev/null 2>&1; then log "aware: snapshot refreshed"; else log "aware: refresh failed (non-fatal)"; fi
    else
        log "aware: node or aware.mjs missing — skipped"
    fi
}

step_improve() {
    # kun's LEARN layer, detection half: zero tokens. Applies only machine-local SAFE fixes
    # (env file permissions, missing labels, the approved prune); improve.mjs itself only
    # rewrites the shared Engine decisions issue from the owner Mac.
    local improve="$KUN_DIR/.claude/scripts/improve.mjs"
    command -v node >/dev/null 2>&1 && [ -f "$improve" ] || { log "improve: skipped (no node or improve.mjs)"; return; }
    KUN_DIR="$KUN_DIR" node "$improve" --apply-safe --issue >>"$LOG_DIR/maintain-$(date '+%Y-%m-%d').log" 2>&1 \
        && log "improve: findings refreshed" || log "improve: run failed (non-fatal)"
}

step_runs() {
    # Every scheduled job (engine.json → jobs): red = crashed or recorded a fail,
    # stale = no log within 2x its cadence. Either floors the verdict to YELLOW and
    # sends ONE digest (desktop + Slack DM via hermes) — the run itself, not the
    # SessionStart hook, is what reaches Abdout when he isn't at a session.
    local runs_script="$CLAUDE_DIR/scripts/runs.sh" json
    [ -f "$runs_script" ] || runs_script="$KUN_DIR/.claude/scripts/runs.sh"
    RUNS_RED=""; RUNS_STALE=""
    [ -f "$runs_script" ] || { log "runs: runs.sh missing — skipped"; return; }
    json=$(KUN_DIR="$KUN_DIR" bash "$runs_script" --json 2>/dev/null)
    RUNS_RED=$(echo "$json" | python3 -c "import json,sys;print(' '.join(json.load(sys.stdin).get('red',[])))" 2>/dev/null)
    RUNS_STALE=$(echo "$json" | python3 -c "import json,sys;print(' '.join(json.load(sys.stdin).get('stale',[])))" 2>/dev/null)
    if [ -n "$RUNS_RED$RUNS_STALE" ]; then
        [ "$VERDICT" = "GREEN" ] && VERDICT="YELLOW"
        # Where aware's refresher runs it owns alerts (transition-only, once each), so the
        # daily digest would repeat what was already sent; elsewhere the digest stays.
        if [ -f "$HOME/Library/LaunchAgents/com.databayt.kun-aware.plist" ]; then
            log "runs: red [${RUNS_RED}] stale [${RUNS_STALE}] — verdict floored to YELLOW (aware owns the alerts)"
        else
            log "runs: red [${RUNS_RED}] stale [${RUNS_STALE}] — verdict floored to YELLOW, digest sent"
            KUN_DIR="$KUN_DIR" bash "$runs_script" --notify >/dev/null 2>&1 || true
        fi
    else
        log "runs: all jobs ok"
    fi
}

load_prev_state() {
    # Carry last_report_ts across runs BEFORE the provisional write clobbers it.
    [ -f "$STATE_FILE" ] && LAST_REPORT_TS=$(python3 -c "import json;print(json.load(open('$STATE_FILE')).get('last_report_ts',''))" 2>/dev/null)
}

step_report() {
    # Due weekly (state-based, not weekday-based — machines off on Mondays
    # still report) or immediately on RED. Needs gh, auth, and network.
    local due=0 now_epoch last_epoch age_days
    now_epoch=$(date +%s)
    if [ "$VERDICT" = "RED" ] || [ -z "$LAST_REPORT_TS" ]; then
        due=1
    else
        last_epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$LAST_REPORT_TS" +%s 2>/dev/null || date -u -d "$LAST_REPORT_TS" +%s 2>/dev/null || echo 0)
        age_days=$(( (now_epoch - last_epoch) / 86400 ))
        [ "$age_days" -ge 6 ] && due=1
    fi
    if [ "$due" != 1 ]; then
        REPORT_STATUS="not-due"
    elif [ "$PULLED" = "offline" ] || ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
        REPORT_STATUS="skipped-unauth-or-offline"
    else
        local health_script="$CLAUDE_DIR/scripts/health.sh"
        [ -f "$health_script" ] || health_script="$KUN_DIR/.claude/scripts/health.sh"
        if bash "$health_script" --report >/dev/null 2>&1; then
            REPORT_STATUS="posted"
            LAST_REPORT_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
        else
            REPORT_STATUS="error"
        fi
    fi
    log "report: $REPORT_STATUS"
}

write_state() {
    mkdir -p "$CLAUDE_DIR"
    python3 - "$STATE_FILE" <<PYEOF
import json, os, sys, time
state = {
    "schema": 1,
    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "host": "$(hostname -s 2>/dev/null || echo unknown)",
    "verdict": "$VERDICT",
    "pulled": "$PULLED",
    "head": "$HEAD_REV",
    "setup": "$SETUP_STATUS",
    "disk_free_gb": ${DISK_FREE_GB:-0},
    "disk_pruned": "${DISK_PRUNED:-no}",
    "runs_red": "${RUNS_RED:-}",
    "runs_stale": "${RUNS_STALE:-}",
    "report": "$REPORT_STATUS",
    "last_report_ts": "$LAST_REPORT_TS",
}
path = sys.argv[1]
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(state, f, indent=2)
    f.write("\n")
os.replace(tmp, path)
PYEOF
    log "state: $STATE_FILE ($VERDICT)"
}

notify() {
    # RED only — GREEN/YELLOW stay silent; the SessionStart hook carries the nag.
    if [ "$VERDICT" = "RED" ] && [ "$(uname -s)" = "Darwin" ]; then
        osascript -e 'display notification "kun engine health RED — run: bash ~/.claude/scripts/health.sh" with title "Kun Maintain"' 2>/dev/null || true
    fi
}

do_run() {
    set +e
    mkdir -p "$CLAUDE_DIR" "$LOG_DIR"
    rotate_logs

    # One heartbeat at a time (atomic mkdir); reclaim locks older than 2h.
    if ! mkdir "$LOCK_DIR" 2>/dev/null; then
        local now mtime lock_age
        now=$(date +%s)
        mtime=$(stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR" 2>/dev/null || echo "$now")
        lock_age=$(( now - mtime ))
        if [ "$lock_age" -gt 7200 ]; then
            log "stale lock (${lock_age}s old) — reclaiming"
            rm -rf "$LOCK_DIR"
            mkdir "$LOCK_DIR" 2>/dev/null || { log "lock contention — exiting"; exit 0; }
        else
            log "another maintain run is in progress — exiting"
            exit 0
        fi
    fi
    trap 'rm -rf "$LOCK_DIR" 2>/dev/null; rm -f "${KUN_MAINTAIN_SELF:-}" 2>/dev/null; true' EXIT

    log "maintain run start (host: $(hostname -s 2>/dev/null || echo unknown))"
    load_prev_state
    # Provisional stamp so health.sh's heartbeat check doesn't warn on the
    # very first run (the check reads this state file mid-run).
    VERDICT="RUNNING"; write_state; VERDICT="GREEN"
    step_pull
    step_setup
    step_health
    step_disk
    step_aware
    step_improve
    step_runs
    step_report
    write_state
    notify
    log "maintain run done — verdict: $VERDICT"
    exit 0
}

case "$MODE" in
    --install)   do_install ;;
    --uninstall) do_uninstall ;;
    --status)    do_status ;;
    --run)       do_run ;;
esac
