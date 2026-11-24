---
name: Codebase
description: Access reference codebase at /Users/abdout/codebase or databayt/codebase
when_to_use: "Use when a pattern, component or convention should be pulled from the reference codebase rather than invented. Triggers on: from codebase, how does codebase do it, check the reference repo, is there an existing pattern for this."
argument-hint: "[search query]"
allowed-tools: ["Read", "Glob", "Grep", "mcp__github__*"]
lane: build
effort: medium
---

# Codebase Reference

Access the user's reference codebase:
- **Local**: `/Users/abdout/codebase`
- **GitHub**: https://github.com/databayt/codebase

## Argument: $ARGUMENTS

## Structure
- `src/` - Source code (components, lib, hooks, etc.)
- `__registry__/` - Component registry
- `docs/` - Documentation
- `prisma/` - Database schema

## Your Task

Based on "$ARGUMENTS", help by:
1. **Browse**: List files/folders in the codebase
2. **Search**: Find specific patterns, components, or code
3. **Copy**: Extract code to use in current project
4. **Reference**: Show how something is implemented

**Prefer local access** - Use Read, Glob, and Grep tools on `/Users/abdout/codebase/`.

**Fallback to GitHub** - If local fails, use GitHub MCP:
```
mcp__github__get_file_contents(owner="databayt", repo="codebase", path="<path>")
```
