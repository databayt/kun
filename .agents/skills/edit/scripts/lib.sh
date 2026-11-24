# Shared by the edit scripts — source, don't run.

# Homebrew's slim ffmpeg has no libass/freetype: subtitles and drawtext only exist in ffmpeg-full.
FFMPEG_FULL_BIN=/opt/homebrew/opt/ffmpeg-full/bin
[ -x "$FFMPEG_FULL_BIN/ffmpeg" ] && export PATH="$FFMPEG_FULL_BIN:$PATH"

VIDEO_USE_DIR="${VIDEO_USE_DIR:-$HOME/oss/video-use}"
EDIT_MIN_FREE_GB="${EDIT_MIN_FREE_GB:-10}"

# Arabic caption preset: Thmanyah Sans (installed locally, never rehosted) on a dark box —
# outlines muddy Arabic dots. libass scales against PlayResY=288, so these read on any aspect.
EDIT_AR_SUB_STYLE="FontName=Thmanyah Sans,FontSize=17,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H33000000,BackColour=&H33000000,BorderStyle=3,Outline=4,Shadow=0,Alignment=2,MarginV=60"

# The disk is the binding constraint on this Mac: refuse to render below the floor.
disk_guard() {
  local free
  free=$(df -g "$HOME" | awk 'NR==2{print $4}')
  if [ "${free:-0}" -lt "$EDIT_MIN_FREE_GB" ]; then
    echo "edit: only ${free} GiB free (floor ${EDIT_MIN_FREE_GB}) — free space before rendering" >&2
    exit 3
  fi
}

hf_plugin_root() {
  ls -d "$HOME"/.claude/plugins/cache/hyperframes/hyperframes/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/$::'
}

# --- media library (media.sh) — shared by edit, shoot (stills + sim) and record ---------------
KUN_DIR="${KUN_DIR:-$HOME/kun}"
# sharp + playwright-core live outside every repo and outside the skills copy (setup.sh cp -r's it).
MEDIA_RT="${MEDIA_RT:-$HOME/.local/share/databayt/media}"
# Voice samples + consent: not git, not ~/media (that syncs to Drive).
MEDIA_VOICE_DIR="${MEDIA_VOICE_DIR:-$HOME/Library/Application Support/databayt/voice}"
MEDIA_CACHE="${MEDIA_CACHE:-$HOME/.cache/media}"
CDN_BUCKET="databayt-cdn"   # the bucket cdn.databayt.org fronts — NOT AWS_S3_BUCKET (hogwarts' upload bucket)
CDN_HOST="cdn.databayt.org"

# Every web render is tagged BT.709 limited range. Full-range (yuvj*, from JPEG frames) or untagged
# video plays washed out or crushed on some players and in social re-encodes.
TAGS=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)

# vf_to_tv <in_range pc|tv> <in_matrix bt601|bt709> <w> <h> [pix_fmt] — resize + convert to tv-range bt709.
# setparams stamps the frames: this ffmpeg 9 build tags the stream from frame properties, so the
# -color_primaries/-color_trc output flags alone leave primaries and transfer unset.
vf_to_tv() {
  echo "scale=$3:$4:flags=lanczos+accurate_rnd+full_chroma_int:in_range=$1:in_color_matrix=$2:out_range=tv:out_color_matrix=bt709,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv,format=${5:-yuv420p}"
}
