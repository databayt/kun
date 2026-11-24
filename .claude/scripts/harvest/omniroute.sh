#!/bin/bash
# omniroute.sh — the token-harvest gateway on this Mac: OmniRoute on 127.0.0.1:20128, as a
# launchd agent, with its secrets generated once and its keys in the Keychain.
#
#   omniroute.sh init        write ~/.omniroute/.env (secrets, loopback, API key required) once
#   omniroute.sh install     init + launchd agent com.databayt.omniroute (starts at login, restarts)
#   omniroute.sh uninstall   remove the launchd agent (data in ~/.omniroute stays)
#   omniroute.sh status      ok | down | missing — one line, exit 0/1/2 (readiness probe)
#   omniroute.sh key         print the OmniRoute API key (credential store OMNIROUTE_API_KEY); never into a log
#   omniroute.sh admin       print the dashboard password (credential store OMNIROUTE_ADMIN_PASSWORD)
#
# Why each setting (OmniRoute 3.8.54 .env.example): the shipped INITIAL_PASSWORD is the public
# CHANGEME and REQUIRE_API_KEY defaults to false — so we set a random admin password and require
# a key on /v1 even on loopback. It runs from ~/.omniroute because OmniRoute reads a .env from its
# working folder: started inside a repo it would try that repo's secrets. Per person: this is
# the teammate's own gateway with their own provider keys (providers.json). Canonical copy in kun;
# Machine's readiness steps omniroute.service / omniroute.key call it.
set -u

HOME_DIR="$HOME/.omniroute"
ENV_FILE="$HOME_DIR/.env"
LABEL="com.databayt.omniroute"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT="${OMNIROUTE_PORT:-20128}"
SVC=org.databayt.kun.machine   # Machine's credential service — one store for every key

kc_get() { security find-generic-password -s "$SVC" -a "$1" -w 2>/dev/null; }
kc_set() { security add-generic-password -U -s "$SVC" -a "$1" -w "$2" >/dev/null; }

bin() { command -v omniroute || ls /opt/homebrew/bin/omniroute /usr/local/bin/omniroute 2>/dev/null | head -1; }

init() {
    mkdir -p "$HOME_DIR"; chmod 700 "$HOME_DIR"
    if [ -f "$ENV_FILE" ] && grep -q '^JWT_SECRET=.\+' "$ENV_FILE"; then echo "omniroute: $ENV_FILE exists"; return 0; fi
    local admin; admin=$(kc_get OMNIROUTE_ADMIN_PASSWORD) || admin=""
    [ -n "$admin" ] || { admin=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24); kc_set OMNIROUTE_ADMIN_PASSWORD "$admin"; }
    (umask 077; cat > "$ENV_FILE" <<EOF
# Written by kun .claude/scripts/harvest/omniroute.sh — OmniRoute's own secrets, this Mac only.
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
API_KEY_SECRET=$(openssl rand -hex 32)
STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
STORAGE_ENCRYPTION_KEY_VERSION=v1
INITIAL_PASSWORD=$admin
REQUIRE_API_KEY=true
OMNIROUTE_SERVER_HOST=127.0.0.1
APP_BIND_HOST=127.0.0.1
PORT=$PORT
EOF
)
    echo "omniroute: wrote $ENV_FILE (admin password in $SVC/OMNIROUTE_ADMIN_PASSWORD)"
}

install() {
    init
    local b; b=$(bin) || true
    [ -n "$b" ] || { echo "omniroute: not installed — npm install -g omniroute" >&2; return 2; }
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$b</string><string>serve</string><string>--no-open</string><string>--no-tray</string><string>--port</string><string>$PORT</string>
  </array>
  <key>WorkingDirectory</key><string>$HOME_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/omniroute.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/omniroute.log</string>
</dict></plist>
EOF
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    for _ in $(seq 1 60); do status >/dev/null && { echo "omniroute: up on 127.0.0.1:$PORT"; return 0; }; sleep 1; done
    echo "omniroute: started but not answering yet — tail ~/Library/Logs/omniroute.log" >&2; return 1
}

status() {
    [ -n "$(bin)" ] || { echo missing; return 2; }
    if curl -s -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -qE '^(200|401|403)$'; then echo ok; return 0; fi
    echo down; return 1
}

case "${1:-status}" in
    init) init ;;
    install) install ;;
    uninstall) launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null; rm -f "$PLIST"; echo "omniroute: agent removed" ;;
    status) status ;;
    key) kc_get OMNIROUTE_API_KEY || { echo "omniroute: no API key yet — Machine → Providers, or: node omni.mjs mint-key" >&2; exit 1; } ;;
    admin) kc_get OMNIROUTE_ADMIN_PASSWORD ;;
    *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 64 ;;
esac
