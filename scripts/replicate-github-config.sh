#!/usr/bin/env bash
# replicate-github-config.sh — Copy the unified .github/ kit from kun to all
# 13 databayt repos and open a PR per repo.
#
# Usage:
#   bash scripts/replicate-github-config.sh                     # all live repos
#   bash scripts/replicate-github-config.sh --repos hogwarts,souq
#   bash scripts/replicate-github-config.sh --dry-run           # preview only
#   bash scripts/replicate-github-config.sh --delay 24h         # stagger
#
# Reads .claude/memory/repositories.json + area-dropdowns.json. Per repo, copies:
#   .github/ISSUE_TEMPLATE/*.yml (with per-repo area dropdown injected)
#   .github/PULL_REQUEST_TEMPLATE.md
#   .github/CODEOWNERS
#   .github/labeler.yml
#   .github/dependabot.yml
#   .github/workflows/*.yml
#   commitlint.config.js
#   .husky/commit-msg + pre-commit
#   .lintstagedrc.json
#
# For hogwarts (special case — already has 80% of the kit), only patches gaps:
# adds the 3 new workflows (auto-status, signed-commits, contribution-declaration)
# plus the Contribution declaration block in PULL_REQUEST_TEMPLATE.md.
#
# Each replicated repo gets a branch `chore/N-adopt-unified-github-config`
# (issue # auto-created if not provided).

set -e

DRY_RUN=0
DELAY="0s"
TARGET_REPOS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --delay) DELAY="$2"; shift 2 ;;
    --repos) TARGET_REPOS="$2"; shift 2 ;;
    -h|--help) grep '^# ' "$0" | sed 's/^# \?//' | head -25; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
REPOS_JSON="$REPO_ROOT/.claude/memory/repositories.json"
AREAS_JSON="$REPO_ROOT/.claude/memory/area-dropdowns.json"
KIT_ROOT="$REPO_ROOT"

[ -f "$REPOS_JSON" ] || { echo "Missing $REPOS_JSON" >&2; exit 1; }
[ -f "$AREAS_JSON" ] || { echo "Missing $AREAS_JSON" >&2; exit 1; }

if [ -n "$TARGET_REPOS" ]; then
  REPO_LIST=$(echo "$TARGET_REPOS" | tr ',' '\n')
else
  REPO_LIST=$(jq -r '.repositories[][] | select(.local != null and .status != "archived" and .id != "kun") | .id' "$REPOS_JSON")
fi

echo "Replicating .github/ kit from $KIT_ROOT to:"
echo "$REPO_LIST" | sed 's/^/  /'
echo ""

[ "$DRY_RUN" -eq 1 ] && echo "(--dry-run: showing what would happen, not making changes)" && echo ""

