#!/bin/bash
# dev.sh — start this repo's dev server detached, wait until it answers, open Chrome, report.
#
#   bash ~/.claude/bin/dev.sh [dir]     dir defaults to $CLAUDE_PROJECT_DIR, then the cwd
#
# The `dev` skill runs as a Haiku fork at low effort (lane: mechanical), so the work has to
# be one command that returns: a foreground `pnpm dev` never does. This script frees the
# port, starts the server with nohup, polls it, and prints one line the fork can pass on.
# Port 3000 always — apple (3001) and nike (3002) are the two standing exceptions.
# Installed at ~/.claude/bin/dev.sh; canonical copy in kun.
set -u

DIR="${1:-${CLAUDE_PROJECT_DIR:-$PWD}}"
cd "$DIR" 2>/dev/null || { echo "dev: no such directory: $DIR"; exit 1; }
[ -f package.json ] || { echo "dev: no package.json in $DIR"; exit 1; }
NAME=$(basename "$DIR")
PORT=3000
case "$NAME" in apple) PORT=3001 ;; nike) PORT=3002 ;; esac
URL="http://localhost:$PORT"
LOG="${TMPDIR:-/tmp}/kun-dev-$NAME.log"

PM=pnpm
if [ ! -f pnpm-lock.yaml ]; then
    [ -f package-lock.json ] && PM=npm
    [ -f yarn.lock ] && PM=yarn
    [ -f bun.lockb ] && PM=bun
fi
command -v "$PM" >/dev/null 2>&1 || { echo "dev: $PM is not installed"; exit 1; }

# Free the port: whatever listens there now is in the way, by Abdout's standing rule.
PIDS=$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')
if [ -n "${PIDS// /}" ]; then
    # shellcheck disable=SC2086
    kill -9 $PIDS 2>/dev/null
    echo "dev: freed port $PORT (pid ${PIDS% })"
    sleep 1
fi

: > "$LOG"
nohup "$PM" dev >> "$LOG" 2>&1 &
SERVER=$!
disown "$SERVER" 2>/dev/null || true

# Up to 90 s for the first answer (any HTTP status counts: the server is listening).
for _ in $(seq 1 90); do
    if ! kill -0 "$SERVER" 2>/dev/null; then
        echo "dev: the server exited before it answered — last lines of $LOG:"
        tail -n 15 "$LOG"
        exit 1
    fi
    if curl -s -o /dev/null --max-time 2 "$URL"; then
        case "$(uname -s)" in
            Darwin) open -g -a "Google Chrome" "$URL" 2>/dev/null || open -g "$URL" 2>/dev/null ;;   # -g: the tab is there, nothing jumps to the front
            Linux) command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 ;;
        esac
        echo "dev: $NAME is up at $URL (pid $SERVER, log $LOG)"
        exit 0
    fi
    sleep 1
done
echo "dev: no answer from $URL after 90 s — the server is still starting (pid $SERVER). Last lines of $LOG:"
tail -n 15 "$LOG"
exit 1
