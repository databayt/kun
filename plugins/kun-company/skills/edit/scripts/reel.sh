#!/usr/bin/env bash
# Vertical 1080x1920@30 reel from a finished horizontal cut, captions burned LAST.
#   reel.sh <in.mp4> <out.mp4> [--srt master.srt] [--mode pad|crop] [--max 58]
# pad  = whole frame centred over a blurred fill (screen content — nothing gets cropped away)
# crop = centre 9:16 crop (talking heads)
set -euo pipefail
. "$(dirname "$0")/lib.sh"

in="${1:?usage: reel.sh <in> <out> [--srt f] [--mode pad|crop] [--max s]}"; out="${2:?out path}"; shift 2
srt=""; mode=pad; max=58
while [ $# -gt 0 ]; do
  case "$1" in
    --srt) srt="$2"; shift 2 ;;
    --mode) mode="$2"; shift 2 ;;
    --max) max="$2"; shift 2 ;;
    *) echo "unknown flag $1" >&2; exit 2 ;;
  esac
done
disk_guard

case "$mode" in
  pad)  vf="[0:v]fps=30,split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2,eq=brightness=-0.12[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1" ;;
  crop) vf="[0:v]fps=30,crop=ih*9/16:ih,scale=1080:1920,setsar=1" ;;
  *) echo "mode must be pad or crop" >&2; exit 2 ;;
esac
if [ -n "$srt" ]; then
  srt_abs="$(cd "$(dirname "$srt")" && pwd)/$(basename "$srt")"
  vf="$vf,subtitles='${srt_abs//:/\\:}':force_style='${EDIT_AR_SUB_STYLE//,/\\,}'"
fi

# Compose to a near-lossless intermediate, then the shared `reel` profile does the delivery encode:
# tv-range BT.709 tags, faststart, −14 LUFS for social, the 8 Mbps cap and the 60 s platform limit.
mezz="$MEDIA_CACHE/reel-$$.mkv"; mkdir -p "$MEDIA_CACHE"; trap 'rm -f "$mezz"' EXIT
ffmpeg -hide_banner -loglevel error -y -i "$in" -t "$max" \
  -filter_complex "$vf[v]" -map "[v]" -map "0:a?" \
  -c:v libx264 -preset veryfast -crf 12 -pix_fmt yuv420p -c:a pcm_s16le "$mezz"
"$(dirname "$0")/media.sh" encode reel "$mezz" "$out" --max "$max" | grep -E '"(width|height|fps|color_range|mb|faststart)"' 
