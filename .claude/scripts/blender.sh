#!/bin/bash
# blender.sh — Blender (blender/blender, GPL, free), kun's 3D lane: product shots, logo stings,
# 3D scenes rendered to frames that /edit's FilmCraft assembler or media.sh take from there.
#
#   blender.sh install|update     brew cask (download.blender.org), checked against blender.org's
#                                 published SHA-256 and the Blender Foundation's notarization; then
#                                 the MCP add-on (pinned) installed and enabled
#   blender.sh version            installed Blender + add-on
#   blender.sh render <script.py> [-- args]   headless (no window): blender -b --factory-startup -P
#   blender.sh frames <dir> <out.mp4> [fps]   a rendered PNG sequence → H.264 (Blender 5 dropped
#                                 its FFMPEG image format; encode here, then media.sh as usual)
#   blender.sh mcp                MCP server (ahujasid/blender-mcp, MIT) — drives the OPEN Blender
#                                 through its add-on on 127.0.0.1:9876; telemetry off
#
# Scripts: set scene.view_settings.view_transform = 'Standard' for exact brand colours (the default
# AgX look washes them). Blender's text objects do not shape Arabic: Arabic titles go on in FilmCraft.
set -euo pipefail

MCP_PKG="mcp-for-blender==2.2.9" # pinned; bump deliberately (sync)
APP="/Applications/Blender.app"
BIN="$APP/Contents/MacOS/Blender"
TEAM_ID="68UA947AUU" # Stichting Blender Foundation

verify() {
  local v sha want
  v=$("$BIN" --version 2>/dev/null | awk 'NR==1{print $2}')
  spctl -a "$APP" || { echo "Blender.app is not notarized" >&2; exit 1; }
  codesign -dv "$APP" 2>&1 | grep -q "TeamIdentifier=$TEAM_ID" || { echo "Blender.app is not signed by the Blender Foundation" >&2; exit 1; }
  # The cask's checksum must be blender.org's own for this release.
  sha=$(brew info --cask blender --json=v2 | python3 -c "import json,sys;print(json.load(sys.stdin)['casks'][0]['sha256'])")
  want=$(curl -fsSL "https://download.blender.org/release/Blender${v%.*}/blender-$v.sha256" | awk '/macos-arm64\.dmg/{print $1}')
  [ -n "$want" ] && [ "$sha" = "$want" ] || { echo "cask sha256 $sha does not match blender.org ($want)" >&2; exit 1; }
  echo "Blender $v verified: blender.org sha256 + Blender Foundation notarization"
}

addon() {
  DISABLE_TELEMETRY=true uvx --from "$MCP_PKG" mcp-for-blender install-addon >/dev/null
  "$BIN" -b --python-expr "import bpy; bpy.ops.preferences.addon_enable(module='blender_mcp'); bpy.ops.wm.save_userpref()" >/dev/null 2>&1
  echo "MCP add-on ($MCP_PKG) installed and enabled — it serves on :9876 whenever Blender is open"
}

case "${1:-help}" in
  install|update)
    if [ -d "$APP" ]; then brew upgrade --cask blender || true; else brew install --cask blender; fi
    verify
    addon ;;
  version)
    "$BIN" --version 2>/dev/null | head -1
    grep -m1 -o '"version": ([0-9, ]*)' "$HOME/Library/Application Support/Blender/"*/scripts/addons/blender_mcp.py 2>/dev/null || echo "add-on not installed" ;;
  render)
    shift; script="$1"; shift
    exec "$BIN" -b --factory-startup -P "$script" "$@" ;;
  frames)
    dir="$2" out="$3" fps="${4:-30}"
    first=$(ls "$dir" | grep -E '\.png$' | sort | head -1)
    pattern="${first%%[0-9]*}%0$(echo "$first" | grep -oE '[0-9]+' | tail -1 | wc -c | tr -d ' ' | awk '{print $1-1}')d.png"
    ffmpeg -v error -y -framerate "$fps" -i "$dir/$pattern" -c:v libx264 -crf 16 -pix_fmt yuv420p \
      -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart "$out"
    echo "$out" ;;
  mcp)
    export DISABLE_TELEMETRY=true
    exec uvx --from "$MCP_PKG" mcp-for-blender ;;
  *) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
