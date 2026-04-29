#!/usr/bin/env bash
# post-commit.sh — PostToolUse(Bash(git commit:*)) hook.
# After a commit lands, append the SHA + subject to the active issue's thread.
# Silent failure on every error.

set +e
trap 'exit 0' ERR

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ACTIVE_ISSUE="$REPO_ROOT/.claude/state/active-issue.json"

[ ! -f "$ACTIVE_ISSUE" ] && exit 0

NUMBER=$(jq -r '.number // empty' "$ACTIVE_ISSUE" 2>/dev/null)
TARGET_REPO=$(jq -r '.repo // empty' "$ACTIVE_ISSUE" 2>/dev/null)
[ -z "$NUMBER" ] || [ -z "$TARGET_REPO" ] && exit 0

SHA=$(git rev-parse HEAD 2>/dev/null) || exit 0
SUBJECT=$(git log -1 --format=%s 2>/dev/null) || exit 0

LAST_COMMITED=$(jq -r '.commits[-1] // empty' "$ACTIVE_ISSUE" 2>/dev/null)
[ "$LAST_COMMITED" = "$SHA" ] && exit 0

ORIGIN=$(git config --get remote.origin.url 2>/dev/null | sed -E 's|^git@github.com:|https://github.com/|; s|\.git$||')
COMMIT_URL=""
[ -n "$ORIGIN" ] && COMMIT_URL="$ORIGIN/commit/$SHA"

COMMENT_BODY="**Commit \`${SHA:0:8}\`**: $SUBJECT
${COMMIT_URL:+[view diff]($COMMIT_URL)}"

gh issue comment "$NUMBER" --repo "$TARGET_REPO" --body "$COMMENT_BODY" >/dev/null 2>&1 || exit 0

TMP=$(mktemp)
jq --arg sha "$SHA" '.commits += [$sha]' "$ACTIVE_ISSUE" > "$TMP" && mv "$TMP" "$ACTIVE_ISSUE" 2>/dev/null

exit 0
