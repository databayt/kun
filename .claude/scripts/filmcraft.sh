#!/bin/bash
# filmcraft.sh — FilmCraft (storytold/filmcraft), kun's video editor. Free, Apache/MIT, no licence.
#
#   filmcraft.sh install|update   download the latest macOS release, verify (sha256 + gpg + Apple
#                                 notarization), install FilmCraft.app + filmcraft-cli
#   filmcraft.sh version          installed vs latest
#   filmcraft.sh mcp              MCP server, headless (no window) — the `filmcraft` MCP entry
#   filmcraft.sh bridge           MCP server driving the open desktop app — `filmcraft-desktop`
#   filmcraft.sh desktop [p.fcproj]  open the desktop app with the control channel on :9877
#
# The control token lives in Keychain (service databayt, account FILMCRAFT_CONTROL_TOKEN) and is
# generated on first use; desktop and bridge read the same one. MCP modes print nothing to stdout
# before exec — stdout is the JSON-RPC channel.
set -euo pipefail

REPO="storytold/filmcraft"
APP="/Applications/FilmCraft.app"
SHARE="$HOME/.local/share/filmcraft-cli"
CLI="$HOME/.local/bin/filmcraft-cli"
# 9877, not FilmCraft's documented 9876: the Blender MCP add-on listens on 9876 (2026-11-15).
PORT="${FILMCRAFT_PORT:-9877}"
TEAM_ID="DJ6XS33FX8" # Learning Machines LLC — the Developer ID that signs the releases

token() {
  local t
  t=$(security find-generic-password -s databayt -a FILMCRAFT_CONTROL_TOKEN -w 2>/dev/null || true)
  if [ -z "$t" ]; then
    t=$(openssl rand -hex 32)
    printf 'add-generic-password -s databayt -a FILMCRAFT_CONTROL_TOKEN -w "%s" -U\n' "$t" | security -i >/dev/null 2>&1
  fi
  printf '%s' "$t"
}

installed() { [ -x "$CLI" ] && "$CLI" --version 2>/dev/null | awk '{print $2}' || echo none; }
latest() { gh release view -R "$REPO" --json tagName --jq .tagName | sed 's/^v//'; }

install() {
  local v dir mnt cli_dir
  v=$(latest)
  if [ "$(installed)" = "$v" ] && [ -d "$APP" ]; then echo "FilmCraft $v already installed"; return; fi
  dir=$(mktemp -d); mnt="$dir/mnt"
  trap 'hdiutil detach -quiet "$mnt" 2>/dev/null || true; rm -rf "$dir"' EXIT
  (cd "$dir" && gh release download "v$v" -R "$REPO" \
    -p "filmcraft-$v-macos-universal.dmg" -p "filmcraft-cli-$v-macos-universal.zip" \
    -p SHA256SUMS.txt -p SHA256SUMS.txt.asc -p release-signing-key.asc)
  (cd "$dir" && grep -E "macos-universal\.(dmg|zip)$" SHA256SUMS.txt | shasum -a 256 -c -) || { echo "sha256 mismatch" >&2; exit 1; }
  if command -v gpg >/dev/null; then
    gpg --batch --import "$dir/release-signing-key.asc" 2>/dev/null
    gpg --batch --verify "$dir/SHA256SUMS.txt.asc" "$dir/SHA256SUMS.txt" 2>&1 | grep -q "Good signature" \
      || { echo "gpg signature check failed" >&2; exit 1; }
  fi
  hdiutil attach -nobrowse -readonly -quiet "$dir/filmcraft-$v-macos-universal.dmg" -mountpoint "$mnt"
  spctl -a "$mnt/FilmCraft.app" || { echo "FilmCraft.app is not notarized" >&2; exit 1; }
  rm -rf "$APP"; ditto "$mnt/FilmCraft.app" "$APP"
  unzip -q -o "$dir/filmcraft-cli-$v-macos-universal.zip" -d "$dir/cli"
  cli_dir="$dir/cli/filmcraft-cli-$v-macos-universal"
  codesign -dv "$cli_dir/filmcraft-cli" 2>&1 | grep -q "TeamIdentifier=$TEAM_ID" \
    || { echo "filmcraft-cli is not signed by $TEAM_ID" >&2; exit 1; }
  rm -rf "$SHARE"; mkdir -p "$SHARE" "$(dirname "$CLI")"; ditto "$cli_dir" "$SHARE"
  ln -sf "$SHARE/filmcraft-cli" "$CLI"
  echo "FilmCraft $v installed: $APP + $CLI"
}

case "${1:-help}" in
  install|update) install ;;
  version) echo "installed $(installed) · latest $(latest)" ;;
  mcp) shift; exec "$CLI" mcp "$@" ;;
  bridge)
    FILMCRAFT_CONTROL_TOKEN=$(token); export FILMCRAFT_CONTROL_TOKEN
    exec "$CLI" mcp --bridge "127.0.0.1:$PORT" ;;
  desktop)
    shift
    FILMCRAFT_CONTROL_TOKEN=$(token); export FILMCRAFT_CONTROL_TOKEN
    nohup "$APP/Contents/MacOS/FilmCraft" --control "$PORT" "$@" >/dev/null 2>&1 &
    echo "FilmCraft desktop up, control channel 127.0.0.1:$PORT (MCP: filmcraft-desktop)" ;;
  *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
