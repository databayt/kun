---
name: report
description: List the open user reports across databayt repos, let a human take or reject each, then fix the accepted ones end to end
when_to_use: "Use when the open reports need a human decision or a fix — list the queue of `report`-labeled issues across the databayt repos (hogwarts, kun, mkan, souq, shifa) as one numbered table, take Abdout's take/reject choices in prose, label the accepted ones and close the rejected ones with a reason, then run the report agent (read, verify, fix, build, push, close) on what was accepted; also a single repo or a single issue. Distinct from /qa (block-wide QA), /check (pre-ship gate) and /issue (file a new issue). Triggers on: report, reports, fix reports, list the reports, show the reports, what did the team report, the team reported, Ali reported, open issues from the dialog, take/reject the reports, verified-report queue, البلاغات, بلاغات الفريق, المشاكل المبلغ عنها, أصلح البلاغات."
argument-hint: "[--status | <repo> | <repo>#N | take 1,3 reject 2]"
---

# Report — list, choose, fix

The dialog on every page files a GitHub issue labeled `report`. This skill is the
other half: **it lists them, Abdout chooses, the agent fixes what he took.** Nothing
is auto-processed. The scoring pipeline's buckets order the list and kill junk before
an issue exists; they are not verdicts.

## Usage

- `report` / "list the reports" — LIST the whole org queue, then CHOOSE
- `report hogwarts` — only `databayt/hogwarts`
- `report hogwarts#42` — skip the list; treat #42 as accepted and FIX it
- `report --status` — the table only, no questions
- "take 1 and 3, reject 2 — not a bug" — APPLY choices against the last table

## Argument: $ARGUMENTS

## 1. LIST — one call, one table

```bash
gh search issues --owner databayt --label report --state open --limit 50 \
  --json repository,number,title,labels,createdAt,author,url
```

(`gh search` indexes with a lag of seconds. Right after an issue was created in this
session, confirm with `gh issue list --repo databayt/<repo> --label report --state open`.)

Render a numbered table, ordered **accepted → verified → team → needs-human →
low-confidence → legacy**, oldest first within a lane:

```
#  | issue         | lane          | age | reporter        | score | page                          | title
1  | hogwarts#382  | team          | 60d | ADMIN cmrkybll… | 40    | demo…/en/students/enroll      | in the student drop down list not all…
```

Lane = the first label present of `accepted`, `verified-report`, `team`, `needs-human`,
`low-confidence`; else `legacy`. Reporter, score and page come from the issue body
(`**Reporter**:`, `**Page**:`, and the `<!-- score-block -->` JSON — `gh issue view N
--repo databayt/<repo> --json body`). Read bodies for the rows you show; the table is
the decision surface, so keep titles whole and pages short (host + path).

If `--status`, stop here.

## 2. CHOOSE — the human gate

- **Never decide for him.** Present the table and ask which to take and which to reject.
- Up to 4 rows: `AskUserQuestion` (multiSelect) "Which reports do you want fixed?", then
  one more for rejects. More than 4: ask in prose — "reply with the numbers to take and
  the numbers to reject, e.g. `take 1,3 reject 2`". AskUserQuestion caps at 4 options.
- Rows he does not mention stay open and untouched.
- In an autonomous session (nobody can answer), render the table, do NOT fire
  AskUserQuestion, and end the turn with the table so he can answer next time.

## 3. APPLY — record the decision on GitHub

Labels may not exist in every repo yet; create before adding (idempotent):

```bash
gh label create accepted --repo databayt/<repo> --color 0e8a16 --force \
  --description "Accepted by a human for the auto-fix lane"
```

- **take** → `gh issue edit N --repo databayt/<repo> --add-label accepted`, plus a
  one-line comment: "Accepted by <who> — queued for fix."
- **reject** → `gh issue close N --repo databayt/<repo> --reason "not planned"
--comment "Rejected by <who>: <the reason he gave>"`. The reporter sees why.
- **defer** (he said "later" / "not now") → leave as is.

## 4. FIX — the report agent, one accepted issue at a time

For every issue now labeled `accepted` (or `verified-report`), oldest first, run the
**report agent pipeline** (`.claude/agents/report.md`):

1. **READ** — `gh issue view N` → description, page URL, reporter, score-block
2. **LOCATE** — URL → route directory + component directory (mirror pattern)
3. **CONTEXT** — AGENTS.md, README.md, ISSUE.md in the feature directory
4. **VALIDATE** — accepted means "fix it if it is a bug"; if it turns out to be a feature request, a data/onboarding gap, or unsafe (schema/auth/middleware), comment and leave it open for him — don't fake a fix
5. **SEE** + **DEBUG** — screenshot the page, console + network
6. **IDENTIFY** — root cause
7. **FIX** — minimum diff in the target repo
8. **BUILD** — `pnpm build` (hogwarts: `pnpm tsc --noEmit` first, the build ignores type errors)
9. **PUSH** — commit straight to `main` with `Closes #N`; no branches, no PRs
10. **VERIFY** — kun redeploys itself on push (Vercel). hogwarts and mkan are on Cloudflare and do NOT: say so in the close comment and either run `/deploy <repo>` or leave the one-line command for Abdout
11. **CLOSE** — `gh issue close` with what was wrong, what changed, files, how verified

One issue, one commit. Fix only what was reported.

## Repo paths

| Repo     | Local path               | Production                    | Deploys on push |
| -------- | ------------------------ | ----------------------------- | --------------- |
| hogwarts | `/Users/abdout/hogwarts` | `*.balqalam.com` (Cloudflare) | no → `/deploy`  |
| kun      | `/Users/abdout/kun`      | `kun.databayt.org` (Vercel)   | yes             |
| mkan     | `/Users/abdout/mkan`     | `www.mkan.sd` (Cloudflare)    | no → `/deploy`  |
| souq     | `/Users/abdout/souq`     | —                             | —               |
| shifa    | `/Users/abdout/shifa`    | —                             | —               |

## Escalation

| Situation                        | Action                                               |
| -------------------------------- | ---------------------------------------------------- |
| Cannot reproduce                 | Comment + `cannot-reproduce` label, leave open       |
| Feature request in disguise      | Comment, leave open for Abdout (he accepted a "bug") |
| Needs schema / auth / middleware | Comment, leave open — QA scope rule                  |
| Build error                      | Hand off to `build` agent                            |
| Server exception                 | Hand off to `sse` agent                              |

## Rules

- The table is the product. Whole titles, real reporters, the page — he decides in 10 seconds.
- Never fire AskUserQuestion with more than 4 options; never fire it in an autonomous session.
- Record every decision on the issue (label or close comment). Silence is what made the old queue rot.
- One issue, one commit. Always build before pushing. Always say whether prod has the fix.
