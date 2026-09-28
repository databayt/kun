# Workflow — Work Directly on Main

**No branches. No worktrees. No PRs.** Every change is committed and pushed straight to `main`.
A standing, deliberate decision — **never reintroduce branch / PR / worktree steps.** Why:
concurrent sessions across worktrees kept resetting `main` under each other
(`git reset --hard origin/main`, "merge-all-worktrees" deploys) and orphaned commits and
uncommitted work; for a small team, branches + PRs cost more than the review they bought.

`IDEA → (ISSUE — optional) → EDIT → COMMIT → PUSH (main) → DEPLOY → VERIFY`

1. **Stay on `main`.** Never `git checkout -b`, never `git worktree add`. A session that finds
   itself on another branch or in a worktree returns to the main working tree on `main` before
   anything else. Right before every commit, `git branch --show-current` must print `main`.
2. **Issue — optional**, for visible work someone else should track (not a gate):
   `gh issue create --repo databayt/<repo> --title "<type>: <description>" --body "<details, acceptance criteria>" --label "type:<type>,P<n>"`.
   Types `feature` · `bug` · `chore` · `docs` · `refactor`. Priority `P0` drop everything ·
   `P1` this week · `P2` this sprint · `P3` backlog.
3. **Commit — conventional, atomic, often.** Small commits are the safety net that replaces
   branches; uncommitted work is what gets lost. `<type>: <description ≤72 chars, present tense>`,
   a body that explains WHY (the diff shows what), `Refs #N` / `Closes #N` (auto-closes when it
   lands on `main`), then the attribution trailers the harness supplies — never hardcode a model
   name in a footer. Types: `feat` `fix` `chore` `docs` `refactor` `test` `perf` `style`.
   The index is shared by every session in the tree: commit with explicit paths in one command
   (`git commit -m "…" -- <paths>`; `git add` new files on the same command line) so another
   session's commit can't swallow your staged files.
4. **Push:** `git pull --rebase origin main && git push origin main` — the rebase stacks
   concurrent commits instead of merging. **Never force-push `main`**, and never
   `git reset --hard origin/main` over others' work in progress.
5. **Deploy:** a repo with a `wrangler.jsonc` does not deploy on push — run the `deploy` skill
   (it routes by platform). Any other repo follows its own platform's lane.
6. **Verify:** `/watch` — screenshot prod, check console + network, confirm the change works.
