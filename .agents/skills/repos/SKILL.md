---
name: Repos
description: Explore databayt organization repositories
when_to_use: "Use when the question spans the databayt GitHub org rather than this repo — listing, syncing, cross-repo status, or finding which repo holds something. Triggers on: list our repos, which repo has, org status, sync the repos."
argument-hint: "[list|sync|status|search|repo-name]"
allowed-tools: ["Read", "Glob", "Grep", "mcp__github__*"]
lane: mechanical
model: haiku
effort: low
context: fork
---

# Repository Explorer

Access and explore all databayt organization repositories.

## Argument: $ARGUMENTS

## Commands

| Command | Description |
|---------|-------------|
| `list` | List all repositories |
| `sync` | Sync all repos locally |
| `status` | Check sync status |
| `search <pattern>` | Search across repos |
| `<repo>` | Explore specific repo |

## Repository Groups

**Core Libraries**: codebase, shadcn, radix, kun
**Products**: hogwarts, souq, mkan, shifa
**Specialized**: swift-app, distributed-computer, marketing

## Quick Access

**Local** (preferred): `/Users/abdout/codebase`, `/Users/abdout/oss/<repo-name>`

**GitHub fallback**: `mcp__github__get_file_contents(owner="databayt", repo="<name>", path="<path>")`
