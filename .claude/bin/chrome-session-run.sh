#!/bin/bash
# chrome-session-run.sh — the session-vault Chrome's process under launchd.
#
# Starts the vault HIDDEN (open -g -j: no window on screen, no focus taken) and stays alive
# for as long as that Chrome does, so launchd still sees one job. Automation works in it
# through background or hidden pages; the owner brings it up by clicking Chrome in the Dock,
# or with `chrome-debug.sh 9222 <url>` when a page needs his hands (a CAPTCHA, a code).
#
# The three throttling flags matter because a hidden window counts as occluded: without
# them Chrome slows timers and stops rendering in exactly the pages automation is using.
#
# Exit code: 1 when Chrome crashed (launchd brings it back), 0 on a normal quit (respected
# until the next login) — read from the profile's own exit_type.
PORT="${1:-9222}"
PROFILE="${2:-$HOME/.claude/chrome-debug-profile}"
APP="Google Chrome"

main_pid() { ps -axo pid=,command= | awk -v p="--remote-debugging-port=$PORT" 'index($0, p) && !index($0, "--type=") {print $1; exit}'; }

if [ -z "$(main_pid)" ]; then
    /usr/bin/open -g -j -n -a "$APP" --args \
        --remote-debugging-port="$PORT" '--remote-allow-origins=*' --user-data-dir="$PROFILE" \
        --no-first-run --no-default-browser-check --restore-last-session \
        --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling
fi
pid=""
for _ in $(seq 1 40); do pid="$(main_pid)"; [ -n "$pid" ] && break; sleep 1; done
[ -n "$pid" ] || { echo "$(date '+%F %T') vault did not start on :$PORT"; exit 1; }
echo "$(date '+%F %T') vault up on :$PORT (pid $pid), hidden"
while kill -0 "$pid" 2>/dev/null; do sleep 5; done
if grep -q '"exit_type":"Crashed"' "$PROFILE/Default/Preferences" 2>/dev/null; then
    echo "$(date '+%F %T') vault crashed — launchd restarts it"; exit 1
fi
echo "$(date '+%F %T') vault quit normally"; exit 0
