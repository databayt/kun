# Agent Registry

**Global agents for all projects** | **Location**: `~/.claude/agents/`

## Quick Stats

- **Total Agents**: 43 (9 leadership + 34 specialists)
- **Model**: opus (all agents)
- **Stack**: Next.js 16 + React 19 + Prisma 6 + TypeScript 5

---

## Company Hierarchy

```
                         captain (CEO brain)
                        /       |        \
                   revenue   growth    support        (Business)
                      \       /
                   product  analyst                   (Product)
                      |
                tech-lead — ops — guardian             (Tech Leadership)
                      |
                 orchestration                        (Coordination)
                    /    \
              learn → analyze                         (Learning)
                      |
                 33 specialists                       (Execution)
```

### Tier 0 — Captain (1)

| Agent | Purpose | Scope |
|-------|---------|-------|
| **captain** | CEO brain — weekly allocation, revenue strategy | All 5 products, all 4 humans |

### Tier 1 — Business (3)

| Agent | Purpose | Primary Human |
|-------|---------|---------------|
| **revenue** | Pricing, proposals, contracts, cost analysis | Ali + Sedon |
| **growth** | Content, SEO, social, developer relations | Samia + Ali |
| **support** | Onboarding, issue triage, knowledge base | Sedon + Ali |

### Tier 2 — Product (2)

| Agent | Purpose | Primary Human |
|-------|---------|---------------|
| **product** | Roadmap across all 5 products, stories, prioritization | All team |
| **analyst** | Market intelligence, competitors, analytics | Ali + Samia |

### Tier 3 — Tech Leadership (3)

| Agent | Purpose | Primary Human |
|-------|---------|---------------|
| **tech-lead** | Architecture across 14 repos, shared patterns | Abdout |
| **ops** | CI/CD, costs, monitoring, infrastructure | Sedon + Abdout |
| **guardian** | Security, performance budgets, compliance | Abdout |

---

## Specialist Categories

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

### DevOps (4)

| Agent | Purpose | Handoff |
|-------|---------|---------|
| **build** | Turbopack, TypeScript validation, bundles | deploy |
| **deploy** | Vercel, monitoring, rollback, staging | - |
| **test** | Vitest, Playwright, 95% coverage target | - |
| **package** | Cross-repo dependency audit, upgrades, alignment | tech-lead, build |

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

### Learning (2)

| Agent | Purpose | Handoff |
|-------|---------|---------|
| **learn** | Org intelligence — extract patterns, conventions, team dynamics from git history | captain, tech-lead, analyze |
| **analyze** | Repo config generator — analyze patterns, generate CLAUDE.md + agents + rules as PR | learn, tech-lead, github |

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
captain (company brain)
    │
    ├── Business Layer
    │   ├── revenue (deals, pricing, Ali + Sedon)
    │   ├── growth (content, SEO, Samia + Ali)
    │   └── support (customers, onboarding, Sedon + Ali)
    │
    ├── Product Layer
    │   ├── product (roadmap, stories, all team)
    │   └── analyst (market intel, Ali + Samia)
    │
    └── Tech Leadership
        ├── tech-lead (cross-repo architecture, Abdout)
        ├── ops (delivery, costs, Sedon + Abdout)
        └── guardian (security, quality, Abdout)
            │
            └── orchestration (task coordinator)
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
                │   └── build → deploy, package → tech-lead
                │
                ├── Learning Chain
                │   └── learn → analyze → github (PR)
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
  revenue ↔ analyst ↔ product (pricing feedback loop)
  growth ↔ product (content aligned with releases)
  support → tech-lead (bug escalation)
  ops → guardian (security review of infra)
  learn → analyze (intelligence feeds config generation)
  learn → captain (org insights inform strategy)
  analyze → github (config PRs follow workflow cycle)
```

---

## Technology Versions

Keep agents updated with latest stable versions:

| Technology | Latest | Check Command |
|------------|--------|---------------|
| Next.js | 16.2.2 | `npm view next version` |
| React | 19.2.4 | `npm view react version` |
| TypeScript | 6.0.2 | `npm view typescript version` |
| Tailwind | 4.2.2 | `npm view tailwindcss version` |
| Prisma | 7.6.0 | `npm view prisma version` |
| Zod | 4.3.6 | `npm view zod version` |
| NextAuth | 5.0.0-beta.30 | `npm view next-auth@beta version` |
| Vercel AI SDK | 6.0.145 | `npm view ai version` |
| lucide-react | 1.7.0 | `npm view lucide-react version` |

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
| Dependency management | package |
| Org intelligence | learn |
| Repo config generation | analyze |

---

**Rule**: Use specialized agents. Follow handoff chains. Keep versions current.
