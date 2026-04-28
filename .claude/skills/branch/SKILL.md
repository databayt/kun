---
name: branch
description: Create a feature branch from the active issue. Branch name follows <type>/<issue#>-<slug>, which is what auto-status, contribution-tally, and signed-commits all key off.
---

# /branch

Create a properly named feature branch from the currently active GitHub issue. The branch name encodes the issue number, which is the primary key for the entire workflow (CI, status flips, contribution attribution).

## Format

```
<type>/<issue-number>-<kebab-slug>
```

Examples:

```
feat/9-unified-git-github-workflow
fix/108-rtl-sidebar-overlap
chore/42-bump-eslint-to-9
docs/56-add-deploy-runbook
```

The PR-check workflow's `branch-name` job rejects anything that doesn't match the regex `^(feat|fix|chore|docs|refactor|test|perf|style|ci|build|revert|i18n|hotfix)\/[0-9]+-[a-z0-9][a-z0-9-]*$`.

## Steps

1. Read `.claude/state/active-issue.json`. If absent → tell the user to run `/issue` first.
2. Determine `<type>` from the issue's labels (`type/feat` → `feat`, etc.). Fallback `feat`.
3. Generate `<slug>` from the issue title:
   - Strip `[Type]: ` prefix
   - Lowercase
   - Replace non-`[a-z0-9]+` runs with single hyphens
   - Trim leading/trailing hyphens
   - Limit to 40 chars
4. Compose branch name `<type>/<N>-<slug>`.
5. If branch already exists locally → `git switch <name>`. Else → `git switch -c <name>` from `main` (refresh first: `git fetch origin main && git switch -c <name> origin/main`).
6. Update `.claude/state/active-issue.json.branch = "<name>"`.
7. Print: "Branch ready: <name>. Make changes, then /commit."

## Edge cases

- **Active issue exists but on a different repo than cwd**: error and ask user to `cd` to the right repo.
- **Branch name regex would fail**: shorten the slug; if title has nothing kebab-able, use `<type>/<N>-update`.
- **`main` has unpushed local commits**: pull first; warn if pull fails.
- **Currently on `main` with uncommitted changes**: stash them, switch, then `git stash pop` (carry to new branch).

## Rebase or fork from current?

This skill always branches from `origin/main`, never from the current branch. Avoid stacking by accident. If the user wants a stacked branch, they do it manually.

## Integration

- Triggers `auto-status.yml` on push: `status/triage` → `status/in-progress`.
- Used by `/commit` (validates branch name in commit-msg footer).
- Used by `/pr` (PR title derives from branch name's `<type>` and the issue title).

## Example

```
$ /branch
Active issue: databayt/kun#9 [Feat]: unified git/github workflow + contribution-as-evidence layer
Type: feat (from label type/feat)
Slug: unified-git-github-workflow (40 chars max)
Branch: feat/9-unified-git-github-workflow

$ git switch -c feat/9-unified-git-github-workflow origin/main
Switched to a new branch 'feat/9-unified-git-github-workflow'

Branch ready: feat/9-unified-git-github-workflow.
Make changes, then /commit.
```
