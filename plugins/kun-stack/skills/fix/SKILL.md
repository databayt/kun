---
name: Fix
description: Auto-fix all detected issues - TypeScript, lint, build errors
when_to_use: "Use when the codebase has mechanical errors to clear — TypeScript, lint and build failures fixed in a loop until green. Unlike /report (a user-filed bug) and /check (the pre-ship gate, which only reports). Triggers on: fix the errors, clear the type errors, make it compile, lint is failing."
argument-hint: "[scope]"
allowed-tools: Bash(pnpm *), Bash(npx *)
model: opus
---

# Auto-Fix

Auto-fix all detected issues in the codebase.

## Argument: $ARGUMENTS

## Steps

1. Run `pnpm tsc --noEmit` and fix TypeScript errors
2. Run `pnpm lint --fix` and fix lint issues
3. Re-run checks to verify all fixed
4. Report summary of changes made
