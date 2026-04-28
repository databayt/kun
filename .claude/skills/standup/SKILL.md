---
name: standup
description: Daily standup digest — reads each human's last 24h commits, open issues, blockers; posts to Slack; updates capacity.json
argument-hint: "[--dry-run | --human <id>]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*), Bash(jq:*), Edit
context: fork
agent: general-purpose
---

# /standup

The daily heartbeat. Runs in 30 seconds, replaces 15 minutes of "what did you do yesterday".

## Procedure

### Step 1: Per-human activity (last 24h)

For each entry in `.claude/memory/capacity.json.humans[]` where `active = true`:

```bash
# Recent commits across all 14 repos
for repo in databayt/{kun,hogwarts,mkan,souq,shifa,marketing,swift-app,codebase}; do
  gh api "repos/${repo}/commits?since=$(date -u -v-24H +%FT%TZ)&author=${human.email}" \
    --jq '.[] | {repo: "'${repo}'", sha: .sha[:7], message: .commit.message | split("\n")[0]}'
done

# Open issues assigned
gh issue list --assignee "${human.id}" --json repository,number,title,labels

# Stale PRs (>48h no commit)
gh pr list --author "${human.id}" --state open --json number,updatedAt,title \
  | jq '.[] | select((now - (.updatedAt | fromdateiso8601)) > 172800)'
```

### Step 2: Read declared blockers

`.claude/memory/capacity.json.humans[].blockers` — anything self-reported.

### Step 3: Compose digest

Per-human section, max 4 lines each:

```
👤 abdout (founder)
- shipped: 3 commits across hogwarts (admission), kun (E14)
- open: hogwarts#115, kun#captain
- blocked: none

👤 ali (qa+sales)
- shipped: report:hogwarts#268, hogwarts#261 verified
- open: hogwarts#115 (5 items remaining)
- blocked: needs preview URL for new admission flow

👤 samia (rd + kun caretaker)
- shipped: 0 commits (research-mode)
- open: kun#docs-content-calendar
- blocked: none

👤 sedon (saudi ops)
- shipped: 0 commits (Friday batch)
- open: saudi-bank-account
- blocked: waiting on signature
```

### Step 4: Update capacity.json

For each human: update `currentFocus` (top 1 active issue title) and `blockers` (carry forward + add new).

### Step 5: Post

- Slack `#standup` channel: digest above
- `~/.claude/bridge.md` Code → Cowork section: brief
- For accessibility (samia/ali blind): also write `.claude/standup/{date}.md` with verbose status the screen reader can read linearly

### Step 6: Surface to captain

If any blocker is present > 48h, escalate to captain queue: `/dispatch --priority decision --deadline 24h "Blocker for {human}: {description}"`

## --dry-run output

Prints the digest to stdout. Does not post or update memory.

## --human <id>

Run for one specific human only (e.g. `/standup --human ali`).

## Definition of Done

- [ ] Digest posted to Slack
- [ ] `capacity.json.humans[].currentFocus` updated for each
- [ ] Stale PRs (> 48h) flagged
- [ ] Bridge file appended

## When NOT to use this skill

- Sprint kickoff — use `/sprint-plan`
- Sprint retrospective — use `/sprint-review`

## Cadence

Run daily 09:00 Asia/Riyadh. Can be wired as a Routine (see `.claude/routines/`) for autonomous execution.

## Reference

- Capacity model: `.claude/memory/capacity.json`
- Captain agent: `.claude/agents/captain.md`
