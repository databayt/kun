# Architecture: Kun (كن)

> **Version**: 3.1
> **Date**: 2026-05-31

---

## 1. Architecture Overview

Kun is a **configuration engine** — not a server, not a platform. It sits as the configuration layer on top of Anthropic's product suite, transforming general-purpose AI into Databayt's operating system.

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATABAYT ENGINE ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 5: Company Operations                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Cowork │ Claude Apps │ Team Follow-up │ Revenue Tracking   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Layer 4: Coordination & Automation                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Agent Teams │ Scheduled Tasks │ CI/CD │ Repo Sync          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Layer 3: KUN CONFIGURATION ENGINE (core value)                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CLAUDE.md   │ 18 Agents  │ 29 Commands │ 26 MCP Servers   │ │
│  │ 3 Rules     │ 5 Hooks    │ 10 Cards   │ 100+ Keywords    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Layer 2: Developer Surfaces (Anthropic-provided)               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CLI │ VS Code │ JetBrains │ Desktop │ Web │ iOS           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Layer 1: Foundation (Anthropic-provided)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Opus 4.8 │ Sonnet 4.6 │ Haiku 4.5 │ 1M Context │ API    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1: Foundation (Anthropic-Provided)

The models and API that power everything. Kun selects optimally within this layer.

### Model Selection Strategy

| Model          | Use Case                                    | Kun Usage                         |
| -------------- | ------------------------------------------- | --------------------------------- |
| **Opus 4.8**   | Architecture, complex features, code review | Default for all agents and skills |
| **Sonnet 4.6** | Fast iteration, routine changes             | Quick fixes, exploration          |
| **Haiku 4.5**  | Search, lookups, simple queries             | Explore subagent type             |

### Cost Context

Databayt runs on a single Max 20x plan ($200/month). Model selection matters for staying within usage limits.

| Technique             | Savings     | Application                      |
| --------------------- | ----------- | -------------------------------- |
| Prompt Caching        | 90%         | CLAUDE.md cached across sessions |
| Batch API             | 50%         | CI/CD review pipelines (Phase 2) |
| Haiku for exploration | 80% vs Opus | Search, lookups                  |

---

## 3. Layer 2: Developer Surfaces

Every surface Anthropic provides. Kun's configuration loads automatically regardless of which surface each team member uses.

### Team Roles

| Member | Role                |
| ------ | ------------------- |
| Abdout | Builder             |
| Ali    | QA Engineer + Sales |
| Samia  | R&D & Kun Caretaker |
| Sedon  | Executor            |

### Surface Capabilities

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Terminal  │  │ Desktop  │  │ Web      │  │ iOS      │
│ CLI      │  │ App      │  │claude.ai │  │ App      │
│          │  │          │  │ /code    │  │          │
│ Power    │  │ Visual   │  │ Zero     │  │ On-the-  │
│ users    │  │ diffs    │  │ setup    │  │ go       │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
      │             │             │             │
      └─────────────┴──────┬──────┴─────────────┘
                           │
                           ▼
             ┌──────────────────────────┐
             │  KUN CONFIGURATION       │
             │  (loaded automatically)  │
             │  ~/.claude/settings.json │
             │  ~/.claude/CLAUDE.md     │
             │  ~/.claude/agents/       │
             │  ~/.claude/mcp.json      │
             └──────────────────────────┘
```

### Cross-Device Handoff

| Feature            | Description                                    | Status       |
| ------------------ | ---------------------------------------------- | ------------ |
| **Remote Control** | Continue session from another device           | GA           |
| **Dispatch**       | Send task from phone, opens Desktop session    | GA           |
| **/teleport**      | Pull web/iOS session into terminal             | GA           |
| **/desktop**       | Hand off terminal to Desktop for visual review | GA           |
| **Agent Teams**    | Lead + teammate parallel coordination          | Experimental |

---

## 4. Layer 3: Kun Configuration Engine (Core)

This is Kun's actual value — the configuration that transforms general-purpose Claude into Databayt's engine.

### 4.1 CLAUDE.md Hierarchy

```
Priority (High → Low):
┌─────────────────────────────────────────────────────────────────┐
│ 1. Project-level: ~/project/CLAUDE.md                          │
│    └── Project-specific context (e.g., Hogwarts school modules)│
├─────────────────────────────────────────────────────────────────┤
│ 2. Repo-level: ~/project/.claude/CLAUDE.md                     │
│    └── Keywords, workflows, agent references, MCP triggers     │
├─────────────────────────────────────────────────────────────────┤
│ 3. User-level: ~/.claude/CLAUDE.md                             │
│    └── Stack preferences, mode, component hierarchy            │
├─────────────────────────────────────────────────────────────────┤
│ 4. Pattern library: /Users/abdout/codebase/CLAUDE.md           │
│    └── Core architectural patterns and conventions             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Agent Fleet

