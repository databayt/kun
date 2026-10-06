#!/usr/bin/env bash
# Idempotent install of the edit toolchain — all free, all local. Safe to re-run.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib.sh"

# ffmpeg-full is keg-only: it sits beside the slim ffmpeg that shoot/record use, never replacing it.
# auto-editor depends on the slim ffmpeg, so installing it may bump that one too — harmless.
for f in ffmpeg-full yt-dlp auto-editor uv; do
  brew list --formula "$f" >/dev/null 2>&1 || HOMEBREW_NO_AUTO_UPDATE=1 brew install "$f"
done
command -v mlx_whisper >/dev/null || uv tool install mlx-whisper

# video-use, patched for on-device mlx-whisper + Arabic caption styles.
if [ ! -d "$VIDEO_USE_DIR/.git" ]; then
  mkdir -p "$(dirname "$VIDEO_USE_DIR")"
  git clone --depth 1 https://github.com/browser-use/video-use "$VIDEO_USE_DIR"
fi
patch="$here/../patches/video-use-local-asr.patch"
if git -C "$VIDEO_USE_DIR" apply --check "$patch" 2>/dev/null; then
  git -C "$VIDEO_USE_DIR" apply "$patch" && echo "video-use: local-asr patch applied"
elif git -C "$VIDEO_USE_DIR" apply --reverse --check "$patch" 2>/dev/null; then
  echo "video-use: local-asr patch already applied"
else
  echo "video-use: patch no longer applies — upstream moved; re-port helpers/transcribe_local.py" >&2
fi
(cd "$VIDEO_USE_DIR" && uv sync -q)
[ -e "$HOME/.claude/skills/video-use" ] || ln -s "$VIDEO_USE_DIR" "$HOME/.claude/skills/video-use"

# HyperFrames as a managed plugin (Apache-2.0). Remotion is deliberately absent: 4+ person
# companies need its paid Company licence.
if [ -z "$(hf_plugin_root)" ]; then
  claude plugin marketplace add heygen-com/hyperframes
  claude plugin install hyperframes@hyperframes
fi

echo "--- edit toolchain"
filters="$(ffmpeg -hide_banner -filters 2>/dev/null)"   # captured: grep -q + pipefail = SIGPIPE false negative
[[ "$filters" == *" subtitles "* ]] && echo "ffmpeg-full  libass ok" || echo "ffmpeg-full  MISSING libass"
echo "mlx_whisper  $(command -v mlx_whisper)"
echo "auto-editor  $(auto-editor --version 2>/dev/null)"
echo "yt-dlp       $(yt-dlp --version 2>/dev/null)"
echo "video-use    $VIDEO_USE_DIR"
echo "hyperframes  $(hf_plugin_root)"
[[ "$(fc-list 2>/dev/null)" == *"thmanyah sans"* ]] && echo "font         Thmanyah Sans ok" || echo "font         Thmanyah Sans missing — Arabic captions fall back"
df -h "$HOME" | awk 'NR==2{print "disk free    "$4}'
