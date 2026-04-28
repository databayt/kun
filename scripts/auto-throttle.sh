#!/usr/bin/env bash
# auto-throttle.sh — Apply E28.5 throttle policy when forecast > $180/mo.
# Story 28.5 in docs/EPICS-V4.md.
#
# Reads:
#   ~/.claude/memory/spend-daily.json — produced by Routine cost-watcher (23.4)
#   .claude/memory/runway.json        — produced by scripts/runway.sh (16.3)
# Writes:
#   .claude/routines/throttle.json    — read by other hooks/routines to know what to skip
#
# Invoked by: Routine cost-watcher (after writing spend-daily.json) or manually.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_MEM="${HOME}/.claude/projects/-Users-abdout-kun/memory"
PROJECT_MEM="${REPO_ROOT}/.claude/memory"
THROTTLE="${REPO_ROOT}/.claude/routines/throttle.json"

command -v jq >/dev/null 2>&1 || { echo "fatal: jq required" >&2; exit 1; }
mkdir -p "$(dirname "$THROTTLE")" 2>/dev/null

# --- Inputs --------------------------------------------------------------

projected_monthly=0
if [ -f "${USER_MEM}/spend-daily.json" ]; then
  # Sum trailing-7-day spend × 30/7
  projected_monthly=$(jq -r '
    [.days // [] | .[] | select(.date >= (now - 7*86400 | strftime("%Y-%m-%d"))) | .total_usd]
    | add // 0
    | . * (30 / 7)
  ' "${USER_MEM}/spend-daily.json" 2>/dev/null || echo 0)
fi

weeks_remaining=0
if [ -f "${PROJECT_MEM}/runway.json" ]; then
  weeks_remaining=$(jq -r '.weeksRemaining // 0' "${PROJECT_MEM}/runway.json")
fi

# --- Decide --------------------------------------------------------------

throttle_active=false
reason=""
skip_prompt_logging=false
pilot_health_cadence="hourly"
captain_model_downshift=false

# Threshold 1: monthly forecast > $180
if (( $(echo "$projected_monthly > 180" | bc -l 2>/dev/null || echo 0) )); then
  throttle_active=true
  reason="monthly_forecast=${projected_monthly}>180"
  skip_prompt_logging=true
  pilot_health_cadence="every-4-hours"
fi

# Threshold 2: runway < 12 weeks (existential)
if [ "$weeks_remaining" -lt 12 ] 2>/dev/null && [ "$weeks_remaining" -gt 0 ] 2>/dev/null; then
  throttle_active=true
  reason="${reason:+$reason; }weeks_remaining=${weeks_remaining}<12"
  skip_prompt_logging=true
  pilot_health_cadence="every-12-hours"
  captain_model_downshift=true
fi

# --- Write throttle.json -------------------------------------------------

ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

jq -n \
  --argjson active "$throttle_active" \
  --arg reason "$reason" \
  --argjson projected "$projected_monthly" \
  --argjson weeks "$weeks_remaining" \
  --argjson skip_prompt "$skip_prompt_logging" \
  --arg pilot_cadence "$pilot_health_cadence" \
  --argjson downshift "$captain_model_downshift" \
  --arg ts "$ts" \
  '{
    last_updated: $ts,
    active: $active,
    reason: $reason,
    inputs: {
      projected_monthly_usd: $projected,
      weeks_remaining: $weeks
    },
    actions: {
      skip_prompt_logging: $skip_prompt,
      pilot_health_cadence: $pilot_cadence,
      captain_model_downshift: $downshift
    }
  }' > "$THROTTLE"

echo "Wrote: $THROTTLE"
echo "  Active:                $throttle_active"
echo "  Reason:                ${reason:-none}"
echo "  Projected monthly:     \$${projected_monthly}"
echo "  Weeks remaining:       ${weeks_remaining}"
echo "  Pilot health cadence:  $pilot_health_cadence"
echo "  Skip prompt logging:   $skip_prompt_logging"
echo "  Captain downshift:     $captain_model_downshift"

# --- Dispatch if active -------------------------------------------------

if [ "$throttle_active" = "true" ]; then
  echo
  echo "ALERT: throttle activated. Captain should be notified." >&2
  # In a real session, this would call /dispatch — but as a script, we just
  # write a marker file the next session's SessionStart hook picks up.
  echo "${ts}: throttle activated — ${reason}" >> "${USER_MEM}/throttle-alerts.log"
fi

exit 0
