---
name: autofix-pr
description: Hand a PR to a Claude Code web session that babysits CI, applies suggested review fixes, and keeps the PR mergeable
model: sonnet
argument-hint: "<PR-number> | <PR-url>"
---

# Autofix-PR — Web-Session PR Babysitter

After `/ship` opens a PR, hand it off to a Claude Code web session that watches CI and review comments and applies fixes without you needing to stay attached. This is a thin kun wrapper around Anthropic's built-in autofix-pr behavior.

> **Built-in**: This delegates to Claude Code's web-session autofix capability. See `/teleport` to bring the session into your terminal at any time.

## Usage

- `/autofix-pr 142` — start babysitting kun#142
- `/autofix-pr https://github.com/databayt/hogwarts/pull/87` — full URL
- `/autofix-pr` (no args) — pick up the most recent PR from `gh pr list --author @me`

## What the web session does

1. **Wait for CI** to start, watch each check
2. **On CI failure**: read logs, propose fix, push to the branch as a new commit
3. **On review comment** (line-level or top-level): if the suggestion is a code fix, apply it; if it's a question, leave a reply
4. **On merge conflict**: rebase onto base, resolve trivially, push; if conflicts are non-trivial, surface to you
5. **On `Closes #N` resolution**: confirm the linked issue auto-closes after merge

The web session does NOT:
- Merge the PR (humans only)
- Force-push to shared branches
- Change the PR title or description
- Approve its own work

## Protocol

### 1. RESOLVE PR

If number: assume current repo from `git remote`.
If URL: parse owner/repo/number.
If empty: `gh pr list --author @me --state open --limit 5` and pick the freshest, or ask if ambiguous.

### 2. AUTHORIZE — Check the user wants autofix on this PR

If this is the user's first autofix on this repo, confirm: "Autofix will push commits to <branch>. OK?"

### 3. LAUNCH — Start the web session

Invoke the underlying `/autofix-pr` built-in or scaffold the equivalent via Anthropic's Claude Code on the web. The session runs on Anthropic infrastructure; your laptop can sleep.

### 4. REPORT

```
## Autofix-PR: <repo>#<N>

**Branch**: <branch>
**Base**: <base>
**Web session**: <url>
**Watching**: CI, review comments, conflicts
**Action policy**: push fixes on failure, reply on questions, never merge

Use /teleport <session-id> to attach.
```

### 5. APPEND telemetry

```jsonl
{"event": "autofix-pr-started", "repo": "<repo>", "pr": <N>, "session": "<url>", "started_at": "<iso>"}
```

To `~/.claude/memory/autofix-prs.jsonl` — `/insights` aggregates this.

## Reusable from /ship

The `/ship` command (Theme 1 / Theme 6) chains `→ /autofix-pr` unless `--skip-autofix` is passed.

## Exit Gate

- Web session launched and URL captured
- Telemetry written
- User informed how to attach
- No commit pushed by `/autofix-pr` itself (the web session does the pushing)
