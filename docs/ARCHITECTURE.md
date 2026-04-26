# Architecture

Kun is a **configuration engine**, not a server. It sits as a configuration layer on top of Anthropic's product suite.

> Counts auto-update from `.claude/memory/kun-inventory.json` via `bash scripts/inventory.sh`.

## Five Layers

```
Layer 5: Company Operations
  Cowork | Claude Apps | Enterprise Connectors

Layer 4: Coordination & Automation
  Agent Teams | Scheduled Tasks | CI/CD | Channels

Layer 3: Kun Configuration Engine (the value)
  CLAUDE.md | Agents | Skills | MCP | Rules | Hooks | Memory | Keywords

Layer 2: Developer Surfaces (Anthropic-provided)
  CLI | VS Code | JetBrains | Desktop | Web | iOS

Layer 1: Foundation (Anthropic-provided)
  Opus | Sonnet | Haiku | 1M Context | API
```

## Layer 3: The Engine

### CLAUDE.md Hierarchy

```
Priority (high → low):
1. Project-level   <project>/CLAUDE.md         — Project context
2. Repo-level      <project>/.claude/CLAUDE.md — Keywords, workflows
3. User-level      ~/.claude/CLAUDE.md         — Stack, preferences
4. Pattern library codebase repo               — Core patterns
```

### Agent Fleet (4 tiers)

```
captain (Tier 0 — strategic brain)
├── Business (Tier 1): revenue, growth, support
├── Product  (Tier 2): product, analyst
└── Tech     (Tier 3): tech-lead, ops, guardian
              └── orchestration → specialist agents
```

| Tier | Agents | Domain |
|------|--------|--------|
| **Tier 0** | captain | Weekly allocation, priorities, delegation |
| **Tier 1** | revenue, growth, support | Business operations |
| **Tier 2** | product, analyst | Roadmap, market intelligence |
| **Tier 3** | tech-lead, ops, guardian | Architecture, infra, security |
| **Stack** | nextjs, react, typescript, tailwind, prisma, shadcn, authjs | Technology expertise |
| **Design** | orchestration, architecture, pattern, structure | System design |
| **UI** | shadcn, atom, template, block | Component hierarchy |
| **DevOps** | build, deploy, test | Development lifecycle |
| **VCS** | git, github | Version control |
| **Specialized** | middleware, i18n, semantic, sse, optimize, performance, comment | Domain expertise |
| **Reference** | hogwarts, souq, mkan, shifa | Product-specific patterns |

### MCP Ecosystem

| Category | Servers |
|----------|---------|
| UI & Design | shadcn, figma, tailwind, a11y, storybook |
| Testing | browser, browser-headed |
| DevOps | github, vercel, sentry, gcloud |
| Data & Auth | neon, postgres, stripe, keychain |
| Knowledge | ref, context7 |
| Project | linear |

### Rules Engine

Path-scoped rules auto-activate on file pattern: auth, i18n, prisma, tailwind, testing, deployment, multi-repo, org-refs.

### Hook Automation

| Event | Action |
|-------|--------|
| SessionStart | Print model + timestamp |
| PreToolUse (`pnpm dev`) | Kill port 3000 |
| PostToolUse (`pnpm dev`) | Open browser |
| PostToolUse (Write/Edit) | Run Prettier |
| Stop | Log session end |

## Layer 4: Coordination

### Agent Teams (experimental)

A lead agent coordinates teammate agents in isolated git worktrees. No merge conflicts. Consolidated PR.

### Cross-Device Flow

```
Phone (iOS) ──Dispatch──▶ Desktop App ──/teleport──▶ Terminal (CLI)
     ◀──────── Remote Control ──────────────────────────┘
```

### Scheduled Tasks

| Type | Runs On | Use Case |
|------|---------|----------|
| Cloud | Anthropic infra (computer off) | Health checks, dependency updates |
| Desktop | Local (app open) | Recurring builds |
| `/loop` | Active session | Poll deploy status |

### Three-Channel Communication

| Channel | Medium | Purpose |
|---------|--------|---------|
| **Dispatch** | Apple Notes | Async updates, decisions, handoffs |
| **GitHub Issues** | Repo issues | Structured work items |
| **Claude Native** | Code / Cowork / Voice | Real-time decisions |

### Cowork ↔ Code Bridge

```
Cowork (think): plan → create issues → write to channel
Code   (do):    read channel → pick up issues → execute → report
```

Shared state lives in `~/.claude/` (agents, memory, settings, rules). Same brain, two postures.

## Layer 5: Operations

### Role Configurations

Four roles ship out of the box, each with a tailored MCP set, skill subset, and agent index:

| Role | Focus |
|------|-------|
| **engineer** | Full stack — all surfaces |
| **business** | Outreach, proposals, content |
| **content** | Translation, docs, research |
| **ops** | Deploys, monitoring, cost tracking |

### Repository Map

```
Org repos
├── Products
│   ├── hogwarts   — Education SaaS
│   ├── mkan       — Rental marketplace
│   ├── souq       — E-commerce
│   └── shifa      — Medical platform
├── Libraries
│   ├── codebase   — Pattern library
│   ├── shadcn     — UI components fork
│   └── radix      — Primitives fork
├── Engine
│   └── kun        — This repo
└── Mobile / Marketing
    ├── swift-app  — iOS
    └── marketing  — Landing pages
```

## Security

| Layer | Mechanism |
|-------|-----------|
| Anthropic | SSO/SCIM, audit logging, SOC 2, no training on data |
| Kun config | Deny rules block destructive operations |
| Hooks | PreToolUse guards validate before execution |
| Secrets | macOS Keychain MCP, never in git |
| Accessibility | Screen reader compatibility |

## Architecture Decisions

### Configuration over infrastructure
Use Anthropic's products as-is. Don't maintain custom infrastructure when configuration suffices.

### Opus default
Use Opus for all agents. Haiku for read-only exploration. Sonnet for fast iteration.

### Single subscription model
One Max plan shared via Desktop/Web. Add Pro seats when team needs individual accounts.

### Shared component library
Every product pulls from a single `codebase` repo so primitives, atoms, and templates aren't rebuilt.

## Principles

1. **Configuration over infrastructure** — don't rebuild what Anthropic ships
2. **Architecture-first** — humans design, AI generates within constraints
3. **Guardrails as training data** — CLAUDE.md, agents, and rules shape output
4. **Full spectrum** — technical AND business operations
5. **Anthropic-native** — use products as designed
