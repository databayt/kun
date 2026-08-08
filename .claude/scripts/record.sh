#!/bin/bash
# record.sh — capture machinery for product flow recordings & screenshots.
# Canonical: kun/.claude/scripts/record.sh — installed to ~/.claude/scripts/ by setup.sh.
# Driven by the /record skill (kun/.claude/skills/record/SKILL.md); technique origin:
# hogwarts memory project_demo_video_recording_otp_2026_08_08.
#
# Library:  ~/databayt/media/<repo>/<block>/<url-slug>--<kind>--<locale>--v<N>.<ext>
# Drive:    My Drive/databayt/media (mirror; local library is the truth)
#
# Subcommands:
#   init                      create the library + manifest
#   start [name]              begin a screen-recording segment (screencapture -v)
#   stop                      end the segment (SIGINT — never plain kill) + verify
#   shot <name>               full-screen still into _work (browser-viewport shots
#                             come from the browser MCP instead)
#   otp                       screenshot the Outlook desktop inbox for the code
#                             (refuses while recording — keeps the inbox off camera)
#   assemble <name>           concat all pending segments into one .mov
#   file <src> --repo R --block B --url U [--kind shot|clip|flow] [--locale ar|en] [--note ...]
#                             normalize the name, move into the library, update manifest
#   sync                      mirror the library to Google Drive (rsync → Finder → advice)
#   stale [repo]              list assets whose block source changed since capture
#   frame                     size Chrome to 1512x982 + dismiss the automation infobar
#   status                    recording state, pending segments, library size, last sync

set -u

LIB="${RECORD_LIBRARY:-$HOME/databayt/media}"
MANIFEST="$LIB/manifest.json"
WORK="$LIB/_work"
PIDFILE="$WORK/.rec.pid"
SEGLIST="$WORK/.segments"
DRIVE_ROOT="${RECORD_DRIVE_ROOT:-$HOME/Library/CloudStorage/GoogleDrive-osmanabdout.jr@gmail.com/My Drive}"
DRIVE_TARGET="$DRIVE_ROOT/databayt/media"

die() { echo "record: $*" >&2; exit 1; }

ensure_lib() {
  mkdir -p "$WORK"
  if [ ! -f "$MANIFEST" ]; then
    cat > "$MANIFEST" <<'JSON'
{
  "$schema": "record-manifest-v1",
  "$comment": "Registry of product flow recordings and screenshots. Managed by record.sh; read by the session-media-stale hook and the /record skill. The local library is the truth; Google Drive is a mirror.",
  "library": "~/databayt/media",
  "drive": "My Drive/databayt/media",
  "assets": []
}
JSON
  fi
}

recording_pid() {
  [ -f "$PIDFILE" ] || return 1
  local pid; pid=$(cat "$PIDFILE" 2>/dev/null)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && { echo "$pid"; return 0; }
  rm -f "$PIDFILE"; return 1
}

cmd_init() { ensure_lib; echo "library ready: $LIB"; }

cmd_start() {
  ensure_lib
  if pid=$(recording_pid); then die "already recording (pid $pid) — run: record.sh stop"; fi
  local name="${1:-take}"
  local n=1
  [ -f "$SEGLIST" ] && n=$(( $(wc -l < "$SEGLIST" | tr -d ' ') + 1 ))
  local out="$WORK/$(printf 'seg-%02d' "$n")--${name}.mov"
  screencapture -v -x "$out" &
  local pid=$!
  echo "$pid" > "$PIDFILE"
  echo "$out" >> "$SEGLIST"
  echo "recording → $out (pid $pid)"
  echo "stop with: record.sh stop   (SIGINT — a plain kill leaves the .mov unfinalized)"
}

