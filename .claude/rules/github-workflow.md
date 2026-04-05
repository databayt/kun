# GitHub Workflow Cycle

The state-of-the-art GitHub workflow for all databayt repos. Every piece of work follows this clean chain.

## The Cycle

```
  ┌──────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌───────┐    ┌───────┐    ┌────────┐    ┌───────┐
  │ IDEA │───▶│ ISSUE  │───▶│ BRANCH │───▶│ COMMIT │───▶│  PUSH  │───▶│  PR   │───▶│REVIEW │───▶│ MERGE  │───▶│ CLOSE │
  └──────┘    └────────┘    └────────┘    └────────┘    └────────┘    └───────┘    └───────┘    └────────┘    └───────┘
                  │                                                       │            │                          │
                  │                                                       │            │                          │
              Tracks work                                             Discussion    Approval                  Auto-deploy
              Labels + assign                                         Comments     CI gates                   Verify live
```

## Each Step

### 1. IDEA → ISSUE

Every change starts as a GitHub issue. No exceptions.

```bash
gh issue create \
  --repo databayt/<repo> \
  --title "<type>: <description>" \
  --body "<details, acceptance criteria, context>" \
  --label "<type>,<priority>" \
  --assignee "<person>"
```

**Labels:**
| Type | Label | Branch prefix |
|------|-------|---------------|
| Feature | `type:feature` | `feat/` |
| Bug fix | `type:bug` | `fix/` |
| Chore | `type:chore` | `chore/` |
| Docs | `type:docs` | `docs/` |
| Refactor | `type:refactor` | `refactor/` |

**Priority:** `P0` (drop everything), `P1` (this week), `P2` (this sprint), `P3` (backlog)

### 2. ISSUE → BRANCH

One branch per issue. Branch name references the issue.

```bash
git checkout -b <type>/<short-description>
# Examples:
# feat/admission-form
# fix/rtl-sidebar-overlap
# chore/analyze-config
```

**Rules:**
- Branch from `main` (always fresh)
- One issue = one branch = one PR
- Delete branch after merge

### 3. BRANCH → COMMITS

Atomic, conventional commits. Each commit is a logical unit.

```bash
git commit -m "$(cat <<'EOF'
feat: add admission form with validation

- Zod schema for student data
- Server action with auth + tenant isolation
- RTL-compatible form layout

Refs #42

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**Conventional format:**
```
<type>: <description>

[optional body — what and why, not how]

[Refs #N | Closes #N]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`

**Rules:**
- Present tense ("add" not "added")
- Under 72 chars for subject line
- Body explains WHY, not what (the diff shows what)
- Reference issue number

### 4. COMMITS → PUSH

Push branch to origin with upstream tracking.

```bash
git push -u origin <branch-name>
```

### 5. PUSH → PR

Create PR that links to the issue.

```bash
gh pr create \
  --title "<type>: <description>" \
  --body "$(cat <<'EOF'
## Summary
<1-3 bullet points of what changed and why>

## Changes
- <file or area>: <what changed>
- <file or area>: <what changed>

## Test plan
- [ ] <how to verify this works>
- [ ] <edge cases checked>

## Screenshots
<if UI changes, before/after>

Closes #<issue-number>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Rules:**
- Title matches the primary commit message
- `Closes #N` auto-closes the issue on merge
- Summary is human-readable (not a commit log dump)
- Test plan tells reviewer how to verify

### 6. PR → REVIEW + DISCUSSION

The PR is a conversation space.

```bash
# Request review
gh pr edit <number> --add-reviewer <person>

# Add comment
gh pr comment <number> --body "Addressed feedback: changed X to Y because Z"

# View review comments
gh api repos/databayt/<repo>/pulls/<number>/reviews
```

**Discussion rules:**
- Respond to every review comment
- If disagreeing, explain why with evidence
- If agreed, fix and comment "Fixed in <commit>"
- Discussion happens ON the PR, not in Slack

### 7. REVIEW → MERGE

After approval, squash merge to main.

```bash
gh pr merge <number> --squash --delete-branch
```

**Merge rules:**
- Squash merge (clean history)
- Delete branch after merge
- CI must pass before merge
- At least 1 approval (or self-merge for solo work with explanation)

### 8. MERGE → CLOSE + DEPLOY

`Closes #N` in the PR body auto-closes the issue. Vercel auto-deploys on push to main.

```bash
# Verify issue closed
gh issue view <number> --repo databayt/<repo>

# Verify deployment
gh api repos/databayt/<repo>/deployments --jq '.[0].statuses_url'
```

### 9. DEPLOY → VERIFY

Post-deploy health check (the `/watch` command).

```bash
# Screenshot production page
# Check console errors
# Check network requests
# Verify the fix/feature works in production
```

## Quick Reference

| Action | Command |
|--------|---------|
| Create issue | `gh issue create --repo databayt/<repo>` |
| Create branch | `git checkout -b feat/<name>` |
| Commit | `git commit -m "feat: description"` |
| Push | `git push -u origin <branch>` |
| Create PR | `gh pr create --title "feat: X" --body "Closes #N"` |
| Review | `gh pr review <N> --approve` |
| Merge | `gh pr merge <N> --squash --delete-branch` |
| Verify | `gh issue view <N>` + `/watch` |

## Anti-Patterns

| Don't | Do Instead |
|-------|-----------|
| Commit directly to main | Branch + PR |
| PR without issue | Create issue first |
| Mega PR (20+ files) | Split into focused PRs |
| Force push to main | Never. Ever. |
| Merge without CI passing | Fix CI first |
| Leave stale branches | Delete after merge |
| Squash commit messages like "fix stuff" | Meaningful conventional commit |
| Close issue manually | Use `Closes #N` in PR |
