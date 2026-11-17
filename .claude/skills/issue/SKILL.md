---
name: issue
description: Create a GitHub issue in the appropriate databayt repo
when_to_use: "Use when a task, bug, chore or follow-up should become a tracked, labelled GitHub issue in the right databayt repo, including turning Slack messages into issues — as distinct from /idea, which captures feature ideas with user stories. Triggers on: open/file an issue, create a GitHub issue in the right databayt repo."
argument-hint: <title> [description]
lane: build
effort: medium
---

Create a GitHub issue in the appropriate databayt repo.

Arguments: $ARGUMENTS (title and description, or just a topic to expand)

## Repos

| Repo                      | Use for                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| **kun**                   | Engine config: agents, skills, MCP, hooks, rules, memory, scripts |
| **hogwarts**              | Education product: features, bugs, improvements                   |
| **souq**                  | E-commerce product                                                |
| **mkan**                  | Rental product                                                    |
| **shifa**                 | Medical product                                                   |
| **codebase**              | Shared patterns, components, templates                            |
| **shadcn**                | UI component library                                              |
| **ios-app / android-app** | Mobile apps (iOS / Android)                                       |
| **marketing**             | Landing pages, marketing site                                     |

## Labels

### Priority

P0-critical, P1-high, P2-medium, P3-low

### Type

type:agent, type:skill, type:mcp, type:hook, type:rule, type:memory, type:docs, type:infra, bug, enhancement

### Scope

scope:captain, scope:business, scope:product, scope:tech, scope:specialist, scope:cross-repo

### Assignment

assign:abdout, assign:ali, assign:samia, assign:sedon, assign:captain

## Steps

1. Determine the correct repo from the topic
2. Select appropriate labels (priority + type + scope + assignment)
3. Select milestone if applicable (Phase 1/2/3 for kun)
4. Write a clear title (imperative, <70 chars)
5. Write a structured body:
   - **Context**: Why this matters
   - **Action**: What needs to be done (checklist)
   - **Verification**: How to confirm it's done
6. Create the issue using `gh issue create`
7. Post to Slack `#dev` channel with the issue link
8. Report the issue URL

## Team task shape

When the issue is a task for a person on the team (a department's work, not an engine chore), use the
machine app's shape (`src/lib/machine/contract.ts`; full example in `.claude/skills/captain/SKILL.md`,
"Task shape"):

- Labels `dept:<tech|business|sales|marketing|video|support|rnd>` + `P0`..`P3` (create missing with `gh label create`).
- Milestone = the current sprint, `Sprint <yyyy>-W<ww>` (`date +%G-W%V`), created if missing with the goal as description.
- Body: Goal, Acceptance checklist, Context links, then the last line
  `<!-- kun: repos=<repos>; items=<skill:x,agent:y from departments/<d>/pack.json>; after=<repo#n,#n> -->`.
- Never set `holder:` / `status:` labels and never close it for the person: machines manage those; only the CEO closes.
- Creating it still waits for Abdout's explicit "send" when the captain or weekly drafted it.

## Slack Integration

After creating an issue, post to Slack:

```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"#dev","text":"New issue: repo#N — title"}' \
  https://slack.com/api/chat.postMessage
```

## From Slack

When asked to create issues from Slack messages:

1. Read recent messages from the specified channel using Slack API
2. Identify actionable items (bugs, feature requests, tasks)
3. For each item:
   - Determine repo from context
   - Create GitHub issue with original message as context
   - Reply in Slack thread with the issue link
4. Use `users:read` to identify who reported the issue

If creating issues across multiple repos, create them in parallel.
If the label doesn't exist in the target repo, create it first with `gh label create`.