**28 user-level stack agents** (`~/.claude/agents/`) organized in 6 chains — distinct from the **18 project-level leadership/product agents** (`.claude/agents/`):

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT FLEET                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Stack Chain (7)           Design Chain (4)                     │
│  ├── nextjs                ├── orchestration (master)           │
│  ├── react                 ├── architecture                     │
│  ├── typescript            ├── pattern                          │
│  ├── tailwind              └── structure                        │
│  ├── prisma                                                     │
│  ├── shadcn                UI Chain (4)                         │
│  └── authjs                ├── shadcn                           │
│                            ├── atom                             │
│  DevOps Chain (3)          ├── template                         │
│  ├── build                 └── block                            │
│  ├── deploy                                                     │
│  └── test                  VCS Chain (2)                        │
│                            ├── git                              │
│  Specialized (8)           └── github                           │
│  ├── middleware                                                  │
│  ├── internationalization  Reference Chain (5)                  │
│  ├── semantic              ├── hogwarts (education SaaS)        │
│  ├── sse                   ├── souq (e-commerce)                │
│  ├── optimize              ├── mkan (rentals)                   │
│  ├── performance           ├── shifa (medical)                  │
│  └── comment               └── icon                             │
│                                                                  │
│  Orchestration Agent = Master Coordinator                       │
│  Routes tasks → Appropriate chain → Databayt products           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Skill Library

17 skills triggered by keywords or slash commands:

| Category          | Skills                               | Trigger Keywords                 |
| ----------------- | ------------------------------------ | -------------------------------- |
| **Workflow**      | /dev, /build, /quick, /deploy        | dev, build, push, ship           |
| **Creation**      | /atom, /template, /block, /saas      | atom, template, block, saas      |
| **Quality**       | /test, /security, /performance, /fix | test, security, performance, fix |
| **Documentation** | /docs, /codebase, /repos             | docs, codebase, repos            |
| **Utilities**     | /screenshot, /motion                 | screenshot, motion               |

### 4.4 MCP Ecosystem

25 project + 19 user MCP servers providing external tool integration:

