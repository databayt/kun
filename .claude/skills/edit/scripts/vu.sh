#!/usr/bin/env bash
# Run a video-use helper with the house defaults: ffmpeg-full, local mlx-whisper, Arabic captions.
#   vu.sh transcribe_batch <videos_dir> --language ar
#   vu.sh pack_transcripts --edit-dir <dir>/edit
#   vu.sh timeline_view <video> <start> <end>
#   vu.sh render <dir>/edit/edl.json -o <dir>/edit/final.mp4 --build-subtitles
set -euo pipefail
. "$(dirname "$0")/lib.sh"

helper="${1:?usage: vu.sh <helper> [args…]}"; shift
[ -f "$VIDEO_USE_DIR/helpers/$helper.py" ] || { echo "no helper $helper in $VIDEO_USE_DIR/helpers" >&2; exit 2; }
[ "$helper" = render ] && disk_guard

export VIDEO_USE_ASR="${VIDEO_USE_ASR:-local}"
export VIDEO_USE_SUB_STYLE="${VIDEO_USE_SUB_STYLE:-$EDIT_AR_SUB_STYLE}"

# Resolve relative paths against the caller's cwd before uv changes directory.
args=()
for a in "$@"; do
  if [[ "$a" != -* && -e "$a" ]]; then args+=("$(cd "$(dirname "$a")" && pwd)/$(basename "$a")"); else args+=("$a"); fi
done
exec uv run --project "$VIDEO_USE_DIR" python "$VIDEO_USE_DIR/helpers/$helper.py" "${args[@]}"
