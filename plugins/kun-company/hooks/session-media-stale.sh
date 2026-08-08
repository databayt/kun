#!/bin/bash
# SessionStart — stale-recording nudge (the iterate half of the /record loop).
# If the current repo has filed assets in the media library manifest
# (~/databayt/media/manifest.json) whose block source gained commits since
# capture, print a one-line nudge so the session knows a re-record is due.
# Silent and instant in every other case.
# Installed at ~/.claude/hooks/session-media-stale.sh; canonical copy in kun
# (.claude/hooks/ — setup.sh ships everything in that dir user-global).

input=$(cat)
MANIFEST="${RECORD_LIBRARY:-$HOME/databayt/media}/manifest.json"
[ -f "$MANIFEST" ] || exit 0

proj="${CLAUDE_PROJECT_DIR:-$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)}"
[ -d "$proj/.git" ] || exit 0

MANIFEST="$MANIFEST" PROJ="$proj" python3 - <<'PY' 2>/dev/null
import json, os, subprocess, sys

proj = os.environ["PROJ"]
repo = os.path.basename(proj.rstrip("/"))
try:
    assets = json.load(open(os.environ["MANIFEST"]))["assets"]
except Exception:
    sys.exit(0)

pairs = {}
for a in assets:
    if a.get("repo") == repo and a.get("sha"):
        pairs.setdefault((a["block"], a["sha"]), 0)
        pairs[(a["block"], a["sha"])] += 1
if not pairs:
    sys.exit(0)

try:
    blocks = json.load(open(os.path.join(proj, ".claude", "blocks.json")))["blocks"]
except Exception:
    blocks = {}

stale = {}
for (block, sha), count in list(pairs.items())[:20]:
    spec = [blocks[block]["path"]] if block in blocks and blocks[block].get("path") else []
    try:
        r = subprocess.run(["git", "-C", proj, "log", "--oneline", f"{sha}..HEAD", "--"] + spec,
                           capture_output=True, text=True, timeout=10)
        n = len([l for l in r.stdout.splitlines() if l.strip()]) if r.returncode == 0 else 0
    except Exception:
        n = 0
    if n:
        stale[block] = max(stale.get(block, 0), n)

if stale:
    items = ", ".join(f"{b} ({n} commits behind)" for b, n in sorted(stale.items()))
    print(f"🎬 Stale recordings for {repo}: {items} — say 'record <block>' to refresh "
          f"(detail: bash ~/.claude/scripts/record.sh stale {repo})")
PY
exit 0