```
┌─────────────────────────────────────────────────────────────────┐
│                       MCP ECOSYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  UI & Design              DevOps & Infra                        │
│  ├── shadcn (components)  ├── vercel (deploy)                   │
│  ├── figma (design)       ├── github (repos, PRs)               │
│  ├── tailwind (CSS)       ├── sentry (errors)                   │
│  ├── a11y (accessibility) └── gcloud (cloud)                    │
│  └── storybook (docs)                                           │
│                            Data & Auth                           │
│  Testing                   ├── neon (Postgres)                  │
│  ├── browser (headless)    ├── postgres (queries)               │
│  └── browser-headed        ├── stripe (payments)                │
│      (visual testing)      └── keychain (credentials)           │
│                                                                  │
│  Knowledge                 Project Management                   │
│  ├── ref (tech docs)       └── linear (issues)                  │
│  └── context7 (latest)                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Rules, Hooks, Memory

**8 Rules** — Path-scoped, auto-activate on file patterns:

| Rule       | Activates On                         | Enforces                                 |
| ---------- | ------------------------------------ | ---------------------------------------- |
| auth       | `**/auth/**`, `**/middleware.*`      | NextAuth v5, session scoping             |
| i18n       | `**/*-ar.json`, `**/dictionaries/**` | Arabic RTL, on-demand translation        |
| prisma     | `**/*.prisma`                        | schoolId inclusion, $extends             |
| tailwind   | `**/*.css`, `**/styles/**`           | CSS-first v4, OKLCH, RTL logical         |
| testing    | `**/tests/**`, `**/*.spec.*`         | Playwright/Vitest conventions            |
| deployment | `**/vercel.json`                     | pnpm, tsc before builds                  |
| multi-repo | (global)                             | Codebase paths, fork workflows           |
| org-refs   | (global)                             | Repo priority: codebase → shadcn → radix |

**5 Hooks** — Guaranteed execution at lifecycle events:

| Hook         | Event             | Action                       |
| ------------ | ----------------- | ---------------------------- |
| SessionStart | Session begins    | Print model info + timestamp |
| PreToolUse   | Before `pnpm dev` | Kill port 3000               |
| PostToolUse  | After `pnpm dev`  | Open Chrome                  |
| PostToolUse  | After Write/Edit  | Auto-run Prettier            |
| Stop         | Agent finishes    | Log session end              |

**6 Memory Files** — Cross-session learning:

| Memory            | Contents                                    |
| ----------------- | ------------------------------------------- |
| preferences.json  | Port 3000, single .env, pnpm-only           |
| repositories.json | 14 databayt repos with paths, stacks        |
| atom.json         | 59 atoms across 6 categories                |
| template.json     | 31 templates across 5 categories            |
| block.json        | 4 blocks (DataTable, Auth, Invoice, Report) |
| report.json       | T&C electrical report templates             |

---

## 5. Layer 4: Coordination & Automation

### 5.1 Repository Architecture

Kun coordinates 14 repositories under github.com/databayt:

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATABAYT REPOSITORY MAP                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Revenue Products                                               │
│  ├── hogwarts (FLAGSHIP — ed.databayt.org)                     │
│  │   └── Multi-tenant SaaS, education, daily active             │
│  ├── mkan (rental marketplace — mkan.vercel.app)               │
│  │   └── Airbnb-inspired, Phase 1 done                         │
│  ├── souq (e-commerce — souq-smoky.vercel.app)                 │
│  │   └── Multi-vendor, MVP, paused                              │
│  └── shifa (medical — shifa-lovat.vercel.app)                  │
│      └── Early stage, paused                                    │
│                                                                  │
│  Infrastructure                                                  │
│  ├── codebase (pattern library — base-coral.vercel.app)        │
│  │   └── 54 ui + 62 atoms + 31 templates                       │
│  ├── kun (THIS — configuration engine)                          │
│  ├── shadcn (shadcn/ui fork)                                   │
│  ├── radix (Radix UI primitives fork)                          │
│  ├── swift-app (iOS companion for Hogwarts)                    │
│  ├── marketing (landing pages)                                  │
│  ├── spma (project management, early)                          │
│  ├── apple (design R&D)                                        │
│  ├── distributed-computer (Rust/blockchain R&D)                │
│  └── .github (org profile)                                     │
│                                                                  │
│  Shared DNA: Next.js 16 + TypeScript 5 + Prisma 6 +           │
│  shadcn/ui + Arabic RTL + Atomic component hierarchy           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent Teams (Experimental)

```
┌──────────────┐
│  LEAD AGENT  │
│ (Orchestrate)│
└──────┬───────┘
       │
  ┌────┼────┐
  ▼    ▼    ▼
┌────┐┌────┐┌────┐
│ A  ││ B  ││ C  │   Each agent: isolated git worktree
│feat││test││docs│   No merge conflicts
└────┘└────┘└────┘   Consolidated into single PR
```

### 5.3 Scheduled Tasks

| Type           | Runs On                  | Use Case                                |
| -------------- | ------------------------ | --------------------------------------- |
| **Cloud**      | Anthropic infrastructure | Daily health checks, dependency updates |
| **Desktop**    | Local machine (app open) | Recurring builds, test runs             |
| **In-session** | Active session (/loop)   | Poll deploy status, watch CI            |

### 5.4 CI/CD Integration (Phase 2)

```
Pull Request ──▶ GitHub Actions ──▶ Agent SDK Review
                                       ├── Code quality
                                       ├── Security scan
                                       ├── Pattern compliance
                                       └── Auto-fix + commit