cmd_stop() {
  local pid; pid=$(recording_pid) || die "not recording"
  kill -INT "$pid"
  local i=0
  while kill -0 "$pid" 2>/dev/null && [ $i -lt 30 ]; do sleep 0.5; i=$((i+1)); done
  kill -0 "$pid" 2>/dev/null && die "recorder did not exit after SIGINT — do NOT SIGKILL; wait and retry stop"
  rm -f "$PIDFILE"
  local out; out=$(tail -1 "$SEGLIST" 2>/dev/null)
  sleep 1
  if [ -n "$out" ] && [ -f "$out" ]; then
    local dur; dur=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$out" 2>/dev/null)
    echo "segment finalized: $out (${dur:-?}s)"
  else
    die "segment file missing — check $WORK"
  fi
}

cmd_shot() {
  ensure_lib
  local name="${1:-shot}"
  local out="$WORK/shot--${name}--$(date +%H%M%S).png"
  screencapture -x -o "$out"
  echo "$out"
}

cmd_otp() {
  ensure_lib
  if pid=$(recording_pid); then
    die "recording in progress — stop the segment first (the inbox must stay off camera)"
  fi
  local prev
  prev=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null)
  open -a "Microsoft Outlook" 2>/dev/null || die "Microsoft Outlook not found — the OTP lane needs the signed-in desktop app"
  sleep 2
  # New Outlook sometimes runs with no window; open -a raises or creates one.
  # If the capture below shows no inbox, click the Dock icon (see the /record skill).
  local out="$WORK/otp--$(date +%H%M%S).png"
  screencapture -x -o "$out"
  [ -n "$prev" ] && osascript -e "tell application \"$prev\" to activate" 2>/dev/null
  echo "$out"
  echo "read the 4-digit code off this image (codes are 4 digits, 30-min expiry)"
}

cmd_assemble() {
  local name="${1:?usage: record.sh assemble <name>}"
  [ -f "$SEGLIST" ] || die "no pending segments"
  local segs; segs=$(cat "$SEGLIST")
  [ -n "$segs" ] || die "no pending segments"
  if pid=$(recording_pid); then die "still recording (pid $pid) — stop first"; fi
  local listfile="$WORK/.concat.txt" out="$WORK/${name}.mov"
  : > "$listfile"
  while IFS= read -r s; do
    [ -f "$s" ] && printf "file '%s'\n" "$s" >> "$listfile"
  done <<< "$segs"
  local count; count=$(wc -l < "$listfile" | tr -d ' ')
  if [ "$count" = "1" ]; then
    cp "$(head -1 "$SEGLIST")" "$out"
  else
    ffmpeg -y -v error -f concat -safe 0 -i "$listfile" -c copy "$out" || die "ffmpeg concat failed"
  fi
  local dur; dur=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$out" 2>/dev/null)
  echo "assembled $count segment(s) → $out (${dur:-?}s)"
  echo "segments kept in $WORK until you run: record.sh file $out --repo … --block … --url …"
}

