# Workflows

How keywords chain into complete operations. Single words trigger steps. Sequences become rituals.

## Development

### Feature Development

```
"saas billing"
  → orchestration
  → prisma (schema) + block (UI) + stripe MCP
  → complete billing feature
```

### Dev Server (`dev`)
1. **Hook** — kill port 3000
2. **Run** — `pnpm dev`
3. **Hook** — open browser to localhost:3000
4. **Hook** — auto-format on every file change

### Build (`build`)
1. Run `pnpm build`
2. Scan TypeScript errors
3. Auto-fix lint + type errors
4. Re-build and verify clean

### Commit and Push (`push` / `quick`)
1. Lint
2. Auto-fix
3. `git add` + conventional commit
4. `git push` to remote

### Deployment (`deploy` / `ship`)
1. Build verification
2. Vercel MCP deploy
3. Poll status
4. Retry up to 5 times
5. Report deployment URL

### Testing (`test [target]`)
1. Read target code
2. Generate Vitest + Playwright tests
3. Execute test suite
4. Report coverage + results

### Handover QA (`handover [block]`)

Multi-pass testing on both localhost and production:

| Pass | Tests |
|------|-------|
| 1. Bug-free | Navigate every page, click everything, check console |
| 2. Flow | Complete user journeys, form submissions, data persistence |
| 3. Responsive | 375px (mobile), 768px (tablet), 1440px (desktop) |
| 4. RTL + i18n | Arabic layout mirrors correctly, no LTR remnants |
| 5. Translation | No hardcoded English, no missing dictionary keys |

### Report to Fix (`report [repo]`)

User submits "Report an Issue" → GitHub issue with `report` label → Claude Code auto-fixes.

```
READ → LOCATE → CONTEXT → VALIDATE → SEE+DEBUG → IDENTIFY → FIX → BUILD → PUSH → VERIFY → CLOSE
```

**Trigger**: say `report` (all repos) or `report <product>` (one repo).

**Automatic**: every session checks for open `report` issues at start.

**Escalation**: cannot reproduce → `cannot-reproduce` label. Needs judgment → `needs-human` label.

## Component Creation

### Atom (`atom [name]`)
Check codebase, compose shadcn/ui primitives, style with Tailwind + RTL, type with TypeScript, register in memory.

### Template (`template [name]`)
Check registry, design full-page layout, responsive breakpoints, mobile-first RTL, connect data layer, register.

### Block (`block [name]`)
Check codebase, design UI + business logic, create component + actions + schema, quality scoring, test, register.

### SaaS Feature (`saas [feature]`)
Generate every layer: Prisma model, server actions, React components, Next.js pages, auth checks, i18n keys, tests.

## Cross-Device

```
Desktop (CLI):  start feature work → /desktop hand off
Phone (iOS):    Remote Control to monitor → Dispatch instruction
Terminal:       /teleport pull session back → "handover" → run QA
```

## Agent Teams (Parallel Development)

```
"Build settings: profile tab, notifications tab, billing tab"
  → Lead Agent dispatches:
    ├── Agent A (worktree) → Profile form + avatar
    ├── Agent B (worktree) → Notification preferences
    └── Agent C (worktree) → Billing + Stripe
  → Lead merges → resolve conflicts → single PR → tests
```

## Scheduled Tasks

| Type | Runs On | Examples |
|------|---------|----------|
| Cloud | Anthropic infra (computer off) | Daily health, dependency audit |
| Desktop | Local machine (app open) | Recurring builds, error check |
| `/loop` | Active session | Poll deploy status |

## Captain Weekly Rhythm

- Monday: Plan
- Wednesday: Check
- Friday: Review

## Communication Channels

| Channel | Medium | Purpose |
|---------|--------|---------|
| **Dispatch** | Apple Notes | Async updates, decisions, handoffs |
| **GitHub Issues** | Repo issues | Structured work items |
| **Claude Native** | Code / Cowork / Voice | Real-time decisions |

## Quick Reference

| I Want To... | Say... |
|--------------|--------|
| Start dev server | `dev` |
| Build project | `build` |
| Push code | `push` / `quick` |
| Deploy | `deploy` / `ship` |
| Create component | `atom` / `template` / `block` |
| Generate feature | `saas [feature]` |
| Run tests | `test [target]` |
| Fix user reports | `report` / `report <repo>` |
| Fix errors | `fix` |
