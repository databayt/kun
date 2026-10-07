#!/usr/bin/env bash
# media.sh — the shared media library behind edit, shoot (stills + sim) and record.
# Local and free: ffmpeg-full, sharp, oxipng, mlx-whisper, mlx-audio. Nothing calls a paid API.
#
#   media.sh setup                      install / verify the toolchain (idempotent)
#   media.sh doctor                     what's installed, model + voice status, cache sizes, disk
#   media.sh purge [--deep] [--force]   render caches by age; --deep also npx + stale Playwright browsers
#   media.sh encode <profile> <in> <out> [--max S] [--fps N] [--box WxH]
#            profiles: web | av1 | reel | clip | loop | draft   (an out ending .av1.mp4 encodes AV1)
#   media.sh poster <in> <out.webp> [--at S] [--width 1600]
#   media.sh derive <png…> [--kind ui|photo] [--widths 1600,2400] [--out dir] [--check]
#   media.sh vtt <in.srt|in.json> <out.vtt> [--offset S]
#   media.sh publish --ns <ns> --slug <slug> --id <id> [--manifest path] <files…>
#   media.sh qa-pack <file…> [--profile p] [--ref mezz] [--vtt f] [--at t1,t2] [--out dir]
#   media.sh probe <file>               compact JSON (codec, colour tags, faststart, size)
#   media.sh loudness <file>            EBU R128 integrated / LRA / true peak
#   media.sh vmaf <dist> <ref>          VMAF mean vs a reference
#   media.sh voice <status|record|gen|mix|revoke> …   local Arabic narration (consent-gated)
#   media.sh brand <id> [--json|--css|--ass]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$here/lib.sh"
mjs() { node "$here/media/$1.mjs" "${@:2}"; }
die() { echo "media: $*" >&2; exit 1; }

probe_field() { ffprobe -v error -select_streams v:0 -show_entries "stream=$1" -of default=nw=1:nk=1 "$2" | head -1 | tr -d ', '; }
has_audio() { [ -n "$(ffprobe -v error -select_streams a -show_entries stream=index -of default=nw=1:nk=1 "$1" | head -1)" ]; }

