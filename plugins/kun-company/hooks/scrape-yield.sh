#!/usr/bin/env bash
# scrape-yield.sh — PostToolUse(Bash) yield ledger for the lead-acquisition lane.
#
# WHY THIS EXISTS
#
# Every earlier read of this funnel was optimistic, and each was corrected only
# because someone finally measured. "Scrape more" looked like the move until
# contact-gap.ts showed 93.2% of the CRM is a name and a map pin; "enrich the
# 3,000" looked like the move until the same file showed the enrichment ceiling
# is 40 rows. Yield that is remembered rather than measured drifts optimistic.
#
# So: after any scrape / enrich / upsert run, append the contact-gap delta to a
# ledger. The next session reads what the last run actually produced instead of
# inheriting a hope.
#
# WHAT IT DOES NOT DO
#
# It never calls Twenty. A PostToolUse hook that made a network round-trip would
# tax every scrape command with the CRM's latency, and the CRM is a laptop that
# is sometimes asleep. It reads the artifact `contact-gap.ts` already writes —
# `<repo>/scripts/crm/.data/contact-gap.json` — and diffs it against the last
# snapshot it saw. If that file was not refreshed, it says so plainly rather
# than reporting a zero delta as if zero were measured. An unmeasured run is a
# finding, not a silence.
#
# Wired async in settings.json — it must never delay a tool result.

set -uo pipefail

json="$(cat)"
cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

# Only lead-lane runs. contact-gap itself IS included: re-running the measurement
# is exactly when a fresh snapshot lands.
LEAD_RUN='(sudan-schools-scraper|tier[0-9]+-[a-z]+|fb-matrix|dorker|enricher|contact-gap|normalize-contacts|twenty-upsert|contact-hunt|scripts/crm/|crm:(scrape|discover|enrich|upsert|matrix|dork|fb|gap|hunt))'
printf '%s' "$cmd" | grep -Eiq "$LEAD_RUN" || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$HOME/kun}"
LOG="$ROOT/.claude/logs/scrape-runs.log"
SNAP="$ROOT/.claude/logs/.contact-gap-last.json"
mkdir -p "$(dirname "$LOG")" 2>/dev/null

# Which product repo did this run touch? Default hogwarts — the lane's home.
repo="hogwarts"
printf '%s' "$cmd" | grep -q '/mkan\|mkan/' && repo="mkan"
GAP="$HOME/$repo/scripts/crm/.data/contact-gap.json"

now="$(date '+%Y-%m-%d %H:%M:%S')"
short="$(printf '%s' "$cmd" | tr '\n' ' ' | cut -c1-140)"

if [ ! -f "$GAP" ]; then
  printf '[%s] %s  %s\n         yield: UNMEASURED — no %s yet. Run contact-gap.ts to establish a baseline.\n' \
    "$now" "$repo" "$short" "$GAP" >> "$LOG"
  exit 0
fi

read_totals() {
  jq -r '[.totals.CONTACTABLE, .totals.FB_PAGE, .totals.WEBSITE, .totals.MAP_ONLY, (.workableNow|length), .generatedAt] | @tsv' \
    "$1" 2>/dev/null
}

cur="$(read_totals "$GAP")"
[ -z "$cur" ] && exit 0
IFS=$'\t' read -r c_now fb_now web_now map_now work_now gen_now <<< "$cur"

if [ -f "$SNAP" ]; then
  prev="$(read_totals "$SNAP")"
  IFS=$'\t' read -r c_was fb_was web_was map_was work_was gen_was <<< "${prev:-}"
else
  gen_was=""
fi

if [ -z "${gen_was:-}" ]; then
  printf '[%s] %s  %s\n         baseline: contactable %s · fb %s · web %s · map-only %s · workable-now %s (gap file %s)\n' \
    "$now" "$repo" "$short" "$c_now" "$fb_now" "$web_now" "$map_now" "$work_now" "$gen_now" >> "$LOG"
elif [ "$gen_was" = "$gen_now" ]; then
  # The command ran, the measurement did not. Say so — a stale file reporting a
  # zero delta is exactly the false "we covered everything" this hook exists to stop.
  printf '[%s] %s  %s\n         yield: UNMEASURED — contact-gap.json unchanged since %s. Re-run contact-gap.ts to measure this run.\n' \
    "$now" "$repo" "$short" "$gen_was" >> "$LOG"
  exit 0
else
  d() { printf '%+d' "$(( ${1:-0} - ${2:-0} ))"; }
  printf '[%s] %s  %s\n         delta: contactable %s (%s→%s) · fb %s · web %s · map-only %s · workable-now %s (%s→%s)\n' \
    "$now" "$repo" "$short" \
    "$(d "$c_now" "$c_was")" "$c_was" "$c_now" \
    "$(d "$fb_now" "$fb_was")" "$(d "$web_now" "$web_was")" "$(d "$map_now" "$map_was")" \
    "$(d "$work_now" "$work_was")" "$work_was" "$work_now" >> "$LOG"
fi

cp "$GAP" "$SNAP" 2>/dev/null
exit 0
