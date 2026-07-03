#!/bin/bash
# greenlist.sh — the list of sites Claude has live-session access to.
#
# "Greenlisting" a site = opening it once in the session-vault Chrome and
# logging in by hand. After that the session persists and Claude reuses it.
# This script just opens the site in the vault and records it in a manifest
# so Claude knows what's available.
#
# Usage:
#   greenlist.sh add <url> [name]   # open <url> in the vault + record it → log in
#   greenlist.sh open <url>         # just open <url> in the vault
#   greenlist.sh list               # show the greenlist
#   greenlist.sh probe              # report which vault sessions look alive
#
# The manifest is ~/.claude/greenlist.json. It never stores passwords or
# cookies — only the URLs you've greenlisted.

set -e

PORT=9222
PROFILE="$HOME/.claude/chrome-debug-profile"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MANIFEST="$HOME/.claude/greenlist.json"
BIN="$(cd "$(dirname "$0")" && pwd)"

ensure_vault() {
  if ! curl -sf -m 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    echo "Session vault not running — starting it..."
    nohup bash "$BIN/chrome-debug.sh" "$PORT" >/dev/null 2>&1 &
    for _ in $(seq 1 20); do
      curl -sf -m 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1 && break
      sleep 0.5
    done
  fi
}

open_url() {
  ensure_vault
  "$CHROME" --remote-debugging-port="$PORT" --remote-allow-origins=* \
    --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
    "$1" >/dev/null 2>&1 &
}

record() {
  local url="$1" name="$2"
  [ -f "$MANIFEST" ] || echo '{"sites":[]}' > "$MANIFEST"
  URL="$url" NAME="$name" python3 - "$MANIFEST" <<'PY'
import json, os, sys
p = sys.argv[1]
url, name = os.environ["URL"], os.environ.get("NAME") or ""
d = json.load(open(p))
sites = d.setdefault("sites", [])
host = url.split("//")[-1].split("/")[0]
name = name or host.replace("www.", "")
if not any(s.get("url") == url for s in sites):
    sites.append({"url": url, "name": name, "host": host})
json.dump(d, open(p, "w"), indent=2)
print(f"greenlisted: {name} ({url})")
PY
}

case "${1:-list}" in
  add)
    [ -z "$2" ] && { echo "usage: greenlist.sh add <url> [name]"; exit 1; }
    open_url "$2"
    record "$2" "$3"
    echo "→ Log into it in the Chrome window that just opened. Done once, it sticks."
    ;;
  open)
    [ -z "$2" ] && { echo "usage: greenlist.sh open <url>"; exit 1; }
    open_url "$2"
    echo "opened $2 in the session vault"
    ;;
  list)
    [ -f "$MANIFEST" ] || { echo "(greenlist empty — add one with: greenlist.sh add <url>)"; exit 0; }
    python3 - "$MANIFEST" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
sites = d.get("sites", [])
if not sites: print("(greenlist empty)"); raise SystemExit
print("Greenlisted sites (session-vault logins Claude can reuse):")
for s in sites: print(f"  • {s['name']:<20} {s['url']}")
PY
    ;;
  probe)
    ensure_vault
    python3 - <<'PY'
import json, urllib.request
try:
    tabs = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=2))
    print("Open tabs in the session vault:")
    for t in tabs:
        if t.get("type") == "page":
            print(f"  • {t.get('title','')[:40]:<42} {t.get('url','')}")
except Exception as e:
    print("vault not reachable:", e)
PY
    ;;
  *)
    echo "usage: greenlist.sh {add <url> [name]|open <url>|list|probe}"; exit 1;;
esac
