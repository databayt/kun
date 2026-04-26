# Contributing to databayt

> Every change is an issue. Every commit references an issue. Every PR closes an issue.
> Issues are the canonical memory channel — they outlive sessions, hand off across humans, and serve as the audit trail for the sharing-economy revenue model.

## TL;DR

```
/issue   →   /branch   →   /commit   →   /pr   →   review   →   merge   →   /close
```

Or interactively: `gh issue create` → `git checkout -b <type>/<#>-<slug>` → conventional commit → `gh pr create`.

## License & contribution agreement

By opening a pull request you agree to:

1. **Server Side Public License v1 (SSPL-1.0)** — see `LICENSE`.
2. **Commercial license grant** — you grant `databayt` a perpetual, worldwide, royalty-free, irrevocable license to use, modify, sublicense, and re-license your contribution under terms of databayt's choosing (including proprietary terms).
3. **License compatibility** — you confirm your contributions do not include code under licenses incompatible with SSPL-1.0.
4. **Right to contribute** — you have the right to submit the work, either as the author or with the rights-holder's permission.

The PR template includes a checkbox confirming all four. Don't merge without it.

## Issues — the front door

Every change starts as a GitHub issue. No exceptions, including hot-fixes and trivial typos.

| Template | When | Default labels |
|----------|------|----------------|
| `1-feat.yml` | New feature or enhancement | `type/feat priority/p2 status/triage` |
| `2-fix.yml` | Bug, regression, broken behavior | `type/fix priority/p2 status/triage` |
| `3-chore.yml` | Maintenance, deps, infra, cleanup | `type/chore priority/p3 status/triage` |
| `4-docs.yml` | Documentation issue | `type/docs priority/p3 status/triage` |
| `5-report.yml` | Auto-filed by in-product Report dialog | `type/report priority/p1 status/triage` |

Every issue includes a **size estimate** (1/2/3/5/8/13). Once the captain applies `status/ready`, the size locks — that estimate becomes the Contribution Unit (CU) multiplier when the issue closes. See `databayt/revenue/RULES.md`.

## Branches

Format: `<type>/<issue#>-<kebab-slug>` — for example `feat/9-unified-git-github-workflow`.

The leading issue number is what makes auto-status flips, contribution attribution, and CI's branch-name regex work. Branches without an issue number are rejected by `pr-check.yml`.

Allowed types: `feat | fix | chore | docs | refactor | test | perf | style | ci | build | revert | i18n | hotfix`.

## Commits

Conventional Commits 1.0.0:

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **Subject** ≤ 72 chars, imperative ("add" not "added"), lowercase first letter, no trailing period.
- **Body** explains *why* (the diff shows *what*).
- **Footer** has `Refs #N` (work-in-progress) or `Closes #N` (final commit on the branch).
- **AI co-authorship**: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer when the commit is AI-assisted. Records attribution but earns 0 CU (humans get paid, not the model).

The husky `commit-msg` hook (commitlint) validates every commit. CI runs commitlint against every commit in the PR.

## Signed commits

Required after this workflow ships. One-time setup per machine:

```bash
git config --global commit.gpgsign true
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

Then add the public key to GitHub: **Settings → SSH and GPG keys → New SSH key**. Set "Key type" to **Signing key** (not "Authentication key").

The `signed-commits.yml` workflow rejects PRs where any commit's `git log %G?` is not `G`.

## Pull requests

```bash
gh pr create --draft --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
## Summary
<1-3 bullets>

## Linked issue
Closes #<n>

## Test plan
- [ ] <verification step>

## Contribution declaration
Closes #<n> (size: <points>)
- Author: @<handle>
- Pair (50%): @<handle> | none
- Reviewers: GitHub auto-lists
- Design credit (20%): @<handle> | none — link: <figma/RFC URL>
- AI co-author: claude-opus-4-7 | none
EOF
)"
```

The Contribution declaration block is parsed by `.github/workflows/contribution-declaration.yml` and consumed by the monthly tally in `databayt/revenue`. See its rules for CU math.

## Sharing-economy revenue model

databayt is open-source and shares revenue with contributors. The math:

1. Each closed issue + merged PR + signed commit = an immutable Contribution Unit (CU) credit.
2. Monthly snapshot computes per-contributor CU across all 13 databayt repos.
3. Distribution = CU share × pool, where the pool comes from real revenue (Hogwarts pilot, sponsors, etc.) with founder reserve and operating reserve held back. Exact percentages live in `databayt/revenue/RULES.md`.
4. Disputes are GitHub issues on `databayt/revenue` — public, append-only, 7-day review window before each distribution PR merges.

AI co-authors are recorded for transparency but earn 0 CU. Anti-gaming locks: story-point freeze at `status/ready`, monthly cap (100 CU/person, overflow at 0.5×), substantive-review threshold, signed commits required.

## What you actually do

```bash
# 1) Make sure issue exists (or auto-create from a work prompt)
/issue add dark mode toggle

# 2) Branch
/branch                       # → feat/42-add-dark-mode-toggle

# 3) Hack
$EDITOR src/components/...

# 4) Commit (signed, conventional, refs the issue)
git add .
/commit                        # commitlint runs via husky

# 5) Push + open draft PR
git push
/pr                            # opens draft, fills declaration block

# 6) When CI is green and self-review is done
gh pr ready

# 7) After merge
/close                         # summary on the closed issue
```

## Anti-patterns

| Don't | Do |
|-------|-----|
| Push directly to `main` | Branch + PR |
| PR without an issue | Create issue first |
| Mega-PR (50+ files unrelated) | Split into focused PRs |
| Force-push to `main` | Never. Ever. |
| Merge with red CI | Fix CI first |
| Stale branches after merge | Branch protection auto-deletes; manually delete if needed |
| Squash commit message "fix stuff" | Meaningful conventional commit |
| Close issue manually after merge | `Closes #N` in PR body auto-closes — auto-status workflow ensures `status/done` |
| Bypass commitlint with `--no-verify` | Fix the message |
| Bypass signed-commits CI | Set up signing properly |
| False Contribution declaration | Forfeits CU for that PR + 25% monthly cap reduction |

## Code of conduct

Be kind. Disagree on substance, not on people. Reviews are about the code; the contributor is on the same team.

## Getting help

- Slack `#dev` — real-time chat
- GitHub Discussions — open-ended questions, RFCs
- Issues — only for actionable work
- `/help` in Claude Code — keybinds, hooks, skills