```

---

## 6. Layer 5: Company Operations

### 6.1 Team Workflows

| Member     | Role       | Primary Workflow                                      |
| ---------- | ---------- | ----------------------------------------------------- |
| **Abdout** | Builder    | code → build → deploy                                 |
| **Ali**    | QA + Sales | testing, issue reports, outreach (sales@databayt.org) |
| **Samia**  | R&D        | Claude/Anthropic research, sharing economy, Kun care  |
| **Sedon**  | Executor   | clear task maps, Saudi operations                     |
| **Kun**    | Engine     | coordination, follow-up, optimization                 |

### 6.2 Business Operations via Cowork

| Function             | How                     |
| -------------------- | ----------------------- |
| Project management   | Cowork + Linear MCP     |
| Documentation        | Artifacts + /docs skill |
| Client communication | Cowork + email drafting |
| Financial tracking   | Stripe MCP + Cowork     |
| Content creation     | Cowork (Arabic/English) |
| Research             | Web search + synthesis  |

### 6.3 Accessibility

All products and workflows must be accessible:

- VoiceOver compatibility on iOS/macOS
- NVDA/JAWS on Windows
- a11y MCP for automated accessibility audits
- Semantic HTML enforced by semantic agent

---

## 7. Security Architecture

### Anthropic-Native Security

| Layer          | Mechanism                                   |
| -------------- | ------------------------------------------- |
| **Data**       | SOC 2 Type II, no training on customer data |
| **Network**    | Encrypted in transit (TLS 1.3)              |
| **Compliance** | GDPR compliant                              |

### Kun-Level Security

| Mechanism           | Implementation                                     |
| ------------------- | -------------------------------------------------- |
| **Deny rules**      | rm -rf, prisma reset, DROP TABLE, TRUNCATE blocked |
| **Hook guards**     | PreToolUse hooks validate before execution         |
| **Secrets**         | macOS Keychain MCP, never in git                   |
| **Permissions**     | 38 explicit allow rules, everything else prompts   |
| **/security skill** | OWASP Top 10 audit on demand                       |

---

## 8. Decision Records

### ADR-001: Anthropic-Native over Custom Infrastructure

**Decision**: Build Kun as a configuration engine on native Anthropic products. Self-hosting is an optional appendix.

**Rationale**: Anthropic invests billions in their products. Our configuration on top is the value-add, not parallel infrastructure.

### ADR-002: Configuration-as-Code

**Decision**: All configuration lives in git-trackable files (CLAUDE.md, settings.json, agents/, skills/, rules/, mcp.json).

**Rationale**: Git provides versioning, diffing, branching, and PR review. Same workflow as code.

### ADR-003: Opus 4.8 as Default Model

**Decision**: Default to Opus 4.8 for all agents and primary work. Haiku 4.5 for exploration subagents only.

**Rationale**: Architecture-first approach values output quality over cost. Max plan ($200/mo) makes this cost-effective.

### ADR-004: Hogwarts-First Product Strategy

**Decision**: Concentrate all engineering effort on Hogwarts until the King Fahad Schools pilot is delivering revenue.

**Rationale**: Hogwarts is the most mature product. $5K capital with $500/month burn gives 10 months runway. Not rushing — building for long-term market leadership in Sudan/MENA education. Mkan, Souq, and Shifa can wait.

### ADR-005: Databayt Shared Component Library

**Decision**: All products inherit from databayt/codebase. No product builds UI primitives from scratch.

**Rationale**: With a team of 4 (2 full-time engineers), code reuse is survival. Every atom built once serves all products.

---

## 9. References

- [PROJECT-BRIEF.md](./PROJECT-BRIEF.md) — Company, team, financial targets
- [CONFIGURATION.md](./CONFIGURATION.md) — Detailed engine blueprint
- [PRODUCTS.md](./PRODUCTS.md) — Anthropic product catalog
- [SELF-HOSTING.md](./SELF-HOSTING.md) — Optional infrastructure appendix
- [Repository details](./repositories/) — Individual repo documentation
