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
#   blender.sh stills <scene.json> <outdir> [--aspect landscape|portrait] [--scale 0.5] [--legs a,b]
#                                 a stills film: a camera over still images (edit/scripts/blender/
#                                 stills.py, schema stills.schema.md) rendered to PNGs, then each
#                                 leg+aspect encoded to <outdir>/<leg>-<aspect>.mp4 (mezzanine:
#                                 H.264 CRF 10, yuv420p, tv-range BT.709) for FilmCraft's assembler
#   blender.sh mcp                MCP server (ahujasid/blender-mcp, MIT) — drives the OPEN Blender
#                                 through its add-on on 127.0.0.1:9876; telemetry off; safe mode on
#                                 (model-written code is AST-checked: Poly Haven text reaches the model)
#   blender.sh install-lab        Blender Lab's official MCP (projects.blender.org/lab/blender_mcp,
#                                 GPL): the add-on (port 9878) + the server (uv tool), sha256-pinned
#   blender.sh lab                that server (stdio): version-matched bpy API + manual search,
#                                 background-Blender exec, .blend summaries, screenshots, renders
#
# Scripts: set scene.view_settings.view_transform = 'Standard' for exact brand colours (the default
# AgX look washes them). Blender's text objects do not shape Arabic: Arabic titles go on in FilmCraft.
set -euo pipefail

MCP_PKG="mcp-for-blender==2.2.9" # pinned; bump deliberately (sync). Has the 2026-07 Poly Haven path-traversal fix (#258)
LAB_VER="1.0.3" # Blender Lab MCP, released 2026-09-11
LAB_URL="https://projects.blender.org/lab/blender_mcp/releases/download/v$LAB_VER"
LAB_ADDON_SHA="a7a9da816192502e5a0a202a396444e266b47d8fc4f74ad4698048bd43040707" # mcp-$LAB_VER.zip
LAB_SERVER_SHA="d6fe04dd17767f7c7fb452142f1f0e6787db575db49f3976a166142683b5b97e" # blender-$LAB_VER.mcpb
LAB_PORT=9878 # 9876 = ahujasid's add-on, 9877 = FilmCraft
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
  stills)
    shift; scene="${1:?scene.json}"; outdir="${2:?outdir}"; shift 2
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    py="$here/../skills/edit/scripts/blender/stills.py"; [ -f "$py" ] || py="$HOME/.claude/skills/edit/scripts/blender/stills.py"
    fps=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('fps',30))" "$scene")
    asp=""; legs=""; prev=""
    for a in "$@"; do
      case "$prev" in --aspect) asp="$a" ;; --legs) legs="$a" ;; esac; prev="$a"
    done
    "$BIN" -b --factory-startup -P "$py" -- "$scene" "$outdir" "$@" 2>&1 | grep -v -E 'use_nodes|DeprecationWarning'
    for d in "$outdir"/*/*/; do
      [ -f "${d}00001.png" ] || continue
      a=$(basename "$d"); l=$(basename "$(dirname "$d")")
      [ -z "$asp" ] || [ "$a" = "$asp" ] || continue
      [ -z "$legs" ] || [[ ",$legs," == *",$l,"* ]] || continue
      ffmpeg -v error -y -framerate "$fps" -i "${d}%05d.png" \
        -vf "scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv,format=yuv420p" \
        -c:v libx264 -preset slow -crf 10 -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
        -movflags +faststart "$outdir/$l-$a.mp4"
      echo "$outdir/$l-$a.mp4"
    done ;;
  mcp)
    export DISABLE_TELEMETRY=true BLENDER_MCP_SAFE_MODE=1
    exec uvx --from "$MCP_PKG" mcp-for-blender ;;
  install-lab)
    tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
    curl -fsSL -o "$tmp/addon.zip" "$LAB_URL/mcp-$LAB_VER.zip"
    curl -fsSL -o "$tmp/server.mcpb" "$LAB_URL/blender-$LAB_VER.mcpb"
    echo "$LAB_ADDON_SHA  $tmp/addon.zip" | shasum -a 256 -c - >/dev/null || { echo "add-on sha256 mismatch" >&2; exit 1; }
    echo "$LAB_SERVER_SHA  $tmp/server.mcpb" | shasum -a 256 -c - >/dev/null || { echo "server sha256 mismatch" >&2; exit 1; }
    "$BIN" --command extension install-file -r user_default -e "$tmp/addon.zip" 2>&1 | grep -E "STATUS|rror" || true
    cat > "$tmp/port.py" <<PY
import bpy
key = next(k for k in bpy.context.preferences.addons.keys() if k.endswith('.mcp'))
p = bpy.context.preferences.addons[key].preferences
p.port = $LAB_PORT; p.use_autostart = True
bpy.ops.wm.save_userpref()
print("blender-lab add-on:", key, "port", p.port)
PY
    "$BIN" -b --python "$tmp/port.py" 2>&1 | grep "blender-lab add-on"
    dest="$HOME/.local/share/databayt/blender-lab/$LAB_VER"
    rm -rf "$dest"; mkdir -p "$dest"; (cd "$dest" && unzip -q "$tmp/server.mcpb")
    uv tool install --force --python 3.12 "$dest" 2>&1 | tail -1
    echo "registered as: claude mcp add -s user blender-lab -- $0 lab" ;;
  lab)
    export BLENDER_MCP_PORT=$LAB_PORT BLENDER_PATH="$BIN"
    exec "$HOME/.local/bin/blender-mcp" ;;
  *) sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
