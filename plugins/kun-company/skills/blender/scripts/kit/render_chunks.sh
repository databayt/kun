#!/bin/bash
# render_chunks.sh — resumable chunked render: PNGs -> one CRF-12 H.264 mezzanine per chunk -> full.mp4.
#
#   render_chunks.sh <blend> <outdir> <start> <end> [--chunk 240] [--fps 24] [--camera NAME] [--res WxH]
#                    [--min-free-gb 8] [--blender /path/to/Blender]
#
# Chunk k covers frames a..b and ends as <outdir>/chunk-<a>-<b>.mp4 (libx264 CRF 12, yuv420p, BT.709 tagged);
# its PNGs are deleted right after the encode. A chunk whose mp4 exists is skipped, so a killed run resumes where
# it stopped. Refuses to start/continue when the outdir's volume has < --min-free-gb free. bash 3.2 compatible.
set -euo pipefail

usage() { sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }
[ $# -ge 4 ] || usage
BLEND="$1" OUT="$2" START="$3" END="$4"; shift 4
CHUNK=240 FPS=24 CAMERA="" RES="" MINFREE=8
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
while [ $# -gt 0 ]; do
  case "$1" in
    --chunk) CHUNK="$2"; shift 2 ;;
    --fps) FPS="$2"; shift 2 ;;
    --camera) CAMERA="$2"; shift 2 ;;
    --res) RES="$2"; shift 2 ;;
    --min-free-gb) MINFREE="$2"; shift 2 ;;
    --blender) BLENDER="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "unknown option: $1" >&2; usage ;;
  esac
done
[ -f "$BLEND" ] || { echo "no such blend: $BLEND" >&2; exit 2; }
[ "$START" -le "$END" ] 2>/dev/null || { echo "start/end must be integers, start <= end" >&2; exit 2; }
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"; BLEND="$(cd "$(dirname "$BLEND")" && pwd)/$(basename "$BLEND")"

free_gb() { df -k "$OUT" | awk 'NR==2{printf "%d", $4/1048576}'; }
check_disk() {
  local f; f=$(free_gb)
  if [ "$f" -lt "$MINFREE" ]; then echo "REFUSING: only ${f} GB free on the volume of $OUT (min ${MINFREE} GB)" >&2; exit 3; fi
}

# pre-script: camera, resolution, PNG output into the chunk's own directory (env: KIT_CAMERA KIT_RES KIT_PNGDIR)
PRE="$OUT/.prerender.py"
cat > "$PRE" <<'PY'
import os, bpy
sc = bpy.context.scene
cam = os.environ.get("KIT_CAMERA")
if cam:
    sc.camera = bpy.data.objects[cam]
res = os.environ.get("KIT_RES")
if res:
    w, h = (int(v) for v in res.lower().split("x")); sc.render.resolution_x, sc.render.resolution_y = w, h
elif sc.camera is not None and "res_x" in sc.camera:
    sc.render.resolution_x, sc.render.resolution_y = int(sc.camera["res_x"]), int(sc.camera["res_y"])
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_depth = "8"
sc.render.filepath = os.path.join(os.environ["KIT_PNGDIR"], "f_#####")
sc.render.use_overwrite = True; sc.render.use_placeholder = False; sc.render.use_file_extension = True
print("[chunks] camera=%s res=%dx%d out=%s" % (sc.camera.name if sc.camera else None, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath))
PY

CHILD=""
trap 'echo "[chunks] interrupted — rerun the same command to resume" >&2; [ -n "$CHILD" ] && kill "$CHILD" 2>/dev/null; exit 130' INT TERM

LIST="$OUT/.concat.txt"; : > "$LIST"
TOTAL_T=0; TOTAL_F=0
a="$START"
while [ "$a" -le "$END" ]; do
  b=$((a + CHUNK - 1)); [ "$b" -gt "$END" ] && b="$END"
  n=$((b - a + 1)); mp4="$OUT/chunk-$a-$b.mp4"; png="$OUT/png-$a-$b"
  if [ -s "$mp4" ]; then
    echo "[chunks] $a-$b: mezzanine exists, skipping"
  else
    check_disk
    rm -rf "$png" "$OUT/chunk-$a-$b.part.mp4"; mkdir -p "$png"
    t0=$(date +%s)
    KIT_CAMERA="$CAMERA" KIT_RES="$RES" KIT_PNGDIR="$png" \
      "$BLENDER" -b "$BLEND" -P "$PRE" -s "$a" -e "$b" -a > "$OUT/render-$a-$b.log" 2>&1 </dev/null &
    CHILD=$!; wait "$CHILD" || { echo "[chunks] Blender failed on $a-$b, see $OUT/render-$a-$b.log" >&2; exit 1; }
    CHILD=""
    t1=$(date +%s); got=$(ls "$png" | grep -c '\.png$' || true)
    [ "$got" -eq "$n" ] || { echo "[chunks] $a-$b: expected $n PNGs, found $got (see log)" >&2; exit 1; }
    ffmpeg -v error -y -framerate "$FPS" -start_number "$a" -i "$png/f_%05d.png" -frames:v "$n" \
      -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv" \
      -c:v libx264 -crf 12 -preset medium -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
      -movflags +faststart "$OUT/chunk-$a-$b.part.mp4" </dev/null
    mv "$OUT/chunk-$a-$b.part.mp4" "$mp4"
    rm -rf "$png"
    dt=$((t1 - t0)); TOTAL_T=$((TOTAL_T + dt)); TOTAL_F=$((TOTAL_F + n))
    echo "[chunks] $a-$b: $n frames in ${dt}s ($(awk -v d=$dt -v n=$n 'BEGIN{printf "%.2f", d/n}') s/frame), PNGs deleted, free $(free_gb) GB -> $mp4"
  fi
  echo "file '$mp4'" >> "$LIST"
  a=$((b + 1))
done

ffmpeg -v error -y -f concat -safe 0 -i "$LIST" -c copy -movflags +faststart "$OUT/full.mp4" </dev/null
if [ "$TOTAL_F" -gt 0 ]; then
  echo "[chunks] rendered this run: $TOTAL_F frames, $(awk -v d=$TOTAL_T -v n=$TOTAL_F 'BEGIN{printf "%.2f", d/n}') s/frame"
fi
echo "[chunks] done -> $OUT/full.mp4"
