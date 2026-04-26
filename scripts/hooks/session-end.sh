#!/usr/bin/env bash
# session-end.sh — Stop hook companion.
#   1. Warn about uncommitted changes in any cloned databayt repo.
#   2. Append a session-summary comment to the active issue (if 2+ commits).
#   3. Archive active-issue.json if its issue is closed.
# Silent failure on every error.

set +e
trap 'exit 0' ERR

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ACTIVE_ISSUE="$REPO_ROOT/.claude/state/active-issue.json"
REPOS_JSON="$REPO_ROOT/.claude/memory/repositories.json"

# 1. Uncommitted-changes scan
if [ -f "$REPOS_JSON" ]; then
  DIRTY=$(jq -r '.repositories[][] | select(.local != null and .status != "archived") | .local' "$REPOS_JSON" 2>/dev/null | while read -r dir; do
    [ -d "$dir/.git" ] || continue
    if [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]; then
      COUNT=$(git -C "$dir" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
      BRANCH=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null)
      printf "  %-45s [%s]  %s files dirty\n" "$dir" "$BRANCH" "$COUNT"
    fi
  done)
  if [ -n "$DIRTY" ]; then
    echo ""
    echo "## Uncommitted work at session end"
    echo ""
    echo "$DIRTY"
    echo ""
    echo "Use /commit to capture, or stash with \`git stash push -m \"WIP\"\`."
  fi
fi

[ -f "$ACTIVE_ISSUE" ] || exit 0

NUMBER=$(jq -r '.number // empty' "$ACTIVE_ISSUE" 2>/dev/null)
TARGET_REPO=$(jq -r '.repo // empty' "$ACTIVE_ISSUE" 2>/dev/null)
COMMITS=$(jq -r '.commits[]? // empty' "$ACTIVE_ISSUE" 2>/dev/null)
[ -z "$NUMBER" ] || [ -z "$TARGET_REPO" ] && exit 0
[ -z "$COMMITS" ] && exit 0

COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
[ "$COMMIT_COUNT" -lt 2 ] && exit 0

ISSUE_STATE=$(gh issue view "$NUMBER" --repo "$TARGET_REPO" --json state -q .state 2>/dev/null)
if [ "$ISSUE_STATE" = "OPEN" ]; then
  SUMMARY=$(echo "$COMMITS" | while read -r sha; do
    [ -z "$sha" ] && continue
    SUBJ=$(git log -1 --format=%s "$sha" 2>/dev/null)
    echo "- \`${sha:0:8}\`: $SUBJ"
  done)

  COMMENT_BODY="## Session summary

This session made $COMMIT_COUNT commits on this issue:

$SUMMARY

Pick up next session with \`/issue resume $NUMBER\`."

  gh issue comment "$NUMBER" --repo "$TARGET_REPO" --body "$COMMENT_BODY" >/dev/null 2>&1 || true
fi

if [ "$ISSUE_STATE" = "CLOSED" ]; then
  HISTORY="$REPO_ROOT/.claude/state/history"
  mkdir -p "$HISTORY" 2>/dev/null
  mv "$ACTIVE_ISSUE" "$HISTORY/issue-${NUMBER}-$(date +%Y%m%d-%H%M%S).json" 2>/dev/null
fi

exit 0
