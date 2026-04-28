---
paths: [".github/**", "**/CHANGELOG.md", ".gitignore", "**/PULL_REQUEST_TEMPLATE.md", "CONTRIBUTING.md"]
---

# GitHub Workflow Cycle

The state-of-the-art GitHub workflow for all databayt repos. Every piece of work follows this clean chain. Git and GitHub are the **sole evidence base** for the sharing-economy revenue model — every artifact is a Contribution Unit (CU) credit when issues close.

## The cycle

```
  ┌──────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌───────┐    ┌───────┐    ┌────────┐    ┌───────┐
  │ IDEA │───▶│ ISSUE  │───▶│ BRANCH │───▶│ COMMIT │───▶│  PUSH  │───▶│  PR   │───▶│REVIEW │───▶│ MERGE  │───▶│ CLOSE │
  └──────┘    └────────┘    └────────┘    └────────┘    └────────┘    └───────┘    └───────┘    └────────┘    └───────┘
                  │             │              │             │            │            │              │            │
              Memory +     <type>/<#>-      Conventional   Triggers    Closes     CI gates +      auto-status  status/done
              Acceptance      slug         + signed +      auto-       #N body     contribution    flips to        + CU credit
                                            Refs #N       status                   declaration     in-review
```

## Each step

### 1. IDEA → ISSUE

Every change starts as a GitHub issue. No exceptions, including hotfixes and typos.

```bash
gh issue create \
  --repo databayt/<repo> \
  --title "[<Type>]: <imperative description>" \
  --body "$body" \
  --label "type/<x>,priority/p<n>,status/triage"
```

Or use the in-product `/issue` skill, or let the `auto-issue.sh` UserPromptSubmit hook do it from a work-regex prompt.

**Type → label → branch-prefix:**

| Type | Label | Branch prefix |
|------|-------|---------------|
| Feature | `type/feat` | `feat/` |
| Fix | `type/fix` | `fix/` |
| Chore | `type/chore` | `chore/` |
| Docs | `type/docs` | `docs/` |
| Refactor | `type/refactor` | `refactor/` |
| Performance | `type/perf` | `perf/` |
| Test | `type/test` | `test/` |
| Style | `type/style` | `style/` |
| CI | `type/ci` | `ci/` |
| Build | `type/build` | `build/` |
| Revert | `type/revert` | `revert/` |
| i18n | `type/i18n` | `i18n/` |
| Hotfix | `type/fix` + `priority/p0` | `hotfix/` |

**Priority:** `priority/p0` (drop everything), `priority/p1` (this week), `priority/p2` (this sprint), `priority/p3` (backlog).

**Status (managed by `auto-status.yml`):** `status/triage` → `status/ready` → `status/in-progress` → `status/in-review` → `status/done`. `status/blocked` is added manually when work is paused.

**Size (Fibonacci):** issue includes 1/2/3/5/8/13 estimate. Locks at `status/ready` — drives the CU multiplier.

### 2. ISSUE → BRANCH

One branch per issue. Branch name encodes the issue number, which is the primary key for the entire workflow.

```bash
git switch -c feat/9-unified-git-github-workflow origin/main
```

Or `/branch` derives the name from the active issue automatically.

CI regex (in `pr-check.yml`):

```
^(feat|fix|chore|docs|refactor|test|perf|style|ci|build|revert|i18n|hotfix)\/[0-9]+-[a-z0-9][a-z0-9-]*$
```

**Rules:**
- Branch from `origin/main` (always fresh)
- One issue = one branch = one PR
- Delete branch after merge

### 3. BRANCH → COMMITS

Atomic, conventional, signed.

```bash
git commit -S -m "$(cat <<'EOF'
feat(workflow): wire UserPromptSubmit auto-issue hook

Triggers only on work-regex prompts (add|fix|build|create|...). Caps 20
issues per day; resolves repo from cwd via repositories.json. Writes
.claude/state/active-issue.json so subsequent /branch /commit /pr /close
can attribute the rest of the session.

Refs #9

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**Conventional format:**

```
<type>(<scope>): <subject>

<body explains why — the diff shows what>

