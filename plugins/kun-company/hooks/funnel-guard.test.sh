#!/usr/bin/env bash
# funnel-guard.test.sh — behavioural tests for the conversion lane's send guard.
#
#   bash .claude/hooks/funnel-guard.test.sh
#
# WHY A HOOK NEEDS TESTS
#
# funnel-guard runs on EVERY Bash call in EVERY kun session. `bash -n` proves it
# parses; it proves nothing about whether it blocks the right things. The first
# version passed `bash -n` and then blocked its own author three times inside an
# hour while that author was editing the funnel lane — a heredoc writing a
# refusal message, a patch quoting the flag, a fixture listing commands. All
# three were authoring, not sending.
#
# That failure mode is worse than it sounds: a guard that fires on innocent work
# teaches people to route around it, and then it is not protecting anything. So
# the false-positive cases below matter as much as the blocking ones, and both
# are asserted here.
#
# Exit 0 = all pass. Exit 1 = at least one case regressed.

set -uo pipefail
GUARD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/funnel-guard.sh"
[ -f "$GUARD" ] || { echo "guard not found at $GUARD"; exit 1; }

# Split so this file's own text can never trip the guard it tests.
A="--app""ly"
S="--seg""ment=owner-mid-sd-now"
T="--templ""ated-only"

pass=0; fail=0
check() { # <expected-exit> <label> <command-string>
  local want="$1" label="$2" cmd="$3" got
  printf '%s' "$(jq -n --arg c "$cmd" '{tool_input:{command:$c}}')" | bash "$GUARD" >/dev/null 2>&1
  got=$?
  if [ "$got" = "$want" ]; then printf '  ✓ %s\n' "$label"; pass=$((pass+1))
  else printf '  ✗ FAIL exit=%s want=%s | %s\n' "$got" "$want" "$label"; fail=$((fail+1)); fi
}

echo "── passes through (must never block ordinary work) ──"
check 0 "unrelated command"                "ls -la"
check 0 "read-only scrape untouched"       "npx tsx scripts/crm/contact-gap.ts"
check 0 "funnel dry run"                   "npx tsx scripts/funnel/tick.ts"

echo "── blocks a real unsafe send ──"
check 2 "apply with no segment"            "npx tsx scripts/funnel/tick.ts $A"
check 2 "drain with no approval source"    "npx tsx scripts/funnel/drain.ts $A $S"
check 2 "unsafe send after a cd"           "cd /x && npx tsx scripts/funnel/drain.ts $A $S"
check 2 "unsafe send on a later line"      "cd /x && npx tsx scripts/crm/outreach-cadence.ts $A"

echo "── allows a deliberate, safe send ──"
check 0 "apply + segment"                  "npx tsx scripts/funnel/tick.ts $A $S --limit=10"
check 0 "drain + templated-only"           "npx tsx scripts/funnel/drain.ts $A $S $T"
check 0 "drain + approved-by"              "npx tsx scripts/funnel/drain.ts $A $S --approved-by=abdout"
check 0 "safe drain after a cd"            "cd /x && npx tsx scripts/funnel/drain.ts $A $S $T"

echo "── authoring is not sending (the regression that started this) ──"
check 0 "echo writing a send command"      "echo 'npx tsx scripts/funnel/tick.ts $A' > notes.txt"
check 0 "sed writing a send command"       "sed -i '' 's|x|scripts/funnel/drain.ts $A|' f.ts"
check 0 "heredoc mentioning the flag"      "$(printf 'python3 - <<PY\nprint("outreach-cadence %s is disabled")\nPY' "$A")"
check 0 "cd && python heredoc"             "$(printf 'cd /Users/abdout/mkan && python3 - <<PY\ns = "outreach-cadence.ts %s blocked"\nPY' "$A")"
check 0 "cat heredoc writing a script"     "$(printf 'cat > f.ts <<EOF\n// %s refuses here\nEOF' "$A")"

echo "── $pass passed, $fail failed"
[ "$fail" = 0 ]
