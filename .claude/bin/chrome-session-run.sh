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

# The flag is assembled inside awk: passed whole (-v p="--remote-debugging-port=9222") it sat in awk's own
# command line, so with no Chrome up awk found ITSELF — the vault "was up", never started, and "quit" in the
# same second, every 5 min (2026-11-13 → 11-16). Same for the runner's own line: it carries only the port.
main_pid() { ps -axo pid=,command= | awk -v port="$PORT" 'index($0, "--remote-debugging-" "port=" port " ") || $0 ~ ("--remote-debugging-" "port=" port "$") { if (!index($0, "--type=")) { print $1; exit } }'; }

if [ -z "$(main_pid)" ]; then
    # A lock left by an unclean exit names a pid the OS may have handed to another process since
    # (2026-11-15: pid 487 became calaccessd), and Chrome then quits at once on every restart —
    # "up … quit normally" in the same second for two days. No Chrome on this profile → it is stale.
    if ! pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; then
        rm -f "$PROFILE/SingletonLock" "$PROFILE/SingletonCookie" "$PROFILE/SingletonSocket"
    fi
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