[Refs #N | Closes #N]

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

Allowed types: `feat | fix | docs | chore | refactor | test | perf | style | ci | build | revert | i18n`.

**Rules:**
- Imperative ("add" not "added")
- Subject ≤ 72 chars, lowercase first letter, no trailing period
- Body explains WHY
- `Refs #N` for work-in-progress; `Closes #N` for the final commit on the branch
- All commits signed (`-S`) — required by `signed-commits.yml` CI
- `Co-Authored-By:` trailer for AI-assisted commits (records attribution; AI earns 0 CU)

The husky `commit-msg` hook validates via commitlint. CI runs commitlint against every commit in the PR.

### 4. COMMITS → PUSH

```bash
git push -u origin <branch-name>
```

The `post-push.sh` hook captures any draft PR URL into `.claude/state/active-issue.json.pr_url` automatically.

### 5. PUSH → PR

PR closes the issue and declares contribution credits.

```bash
gh pr create \
  --draft \
  --title "feat(workflow): unified git/github workflow + contribution-as-evidence layer" \
  --body "$body"
```

The body uses `.github/PULL_REQUEST_TEMPLATE.md` and includes:
- Summary (1-3 bullets, why)
- `Closes #<n>`
- Test plan checklist
- Screenshots (Before/After for UI)
- Standard checklist (CLA + lint + typecheck + secrets)
- **Contribution declaration block** (parsed by `contribution-declaration.yml` CI)

#### Contribution declaration

```markdown
## Contribution declaration

Closes #<issue> (size: <points>)

- Author: @<handle>
- Pair (50% of size): @<handle> | none
- Reviewers (10% each, max 3): GitHub auto-lists
- Design credit (20% of size): @<handle> | none — link: <figma/RFC URL>
- AI co-author: claude-opus-4-7 | claude-sonnet-4 | none

By opening this PR I confirm credits above are accurate. False declarations
forfeit Contribution Units for this PR and reduce the contributor's monthly
cap by 25%.
```

`/pr` auto-fills it from `.claude/state/active-issue.json` (size from the issue's locked Size field; author from `git log`; AI co-author from the commit trailers; design from a `figma.com` URL in the issue body if present).

**Rules:**
- Title matches the primary commit message
- `Closes #N` auto-closes the issue on merge (only on the PR body, not commit messages)
- Always open as draft; `gh pr ready` when CI passes + self-review done
- Declaration block is required — `contribution-declaration.yml` rejects PRs missing it

### 6. PR → REVIEW

The PR is the conversation space.

```bash
gh pr edit <number> --add-reviewer <person>
gh pr comment <number> --body "Addressed feedback: changed X to Y because Z"
gh api repos/databayt/<repo>/pulls/<number>/reviews
```

**Discussion rules:**
- Respond to every review comment
- If disagreeing, explain why with evidence
- If agreed, fix and comment "Fixed in <commit-sha>"
- Discussion happens ON the PR, not in Slack
- Reviews require >2 substantive comments to count toward CU credit

### 7. REVIEW → MERGE

After approval, squash merge to main.

```bash
gh pr merge <number> --squash --delete-branch
```

**Merge rules:**
- Squash merge (clean history)
- Delete branch after merge
- All CI checks must pass: `pr-check`, `signed-commits`, `contribution-declaration`, `labeler`, `auto-status`
- At least 1 approval (or self-merge for solo work with documented reason)
- Never `--no-verify`, never force-push to `main`

### 8. MERGE → CLOSE + DEPLOY

`Closes #N` in the PR body auto-closes the issue. `auto-status.yml` ensures `status/done` label. Vercel auto-deploys on push to `main`.

```bash
gh issue view <number> --repo databayt/<repo>     # verify closed
gh api repos/databayt/<repo>/deployments --jq '.[0].statuses_url'
```

The `/close` skill is for explicit issue closure when the PR body's `Closes #N` is missing or when closing for `wontfix`/`duplicate`.

### 9. DEPLOY → VERIFY

Post-deploy health check via `/watch` skill: production screenshot + console errors + network requests check.

## Quick reference

| Action | Skill | Command |
|--------|-------|---------|
| Create issue | `/issue` | `gh issue create --repo databayt/<repo>` |
| Resume issue | `/issue resume <N>` | hydrates `.claude/state/active-issue.json` |
| List my issues | `/issue list` | `gh search issues --owner databayt --assignee @me` |
| Create branch | `/branch` | `git switch -c <type>/<#>-<slug> origin/main` |
| Commit | `/commit` | `git commit -S -m "..."` (commitlint via husky) |
| Push | — | `git push -u origin <branch>` |
| Create PR | `/pr` | `gh pr create --draft ...` |
| Review | — | `gh pr review <N> --approve` |
| Merge | — | `gh pr merge <N> --squash --delete-branch` |
| Close | `/close` | `gh issue close <N> --comment "..."` |
| Verify | `/watch` | `gh issue view <N>` + production screenshot |

## Anti-patterns

| Don't | Do instead |
|-------|-----------|
| Commit directly to main | Branch + PR |
| PR without an issue | Create issue first via `/issue` |
| Mega-PR (50+ unrelated files) | Split into focused PRs, one concern each |
| Force-push to main | Denied by branch protection. Never. |
| Merge without all CI green | Fix CI first |
| Leave stale branches | Squash + `--delete-branch` |
| `--no-verify` to skip commitlint | Fix the message |
| Skip signing | Set up SSH signing once (see CONTRIBUTING.md) |
| False Contribution declaration | Forfeits CU; 25% monthly cap reduction |
| Hardcoded `Co-Authored-By: Claude` in PR body | Goes in commit trailer, not PR body |
| Branch without issue number | CI rejects |

## Hooks that fire automatically

| Hook | When | What |
|------|------|------|
| `auto-issue.sh` | UserPromptSubmit | Creates GitHub issue from work-regex prompt; writes `active-issue.json` |
| `post-commit.sh` | PostToolUse(git commit) | Comments commit SHA + subject on active issue |
| `post-push.sh` | PostToolUse(git push) | Captures PR URL into `active-issue.json.pr_url` |
| `session-start.sh` | SessionStart | Lists active issue + uncommitted work + report queue + signed-commit warning |
| `session-end.sh` | Stop | Posts session summary to active issue if 2+ commits |

## CI workflows

| Workflow | When | Effect |
|----------|------|--------|
| `pr-check.yml` | every PR push | typecheck/lint/test/build/commit-lint/branch-name/pr-body parallel jobs |
| `auto-status.yml` | branch create + PR open/merge + issue close/reopen | flips `status/*` labels |
| `labeler.yml` | every PR push | applies `area/*` labels by file path |
| `stale.yml` | weekly Mondays | marks issues stale at 30 days, closes at 37; exempts P0/P1, in-progress, in-review, report, pinned, security, monthly-report |
| `signed-commits.yml` | every PR push | rejects PRs with unsigned commits |
| `contribution-declaration.yml` | every PR push | validates the declaration block, links issue exists |

See also: `.claude/rules/cowork-bridge.md` for cross-session handoff via GitHub Issues + bridge.md.
