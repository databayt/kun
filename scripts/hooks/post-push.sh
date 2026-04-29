#!/usr/bin/env bash
# post-push.sh — PostToolUse(Bash(git push:*)) hook.
# After push, capture PR URL (if a draft PR exists) and remind to watch CI.

set +e
trap 'exit 0' ERR

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ACTIVE_ISSUE="$REPO_ROOT/.claude/state/active-issue.json"

[ ! -f "$ACTIVE_ISSUE" ] && exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$BRANCH" in main|HEAD) exit 0 ;; esac

PR_URL=$(gh pr view --json url -q .url 2>/dev/null) || true

if [ -n "$PR_URL" ]; then
  TMP=$(mktemp)
  jq --arg url "$PR_URL" '.pr_url = $url' "$ACTIVE_ISSUE" > "$TMP" && mv "$TMP" "$ACTIVE_ISSUE" 2>/dev/null
  echo "Pushed. PR: $PR_URL"
  echo "Watch CI:  gh pr checks --watch"
else
  echo "Pushed branch '$BRANCH'. No PR yet — run /pr to open a draft PR."
fi

exit 0
