---
name: pr
description: Open a draft pull request linked to the active issue. PR body uses the template, fills the Contribution declaration block, applies labels.
---

# /pr

Open a draft GitHub pull request from the current branch, with body filled from `.github/PULL_REQUEST_TEMPLATE.md`, `Closes #<active-issue>`, and the auto-filled Contribution declaration block.

## Steps

1. Read `.claude/state/active-issue.json` (`number`, `title`, `repo`, `branch`).
2. Verify branch is pushed: `git rev-parse @{u}` succeeds. If not, `git push -u origin <branch>`.
3. Pull `.github/PULL_REQUEST_TEMPLATE.md` content.
4. Fill template:
   - `## Summary` — from the issue's description + this branch's commit subjects.
   - `## Linked issue` — `Closes #<N>`
   - `## Test plan` — from the issue's Acceptance criteria checklist.
   - `## Contribution declaration` block — see "Auto-fill rules" below.
5. `gh pr create --draft --title "<type>(<scope>): <issue-title-without-bracket>" --body "$body" --label "<from-issue>"`.
6. Capture URL into `.claude/state/active-issue.json.pr_url`.
7. Print: "Draft PR opened: <url>. Use /commit for more changes; mark ready when done; CI will run on push."

## Auto-fill rules — Contribution declaration

| Field | Source |
|------|--------|
| `Closes #<issue> (size: <points>)` | active-issue + issue's Size custom field |
| `Author: @<handle>` | `git log` author of branch's first commit (or `gh api user`) |
| `Pair (50%): @<handle> \| none` | leave as `none`; user edits if pairing |
| `Reviewers (10% each)` | leave blank; GitHub auto-lists when reviews land |
| `Design credit (20%): @<handle> \| none` | scan issue body for `figma.com` or `RFC #N` link; else `none` |
| `AI co-author` | from the most-recent `Co-Authored-By:` trailer in branch commits; else `none` |

## Title rules

- Mirror the primary commit's type + scope: `feat(workflow): unified git/github workflow + contribution-as-evidence layer`.
- Strip the issue's `[Feat]:` prefix.
- ≤ 72 chars.
- No issue number in the title (it's in the body via `Closes #N`).

## Labels

Inherit from the issue, but transform:
- `status/in-progress` → drop (PR opening triggers `status/in-review` via auto-status.yml)
- `auto-created` → drop (only relevant for the issue itself)
- Keep `type/*`, `priority/*`, `area/*`

`labeler.yml` will add additional `area/*` labels based on changed paths.

## Draft vs ready

`/pr` always opens **draft**. Mark ready with `gh pr ready` when:
- All commits land
- Local pre-flight passes (`pnpm typecheck && pnpm build`)
- `pnpm exec commitlint --from origin/main --to HEAD` passes
- Self-review of the diff complete

Drafts skip required reviewers but still run CI.

## CI gates

After `/pr`, CI runs:
- `pr-check.yml` — typecheck/lint/test/build/commit-lint/branch-name/pr-body
- `signed-commits.yml` — every commit must be signed
- `contribution-declaration.yml` — declaration block parses, links a real issue
- `labeler.yml` — auto-applies area:* labels
- `auto-status.yml` — flips issue's status label to `status/in-review`

## Edge cases

- **No active issue**: refuse; suggest `/issue` first. (Every PR must close an issue — that's the contribution attribution chain.)
- **Branch is stacked on another open PR**: warn; pick base intentionally with `--base <branch>`.
- **PR already exists for branch**: print URL, refresh `.claude/state/active-issue.json.pr_url`, exit.

## Integration

- Reads `.github/PULL_REQUEST_TEMPLATE.md` (so any change to the template flows automatically).
- Writes `pr_url` back into active-issue.json.
- Triggers all CI workflows including `auto-status.yml` flipping labels.
- `post-push.sh` hook also captures PR URL after `git push`; `/pr` is the explicit form.

## Example

```
$ /pr
Active issue: #9 [Feat]: unified git/github workflow + contribution-as-evidence layer
Branch: feat/9-unified-git-github-workflow (4 commits ahead of main, pushed)

Title: feat(workflow): unified git/github workflow + contribution-as-evidence layer

Body draft:
  ## Summary
  - Add 5 issue YAML forms + PR template + CODEOWNERS + labeler + dependabot
  - Add 6 GitHub Actions workflows
  - Wire commitlint + husky + lint-staged
  - Wire 4 git/github automation hooks
  - ...

  ## Linked issue
  Closes #9

  ## Test plan
  - [ ] commitlint rejects "fix stuff"
  - [ ] auto-issue.sh fires on a work prompt
  - ...

  ## Contribution declaration
  Closes #9 (size: 13)
  - Author: @abdout
  - Pair (50%): none
  - Reviewers: _GitHub will list reviewers automatically_
  - Design credit (20%): none
  - AI co-author: claude-opus-4-7

Labels: type/feat, priority/p1, area/workflow

OK? [Y/n]: y

→ Draft PR opened: https://github.com/databayt/kun/pull/10
→ Updated .claude/state/active-issue.json.pr_url
→ CI will run on push. Use `gh pr checks --watch`.
```
