#!/usr/bin/env bash
# auto-issue.sh — UserPromptSubmit hook that auto-creates a GitHub issue when a
# prompt looks like a real work request and no active issue is set.
#
# Triggers ONLY when:
#   - the prompt matches the work-request regex
#   - .claude/state/active-issue.json does NOT exist
#   - .claude/state/auto-issue-disabled does NOT exist (kill-switch)
#   - the daily counter has not exceeded the cap
#
# On success, writes .claude/state/active-issue.json with the issue number, and
# emits an `additionalContext` JSON envelope so Claude sees the new issue right
# away. On any failure, exits 0 silently — hooks must NEVER block the user.
#
# Reads stdin: { "prompt": "...", "session_id": "...", ... }

set +e
trap 'exit 0' ERR

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="$REPO_ROOT/.claude/state"
ACTIVE_ISSUE="$STATE_DIR/active-issue.json"
DISABLED="$STATE_DIR/auto-issue-disabled"
COUNTER="$STATE_DIR/auto-issue-counter.json"
CAP_PER_DAY=20
WORK_REGEX='(add|fix|build|create|implement|deploy|refactor|wire|ship|migrate|update|setup|install|enable|disable|remove|delete|rename|rewrite|integrate|connect|generate)'

mkdir -p "$STATE_DIR" 2>/dev/null

[ -f "$ACTIVE_ISSUE" ] && exit 0
[ -f "$DISABLED" ] && exit 0

INPUT=$(cat 2>/dev/null || true)
[ -z "$INPUT" ] && exit 0

PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null)
[ -z "$PROMPT" ] && exit 0

[ ${#PROMPT} -lt 30 ] && exit 0

echo "$PROMPT" | head -c 2000 | grep -qiE "$WORK_REGEX" || exit 0

echo "$PROMPT" | grep -qiE '(--dry-run|do not create issue|no issue|skip issue)' && exit 0

TODAY=$(date +%Y-%m-%d)
STORED_DAY=""
STORED_COUNT=0
if [ -f "$COUNTER" ]; then
  STORED_DAY=$(jq -r '.day // empty' "$COUNTER" 2>/dev/null)
  STORED_COUNT=$(jq -r '.count // 0' "$COUNTER" 2>/dev/null)
  if [ "$STORED_DAY" = "$TODAY" ] && [ "$STORED_COUNT" -ge "$CAP_PER_DAY" ]; then
    exit 0
  fi
fi

# Resolve repo from cwd via repositories.json.
REPOS_JSON="$REPO_ROOT/.claude/memory/repositories.json"
TARGET_REPO=""
if [ -f "$REPOS_JSON" ]; then
  CWD=$(pwd)
  TARGET_REPO=$(jq -r --arg cwd "$CWD" '
    [.repositories[][] | select(.local != null and (.local == $cwd or ($cwd | startswith(.local + "/"))))]
    | first | "databayt/" + .id
  ' "$REPOS_JSON" 2>/dev/null)
fi
case "$TARGET_REPO" in ""|"databayt/null") TARGET_REPO="databayt/kun" ;; esac

TITLE_RAW=$(echo "$PROMPT" | head -1 | head -c 65)
TITLE=$(echo "$TITLE_RAW" | sed -E 's/^["'"'"'[:space:]]+|["'"'"'[:space:]]+$//g')

# Detect type with regex hints — falls back to feat.
TYPE_LABEL="type/feat"
PREFIX="[Feat]:"
if echo "$PROMPT" | grep -qiE '\b(fix|bug|broken|fail|crash|error)\b'; then
  TYPE_LABEL="type/fix"
  PREFIX="[Fix]:"
elif echo "$PROMPT" | grep -qiE '\b(deps|bump|upgrade|chore|cleanup|tooling|ci)\b'; then
  TYPE_LABEL="type/chore"
  PREFIX="[Chore]:"
elif echo "$PROMPT" | grep -qiE '\b(docs|documentation|readme)\b'; then
  TYPE_LABEL="type/docs"
  PREFIX="[Docs]:"
fi

ISSUE_BODY=$(printf '%s\n\n%s\n\n%s\n\n%s\n' \
  "## Auto-captured from prompt" \
  "> $PROMPT" \
  "## Acceptance criteria

- [ ] Define
- [ ] Verify" \
  "## Origin

Auto-created by \`scripts/hooks/auto-issue.sh\` from a UserPromptSubmit event.
Refine title/body via \`gh issue edit\` or \`/issue resume\`.")

URL=$(gh issue create \
  --repo "$TARGET_REPO" \
  --title "$PREFIX $TITLE" \
  --body "$ISSUE_BODY" \
  --label "$TYPE_LABEL,priority/p2,status/triage,auto-created" \
  2>/dev/null) || exit 0

[ -z "$URL" ] && exit 0

NUMBER=$(echo "$URL" | grep -oE '[0-9]+$')
[ -z "$NUMBER" ] && exit 0

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$ACTIVE_ISSUE" <<EOF
{
  "repo": "$TARGET_REPO",
  "number": $NUMBER,
  "title": "$PREFIX $TITLE",
  "url": "$URL",
  "branch": null,
  "commits": [],
  "pr_url": null,
  "started_at": "$NOW",
  "auto_created": true
}
EOF

NEW_COUNT=$((STORED_COUNT + 1))
[ "$STORED_DAY" = "$TODAY" ] || NEW_COUNT=1
cat > "$COUNTER" <<EOF
{ "day": "$TODAY", "count": $NEW_COUNT }
EOF

cat <<EOF
{
  "hookSpecificOutput": {
    "additionalContext": "## Auto-created issue: $TARGET_REPO#$NUMBER\n$URL\nTitle: $PREFIX $TITLE\nLabels: $TYPE_LABEL, priority/p2, status/triage, auto-created\n\nThis is now the active issue. Use /branch to start work, /commit to commit (Refs #$NUMBER), /pr to open the PR (Closes #$NUMBER), /close to finish."
  }
}
EOF

exit 0
