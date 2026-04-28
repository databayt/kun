# Routine: Daily Org Pulse

> Story 17.2 in `docs/EPICS-V4.md`. Anthropic Routine — copy this prompt verbatim into [claude.ai/code/routines](https://claude.ai/code/routines) when registering.

## Schedule

- Daily at 07:00 Asia/Riyadh
- Repo: `databayt/kun` (read-only, no branch pushes)
- Connectors: `github`, `slack`

## Prompt

You are running the daily org pulse for databayt. You have read access to the kun repo and write access to Slack and GitHub issues.

**Your task:**

1. Read `.claude/memory/repositories.json` to know which 13 live repos to walk.

2. For each non-archived, non-dormant repo, gather:
   - Open issue count by label (especially `report`, `captain`, `pilot`, `bug`, `feat`)
   - Commits in last 24h (count + author breakdown)
   - Latest deploy status from Vercel (if `deployUrl` is set, fetch via gh API or Vercel MCP)
   - Open PR count (draft vs ready)
   - Failing CI runs (gh run list --status failure)

3. Compose a concise org pulse summary (max 1500 chars) with sections:
   - **Movement**: which repos had commits, by whom
   - **Stalled**: repos with stale PRs (>48h no commit) or red CI
   - **Pilot**: hogwarts#115 progress (admission QA checkboxes)
   - **Risks**: any P0/urgent labeled issues opened in last 24h
   - **Routines**: any Anthropic Routines that errored (read `~/.claude/memory/routine-failures.jsonl` if exists)

4. Write the summary as a JSON file `~/.claude/memory/org-pulse-{date}.json` with the same sections plus raw data.

5. Post the summary to Slack `#dispatch` channel with the title `🌅 Daily Pulse — {date}`.

6. If any of the following thresholds are crossed, also dispatch a captain alert via the `/dispatch --priority urgent` channel (Apple Notes Inbox or GitHub issue with label `captain`):
   - Any repo has 3+ open `report` issues
   - hogwarts#115 has new comments since yesterday
   - Anthropic spend trending > $180/mo (read `runway.json`)
   - Any production deploy failed in last 24h

**Do not:**
- Push commits to any repo (read-only)
- Post to channels other than `#dispatch`
- Close or comment on issues (your job is observation, not action)

**On error:**
- Log to `~/.claude/memory/routine-failures.jsonl`
- Continue with remaining repos (don't fail the whole run if one repo's API is down)

## Verification

After registration, trigger manually with the **Run now** button. Expected output:
- File created at `~/.claude/memory/org-pulse-{today}.json`
- Slack message in `#dispatch` channel
- No new branches in any repo

## Cost estimate

~$0.05/day with sonnet-4.6 + prompt caching. Monthly: $1.50.
