---
name: Block
description: Create blocks - UI components with integrated business logic
argument-hint: "<source|refactor|audit|list> [name]"
model: claude-opus-4-7
allowed-tools: ["Bash(pnpm *)", "Read", "Write", "Edit", "Glob", "Grep", "mcp__shadcn__*"]
---

# Block Command

Create and manage blocks - UI components with integrated business logic. Beyond shadcn/ui: authentication, data tables, payments, dashboards with full stack integration.

## Usage
```
/block <source>            - Add block from source
/block refactor <name>     - Refactor existing block
/block audit <name>        - Quality audit (100-point score)
/block list                - List all registered blocks
```

## Argument: $ARGUMENTS

## Source Types

| Prefix | Source | Example |
|--------|--------|---------|
| `github:` | GitHub repository | `github:tanstack/table` |
| `shadcn:` | shadcn/ui registry | `shadcn:sidebar-07` |
| `magicui:` | Magic UI | `magicui:shimmer-button` |
| `aceternity:` | Aceternity UI | `aceternity:spotlight` |
| `internal:` | Existing component | `internal:tablecn` |
| (path) | Local file | `./downloads/block` |

## Stack Adaptation

- Auth: Clerk/Auth0 → Auth.js (NextAuth v5)
- Database: MongoDB/Supabase → Prisma + Neon
- Styling: hex/rgb → OKLCH theme variables
- Margins: ml/mr → ms/me (RTL-compatible)
- Structure: Mirror-pattern with content.tsx, config.ts, types.ts, actions.ts

## Quality Audit (100 pts)

| Category | Points |
|----------|--------|
| Architecture | 20 |
| Code Quality | 20 |
| Styling | 15 |
| i18n | 15 |
| Accessibility | 10 |
| Performance | 10 |
| Security | 5 |
| Documentation | 5 |
