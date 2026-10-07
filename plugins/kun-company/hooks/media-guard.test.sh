#!/usr/bin/env bash
# media-guard.test.sh — behavioural tests for the media commit guard.
#
#   bash .claude/hooks/media-guard.test.sh
#
# A guard that fails OPEN (a stray echo corrupting the JSON) or cries wolf (blocking a normal
# commit) is worse than none, so both directions are asserted on real git repos in a temp dir.
# Exit 0 = all pass.
set -uo pipefail
GUARD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/media-guard.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0
git -C "$T" init -q && git -C "$T" config user.email t@t && git -C "$T" config user.name t
printf 'x' > "$T/readme.md"
head -c 3145728 /dev/zero > "$T/big.png"
head -c 1024 /dev/zero > "$T/small.png"
head -c 1024 /dev/zero > "$T/clip.mp4"
head -c 4194304 /dev/zero > "$T/book.pdf"
head -c 1024 /dev/zero > "$T/thmanyah-sans-500.ttf"

run() { printf '{"tool_input":{"command":%s},"cwd":"%s"}' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")" "$T" | bash "$GUARD"; }
expect() { # <deny|allow> <command>
  local out; out="$(run "$2")"
  if [ "$1" = deny ]; then
    printf '%s' "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["hookSpecificOutput"]["permissionDecision"]=="deny"' 2>/dev/null \
      && echo "ok   deny  $2" || { echo "FAIL deny  $2 → ${out:-<empty>}"; fail=1; }
  else
    [ -z "$out" ] && echo "ok   allow $2" || { echo "FAIL allow $2 → $out"; fail=1; }
  fi
}

expect allow "ls -la"
expect allow "git status"
expect allow "git add readme.md small.png book.pdf"
expect deny  "git add big.png"
expect deny  "git add clip.mp4 readme.md"
expect deny  "git add thmanyah-sans-500.ttf"
expect deny  "git add -A"
expect deny  "git add . && git commit -m 'wip'"
expect allow "MEDIA_GUARD_ALLOW=1 git add big.png"
expect allow "git commit -m 'adds big.png in the message only' -- readme.md"
git -C "$T" add clip.mp4 2>/dev/null
expect deny  "git commit -m 'staged video'"
git -C "$T" reset -q clip.mp4
expect allow "git commit -m 'nothing heavy staged'"
expect deny  "cd $T && git add big.png"
expect deny  "git -C $T add clip.mp4"

[ $fail = 0 ] && echo "media-guard: all cases pass" || echo "media-guard: FAILURES"
exit $fail
