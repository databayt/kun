#!/usr/bin/env bash
# runway.sh — Compute current runway and update memory.
# Story 16.3 in docs/EPICS-V4.md.
#
# Sources:
#   .claude/memory/team.json         — capital + monthly_burn baseline
#   .claude/memory/revenue.json      — MRR (manually updated or via Stripe routine)
#   ~/.claude/memory/spend-daily.json — actual Anthropic spend (E28.1)
#
# Output:
#   .claude/memory/runway.json       — refreshed snapshot
#
# Usage: bash scripts/runway.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEM="${REPO_ROOT}/.claude/memory"
USER_MEM="${HOME}/.claude/projects/-Users-abdout-kun/memory"

[ -f "${MEM}/runway.json" ] || { echo "fatal: ${MEM}/runway.json not found" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "fatal: jq required" >&2; exit 1; }

# --- read inputs ----------------------------------------------------------

# Capital + burn baseline (from runway.json itself, persistent)
capital=$(jq -r '.capital.amount // 5000' "${MEM}/runway.json")
monthly_burn_baseline=$(jq -r '.burn.monthly // 500' "${MEM}/runway.json")
anthropic_baseline=$(jq -r '.burn.breakdown.anthropic_max // 200' "${MEM}/runway.json")

# Revenue (MRR)
mrr=0
if [ -f "${MEM}/revenue.json" ]; then
  mrr=$(jq -r '.totals.mrr // 0' "${MEM}/revenue.json")
fi

# Actual Anthropic spend (last 30 days, from E28.1 telemetry)
anthropic_actual=0
if [ -f "${USER_MEM}/spend-daily.json" ]; then
  anthropic_actual=$(jq -r '
    [.days[]? | select(.date >= (now - 30*86400 | strftime("%Y-%m-%d"))) | .total_usd]
    | add // 0
  ' "${USER_MEM}/spend-daily.json" 2>/dev/null || echo 0)
fi

# Use higher of baseline or measured actual for forecast (conservative)
if (( $(echo "$anthropic_actual > $anthropic_baseline" | bc -l 2>/dev/null || echo 0) )); then
  anthropic_forecast="$anthropic_actual"
else
  anthropic_forecast="$anthropic_baseline"
fi

# --- compute --------------------------------------------------------------

# Effective monthly burn = baseline non-AI + actual/forecast AI - MRR
non_ai_burn=$(echo "$monthly_burn_baseline - $anthropic_baseline" | bc -l 2>/dev/null || echo "$monthly_burn_baseline")
effective_burn=$(echo "$non_ai_burn + $anthropic_forecast - $mrr" | bc -l 2>/dev/null || echo "$monthly_burn_baseline")

# Defensive: never let burn go below 0 (otherwise weeks_remaining is infinite)
if (( $(echo "$effective_burn <= 0" | bc -l 2>/dev/null || echo 0) )); then
  effective_burn=1
fi

# Weeks remaining = capital / (effective_burn / 4.33 weeks per month)
weeks_remaining=$(echo "scale=0; $capital / ($effective_burn / 4.33)" | bc -l 2>/dev/null || echo 0)
months_remaining=$(echo "scale=1; $capital / $effective_burn" | bc -l 2>/dev/null || echo 0)

# --- write ----------------------------------------------------------------

today=$(date '+%Y-%m-%d')
now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

tmp=$(mktemp)
jq \
  --arg today "$today" \
  --arg now "$now" \
  --argjson capital "$capital" \
  --argjson mrr "$mrr" \
  --argjson anth_forecast "$anthropic_forecast" \
  --argjson anth_actual "$anthropic_actual" \
  --argjson eff_burn "$effective_burn" \
  --argjson weeks "$weeks_remaining" \
  --argjson months "$months_remaining" \
  '.lastUpdated = $today
   | .capital.amount = $capital
   | .capital.asOf = $today
   | .burn.monthly = ($eff_burn | tonumber | floor)
   | .burn.breakdown.anthropic_max = ($anth_forecast | tonumber | floor)
   | .burn.breakdown.anthropic_actual_30d = ($anth_actual | tonumber | floor)
   | .burn.asOf = $today
   | .revenue.mrr = $mrr
   | .revenue.asOf = $today
   | .weeksRemaining = ($weeks | tonumber | floor)
   | .monthsRemaining = ($months | tonumber)' \
  "${MEM}/runway.json" > "$tmp"

mv "$tmp" "${MEM}/runway.json"

echo "Updated: ${MEM}/runway.json"
echo "  Capital:          \$${capital}"
echo "  MRR:              \$${mrr}"
echo "  Anthropic actual: \$${anthropic_actual} (30d)"
echo "  Anthropic forecast: \$${anthropic_forecast}/mo"
echo "  Effective burn:   \$${effective_burn}/mo"
echo "  Weeks remaining:  ${weeks_remaining}"
echo "  Months remaining: ${months_remaining}"

# Trigger captain alert if below threshold
if [ "$weeks_remaining" -lt 12 ] 2>/dev/null; then
  echo
  echo "ALERT: weeks_remaining < 12 — captain rule 'runway-critical' should fire" >&2
fi
if (( $(echo "$anthropic_forecast >= 200" | bc -l 2>/dev/null || echo 0) )); then
  echo
  echo "ALERT: anthropic forecast >= \$200/mo — captain rule 'anthropic-spend-overshoot' should fire" >&2
fi

exit 0
