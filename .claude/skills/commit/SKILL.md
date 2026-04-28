---
name: commit
description: Draft and create a Conventional Commit from the staged diff. Always signed, always references the active issue.
---

# /commit

Compose a Conventional Commits 1.0.0 message from the staged diff, attach `Refs #<active-issue>`, sign the commit, and push through husky's commit-msg hook (commitlint).

## Steps

1. Verify there are staged changes: `git diff --staged --stat`. If empty → suggest `git add <files>` first.
2. Read `.claude/state/active-issue.json`. If absent → run `/issue` first (or proceed without `Refs` and warn).
3. Build the message:
   - **Type**: from active-issue's `type/*` label, fallback `feat`.
   - **Scope** (optional): inferred from the dominant directory in the staged diff (`agents`, `skills`, `rules`, `hooks`, `workflow`, etc.). Skip scope when changes span >2 areas.
   - **Subject**: imperative, ≤ 72 chars, lowercase, no trailing period. Generated from the diff's most important file or from the issue title.
   - **Body** (optional): paragraph explaining *why*. Skip for tiny changes.
   - **Footer**: `Refs #<N>` if work-in-progress, or `Closes #<N>` if this is the final commit on the branch (user confirms).
   - **Trailer**: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
4. Show the user the proposed message; allow edits.
5. `git commit -S -m "<message>"` (signed).
6. The husky `commit-msg` hook runs commitlint — validates type, header length, lowercase.
7. The `post-commit.sh` PostToolUse hook posts a comment on the active issue with the SHA.

## Conventional types

`feat | fix | docs | chore | refactor | test | perf | style | ci | build | revert | i18n`

Custom: `i18n` for translation-only changes (databayt convention).

## Subject rules

- Imperative ("add" not "added", "fix" not "fixed")
- Lowercase first letter
- ≤ 72 chars total (including `<type>(<scope>): `)
- No trailing period

## Refs vs Closes

- `Refs #N` — work in progress, this commit is part of the issue
- `Closes #N` — this is the final commit; merging will close the issue

`Closes` should appear in **at most one commit per issue** — usually the last one before opening the PR. The PR body's `Closes #N` is what actually closes the issue on merge; commit-message `Closes` is informational.

## Signed commits

- Required after this PR ships (signed-commits.yml CI gate).
- Set up once: `git config --global commit.gpgsign true && git config --global gpg.format ssh && git config --global user.signingkey ~/.ssh/id_ed25519.pub`. Add the public key to GitHub as a *signing* key (not auth key).
- `/commit` always passes `-S`. If signing fails (key missing), commit fails — that's intentional.

## Edge cases

- **Pre-commit hook fails**: the husky `pre-commit` runs lint-staged. If it edits files, those edits aren't yet staged — re-stage and retry. Don't bypass with `--no-verify`.
- **commitlint rejects the message**: rewrite (don't `--no-verify`). Common rejections: subject too long, missing type, uppercase first letter.
- **Diff is too large for sane summarization**: ask the user to split into multiple commits.
- **Active issue is in a different repo than cwd**: warn, don't auto-add `Refs` for the wrong repo.

## Integration

- `post-commit.sh` PostToolUse hook captures the SHA on the active issue.
- `pr-check.yml` CI runs commitlint on every commit in the PR.
- `signed-commits.yml` CI rejects unsigned commits on PRs.

## Example

```
$ git add scripts/hooks/auto-issue.sh

$ /commit
Active issue: #9 (type/feat, area: hooks)

Proposed message:
  feat(hooks): wire UserPromptSubmit auto-issue hook

  Trigger only on work-regex prompts; cap 20 issues/day; resolve repo from
  cwd via repositories.json. Writes .claude/state/active-issue.json so
  branch/commit/pr/close skills can attribute the rest of the session.

  Refs #9

  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

OK? [Y/n]: y

$ git commit -S -m "..."
[feat/9-unified-git-github-workflow a11d313] feat(hooks): wire UserPromptSubmit auto-issue hook
 1 file changed, 124 insertions(+)
 create mode 100755 scripts/hooks/auto-issue.sh
```
