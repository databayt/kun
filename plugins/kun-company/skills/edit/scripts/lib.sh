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
