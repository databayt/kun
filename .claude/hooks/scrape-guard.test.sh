#!/usr/bin/env bash
# scrape-guard.test.sh — behavioural tests for the lead lane's scrape guard.
#
#   bash .claude/hooks/scrape-guard.test.sh
#
# WHY A HOOK NEEDS TESTS
#
# Two failure modes, both silent, both worse than a crash.
#
# 1. STDOUT PROTOCOL. The guard now speaks the documented PreToolUse decision
#    protocol — a single JSON object on stdout carrying
#    `permissionDecision: "ask"`. One stray `echo` anywhere in the script
#    corrupts that object, and the hook then fails OPEN with no visible symptom:
#    the run proceeds, nobody is asked, and the only trace is a scrape that
#    should have paused and didn't. `bash -n` cannot see this. Nothing can,
#    except asserting on stdout — which is what this file does.
#
# 2. CRYING WOLF. The guard matches command TEXT, so it has twice fired on
#    authoring rather than running — `git add` on a scraper file, a grep over
#    the scraper directory. A guard that blocks innocent work teaches people to
#    route around it, and then it protects nothing. The ALLOW cases below matter
#    at least as much as the BLOCK cases.
#
# Exit 0 = all pass. Exit 1 = at least one case regressed.

set -uo pipefail
GUARD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scrape-guard.sh"
[ -f "$GUARD" ] || {
  echo "guard not found at $GUARD"
  exit 1
}

DEDICATED="$HOME/.claude/chrome-fbscrape-profile"
FAIL=0
PASSED=0

# Run the guard with a clean env unless the caller passes overrides, capturing
# stdout and exit code separately — stdout is the protocol channel and must be
# asserted on its own.
run_guard() { # run_guard <command-string> [ENV=VAL ...] ; sets $OUT and $CODE
  local cmd="$1"
  shift
  local payload
  payload=$(python3 -c 'import json,sys;print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$cmd")
  if [ $# -gt 0 ]; then
    OUT=$(printf '%s' "$payload" | env "$@" bash "$GUARD" 2>/dev/null)
  else
    OUT=$(printf '%s' "$payload" | env -u FB_SCRAPE_PROFILE -u FB_SCRAPE_PORT -u FB_SCRAPE_DELAY_MS bash "$GUARD" 2>/dev/null)
  fi
  CODE=$?
}

ok() {
  PASSED=$((PASSED + 1))
  printf '  PASS  %s\n' "$1"
}
bad() {
  FAIL=1
  printf '  FAIL  %s\n       %s\n' "$1" "$2"
}

# ── 1. The protocol case: unthrottled run must ASK, on stdout, exit 0 ────────
#
# NOTE the command choice. It must be a real scrape entrypoint that CLEARS the
# identity and port checks, so execution actually reaches §3. An anonymous
# `scrapling extract` on a school URL is deliberately NOT an entrypoint (that is
# the lane we want unblocked), so using one here would exit at step 1 and this
# test would pass vacuously while asserting nothing. It did, on the first run.
echo "-- stdout decision protocol ---------------------------------"
run_guard 'node scripts/crm/tier4-enricher.js' \
  FB_SCRAPE_PROFILE="$DEDICATED" FB_SCRAPE_PORT=9333
if [ "$CODE" != 0 ]; then
  bad "unthrottled -> ask" "expected exit 0, got $CODE"
elif ! printf '%s' "$OUT" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; then
  bad "unthrottled -> ask" "stdout is not valid JSON: ${OUT:0:120}"
else
  decision=$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["permissionDecision"])' 2>/dev/null)
  event=$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["hookEventName"])' 2>/dev/null)
  [ "$decision" = "ask" ] || bad "unthrottled -> ask" "permissionDecision was '$decision'"
  [ "$event" = "PreToolUse" ] || bad "unthrottled -> ask" "hookEventName was '$event'"
  [ "$decision" = "ask" ] && [ "$event" = "PreToolUse" ] && ok "unthrottled -> permissionDecision=ask on stdout"
fi

# A throttled run is the silent-success case — same entrypoint, so it reaches §3
# too. Any stdout here would be a stray echo leaking into the protocol channel,
# the exact bug this file exists for.
run_guard 'node scripts/crm/tier4-enricher.js' \
  FB_SCRAPE_PROFILE="$DEDICATED" FB_SCRAPE_PORT=9333 FB_SCRAPE_DELAY_MS=4000
if [ "$CODE" = 0 ] && [ -z "$OUT" ]; then ok "throttled -> silent allow, stdout empty"; else
  bad "throttled -> silent allow" "exit=$CODE stdout='${OUT:0:120}'"
fi

# And the early-exit path must ALSO stay stdout-clean: a non-entrypoint command
# never reaches §3, so it must neither ask nor print.
run_guard 'scrapling extract fetch https://example.com out.md'
if [ "$CODE" = 0 ] && [ -z "$OUT" ]; then ok "non-entrypoint -> early exit, stdout empty"; else
  bad "non-entrypoint -> early exit" "exit=$CODE stdout='${OUT:0:120}'"
fi

# ── 2. Blocks stay exit 2, and must not print to stdout either ──────────────
echo "-- hard blocks (exit 2, stdout stays clean) -----------------"
for c in \
  'opencli facebook profile https://web.facebook.com/x -f yaml' \
  'opencli instagram profile someschool' \
  'node scripts/crm/tier4-enricher.js' \
  'scrapling extract fetch https://web.facebook.com/alsanaracademy a.md' \
  'scrapling shell --cdp-url http://127.0.0.1:9222'; do
  run_guard "$c"
  if [ "$CODE" = 2 ] && [ -z "$OUT" ]; then ok "block: ${c:0:52}"; else
    bad "block: ${c:0:52}" "exit=$CODE (want 2) stdout='${OUT:0:80}'"
  fi
done

# Dedicated identity declared but pointed at the vault port -> still a block.
run_guard 'opencli facebook profile https://web.facebook.com/x' \
  FB_SCRAPE_PROFILE="$DEDICATED" FB_SCRAPE_PORT=9222
if [ "$CODE" = 2 ]; then ok "block: dedicated profile but vault port 9222"; else
  bad "block: dedicated profile but vault port 9222" "exit=$CODE (want 2)"
fi

# ── 3. Must NOT cry wolf — authoring and inspection are not running ─────────
echo "-- allow (authoring/inspection/read-only) -------------------"
for c in \
  'npx tsx scripts/crm/contact-gap.ts' \
  'git add scripts/crm/enrich-fb-about.ts' \
  'grep -rn phone scripts/crm/enrich-fb-about.ts' \
  'agent-reach doctor --json' \
  'agent-reach install --env=auto' \
  'scrapling extract get https://qla.edu.qa out.md' \
  'scrapling extract get https://dubaipulse.gov.ae/data/khda-schools k.md' \
  'uv tool install "scrapling[fetchers]"'; do
  run_guard "$c" FB_SCRAPE_DELAY_MS=4000
  if [ "$CODE" = 0 ] && [ -z "$OUT" ]; then ok "allow: ${c:0:52}"; else
    bad "allow: ${c:0:52}" "exit=$CODE (want 0) stdout='${OUT:0:80}'"
  fi
done

echo
if [ "$FAIL" = 0 ]; then
  echo "ALL PASS ($PASSED cases)"
else
  echo "SOME FAILED"
fi
exit "$FAIL"
