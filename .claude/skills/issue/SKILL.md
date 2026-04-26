---
name: issue
description: Create or resume a GitHub issue. Issues are the canonical memory channel — every task starts here, ends here, and can be paused/resumed by reading here.
---

# /issue

Issues are the primary communication channel and the resumable memory of every task. The `/issue` skill creates, hydrates, and lists them.

## Modes

```
/issue                    interactive — prompt for title/type/area/size, create
/issue <text>             one-shot   — expand <text> into a full issue, create
/issue resume <N>         load issue #N as the active context (the *resume* primitive)
/issue list               table of open issues assigned to me across all databayt repos
/issue close              close the active issue with a summary comment
```

## Active issue contract

After any non-`list` mode, `/issue` writes `.claude/state/active-issue.json`:

```json
{
  "repo": "databayt/<repo>",
  "number": 42,
  "title": "[Feat]: ...",
  "url": "https://github.com/databayt/<repo>/issues/42",
  "branch": null,
  "commits": [],
  "pr_url": null,
  "started_at": "2026-04-26T13:00:00Z"
}
```

This file is the session pointer. Hooks read it (`post-commit.sh`, `post-push.sh`, `session-end.sh`). Branch + commit + PR skills read it. Resume rehydrates from it.

## /issue (interactive)

1. Determine the target repo from cwd via `.claude/memory/repositories.json`.
2. Prompt the user for: type (feat | fix | chore | docs | report), title (≤ 65 chars, imperative), area (from the repo's `area-dropdowns.json`), size (1/2/3/5/8/13).
3. Compose the body using the matching `.github/ISSUE_TEMPLATE/<n>-<type>.yml` form: Description / Acceptance criteria checklist / Verification.
4. `gh issue create --repo "$REPO" --title "[$TYPE]: $TITLE" --body "$BODY" --label "type/$TYPE,priority/p2,status/triage"`.
5. Write `.claude/state/active-issue.json`.
6. Print the issue URL.

## /issue \<text\>

Same as interactive, but type/area/size are inferred from `<text>`:
- Type from regex (matches `auto-issue.sh`'s detection).
- Area defaults to first match in the repo's area dropdown, or `other`.
- Size defaults to `2`.

The user can edit before confirming.

## /issue resume \<N\>

The resume primitive — pick up exactly where the last session left off.

1. `gh issue view <N> --repo "$REPO" --json title,body,labels,assignees,state,comments` — full thread.
2. `gh pr list --search "linked:issue #<N>" --repo "$REPO" --json number,url,state` — linked PRs.
3. Hydrate `.claude/state/active-issue.json`:
   - `commits[]` — collect SHAs from every comment matching `**Commit \`<sha>\`**:`
   - `pr_url` — first non-null linked PR
   - `branch` — derive from `<type>/<N>-<slug>` if branch exists locally
4. Dump the entire issue thread + PR descriptions into the conversation as additional context.
5. Print: "Resumed #<N>. <K> commits made previously. PR: <url> (state). Continue with /branch / /commit / /pr / /close."

## /issue list

```bash
gh search issues \
  --owner databayt \
  --assignee @me \
  --state open \
  --json repository,number,title,labels,updatedAt \
  --limit 30
```

Group by `repository.name`, sort by `updatedAt` desc, format as a table:

```
databayt/kun
  #9   [Feat]: unified git/github workflow + contribution-as-evidence layer  status/in-progress  2026-04-26
  #1   [Chore]: configure API keys for 7 missing MCP servers                  status/triage       2026-04-15

databayt/hogwarts
  #115 [QA]: King Fahad pilot — pre-launch checklist                          status/in-progress  2026-04-25
```

## /issue close

Close the active issue:

1. Read `.claude/state/active-issue.json`.
2. If `pr_url` is set and PR is merged, comment with summary + PR link.
3. If PR is not merged, prompt for confirmation (might be wontfix/duplicate).
4. `gh issue close <N> --comment "<summary>" --repo "$REPO"`.
5. Move `.claude/state/active-issue.json` → `.claude/state/history/issue-<N>-<timestamp>.json`.

## Defaults

- Repo resolution: `repositories.json` lookup by cwd. Fallback `databayt/kun`.
- Default labels: `type/<x>`, `priority/p2`, `status/triage`.
- Default size: `2` (small, 1-2 hours).
- Title format: `[Type]: imperative-verb description ≤ 65 chars`.
- Body must include Acceptance criteria checklist + Verification.

## Integration

- `auto-issue.sh` UserPromptSubmit hook auto-creates issues for work-regex prompts. `/issue` is the explicit form.
- `/branch` requires an active issue; the branch name is `<type>/<N>-<slug>`.
- `/commit` references the active issue with `Refs #N`.
- `/pr` opens the PR with `Closes #N` and the Contribution declaration filled.
- `/close` closes the issue and clears active state.

## Examples

```
/issue
> type: feat
> title: add dark mode toggle to docs site
> area: docs
> size: 3
→ databayt/kun#42 created. https://github.com/databayt/kun/issues/42

/issue add OpenTelemetry tracing to auto-issue.sh
→ databayt/kun#43 created with type/feat, area: hooks, size: 2.

/issue resume 9
→ Loaded #9 (8 commits made previously, PR draft). Continue with /commit.

/issue list
→ 12 open issues assigned to @abdout across 4 repos.

/issue close
→ Closed databayt/kun#9 with summary referencing 11 commits + merged PR #99.
```
