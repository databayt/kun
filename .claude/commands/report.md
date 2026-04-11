# Report — Auto-Fix User-Reported Issues

Process GitHub issues labeled `report`. Read, verify, fix, close.

## Usage
- `/report` - Process all repos with open report issues
- `/report hogwarts` - Process only databayt/hogwarts
- `/report kun` - Process only databayt/kun
- `/report hogwarts#42` - Process a specific issue
- `/report --status` - Show open report issues across all repos

## Argument: $ARGUMENTS

## Instructions

### Parse Arguments

- No argument or empty → process ALL repos (hogwarts, kun, souq, mkan, shifa)
- Repo name (e.g., `hogwarts`) → process only `databayt/<repo>`
- `repo#number` (e.g., `hogwarts#42`) → process only that specific issue
- `--status` → show status dashboard, don't fix anything

### If `--status`

Run this for each repo and present as a table:

```bash
gh issue list --label report --state open --repo databayt/hogwarts --json number,title,createdAt,labels
gh issue list --label report --state open --repo databayt/kun --json number,title,createdAt,labels
gh issue list --label report --state open --repo databayt/souq --json number,title,createdAt,labels
gh issue list --label report --state open --repo databayt/mkan --json number,title,createdAt,labels
gh issue list --label report --state open --repo databayt/shifa --json number,title,createdAt,labels
```

Output: `repo | issue# | title | age | labels`

### If processing issues

For each target repo, list open report issues:

```bash
gh issue list --repo databayt/<repo> --label report --state open --json number,title,createdAt
```

Process each issue (oldest first) using the **report agent pipeline**:

1. **READ** — `gh issue view <N>` → extract description + page URL
2. **LOCATE** — URL → route directory + component directory (mirror pattern)
3. **CONTEXT** — read CLAUDE.md, README.md, ISSUE.md in the feature directory
4. **VALIDATE** — is it a real bug? aligned with plans? safe to fix?
5. **SEE** — screenshot the page
6. **DEBUG** — console errors, network failures
7. **IDENTIFY** — correlate signals → root cause
8. **FIX** — minimum diff in the target repo
9. **BUILD** — `pnpm build` in the target repo
10. **PUSH** — branch + PR with `fix:` prefix, `Closes #N`
11. **VERIFY** — screenshot again after deploy
12. **CLOSE** — close issue with structured comment

### Repo Paths

| Repo | Local Path | Production |
|------|-----------|------------|
| hogwarts | `/Users/abdout/hogwarts` | `*.databayt.org` |
| kun | `/Users/abdout/kun` | `kun.databayt.org` |
| souq | `/Users/abdout/souq` | `souq.databayt.org` |
| mkan | `/Users/abdout/mkan` | `mkan.databayt.org` |
| shifa | `/Users/abdout/shifa` | `shifa.databayt.org` |

### Escalation

| Situation | Action |
|-----------|--------|
| Cannot reproduce | Comment + `cannot-reproduce` label, leave open |
| Feature request | Comment + `needs-human` label, leave open |
| Needs schema/auth change | Comment + `needs-human` label, leave open |
| Build error | Hand off to `build` agent |
| Server exception | Hand off to `sse` agent |

### Rules

- One issue, one commit — no bundling
- Fix only what's reported — no scope creep
- Always `pnpm build` before pushing
- Always `see` the page after deploy
- When in doubt, comment and label — don't guess
