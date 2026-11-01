#!/usr/bin/env bash
# SessionStart hook — surface the open report-an-issue queue across databayt repos.
#
# Policy (~/.claude/rules/session-start.md, canonical kun/.claude/rules-global/):
#   the hook LISTS, the human CHOOSES. Nothing here is auto-processed. Only
#   issues carrying `accepted` (Abdout took it) or a genuine `verified-report`
#   are fair game for the report agent — and only when someone says `report`.
#
# One GitHub search call for the whole org (was 20 `gh issue list` calls per
# session start, ~10s). Prints a compact table on stdout so it lands in the
# session context; exits 0 always so it never blocks startup.
#
# Canonical copy: kun/.claude/hooks/session-start-reports.sh
# Installed at:   ~/.claude/hooks/session-start-reports.sh

[ -n "${KUN_HEADLESS:-}" ] && exit 0   # headless `claude -p` (kun-claude.sh): context hooks stay silent — nobody reads them, every token is paid
set -u

# Only fire in databayt-owned working trees
git -C "$PWD" remote get-url origin 2>/dev/null | grep -q 'databayt/' || exit 0
command -v gh >/dev/null 2>&1 || exit 0

# Lane order + row format, shared by both sources below.
DEFS='def has($l): ([.labels[].name] | index($l)) != null;
def lane:
  if has("accepted") then "accepted"
  elif has("verified-report") then "verified"
  elif has("team") then "team"
  elif has("needs-human") then "needs-human"
  elif has("low-confidence") then "low-confidence"
  else "legacy" end;
def rank: {accepted:0, verified:1, team:2, "needs-human":3, "low-confidence":4, legacy:5}[lane];
def age: ((now - (.createdAt | fromdateiso8601)) / 86400 | floor);'
BODY='[ .[] | { key: (.repository.name + "#" + (.number|tostring)),
           lane: lane, rank: rank, age: age,
           title: (.title | .[0:70]) } ]
| sort_by(.rank, -.age)
| .[] | "\(.key)\t\(.lane)\t\(.age)d\t\(.title)"'

# aware.mjs caches the same org-wide search every refresh (~/.claude/state/reports.json);
# a fresh cache spares this hook the 1–3 s search that every session start waits on.
rows=""
CACHE="$HOME/.claude/state/reports.json"
if command -v jq >/dev/null 2>&1 && [ -n "$(find "$CACHE" -mmin -30 2>/dev/null)" ]; then
  rows=$(jq -r "$DEFS .rows | $BODY" "$CACHE" 2>/dev/null) || rows=""
  cached=1
fi
if [ -z "${cached:-}" ]; then
  rows=$(gh search issues --owner databayt --label report --state open --limit 50 \
    --json repository,number,title,labels,createdAt,author \
    --jq "$DEFS $BODY" 2>/dev/null) || exit 0
fi

[ -z "$rows" ] && exit 0

total=$(printf '%s\n' "$rows" | wc -l | tr -d ' ')
accepted=$(printf '%s\n' "$rows" | awk -F'\t' '$2=="accepted"' | wc -l | tr -d ' ')
team=$(printf '%s\n' "$rows" | awk -F'\t' '$2=="team"' | wc -l | tr -d ' ')

printf '📋 Open reports: %s (%s accepted, %s from the team). Say "report" to take or reject them.\n' \
  "$total" "$accepted" "$team"
printf '%s\n' "$rows" | head -12 | awk -F'\t' '{ printf "   %-14s %-14s %5s  %s\n", $1, $2, $3, $4 }'
if [ "$total" -gt 12 ]; then
  printf '   … %s more — `report --status` shows all.\n' "$((total - 12))"
fi

exit 0
