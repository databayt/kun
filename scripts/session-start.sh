#!/usr/bin/env bash
# session-start.sh — SessionStart hook for Claude Code.
# Prints at session start:
#   1. Active issue (from .claude/state/active-issue.json)
#   2. Uncommitted changes across all cloned databayt repos
#   3. Open `report` issues across kun + hogwarts
#   4. Signed-commit configuration warning
#   5. Runway + active sprint (from .claude/memory/captain-state.json, if present)

set +e
trap 'exit 0' ERR

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="$REPO_ROOT/.claude/state"
REPOS_JSON="$REPO_ROOT/.claude/memory/repositories.json"
CAPTAIN_STATE="$REPO_ROOT/.claude/memory/captain-state.json"

# 1. Active issue
ACTIVE="$STATE_DIR/active-issue.json"
if [ -f "$ACTIVE" ]; then
  N=$(jq -r '.number // empty' "$ACTIVE" 2>/dev/null)
  R=$(jq -r '.repo // empty' "$ACTIVE" 2>/dev/null)
  T=$(jq -r '.title // empty' "$ACTIVE" 2>/dev/null)
  U=$(jq -r '.url // empty' "$ACTIVE" 2>/dev/null)
  if [ -n "$N" ] && [ -n "$R" ]; then
    STATE=$(gh issue view "$N" --repo "$R" --json state -q .state 2>/dev/null)
    if [ "$STATE" = "OPEN" ]; then
      echo "## Active issue: $R#$N"
      echo "  $T"
      echo "  $U"
      echo ""
    elif [ "$STATE" = "CLOSED" ]; then
      mkdir -p "$STATE_DIR/history" 2>/dev/null
      mv "$ACTIVE" "$STATE_DIR/history/issue-${N}-$(date +%Y%m%d-%H%M%S).json" 2>/dev/null
      echo "## Previous active issue $R#$N is closed — archived."
      echo ""
    fi
  fi
fi

# 2. Uncommitted changes scan
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
    echo "## Uncommitted work"
    echo ""
    echo "$DIRTY"
    echo ""
  fi
fi

# 3. Open `report` issues — kun + hogwarts
for repo in databayt/kun databayt/hogwarts; do
  COUNT=$(gh issue list --repo "$repo" --state open --label "type/report,report" --json number --jq 'length' 2>/dev/null)
  if [ -n "$COUNT" ] && [ "$COUNT" -gt 0 ]; then
    echo "## $repo report issues: $COUNT open"
    gh issue list --repo "$repo" --state open --label "type/report,report" --limit 5 --json number,title --jq '.[] | "- #\(.number) \(.title)"' 2>/dev/null
    echo ""
  fi
done

# 4. Signed-commit configuration warning
SIGN=$(git -C "$REPO_ROOT" config --get commit.gpgsign 2>/dev/null)
KEY=$(git -C "$REPO_ROOT" config --get user.signingkey 2>/dev/null)
if [ "$SIGN" != "true" ] || [ -z "$KEY" ]; then
  echo "## ⚠ Commit signing not configured"
  echo ""
  echo "  Set up once (after this PR ships, signed commits become required on main):"
  echo "    git config --global commit.gpgsign true"
  echo "    git config --global gpg.format ssh"
  echo "    git config --global user.signingkey ~/.ssh/id_ed25519.pub"
  echo "  Add the public key to GitHub: https://github.com/settings/ssh/new (type: signing key)"
  echo ""
fi

# 5. Runway + sprint (optional — only if captain-state.json is present)
if [ -f "$CAPTAIN_STATE" ]; then
  WEEKS=$(jq -r '.runway.weeks // empty' "$CAPTAIN_STATE" 2>/dev/null)
  BURN=$(jq -r '.runway.monthlyBurnUsd // empty' "$CAPTAIN_STATE" 2>/dev/null)
  SPRINT=$(jq -r '.activeSprint.name // empty' "$CAPTAIN_STATE" 2>/dev/null)
  EPICS=$(jq -r '.activeSprint.epics // empty | join(", ")' "$CAPTAIN_STATE" 2>/dev/null)
  [ -n "$WEEKS" ] && [ -n "$BURN" ] && echo "## Runway: $WEEKS weeks @ \$$BURN/mo burn"
  [ -n "$SPRINT" ] && echo "## Active sprint: $SPRINT${EPICS:+ ($EPICS)}"
fi

exit 0
