---
name: Quick
description: Fastest commit cycle - lint, fix, commit, push
when_to_use: "Use when finished work just needs to land — lint, auto-fix, conventional commit and push to main in one pass. Not a production promotion (/ship) and not a Vercel deploy (/deploy). Triggers on: commit and push, just push it, save this work, land it."
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
