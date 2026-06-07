# Workflow Cycle — Work Directly on Main

> **No branches. No worktrees. No PRs.** Every change is committed and pushed straight to `main`.
> This is a standing, deliberate decision — **do not reintroduce branch / PR / worktree steps.**

```
IDEA → (ISSUE — optional) → EDIT → COMMIT → PUSH (main) → DEPLOY → VERIFY
```

## Why main-only

Multiple concurrent sessions working across git worktrees kept resetting `main` under
each other — `git reset --hard origin/main` and "merge-all-worktrees" deploys repeatedly
orphaned commits and wiped uncommitted work. For a solo / small team, branches + PRs +
worktrees added coordination cost and real data-loss risk without buying meaningful review
value. So: **one working tree, one branch (`main`), commit early and often.**

## The Rules

### 1. Stay on `main`

You are always on `main`. Never `git checkout -b`. Never `git worktree add`. If a session
finds itself on another branch or in a worktree, switch back to the main working tree on
`main` before doing anything else. Verify right before every commit:

```bash
git branch --show-current   # must print: main
```

### 2. (Optional) Issue for tracking

Issues are for _tracking visible work_, not a gate. Create one when it helps someone else
see what's happening; skip it for routine edits.

```bash
gh issue create --repo databayt/<repo> \
  --title "<type>: <description>" \
  --body "<details, acceptance criteria>" \
  --label "type:<type>,P<n>"
```

| Type     | Label           |
| -------- | --------------- |
| Feature  | `type:feature`  |
| Bug fix  | `type:bug`      |
| Chore    | `type:chore`    |
| Docs     | `type:docs`     |
| Refactor | `type:refactor` |

**Priority**: `P0` (drop everything) · `P1` (this week) · `P2` (this sprint) · `P3` (backlog)

### 3. Commit — conventional, atomic, often

Small commits on `main` are the safety net that replaces branches. Uncommitted work is the
thing that gets lost — so commit _frequently_, not at the end.

```
<type>: <description (≤72 chars, present tense)>

[body — explain WHY, not what; the diff shows what]

[Refs #N | Closes #N]

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`

`Closes #N` in a commit body auto-closes the issue when the commit lands on `main`.

### 4. Push to `main`

```bash
git pull --rebase origin main   # take others' commits first, replay yours on top
git push origin main
```

Rebase-pull before pushing so concurrent commits stack cleanly instead of forcing a merge.
**Never force-push `main`.**

### 5. Deploy

Vercel auto-deploys `main` on push. Nothing to do.

### 6. Verify

Use `/watch` — screenshot prod, check console + network, confirm the change works.

## Anti-Patterns

| Don't                                                   | Do                                        |
| ------------------------------------------------------- | ----------------------------------------- |
| `git checkout -b feat/...`                              | Stay on `main`                            |
| `git worktree add ...`                                  | One working tree                          |
| Open a PR                                               | Commit + push to `main`                   |
| Hold work uncommitted across a session                  | Commit early + often                      |
| `git reset --hard origin/main` with others' WIP present | Pull `--rebase`; never blow away the tree |
| Force-push `main`                                       | Never                                     |
| "fix stuff" commit msg                                  | Conventional commit                       |

## Quick Reference

| Action           | Command                                                 |
| ---------------- | ------------------------------------------------------- |
| Confirm on main  | `git branch --show-current`                             |
| Issue (optional) | `gh issue create --repo databayt/<repo>`                |
| Commit           | `git commit -m "feat: …"`                               |
| Sync + push      | `git pull --rebase origin main && git push origin main` |
| Verify           | `/watch`                                                |
