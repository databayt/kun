Create a GitHub issue in the appropriate databayt repo.

Arguments: $ARGUMENTS (title and description, or just a topic to expand)

## Repos

| Repo | Use for |
|------|---------|
| **kun** | Engine config: agents, skills, MCP, hooks, rules, memory, scripts |
| **hogwarts** | Education product: features, bugs, improvements |
| **souq** | E-commerce product |
| **mkan** | Rental product |
| **shifa** | Medical product |
| **codebase** | Shared patterns, components, templates |
| **shadcn** | UI component library |
| **swift-app** | iOS mobile app |
| **marketing** | Landing pages, marketing site |

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
