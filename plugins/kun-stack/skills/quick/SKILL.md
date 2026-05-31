---
name: Quick
description: Fastest commit cycle - lint, fix, commit, push
argument-hint: "[commit message]"
allowed-tools: Bash(git *), Bash(pnpm *), Bash(npx *)
---

# Quick Commit

Fastest commit cycle: lint, fix, commit, push.

## Argument: $ARGUMENTS

## Steps

1. Run `pnpm tsc --noEmit` - fix any TypeScript errors
2. Stage all changes: `git add -A`
3. Commit with provided message (or auto-generate from diff)
4. Push to remote
