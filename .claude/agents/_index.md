# Agent Registry

**Global agents for all projects** | **Location**: `~/.claude/agents/`

## Quick Stats

- **Total Agents**: 27
- **Model**: opus (all agents)
- **Stack**: Next.js 16 + React 19 + Prisma 6 + TypeScript 5

---

## Agent Categories

### Stack (7)

| Agent | Purpose | Version |
|-------|---------|---------|
| **nextjs** | App Router, Server Components, Server Actions | 16.0.7 |
| **react** | Hooks, Suspense, Concurrent Features | 19.2.0 |
| **typescript** | Strict Mode, Generics, Zod Validation | 5.x |
| **tailwind** | Semantic Tokens, RTL/LTR, Responsive | 4.x |
| **prisma** | Schema Design, Queries, Multi-tenant | 6.16.2 |
| **shadcn** | Registry (82 Sources), MCP, Radix | latest |
| **authjs** | NextAuth v5, OAuth, JWT, Sessions | 5.x |

### Design (4)

| Agent | Purpose | Handoff |
|-------|---------|---------|
| **orchestration** | Multi-agent coordination, complex tasks | all agents |
| **architecture** | Mirror pattern, Prisma, multi-tenant design | pattern, structure |
| **pattern** | Code conventions, anti-patterns, best practices | structure |
| **structure** | File organization, naming, project layout | nextjs |

### UI (4)

| Agent | Purpose | Handoff |
|-------|---------|---------|
| **shadcn** | Registry, Radix primitives, MCP | atom |
| **atom** | Composed components (2+ UI primitives) | template |
| **template** | Page layouts (hero, sidebar, auth) | block |
| **block** | Functional UI (DataTable, Forms, Wizards) | - |

### DevOps (3)

| Agent | Purpose | Handoff |
|-------|---------|---------|
| **build** | Turbopack, TypeScript validation, bundles | deploy |
| **deploy** | Vercel, monitoring, rollback, staging | - |
| **test** | Vitest, Playwright, 95% coverage target | - |

### VCS (2)

| Agent | Purpose | Handoff |
|-------|---------|---------|
| **git** | Branching, commits, conventional format | github |
| **github** | PRs, Issues, Actions, MCP integration | - |

### Specialized (7)

| Agent | Purpose | Handoff |
|-------|---------|---------|
| **middleware** | Edge runtime, auth checks, i18n routing | nextjs |
| **internationalization** | Arabic RTL, English LTR, dictionaries | - |
| **semantic** | Semantic HTML, color tokens, accessibility | tailwind |
| **sse** | Server-side exception diagnosis, debugging | nextjs, react |
| **optimize** | Feature automation, integration, time savings | architecture, prisma |
| **performance** | Core Web Vitals, profiling, runtime optimization | nextjs, react, prisma, build, tailwind |
| **comment** | Code comments, WHY over WHAT, Clean Code | pattern, typescript |

---

## Handoff Protocol

When delegating to another agent:

1. **State the reason**: Why you are handing off
2. **Provide context**: What you've done so far
3. **Specify the task**: What the target agent should do
4. **Return control**: Continue after delegation completes

### Example Handoff

```
Handing off to `react` agent:
- Reason: Need to optimize component re-renders
- Context: Created server action for data fetching
- Task: Implement useMemo and useCallback for list component
```

---

## Inter-Agent Relationships

```
orchestration (master coordinator)
    │
    ├── Design Chain
    │   └── architecture → pattern → structure
    │
    ├── Stack Chain
    │   └── nextjs → react → typescript
    │
    ├── UI Chain
    │   └── shadcn → atom → template → block
    │
    ├── DevOps Chain
    │   └── build → deploy
    │
    └── Standalone
        └── test, git → github

Cross-references:
  tailwind ↔ semantic ↔ shadcn
  middleware → nextjs → architecture
  sse → nextjs + react (debugging)
  prisma → architecture (schema design)
  authjs → middleware (auth flow)
  optimize → architecture + prisma (feature analysis)
  performance → nextjs + react + prisma + build (runtime optimization)
```

---

## Technology Versions

Keep agents updated with latest stable versions:

| Technology | Current | Check Command |
|------------|---------|---------------|
| Next.js | 16.0.7 | `npm view next version` |
| React | 19.2.0 | `npm view react version` |
| TypeScript | 5.8.x | `npm view typescript version` |
| Tailwind | 4.1.x | `npm view tailwindcss version` |
| Prisma | 6.16.2 | `npm view prisma version` |
| Zod | 3.25.x | `npm view zod version` |
| NextAuth | 5.x | `npm view next-auth version` |

---

## Reference Codebase

All agents reference production patterns from:

- **Local**: `/Users/abdout/codebase`
- **GitHub**: `databayt/codebase`
- **Registry**: 82 shadcn registries via MCP

---

## Self-Improvement Triggers

Agents should suggest updates when:

1. New major version released
2. Breaking changes in dependencies
3. New patterns emerge in official docs
4. Anti-patterns discovered in practice

---

## Usage

### In Prompts

```
Use the nextjs agent to create a new page with server actions.
Use the architecture agent to design the multi-tenant data model.
Use the build agent to fix TypeScript errors.
```

### Task Delegation

```
@orchestration: Coordinate this complex feature
@architecture: Design the data model
@shadcn: Add required UI components
@build: Validate and build the feature
@deploy: Ship to production
```

### Quick Reference

| Need | Use Agent |
|------|-----------|
| New page/route | nextjs |
| Component optimization | react |
| Type errors | typescript |
| Styling/tokens | tailwind |
| Database schema | prisma |
| UI components | shadcn |
| Authentication | authjs |
| System design | architecture |
| File organization | structure |
| Code review | pattern |
| Build issues | build |
| Deployment | deploy |
| Testing | test |
| Git workflow | git, github |
| i18n/RTL | internationalization |
| Server errors | sse |
| Feature optimization | optimize |
| Runtime performance | performance |
| Code comments | comment |

---

**Rule**: Use specialized agents. Follow handoff chains. Keep versions current.
