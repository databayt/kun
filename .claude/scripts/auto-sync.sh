#!/bin/bash
# Kun auto-sync — real-time bidirectional git sync for all databayt repos.
# Watches each repo at ~/<name> for local commits (push instantly) and polls
# origin every 60s for new upstream commits (pull --rebase). Per-repo isolation:
# one repo's failure never stops the others.
#
# Usage: auto-sync.sh [--poll-interval N] [--debounce N] [--dry-run] [--once] [--verbose]
#
# Background install: auto-sync-install.sh --install
# Logs: ~/.claude/logs/auto-sync-<date>.log
#
# Requires: bash 3.2+, git. Optional: fswatch (macOS) or inotifywait (Linux)
# for true real-time. Without them, falls back to a polling loop only.

set -uo pipefail

POLL_INTERVAL=60
DEBOUNCE=2
DRY_RUN=false
ONCE=false
VERBOSE=false

while [ $# -gt 0 ]; do
    case "$1" in
        --poll-interval) POLL_INTERVAL="$2"; shift 2 ;;
        --debounce)      DEBOUNCE="$2";      shift 2 ;;
        --dry-run)       DRY_RUN=true;       shift ;;
        --once)          ONCE=true;          shift ;;
        --verbose|-v)    VERBOSE=true;       shift ;;
        *) shift ;;
    esac
done

LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/auto-sync-$(date '+%Y-%m-%d').log"

write_log() {
    local repo="$1" level="$2" msg="$3"
    local line
    line=$(printf '[%s] [%-5s] [%-20s] %s' "$(date '+%H:%M:%S')" "$level" "$repo" "$msg")
    echo "$line" >> "$LOG_FILE"
    case "$level" in
        PUSH|PULL|WARN|ERROR) echo "$line" ;;
        *) [ "$VERBOSE" = true ] && echo "$line" ;;
    esac
}

# ── OS + watcher detection ─────────────────────────────────────────
OS="$(uname -s)"
WATCHER='none'
case "$OS" in
    Darwin) command -v fswatch     >/dev/null 2>&1 && WATCHER='fswatch' ;;
    Linux)  command -v inotifywait >/dev/null 2>&1 && WATCHER='inotifywait' ;;
esac

# ── Get repo list ──────────────────────────────────────────────────
get_repos() {
    local memory="$HOME/.claude/memory/repositories.json"
    if [ -f "$memory" ] && command -v jq >/dev/null 2>&1; then
        jq -r '.repos | to_entries[] | "\(.key) \(.value)"' "$memory" 2>/dev/null | \
            sed "s|\$HOME|$HOME|g; s|\$env:USERPROFILE|$HOME|g; s|\\\\|/|g"
    else
        for name in codebase kun shadcn radix hogwarts souq mkan shifa swift-app distributed-computer marketing; do
            echo "$name $HOME/$name"
        done
    fi
}

# Filter to cloned repos only
declare -a REPO_NAMES REPO_PATHS
while IFS=' ' read -r name path; do
    if [ -d "$path/.git/refs/heads" ]; then
        REPO_NAMES+=("$name")
        REPO_PATHS+=("$path")
    fi
done < <(get_repos)

if [ "${#REPO_NAMES[@]}" -eq 0 ]; then
    write_log _main_ ERROR 'no cloned repos found — run sync-repos.sh first'
    exit 1
fi

write_log _main_ INFO "auto-sync starting · poll=${POLL_INTERVAL}s · debounce=${DEBOUNCE}s · dry-run=$DRY_RUN · watcher=$WATCHER"
write_log _main_ INFO "watching ${#REPO_NAMES[@]} repos"
for i in "${!REPO_NAMES[@]}"; do
    write_log "${REPO_NAMES[$i]}" INFO "tracking ${REPO_PATHS[$i]}"
done

# ── Per-repo operations ────────────────────────────────────────────
push_repo() {
    local name="$1" path="$2"
    cd "$path" || return
    local ahead
    ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
    [ "$ahead" -eq 0 ] && return
    if [ "$DRY_RUN" = true ]; then
        write_log "$name" PUSH "[dry-run] $ahead commit(s) ready to push"
        return
    fi
    if git push --quiet 2>/dev/null; then
        write_log "$name" PUSH "$ahead commit(s) pushed"
    else
        write_log "$name" WARN "push failed (auth, conflict, or network)"
    fi
}

pull_repo() {
    local name="$1" path="$2"
    cd "$path" || return
    git fetch --quiet 2>/dev/null || true
    git rev-parse '@{u}' >/dev/null 2>&1 || { write_log "$name" WARN 'no upstream — skipping pull'; return; }
    local behind dirty
    behind=$(git rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)
    [ "$behind" -eq 0 ] && return
    dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$dirty" -gt 0 ]; then
        write_log "$name" WARN "$behind behind but working tree dirty — skipping pull"
        return
    fi
    if [ "$DRY_RUN" = true ]; then
        write_log "$name" PULL "[dry-run] $behind commit(s) ready to pull"
        return
    fi
    if git pull --rebase --quiet 2>/dev/null; then
        write_log "$name" PULL "$behind commit(s) rebased"
    else
        write_log "$name" ERROR 'pull failed — rebase aborted'
        git rebase --abort 2>/dev/null || true
    fi
}

# ── File-watcher background job (push side) ────────────────────────
# Tracks per-repo last-event timestamps in a temp dir (avoids subshell scope).
EVENT_DIR=$(mktemp -d)
trap 'rm -rf "$EVENT_DIR"; jobs -p | xargs -r kill 2>/dev/null' EXIT

start_watcher() {
    local name="$1" path="$2"
    case "$WATCHER" in
        fswatch)
            ( fswatch -0 "$path/.git/refs/heads" 2>/dev/null | \
              while IFS= read -r -d '' _; do date +%s > "$EVENT_DIR/$name"; done ) &
            ;;
        inotifywait)
            ( inotifywait -m -q -e modify,create,move "$path/.git/refs/heads" 2>/dev/null | \
              while read -r _; do date +%s > "$EVENT_DIR/$name"; done ) &
            ;;
        none)
            : # No watcher → push-on-poll only
            ;;
    esac
}

for i in "${!REPO_NAMES[@]}"; do
    start_watcher "${REPO_NAMES[$i]}" "${REPO_PATHS[$i]}"
done

# ── Main loop ──────────────────────────────────────────────────────
last_poll=$(date +%s)
while true; do
    sleep 1
    now=$(date +%s)

    # 1. Debounced push from file-watcher events
    for i in "${!REPO_NAMES[@]}"; do
        name="${REPO_NAMES[$i]}"
        path="${REPO_PATHS[$i]}"
        event_file="$EVENT_DIR/$name"
        [ -f "$event_file" ] || continue
        event_ts=$(cat "$event_file" 2>/dev/null || echo 0)
        [ "$event_ts" -eq 0 ] && continue
        elapsed=$((now - event_ts))
        if [ "$elapsed" -ge "$DEBOUNCE" ] && [ "$elapsed" -lt 600 ]; then
            rm -f "$event_file"
            push_repo "$name" "$path"
        fi
    done

    # 2. Periodic poll: fetch + pull (and push as fallback when no watcher)
    if [ $((now - last_poll)) -ge "$POLL_INTERVAL" ]; then
        for i in "${!REPO_NAMES[@]}"; do
            pull_repo "${REPO_NAMES[$i]}" "${REPO_PATHS[$i]}"
            [ "$WATCHER" = 'none' ] && push_repo "${REPO_NAMES[$i]}" "${REPO_PATHS[$i]}"
        done
        last_poll=$now
        [ "$ONCE" = true ] && break
    fi
done
