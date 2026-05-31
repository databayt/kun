---
name: Fix
description: Auto-fix all detected issues - TypeScript, lint, build errors
argument-hint: "[scope]"
allowed-tools: Bash(pnpm *), Bash(npx *)
model: claude-opus-4-7
---

# Auto-Fix

Auto-fix all detected issues in the codebase.

## Argument: $ARGUMENTS

## Steps

1. Run `pnpm tsc --noEmit` and fix TypeScript errors
2. Run `pnpm lint --fix` and fix lint issues
3. Re-run checks to verify all fixed
4. Report summary of changes made
