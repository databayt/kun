# GitHub Workflow Cycle

State-of-the-art GitHub workflow for all databayt repos. Every change follows this chain.

```
IDEA → ISSUE → BRANCH → COMMIT → PUSH → PR → REVIEW → MERGE → CLOSE → DEPLOY → VERIFY
```

## The Rules

### 1. IDEA → ISSUE

Every change starts as a GitHub issue. No exceptions.

```bash
gh issue create --repo databayt/<repo> \
  --title "<type>: <description>" \
  --body "<details, acceptance criteria>" \
  --label "type:<type>,P<n>" \
  --assignee "<person>"
```

| Type | Label | Branch prefix |
|------|-------|---------------|
| Feature | `type:feature` | `feat/` |
| Bug fix | `type:bug` | `fix/` |
| Chore | `type:chore` | `chore/` |
| Docs | `type:docs` | `docs/` |
| Refactor | `type:refactor` | `refactor/` |

**Priority**: `P0` (drop everything) · `P1` (this week) · `P2` (this sprint) · `P3` (backlog)

### 2. ISSUE → BRANCH

```bash
git checkout -b <type>/<short-description>   # e.g. feat/admission-form
```

Rules: branch from fresh `main`, one issue = one branch = one PR, delete after merge.

### 3. BRANCH → COMMITS

Conventional, atomic commits:

```
<type>: <description (≤72 chars, present tense)>

[body — explain WHY, not what; the diff shows what]

[Refs #N | Closes #N]

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`

### 4. COMMITS → PUSH

```bash
git push -u origin <branch-name>
```

### 5. PUSH → PR

```bash
gh pr create --title "<type>: <desc>" --body "$(cat <<'EOF'
## Summary
<1-3 bullets: what changed and why>

## Changes
- <area>: <what changed>

## Test plan
- [ ] <how to verify>

Closes #<N>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Rules: title = primary commit msg · `Closes #N` auto-closes the issue · summary is human-readable, not a commit log dump.

### 6. PR → REVIEW

```bash
gh pr edit <N> --add-reviewer <person>
gh pr comment <N> --body "Addressed feedback: changed X to Y because Z"
gh api repos/databayt/<repo>/pulls/<N>/reviews   # view review comments
```

Rules: respond to every review comment · disagree only with evidence · discussion happens ON the PR, not Slack.

### 7. REVIEW → MERGE

```bash
gh pr merge <N> --squash --delete-branch
```

Rules: squash merge · CI must pass · ≥1 approval (or self-merge for solo work, with explanation in PR).

### 8. MERGE → CLOSE + DEPLOY

`Closes #N` auto-closes the issue. Vercel auto-deploys `main`. Verify:

```bash
gh issue view <N> --repo databayt/<repo>
gh api repos/databayt/<repo>/deployments --jq '.[0].statuses_url'
```

### 9. DEPLOY → VERIFY

Use `/watch` — screenshot prod, check console + network, confirm fix/feature works.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Commit directly to `main` | Branch + PR |
| PR without issue | Create issue first |
| Mega PR (20+ files) | Split into focused PRs |
| Force push to `main` | Never |
| Merge with red CI | Fix CI first |
| Leave stale branches | Delete after merge |
| "fix stuff" commit msg | Conventional commit |
| Manually close issue | `Closes #N` in PR |

## Quick Reference

| Action | Command |
|--------|---------|
| Issue | `gh issue create --repo databayt/<repo>` |
| Branch | `git checkout -b feat/<name>` |
| Commit | `git commit -m "feat: …"` |
| Push | `git push -u origin <branch>` |
| PR | `gh pr create --title "feat: X" --body "Closes #N"` |
| Review | `gh pr review <N> --approve` |
| Merge | `gh pr merge <N> --squash --delete-branch` |
| Verify | `gh issue view <N>` + `/watch` |