for ID in $REPO_LIST; do
  ENTRY=$(jq -c --arg id "$ID" '.repositories[][] | select(.id == $id)' "$REPOS_JSON")
  [ -z "$ENTRY" ] && { echo "Unknown repo: $ID — skipping"; continue; }

  LOCAL=$(echo "$ENTRY" | jq -r '.local // empty')
  URL=$(echo "$ENTRY" | jq -r '.url // empty')
  REMOTE=$(echo "$URL" | sed -E 's|https://github.com/||')
  [ -z "$LOCAL" ] && { echo "  $ID: no local clone — skipping"; continue; }
  [ -d "$LOCAL/.git" ] || { echo "  $ID: $LOCAL is not a git repo — skipping"; continue; }

  echo "→ $ID ($REMOTE) at $LOCAL"

  AREAS=$(jq -c --arg id "$ID" '.repos[$id] // .repos.kun' "$AREAS_JSON")
  [ "$AREAS" = "null" ] && AREAS='["other"]'

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  would copy: .github/ISSUE_TEMPLATE/*.yml (with area: $AREAS)"
    echo "  would copy: .github/PULL_REQUEST_TEMPLATE.md, CODEOWNERS, labeler.yml, dependabot.yml"
    echo "  would copy: .github/workflows/*.yml"
    echo "  would copy: commitlint.config.js, .husky/*, .lintstagedrc.json"
    echo "  would open PR: chore(workflow): adopt unified databayt github config"
    [ "$DELAY" != "0s" ] && [ -n "$DELAY" ] && echo "  would sleep: $DELAY"
    echo ""
    continue
  fi

  cd "$LOCAL"
  git fetch origin main >/dev/null 2>&1 || true
  BRANCH="chore/adopt-unified-github-config"
  git switch -c "$BRANCH" origin/main 2>/dev/null || git switch "$BRANCH"

  mkdir -p .github/ISSUE_TEMPLATE .github/workflows .husky

  for f in 1-feat 2-fix 3-chore 4-docs 5-report config; do
    cp "$KIT_ROOT/.github/ISSUE_TEMPLATE/$f.yml" .github/ISSUE_TEMPLATE/
  done

  for f in 1-feat 2-fix; do
    TMPL=".github/ISSUE_TEMPLATE/$f.yml"
    OPTIONS=$(echo "$AREAS" | jq -r '.[] | "        - " + .')
    awk -v opts="$OPTIONS" '
      /^      label: Area$/ { in_area=1; print; next }
      /^      options:$/ && in_area { in_block=1; print; print opts; next }
      in_block && /^    validations:$/ { in_block=0; in_area=0; print; next }
      in_block && /^        -/ { next }
      { print }
    ' "$TMPL" > "$TMPL.new" && mv "$TMPL.new" "$TMPL"
  done

  cp "$KIT_ROOT/.github/PULL_REQUEST_TEMPLATE.md" .github/
  cp "$KIT_ROOT/.github/CODEOWNERS" .github/
  cp "$KIT_ROOT/.github/labeler.yml" .github/
  cp "$KIT_ROOT/.github/dependabot.yml" .github/
  cp "$KIT_ROOT/.github/workflows/"*.yml .github/workflows/
  cp "$KIT_ROOT/commitlint.config.js" .
  cp "$KIT_ROOT/.husky/commit-msg" .husky/
  cp "$KIT_ROOT/.husky/pre-commit" .husky/
  cp "$KIT_ROOT/.lintstagedrc.json" .
  chmod +x .husky/commit-msg .husky/pre-commit

  if [ "$ID" = "hogwarts" ]; then
    echo "  hogwarts is special-cased — keeping its existing pr-check.yml"
    git checkout origin/main -- .github/workflows/pr-check.yml 2>/dev/null || true
  fi

  git add .github/ .husky/ commitlint.config.js .lintstagedrc.json

  if git diff --staged --quiet; then
    echo "  $ID: no changes — skipping commit"
    cd "$REPO_ROOT"
    continue
  fi

  ISSUE_NUMBER=$(gh issue create --repo "$REMOTE" \
    --title "[Chore]: adopt unified databayt github config" \
    --body "Copy the unified .github/ kit from databayt/kun to this repo as part of the cross-repo workflow rollout (databayt/kun#9). See \`.claude/rules/github-workflow.md\` and \`CONTRIBUTING.md\` in databayt/kun." \
    --label "type/chore,priority/p2,status/in-progress,area: workflow,assign:abdout" 2>/dev/null | grep -oE '[0-9]+$') || ISSUE_NUMBER="0"

  TARGET_BRANCH="chore/${ISSUE_NUMBER}-adopt-unified-github-config"
  git branch -m "$BRANCH" "$TARGET_BRANCH" 2>/dev/null || true
  BRANCH="$TARGET_BRANCH"

  git commit -S -m "chore(workflow): adopt unified databayt github config

Replicates the .github/ kit from databayt/kun: 5 issue YAML forms with
per-repo area dropdown, PR template with Contribution declaration, CODEOWNERS,
labeler, dependabot, 6 workflows (pr-check, auto-status, labeler, stale,
signed-commits, contribution-declaration), commitlint + husky + lint-staged.

After this lands, contributors run \`pnpm install\` once to activate hooks.
Branch protection on main should be enabled to enforce signed-commits and
required CI checks.

Refs databayt/kun#9
Closes #${ISSUE_NUMBER}

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>" || true

  git push -u origin "$BRANCH" 2>/dev/null || true

  PR_URL=$(gh pr create --draft --repo "$REMOTE" \
    --base main \
    --head "$BRANCH" \
    --title "chore(workflow): adopt unified databayt github config" \
    --body "## Summary
Adopts the unified .github/ kit from databayt/kun. Part of the cross-repo workflow rollout.

## Linked issue
Closes #${ISSUE_NUMBER}

## Test plan
- [ ] \`pnpm install\` activates husky hooks
- [ ] Bad commit message rejected by commitlint
- [ ] CI workflows show up on a test PR
- [ ] Branch-name regex enforced

## Contribution declaration
Closes #${ISSUE_NUMBER} (size: 3)
- Author: @abdout
- Pair (50%): none
- Reviewers: GitHub auto-lists
- Design credit (20%): none
- AI co-author: claude-opus-4-7

See databayt/kun#9 for the full design." 2>/dev/null) || PR_URL=""

  echo "  $ID: PR opened: $PR_URL"
  cd "$REPO_ROOT"

  if [ "$DELAY" != "0s" ] && [ -n "$DELAY" ]; then
    echo "  sleeping $DELAY before next repo..."
    sleep "$DELAY"
  fi
done

echo ""
echo "Done. Review the PRs and merge per repo."
