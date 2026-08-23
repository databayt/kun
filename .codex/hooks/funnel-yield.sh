#!/usr/bin/env bash
# funnel-yield.sh — PostToolUse(Bash) conversion ledger for the funnel lane.
#
# WHY THIS EXISTS
#
# This lane has never converted anything: 0 sessions, 0 gates instrumented, 0
# paying schools. That makes it maximally vulnerable to the failure its sibling
# lane already learned the hard way — a number that is remembered rather than
# measured drifts optimistic, and "the funnel is working" is the easiest thing
# in this repo to believe without evidence.
#
# So: after any funnel tick, drain or gate read, append the gate-count delta to
# a ledger. The next session reads what the last run actually moved instead of
# inheriting a hope. A run that moved nothing is a finding, not a silence.
#
# WHAT IT DOES NOT DO
#
# It never calls Twenty or Postgres. A PostToolUse hook that made a network
# round-trip would tax every command with the CRM's latency, and the CRM is a
# laptop that is sometimes asleep. It reads the artifact the tick already writes
# — `<repo>/scripts/crm/.data/funnel-gates.json` — and diffs it against the last
# snapshot it saw. If that file was not refreshed it says UNMEASURED plainly,
# rather than reporting a zero delta as though zero had been measured.
#
# Wired async in settings.json — it must never delay a tool result.

set -uo pipefail

json="$(cat)"
cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // .toolCall.args.CommandLine // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

# Only funnel-lane runs. The gate read itself IS included: re-running the
# measurement is exactly when a fresh snapshot lands.
# Narrow on purpose: matching all of scripts/crm/ would make every ordinary scrape
# command append an UNMEASURED line to this lane's ledger, which is noise that trains
# people to stop reading it.
FUNNEL_RUN='(funnel-(tick|drain|gates)|drain-funnel|funnel-drafts|sendFunnelTouch|outreach-cadence|promoteToLead|seed-funnel-fields|crm:(funnel|nudge|gates|drain)|scripts/funnel/)'
printf '%s' "$cmd" | grep -Eiq "$FUNNEL_RUN" || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$HOME/kun}"
LOG="$ROOT/.claude/logs/funnel-runs.log"
SNAP="$ROOT/.claude/logs/.funnel-gates-last.json"
mkdir -p "$(dirname "$LOG")" 2>/dev/null

repo="hogwarts"
printf '%s' "$cmd" | grep -q '/mkan\|mkan/' && repo="mkan"
GATES="$HOME/$repo/scripts/crm/.data/funnel-gates.json"

now="$(date '+%Y-%m-%d %H:%M:%S')"
short="$(printf '%s' "$cmd" | tr '\n' ' ' | cut -c1-140)"

if [ ! -f "$GATES" ]; then
  printf '[%s] %s  %s\n         movement: UNMEASURED — no %s yet. The funnel is not instrumented; that is the current true state, not an error.\n' \
    "$now" "$repo" "$short" "$GATES" >> "$LOG"
  exit 0
fi

read_gates() {
  # Gate names match the ladder LIVE in the workspace (measured 2026-08-18), not the
  # one drafted on paper: WARM is replied, DISCOVERY is qualified, PAID is customer.
  jq -r '[.gates.PROSPECT, .gates.WARM, .gates.DISCOVERY, .gates.DEMO, .gates.TRIAL, .gates.PILOT, .gates.PAID, .gates.DORMANT, .generatedAt] | @tsv' \
    "$1" 2>/dev/null
}

cur="$(read_gates "$GATES")"
[ -z "$cur" ] && exit 0
IFS=$'\t' read -r p_now w_now di_now de_now tr_now pi_now pa_now d_now gen_now <<< "$cur"

if [ -f "$SNAP" ]; then
  prev="$(read_gates "$SNAP")"
  IFS=$'\t' read -r p_was w_was di_was de_was tr_was pi_was pa_was d_was gen_was <<< "${prev:-}"
else
  gen_was=""
fi

if [ -z "${gen_was:-}" ]; then
  printf '[%s] %s  %s\n         baseline: prospect %s · warm %s · discovery %s · demo %s · trial %s · pilot %s · paid %s · dormant %s (gates file %s)\n' \
    "$now" "$repo" "$short" "$p_now" "$w_now" "$di_now" "$de_now" "$tr_now" "$pi_now" "$pa_now" "$d_now" "$gen_now" >> "$LOG"
elif [ "$gen_was" = "$gen_now" ]; then
  # The command ran, the measurement did not. A stale file reporting a zero
  # delta is exactly the false "it's working" this hook exists to stop.
  printf '[%s] %s  %s\n         movement: UNMEASURED — funnel-gates.json unchanged since %s. Re-run the gates stage to measure this run.\n' \
    "$now" "$repo" "$short" "$gen_was" >> "$LOG"
  exit 0
else
  d() { printf '%+d' "$(( ${1:-0} - ${2:-0} ))"; }
  printf '[%s] %s  %s\n         delta: prospect %s · warm %s · discovery %s · demo %s · trial %s · pilot %s · PAID %s (%s→%s) · dormant %s\n' \
    "$now" "$repo" "$short" \
    "$(d "$p_now" "$p_was")" "$(d "$w_now" "$w_was")" "$(d "$di_now" "$di_was")" \
    "$(d "$de_now" "$de_was")" "$(d "$tr_now" "$tr_was")" "$(d "$pi_now" "$pi_was")" \
    "$(d "$pa_now" "$pa_was")" "$pa_was" "$pa_now" "$(d "$d_now" "$d_was")" >> "$LOG"
fi

cp "$GATES" "$SNAP" 2>/dev/null
exit 0
