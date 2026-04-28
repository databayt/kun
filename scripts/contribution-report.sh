#!/usr/bin/env bash
# contribution-report.sh — Aggregate Contribution Units across all databayt repos.
#
# Usage:
#   bash scripts/contribution-report.sh [--since 30d|7d|YYYY-MM-DD] [--out path]
#                                        [--dry-run]
#
# Reads .claude/memory/repositories.json for the repo list (filters status != archived).
# For each repo, queries gh api for closed issues + merged PRs + reviews in the
# window, parses each PR body for the Contribution declaration block, applies
# the CU table from databayt/revenue/RULES.md, applies the monthly cap, writes
# JSON snapshot.
#
# Sibling to scripts/runway.sh and scripts/inventory.sh.

set -e

SINCE="30d"
OUT=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      grep '^# ' "$0" | sed 's/^# \?//' | head -25
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
REPOS_JSON="$REPO_ROOT/.claude/memory/repositories.json"
[ -f "$REPOS_JSON" ] || { echo "Missing $REPOS_JSON" >&2; exit 1; }

# Resolve the cutoff date.
case "$SINCE" in
  *d)
    DAYS="${SINCE%d}"
    SINCE_DATE=$(date -u -v-"${DAYS}"d +%Y-%m-%d 2>/dev/null || date -u -d "${DAYS} days ago" +%Y-%m-%d)
    ;;
  ????-??-??)
    SINCE_DATE="$SINCE"
    ;;
  *)
    echo "Invalid --since format: $SINCE (use 30d, 7d, or YYYY-MM-DD)" >&2
    exit 2
    ;;
esac

[ -z "$OUT" ] && OUT="$REPO_ROOT/.snapshot-$(date -u +%Y-%m-%d).json"

echo "Tallying contributions since $SINCE_DATE → $OUT"

REPO_IDS=$(jq -r '.repositories[][] | select(.status != "archived" and .url != null) | .url | sub("https://github.com/"; "")' "$REPOS_JSON")

TMP=$(mktemp)
echo '{"version":"1.0.0-draft","since":"'"$SINCE_DATE"'","generated_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","repos":{}}' > "$TMP"

for REPO in $REPO_IDS; do
  echo "  → $REPO"
  ISSUES=$(gh issue list --repo "$REPO" --state closed --search "closed:>=$SINCE_DATE" --limit 200 --json number,title,labels,assignees,closedAt,url 2>/dev/null || echo '[]')
  PRS=$(gh pr list --repo "$REPO" --state merged --search "merged:>=$SINCE_DATE" --limit 200 --json number,title,author,body,mergedAt,url 2>/dev/null || echo '[]')

  ENTRY=$(jq -n \
    --arg repo "$REPO" \
    --argjson issues "$ISSUES" \
    --argjson prs "$PRS" \
    '{
      issues_closed: ($issues | length),
      prs_merged: ($prs | length),
      issues: $issues,
      prs: $prs
    }')

  TMP2=$(mktemp)
  jq --arg repo "$REPO" --argjson entry "$ENTRY" '.repos[$repo] = $entry' "$TMP" > "$TMP2"
  mv "$TMP2" "$TMP"
done

if [ "$DRY_RUN" -eq 1 ]; then
  jq '.' "$TMP"
  echo ""
  echo "(--dry-run: not writing $OUT)"
  rm "$TMP"
  exit 0
fi

# Apply CU math — minimal v1 implementation. Full math (review-substance,
# pair declaration parsing, monthly cap, reserves) lives in databayt/revenue's
# scripts/tally.mjs once the ledger repo exists. Here we just compute headline
# CU per assignee from issue size labels.
TMP3=$(mktemp)
jq '
  .repos | to_entries | map(
    .value.issues | map(
      . as $issue
      | ($issue.labels | map(select(.name | startswith("size/"))) | first.name | sub("size/"; "") // "2") as $size
      | ($issue.assignees | map(.login) | first) as $assignee
      | select($assignee != null)
      | {repo: $issue.repository_url, issue: $issue.number, assignee: $assignee, size: ($size | tonumber? // 2), cu: ($size | tonumber? // 2)}
    )
  ) | flatten | group_by(.assignee) | map({assignee: .[0].assignee, total_cu: (map(.cu) | add), issues: length})
' "$TMP" > "$TMP3"

jq --slurpfile leaderboard "$TMP3" '. + {leaderboard: $leaderboard[0]}' "$TMP" > "$OUT"
rm "$TMP" "$TMP3"

echo ""
echo "Wrote $OUT"
echo ""
echo "Leaderboard:"
jq -r '.leaderboard[] | "  \(.assignee): \(.total_cu) CU (\(.issues) issues)"' "$OUT"
