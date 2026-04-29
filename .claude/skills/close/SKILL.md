---
name: close
description: Close the active issue with a summary comment + link to merged PR. Clears active-issue.json.
---

# /close

Close the currently active GitHub issue and clear the active-issue pointer. Use after the linked PR has merged (or when intentionally closing without a PR — wontfix, duplicate, etc.).

## Steps

1. Read `.claude/state/active-issue.json`.
2. Branch on PR state:
   - **PR merged**: build a summary (commit count, files changed, PR URL); proceed to close.
   - **PR open or none**: prompt for confirmation. Closing without a merge implies wontfix/duplicate/superseded — warn the user; ask for a reason; record it.
3. `gh issue close <N> --repo <repo> --comment "$summary" --reason "completed"` (or `--reason "not planned"` for wontfix).
4. Move `.claude/state/active-issue.json` → `.claude/state/history/issue-<N>-<timestamp>.json`.
5. Auto-status workflow ensures `status/done` label is set on the closed issue.

## Summary template

```markdown
## Closed via #<pr>

This issue is closed. Summary of work:

- **Commits**: <count>
- **PR**: #<pr> — merged <date>
- **Files changed**: <count>
- **Lines**: +<additions> / -<deletions>

Key changes:
- <bullet from primary commit subject>
- <bullet>
- <bullet>

Verification:
- [x] CI passed
- [x] PR merged to main

Resume any related work with `/issue resume <N>`.
```

The summary is *not* a release note — it's a closing receipt. Detailed change notes go in the PR body and the merged commit messages.

## When NOT to use /close

- **Issue auto-closed by `Closes #N` in PR body**: the auto-status workflow handles labels; just clear active-issue.json manually if needed (or `/issue resume <N>` to verify closed state, which auto-archives the pointer).
- **Issue blocked**: don't close; comment + add `status/blocked` label; keep open.
- **Issue duplicates another**: close with `--reason "not planned"` and link the canonical issue.

## Integration

- Triggers `auto-status.yml` (issues.closed event) → ensures `status/done` label.
- Archives `active-issue.json` to `.claude/state/history/`.
- Future `/issue list` will not show this issue (closed).

## Example

```
$ /close
Active issue: databayt/kun#9 [Feat]: unified git/github workflow ...
Linked PR: #10 — MERGED 2026-04-26

Summary:
  - Commits: 11
  - PR: #10 merged 2026-04-26
  - Files: 38 changed, +3427 / -89

Key changes:
  - Add 5 issue YAML forms + PR template + CODEOWNERS + labeler + dependabot
  - Add 6 GitHub Actions workflows
  - Wire commitlint + husky + lint-staged
  - Wire 4 git/github automation hooks
  - Rewrite /issue and add /branch /commit /pr /close skills

OK? [Y/n]: y

→ Closed databayt/kun#9 with summary comment.
→ Archived .claude/state/active-issue.json → .claude/state/history/issue-9-20260426-143022.json
→ status/done label confirmed.

Next: /issue list to pick up the next task.
```