cmd_file() {
  ensure_lib
  python3 - "$@" <<'PY'
import json, os, re, shutil, subprocess, sys
from datetime import datetime, timezone

args = sys.argv[1:]
if not args:
    sys.exit("usage: record.sh file <src> --repo R --block B --url U [--kind K] [--locale L] [--note ...]")
src = args[0]
opts = {"kind": None, "locale": "ar", "note": "", "repo": None, "block": None, "url": None, "repo-path": None}
i = 1
while i < len(args):
    k = args[i].lstrip("-")
    if k in opts and i + 1 < len(args):
        opts[k] = args[i + 1]; i += 2
    else:
        i += 1
for req in ("repo", "block", "url"):
    if not opts[req]:
        sys.exit(f"record: --{req} is required")
if not os.path.isfile(src):
    sys.exit(f"record: source not found: {src}")

lib = os.environ["RECORD_LIB"]
manifest_path = os.path.join(lib, "manifest.json")

# URL → slug: drop scheme/host, locale prefix, tenant segment; keep the meaningful path.
path = re.sub(r"^https?://[^/]+", "", opts["url"]) or "/"
segs = [s for s in path.split("/") if s]
if segs and segs[0] in ("ar", "en"):
    segs = segs[1:]
if len(segs) >= 2 and segs[0] == "s":          # /s/<subdomain>/... tenant prefix
    segs = segs[2:]
slug = "-".join(re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-") for s in segs).strip("-").lower() or "home"

ext = os.path.splitext(src)[1].lstrip(".").lower() or "bin"
kind = opts["kind"] or ("shot" if ext in ("png", "jpg", "jpeg", "webp") else "clip")
if kind not in ("shot", "clip", "flow"):
    sys.exit("record: --kind must be shot|clip|flow")
locale = opts["locale"]

dest_dir = os.path.join(lib, opts["repo"], opts["block"])
os.makedirs(dest_dir, exist_ok=True)
stem = f"{slug}--{kind}--{locale}"
existing = [f for f in os.listdir(dest_dir) if re.match(re.escape(stem) + r"--v(\d+)\.", f)]
versions = [int(re.search(r"--v(\d+)\.", f).group(1)) for f in existing]
v = max(versions, default=0) + 1
name = f"{stem}--v{v}.{ext}"
dest = os.path.join(dest_dir, name)

repo_path = opts["repo-path"] or os.path.expanduser(f"~/{opts['repo']}")
sha = ""
try:
    sha = subprocess.run(["git", "-C", repo_path, "rev-parse", "--short", "HEAD"],
                         capture_output=True, text=True, timeout=10).stdout.strip()
except Exception:
    pass

shutil.move(src, dest)
m = json.load(open(manifest_path))
m["assets"].append({
    "file": os.path.relpath(dest, lib),
    "repo": opts["repo"], "block": opts["block"], "url": opts["url"],
    "kind": kind, "locale": locale, "v": v, "sha": sha,
    "capturedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "note": opts["note"],
})
tmp = manifest_path + ".tmp"
json.dump(m, open(tmp, "w"), indent=1, ensure_ascii=False)
os.replace(tmp, manifest_path)
print(dest)
PY
}

cmd_sync() {
  ensure_lib
  if ! pgrep -q "Google Drive" 2>/dev/null; then
    echo "warning: Google Drive desktop is not running — files will sync when it starts" >&2
  fi
  # Lane 1: direct rsync (works once the host app has Full Disk Access / a files grant).
  if mkdir -p "$DRIVE_TARGET" 2>/dev/null && \
     rsync -a --delete --exclude '_work' --exclude '.last-sync' "$LIB/" "$DRIVE_TARGET/" 2>/dev/null; then
    date -u +"%Y-%m-%dT%H:%M:%SZ rsync" > "$LIB/.last-sync"
    echo "synced → $DRIVE_TARGET (rsync)"
    return 0
  fi
  # Lane 2: Finder AppleScript (needs a one-time Automation approval for Finder).
  if osascript >/dev/null 2>&1 <<EOF
set driveRoot to POSIX file "$DRIVE_ROOT"
set libFolder to POSIX file "$LIB"
with timeout of 600 seconds
  tell application "Finder"
    if not (exists folder "databayt" of folder driveRoot) then
      make new folder at folder driveRoot with properties {name:"databayt"}
    end if
    duplicate folder libFolder to folder "databayt" of folder driveRoot with replacing
  end tell
end timeout
EOF
  then
    date -u +"%Y-%m-%dT%H:%M:%SZ finder" > "$LIB/.last-sync"
    echo "synced → $DRIVE_ROOT/databayt/media (Finder copy, whole-library replace)"
    return 0
  fi
  cat >&2 <<'EOT'
record: sync blocked by macOS permissions. Two one-time fixes (either works):
  1. System Settings → Privacy & Security → Full Disk Access → enable your
     terminal app, then rerun: record.sh sync            (enables fast rsync)
  2. Rerun and click "Allow" on the "control Finder" automation prompt
     (enables the Finder copy lane)
The library is safe locally at ~/databayt/media — nothing is lost.
EOT
  return 1
}

cmd_stale() {
  ensure_lib
  python3 - "${1:-}" <<'PY'
import json, os, subprocess, sys

repo_filter = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None
lib = os.environ["RECORD_LIB"]
m = json.load(open(os.path.join(lib, "manifest.json")))
assets = [a for a in m["assets"] if not repo_filter or a["repo"] == repo_filter]
if not assets:
    print("no filed assets" + (f" for {repo_filter}" if repo_filter else "")); sys.exit(0)

def block_path(repo_path, block):
    try:
        b = json.load(open(os.path.join(repo_path, ".claude", "blocks.json")))["blocks"]
        return b.get(block, {}).get("path")
    except Exception:
        return None

stale, fresh, unknown = [], [], []
cache = {}
for a in assets:
    key = (a["repo"], a["block"], a["sha"])
    if key not in cache:
        repo_path = os.path.expanduser(f"~/{a['repo']}")
        bp = block_path(repo_path, a["block"])
        if not a["sha"] or not os.path.isdir(repo_path):
            cache[key] = None
        else:
            spec = [bp] if bp else []
            try:
                r = subprocess.run(["git", "-C", repo_path, "log", "--oneline", f"{a['sha']}..HEAD", "--"] + spec,
                                   capture_output=True, text=True, timeout=15)
                cache[key] = len([l for l in r.stdout.splitlines() if l.strip()]) if r.returncode == 0 else None
            except Exception:
                cache[key] = None
    n = cache[key]
    (unknown if n is None else (stale if n > 0 else fresh)).append((a, n))

for a, n in stale:
    print(f"STALE  {a['repo']}/{a['block']}  {os.path.basename(a['file'])}  ({n} commits since {a['sha']})")
for a, n in unknown:
    print(f"?      {a['repo']}/{a['block']}  {os.path.basename(a['file'])}  (no sha or repo not found)")
print(f"\n{len(stale)} stale / {len(fresh)} fresh / {len(unknown)} unknown of {len(assets)} assets")
if stale:
    blocks = sorted({f"{a['repo']}:{a['block']}" for a, _ in stale})
    print("re-record with the /record skill: " + ", ".join(blocks))
PY
}

cmd_frame() {
  osascript -e 'tell application "Google Chrome" to set bounds of window 1 to {0, 0, 1512, 982}' 2>/dev/null \
    && echo "Chrome window → 1512x982 (full logical screen)" \
    || echo "could not size Chrome (is a window open?)" >&2
  # Best effort: dismiss the "controlled by automated test software" infobar.
  osascript >/dev/null 2>&1 <<'EOF'
tell application "System Events"
  tell process "Google Chrome"
    repeat with g in groups of window 1
      try
        if description of g contains "test software" then click button 1 of g
      end try
    end repeat
  end tell
end tell
EOF
  echo "reminder: enable Do Not Disturb by hand — no automation shortcut exists on this Mac"
  echo "cliclick coords are LOGICAL points = screenshot pixels ÷ 2 on this Retina display"
}

cmd_status() {
  ensure_lib
  if pid=$(recording_pid); then echo "recording: yes (pid $pid)"; else echo "recording: no"; fi
  local pending=0
  [ -f "$SEGLIST" ] && pending=$(wc -l < "$SEGLIST" | tr -d ' ')
  echo "pending segments: $pending"
  echo "library: $LIB ($(du -sh "$LIB" 2>/dev/null | cut -f1 || echo '?'))"
  echo "assets filed: $(python3 -c "import json;print(len(json.load(open('$MANIFEST'))['assets']))" 2>/dev/null || echo 0)"
  echo "last sync: $(cat "$LIB/.last-sync" 2>/dev/null || echo never)"
}

export RECORD_LIB="$LIB"
case "${1:-}" in
  init)     shift; cmd_init "$@" ;;
  start)    shift; cmd_start "$@" ;;
  stop)     shift; cmd_stop "$@" ;;
  shot)     shift; cmd_shot "$@" ;;
  otp)      shift; cmd_otp "$@" ;;
  assemble) shift; cmd_assemble "$@" ;;
  file)     shift; cmd_file "$@" ;;
  sync)     shift; cmd_sync "$@" ;;
  stale)    shift; cmd_stale "$@" ;;
  frame)    shift; cmd_frame "$@" ;;
  status)   shift; cmd_status "$@" ;;
  *) sed -n '2,30p' "$0"; exit 1 ;;
esac
