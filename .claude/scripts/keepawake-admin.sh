#!/bin/bash
# keepawake-admin.sh — the one admin step that makes this Mac an always-on server.
#
#   bash keepawake-admin.sh apply      macOS asks for the owner's password in its own dialog
#   bash keepawake-admin.sh rollback   put everything back (same dialog)
#   bash keepawake-admin.sh status     what is set now (no password)
#
# Why a dialog and not sudo in a terminal: the owner authenticates to macOS directly, so the
# password never passes through a script or an agent. `apply` and `rollback` re-run this file
# as root through `osascript … with administrator privileges`.
#
# What apply changes (measured before, 2026-11-14: displaysleep 180 on both sources, battery
# lowpowermode 0 / powernap 1 / tcpkeepalive 1, automatic macOS installs ON, no lock message):
#   /etc/sudoers.d/kun-pmset   lets the presence loop run exactly `pmset -a disablesleep 0|1`
#                              without a password (devices.sh decides when — see its header)
#   pmset -a displaysleep N    the display goes dark after N idle minutes (engine.json →
#                              devices.power.display_minutes, 2); the Mac itself stays awake
#   pmset -b lowpowermode 1 powernap 0 tcpkeepalive 0
#                              on battery: stretch a power cut, and stop the 15-minute dark
#                              wakes that drained 4% to 1% while it slept
#   AutomaticallyInstallMacOSUpdates = false
#                              updates still download and security responses still install;
#                              macOS no longer restarts the Mac to install a release by itself
#   LoginwindowText            the lock screen says the Mac is awake and working
# The sudoers file is written to a temp file and checked with `visudo -cf` first: a bad file
# in sudoers.d breaks every sudo.
set -u

SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
ENGINE="$(cd "$(dirname "$0")/.." && pwd)/engine.json"
RULE=/etc/sudoers.d/kun-pmset
SU=/Library/Preferences/com.apple.SoftwareUpdate
LW=/Library/Preferences/com.apple.loginwindow
MESSAGE="Kun server — awake and working. Unlock; do not restart."

display_minutes() {
    local v=""
    command -v jq >/dev/null 2>&1 && v="$(jq -r '.devices.power.display_minutes // empty' "$ENGINE" 2>/dev/null)"
    case "$v" in '' | *[!0-9]*) v=2 ;; esac
    echo "$v"
}

as_admin() {  # as_admin <mode> — the same file, as root, behind the macOS password dialog
    [ "$(uname -s)" = Darwin ] || { echo "keepawake-admin: macOS only"; exit 0; }
    /usr/bin/osascript -e "do shell script \"/bin/bash '$SELF' $1-root '$(id -un)' '$(display_minutes)'\" with administrator privileges with prompt \"Kun: set this Mac up as an always-on server ($1).\"" 2>&1
}

status() {
    echo "sudoers rule      $([ -f "$RULE" ] && echo "installed ($RULE)" || echo "not installed")"
    echo "sleep disabled    $(ioreg -rd1 -c IOPMrootDomain 2>/dev/null | grep -q '"SleepDisabled" = Yes' && echo yes || echo no)"
    echo "display sleep     mains $(pmset -g custom | awk '/^AC Power/ {ac=1} ac && $1 == "displaysleep" {print $2; exit}') min · battery $(pmset -g custom | awk '/^Battery Power/ {b=1} /^AC Power/ {b=0} b && $1 == "displaysleep" {print $2; exit}') min"
    echo "on battery        lowpowermode $(pmset -g custom | awk '/^Battery Power/ {b=1} /^AC Power/ {b=0} b && $1 == "lowpowermode" {print $2; exit}') · powernap $(pmset -g custom | awk '/^Battery Power/ {b=1} /^AC Power/ {b=0} b && $1 == "powernap" {print $2; exit}') · tcpkeepalive $(pmset -g custom | awk '/^Battery Power/ {b=1} /^AC Power/ {b=0} b && $1 == "tcpkeepalive" {print $2; exit}')"
    echo "macOS auto-install $(defaults read "$SU" AutomaticallyInstallMacOSUpdates 2>/dev/null | sed 's/^1$/ON — macOS can restart the Mac by itself/; s/^0$/off/')"
    echo "lock message      $(defaults read "$LW" LoginwindowText 2>/dev/null || echo "none")"
    echo "power now         $(pmset -g batt | head -1 | sed "s/Now drawing from //; s/'//g") · $(pmset -g batt | grep -Eo '[0-9]+%' | head -1)"
}

case "${1:-status}" in
    status) status ;;
    apply | rollback)
        out="$(as_admin "$1")" || { echo "keepawake-admin: not applied — the dialog was cancelled or timed out."; echo "$out" | tail -2; exit 1; }
        echo "$out"
        status
        ;;
    apply-root)
        [ "$(id -u)" = 0 ] || { echo "apply-root must run as root"; exit 1; }
        user="${2:?user}"; minutes="${3:-2}"
        tmp="$(/usr/bin/mktemp /tmp/kun-pmset.XXXXXX)"
        printf '%s ALL=(root) NOPASSWD: /usr/bin/pmset -a disablesleep 0, /usr/bin/pmset -a disablesleep 1\n' "$user" > "$tmp"
        if ! /usr/sbin/visudo -cf "$tmp" >/dev/null 2>&1; then
            /bin/rm -f "$tmp"; echo "the sudoers rule did not pass visudo — nothing was changed"; exit 1
        fi
        /usr/bin/install -m 0440 -o root -g wheel "$tmp" "$RULE"; /bin/rm -f "$tmp"
        /usr/bin/pmset -a displaysleep "$minutes" >/dev/null 2>&1
        /usr/bin/pmset -b lowpowermode 1 powernap 0 tcpkeepalive 0 >/dev/null 2>&1
        /usr/bin/defaults write "$SU" AutomaticallyInstallMacOSUpdates -bool false
        /usr/bin/defaults write "$LW" LoginwindowText "$MESSAGE"
        echo "server mode applied"
        ;;
    rollback-root)
        [ "$(id -u)" = 0 ] || { echo "rollback-root must run as root"; exit 1; }
        /bin/rm -f "$RULE"
        /usr/bin/pmset -a disablesleep 0 >/dev/null 2>&1
        /usr/bin/pmset -a displaysleep 180 >/dev/null 2>&1
        /usr/bin/pmset -b lowpowermode 0 powernap 1 tcpkeepalive 1 >/dev/null 2>&1
        /usr/bin/defaults write "$SU" AutomaticallyInstallMacOSUpdates -bool true
        /usr/bin/defaults delete "$LW" LoginwindowText >/dev/null 2>&1
        echo "server mode rolled back to the settings of 2026-11-14"
        ;;
    *) echo "usage: keepawake-admin.sh apply | rollback | status"; exit 1 ;;
esac