# Two-pass EBU R128 to the target; prints the af= value for pass two.
loudnorm_af() { # <in> <I> <TP>
  local j
  j=$(ffmpeg -hide_banner -nostats -i "$1" -af "loudnorm=I=$2:TP=$3:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  python3 - "$2" "$3" "$j" <<'PY'
import json, sys
I, TP, j = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
print(f"loudnorm=I={I}:TP={TP}:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
      f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
PY
}

cmd_encode() {
  local profile="${1:?profile}" in="${2:?in}" out="${3:?out}"; shift 3
  local max="" fps="" box=""
  while [ $# -gt 0 ]; do case "$1" in --max) max="$2"; shift 2 ;; --fps) fps="$2"; shift 2 ;; --box) box="$2"; shift 2 ;; *) die "unknown flag $1" ;; esac; done
  [ -f "$in" ] || die "no such file: $in"
  disk_guard
  local w h pf cr cs r av1=0
  w=$(probe_field width "$in"); h=$(probe_field height "$in"); pf=$(probe_field pix_fmt "$in")
  cr=$(probe_field color_range "$in"); cs=$(probe_field color_space "$in"); r=$(probe_field avg_frame_rate "$in")
  [[ "$out" == *.av1.mp4 || "$profile" == av1 ]] && av1=1
  # input range/matrix: JPEG-born frames (yuvj*, mjpeg, full range) are pc + bt601
  local inr=tv inm=bt709
  if [[ "$cr" == pc || "$pf" == yuvj* ]]; then inr=pc; inm=bt601; fi
  [[ "$cs" == bt470bg || "$cs" == smpte170m ]] && inm=bt601
  # fit inside the delivery box, never upscale, even dims
  # --box WxH targets a screen instead: 2560x1600 fills a MacBook, 1080x2340 an iPhone 16
  local bw=1920 bh=1080; [ "$profile" = reel ] && { bw=1080; bh=1920; }
  [ -n "$box" ] && { bw="${box%x*}"; bh="${box#*x}"; }
  read -r tw th < <(python3 -c "w,h,bw,bh=$w,$h,$bw,$bh
s=min(1,bw/w,bh/h); tw=int(w*s)//2*2; th=int(h*s)//2*2; print(tw,th)")
  local srcfps; srcfps=$(python3 -c "n,d='${r}'.split('/') if '/' in '${r}' else ('${r}','1'); print(round(float(n)/float(d or 1),3) if float(d or 1) else 30)")
  local ofps="${fps:-$srcfps}"
  local pixfmt=yuv420p; [ $av1 = 1 ] && pixfmt=yuv420p10le
  local vf; vf="$(vf_to_tv $inr $inm $tw $th $pixfmt)"
  [ -n "$fps" ] && vf="fps=$fps,$vf"
  local level=4.1 hi=0; python3 -c "import sys; sys.exit(0 if $th*$tw>=1920*1080*0.9 and $ofps>30 else 1)" && hi=1
  [ $hi = 1 ] && level=4.2
  # above 8,704 macroblocks a frame (1080p) level 4.x is out of spec — 5.1 covers 1600p and 1080x2340
  python3 -c "import sys; sys.exit(0 if (($tw+15)//16)*(($th+15)//16) > 8704 else 1)" && level=5.1
  local gop; gop=$(python3 -c "print(int(round($ofps*2)))")
  local v=() a=(-an) t=()
  [ -n "$max" ] && t=(-t "$max")
  local crf
  case "$profile" in
    web|av1) crf=20 ;;
    reel) crf=21; [ -z "$max" ] && t=(-t 60); level=4.2 ;;
    clip) crf=23; [ -z "$max" ] && t=(-t 30) ;;
    loop) crf=24 ;;
    draft) crf=0 ;;
    *) die "unknown profile $profile (web|av1|reel|clip|loop|draft)" ;;
  esac
  if [ "$profile" != loop ] && has_audio "$in"; then
    # the normaliser aims 1 dB under the budget (-1.5 web, -1 social): AAC adds inter-sample overshoot,
    # and peaky speech (TTS) landed at -0.7 dBTP when aimed at the budget itself
    local I=-16 TP=-2.5 ab=96k ac=1
    [ "$profile" = reel ] && { I=-14; TP=-2; ab=128k; ac=2; }
    a=(-af "$(loudnorm_af "$in" $I $TP)" -c:a aac -b:a $ab -ac $ac -ar 48000)
  fi
  local acrf=34; case "$profile" in clip) acrf=36 ;; loop) acrf=38 ;; reel) acrf=32 ;; esac
  # Budget-aware: UI footage fits the MB/min budget at the default CRF; photo-heavy footage (listing
  # tours) may not — then re-encode at CRF +3, at most twice, rather than ship an oversized file.
  local budget=""
  case "$profile" in web|av1) budget=$(python3 -c "import json
try: m=json.load(open('$KUN_DIR/.claude/engine.json')).get('media',{})
except Exception: m={}
b=m.get('av1_mb_per_min',5) if $av1 else m.get('h264_mb_per_min',8)
# budgets are written for 1080p; a screen-sized box (2560x1600, 1080x2340) carries more pixels
print(round(b*max(1,$tw*$th/(1920*1080)),2))") ;; esac
  local pass=0
  while :; do
    if [ "$profile" = draft ]; then
      v=(-c:v h264_videotoolbox -b:v 6M -allow_sw 1)
    elif [ $av1 = 1 ]; then
      v=(-c:v libsvtav1 -preset 6 -crf $acrf -g 240 -svtav1-params tune=0:scm=2:fast-decode=1)
    else
      v=(-c:v libx264 -preset slow -crf $crf -profile:v high -level:v $level -g "$gop" -keyint_min "$((gop / 2))" -sc_threshold 0)
      [ "$profile" = reel ] && v+=(-maxrate 8M -bufsize 16M)
    fi
    ffmpeg -hide_banner -loglevel error -y -i "$in" ${t[@]+"${t[@]}"} -map 0:v:0 -map "0:a:0?" -vf "$vf" -r "$ofps" \
      "${v[@]}" -pix_fmt $pixfmt "${TAGS[@]}" "${a[@]}" -movflags +faststart "$out"
    [ -z "$budget" ] || [ $pass -ge 2 ] && break
    local over; over=$(python3 -c "import subprocess
d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1','$out'],capture_output=True,text=True).stdout or 1)
import os; print(1 if os.path.getsize('$out')/1e6/max(d/60,1/60) > $budget else 0)")
    [ "$over" = 1 ] || break
    pass=$((pass + 1)); crf=$((crf + 3)); acrf=$((acrf + 3))
    echo "encode: over ${budget} MB/min — re-encoding at CRF +3 (pass $pass)" >&2
  done
  mjs probe "$out"
}

cmd_poster() {
  local in="${1:?in}" out="${2:?out.webp}"; shift 2
  local at=1 width=1600
  while [ $# -gt 0 ]; do case "$1" in --at) at="$2"; shift 2 ;; --width) width="$2"; shift 2 ;; *) die "unknown flag $1" ;; esac; done
  ffmpeg -hide_banner -loglevel error -y -ss "$at" -i "$in" -frames:v 1 \
    -vf "scale='min($width,iw)':-2:flags=lanczos" -c:v libwebp -quality 80 "$out"
  echo "{\"poster\":\"$out\",\"bytes\":$(stat -f%z "$out")}"
}

cmd_loudness() {
  ffmpeg -hide_banner -nostats -i "${1:?file}" -filter_complex ebur128=peak=true -f null - 2>&1 |
    sed -n '/Summary:/,$p' | grep -E "I:|LRA:|Peak:" | tr -s ' '
}

cmd_vmaf() {
  local dist="${1:?dist}" ref="${2:?ref}"
  node "$here/media/qa.mjs" "$dist" --ref "$ref" --out "$MEDIA_CACHE/vmaf" >/dev/null || true
  python3 -c "import json;d=json.load(open('$MEDIA_CACHE/vmaf/summary.json'));print(d['results'][0]['vmaf'])"
}

cmd_purge() {
  local deep=0 force=0
  for x in "$@"; do case "$x" in --deep) deep=1 ;; --force) force=1 ;; *) die "unknown flag $x" ;; esac; done
  local days; days=$(python3 -c "import json;print(json.load(open('$KUN_DIR/.claude/engine.json')).get('media',{}).get('cache_days',7))" 2>/dev/null || echo 7)
  local before; before=$(df -g "$HOME" | awk 'NR==2{print $4}')
  find "$HOME/.cache/shoot-sim" -mindepth 1 -maxdepth 1 -mtime +"$days" -exec rm -rf {} + 2>/dev/null || true
  find "$MEDIA_CACHE" -mindepth 1 -maxdepth 1 -mtime +"$days" -exec rm -rf {} + 2>/dev/null || true
  find "$HOME/media/_work" -maxdepth 1 -name '.assembled-*' -mtime +14 -exec rm -rf {} + 2>/dev/null || true
  if [ $deep = 1 ]; then
    # MCP servers run out of ~/.npm/_npx — never pull it from under a live Claude session.
    if [ $force = 0 ] && pgrep -f '(^|/)claude( |$)' >/dev/null 2>&1; then
      die "--deep needs every Claude session closed (MCP servers run from ~/.npm/_npx). Close them, or pass --force."
    fi
    find "$HOME/.npm/_npx" -mindepth 1 -maxdepth 1 -mtime +30 -exec rm -rf {} + 2>/dev/null || true
    # Re-running install makes Playwright drop browser builds that no installation references any more.
    node "$MEDIA_RT/node_modules/playwright-core/cli.js" install chromium >/dev/null 2>&1 || true
  fi
  echo "purge: ${before} → $(df -g "$HOME" | awk 'NR==2{print $4}') GiB free"
}

