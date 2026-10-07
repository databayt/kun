#!/usr/bin/env bash
# media-guard.sh — PreToolUse(Bash): keep media binaries out of git, in every repo.
#
# WHY: product repos ship as `git archive HEAD`, so every committed video rides in every build
# and in history forever — hogwarts carried a 20.5 MB story.mp4 and mkan a 40 MB unreferenced
# hero video before they moved to cdn.databayt.org. Media belongs on the CDN (media.sh publish:
# hashed, immutable keys + a committed manifest), never in the tree. Thmanyah fonts are licensed
# for local use only — committing them is redistribution.
#
# BLOCKS a `git add` / `git commit` that would put into the index:
#   · any video (mp4 mov webm mkv m4v avi), any size
#   · an image or audio file over 2 MiB (png jpg jpeg webp avif gif heic tif tiff wav mp3 m4a aac flac)
#   · any thmanyah* font file
# PDFs are exempt (the curriculum textbooks). Override deliberately: MEDIA_GUARD_ALLOW=1 git commit …
#
# Speaks the PreToolUse JSON protocol on stdout (permissionDecision: deny). Silent and fast for every
# other Bash call. Canonical source: kun/.claude/hooks/ → ~/.claude/hooks/ via setup.sh.
set -uo pipefail
json="$(cat)"
case "$json" in *"git"*) ;; *) exit 0 ;; esac
command -v python3 >/dev/null || exit 0
exec python3 - "$json" <<'PY'
import json, os, re, shlex, subprocess, sys

payload = json.loads(sys.argv[1] or "{}")
cmd = (payload.get("tool_input") or {}).get("command") or ""
if not re.search(r"\bgit\b[^;&|]*\b(add|commit)\b", cmd) or "MEDIA_GUARD_ALLOW=1" in cmd:
    sys.exit(0)

VIDEO = {"mp4", "mov", "webm", "mkv", "m4v", "avi"}
HEAVY = {"png", "jpg", "jpeg", "webp", "avif", "gif", "heic", "tif", "tiff", "wav", "mp3", "m4a", "aac", "flac"}
LIMIT = 2 * 1024 * 1024
cwd = payload.get("cwd") or os.getcwd()

def git(d, *a):
    r = subprocess.run(["git", "-C", d, *a], capture_output=True, text=True)
    return [l for l in r.stdout.splitlines() if l] if r.returncode == 0 else []

hits = []
here = cwd
for seg in re.split(r"&&|\|\||;", cmd):
    try:
        tok = shlex.split(seg)
    except ValueError:
        continue
    if tok[:1] == ["cd"] and len(tok) > 1:
        here = os.path.normpath(os.path.join(here, os.path.expanduser(tok[1])))
        continue
    if "git" not in tok:
        continue
    tok = tok[tok.index("git") + 1:]
    repo = here
    while tok[:1] == ["-C"] and len(tok) > 1:
        repo = os.path.normpath(os.path.join(repo, os.path.expanduser(tok[1]))); tok = tok[2:]
    if not tok or tok[0] not in ("add", "commit"):
        continue
    sub, rest = tok[0], tok[1:]
    specs = [t for t in rest if not t.startswith("-")]
    if sub == "commit":
        # message values are not pathspecs: only what follows `--` or bare paths after flags
        specs = rest[rest.index("--") + 1:] if "--" in rest else []
        files = set(git(repo, "diff", "--cached", "--name-only", "--diff-filter=AM"))
        if "-a" in rest or "--all" in rest:
            files |= set(git(repo, "ls-files", "--modified"))
        if specs:
            files |= set(git(repo, "ls-files", "--modified", "--others", "--exclude-standard", "--", *specs))
    else:
        if any(t in ("-A", "--all", "-u", "--update") for t in rest) and not specs:
            specs = ["."]
        files = set(git(repo, "ls-files", "--modified", "--others", "--exclude-standard", "--", *specs)) if specs else set()
    top = (git(repo, "rev-parse", "--show-toplevel") or [repo])[0]
    for f in sorted(files):
        p = os.path.join(top, f)
        if not os.path.isfile(p):
            continue
        ext = f.rsplit(".", 1)[-1].lower() if "." in f else ""
        size = os.path.getsize(p)
        if ext in VIDEO:
            hits.append(f"{f} — video ({size / 1e6:.1f} MB)")
        elif ext in HEAVY and size > LIMIT:
            hits.append(f"{f} — {ext} {size / 1e6:.1f} MB > 2 MiB")
        elif "thmanyah" in f.lower() and ext in ("ttf", "otf", "woff", "woff2"):
            hits.append(f"{f} — Thmanyah font (licensed for local use only)")

if hits:
    reason = ("media-guard: these would land in git —\n  " + "\n  ".join(hits[:12]) +
              "\nPublish media to the CDN instead (media.sh publish → hashed immutable URL + manifest) "
              "and keep fonts in ~/Library/Fonts. Deliberate exception: prefix MEDIA_GUARD_ALLOW=1.")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}))
PY