cmd_doctor() {
  local filters encs; filters="$(ffmpeg -hide_banner -filters 2>/dev/null)"; encs="$(ffmpeg -hide_banner -encoders 2>/dev/null)"
  for f in subtitles libvmaf loudnorm ebur128; do [[ "$filters" == *" $f "* ]] && echo "ffmpeg  $f ok" || echo "ffmpeg  $f MISSING"; done
  for e in libx264 libsvtav1 h264_videotoolbox libwebp; do [[ "$encs" == *" $e "* ]] && echo "ffmpeg  $e ok" || echo "ffmpeg  $e MISSING"; done
  for b in oxipng mlx_whisper mlx_audio.tts.generate ssimulacra2 cwebp aws auto-editor yt-dlp; do
    command -v "$b" >/dev/null && echo "bin     $b ok" || echo "bin     $b MISSING"
  done
  node -e "for (const p of ['sharp','playwright-core']) { try { console.log('node    '+p+' '+require(require.resolve(p+'/package.json',{paths:['$MEDIA_RT']})).version) } catch { console.log('node    '+p+' MISSING') } }"
  for m in mlx-community--whisper-large-v3-turbo mlx-community--chatterbox-multilingual-v3 mlx-community--S3TokenizerV3 mlx-community--S3TokenizerV2; do
    [ -d "$HOME/.cache/huggingface/hub/models--$m" ] && echo "model   ${m#mlx-community--} $(du -sh "$HOME/.cache/huggingface/hub/models--$m" | cut -f1)" || echo "model   ${m#mlx-community--} not downloaded"
  done
  mjs voice status || true
  for d in "$HOME/.cache/shoot-sim" "$MEDIA_CACHE" "$HOME/media/_work" "$HOME/.npm/_npx" "$HOME/Library/Caches/ms-playwright"; do
    [ -d "$d" ] && echo "cache   $(du -sh "$d" 2>/dev/null | cut -f1)  $d"
  done
  df -h "$HOME" | awk 'NR==2{print "disk    "$4" free"}'
}

cmd_setup() { bash "$here/setup.sh"; }

sub="${1:-}"; [ $# -gt 0 ] && shift
case "$sub" in
  setup) cmd_setup ;;
  doctor) cmd_doctor ;;
  purge) cmd_purge "$@" ;;
  encode) cmd_encode "$@" ;;
  poster) cmd_poster "$@" ;;
  loudness) cmd_loudness "$@" ;;
  vmaf) cmd_vmaf "$@" ;;
  derive) mjs derive "$@" ;;
  vtt) mjs vtt "$@" ;;
  publish) mjs publish "$@" ;;
  qa-pack) mjs qa "$@" ;;
  probe) mjs probe "$@" ;;
  voice) mjs voice "$@" ;;
  brand) mjs brand "$@" ;;
  ""|-h|--help|help) sed -n '2,22p' "$0" ;;
  *) die "unknown subcommand: $sub (media.sh help)" ;;
esac
