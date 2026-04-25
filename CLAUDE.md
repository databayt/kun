@AGENTS.md

# Kun (كن) — The Kun Engine

> The configuration engine that transforms Anthropic's product suite into a unified software company operating system.

> **Note**: This file imports `AGENTS.md` (Vercel-style canonical agent guide) at the top. Build/test/PR conventions live there. Below: kun-specific mission, philosophy, and the three-phase plan.

---

## Project Overview

**Kun** is the optimal configuration layer — agents, skills, hooks, MCP servers, rules, and memory — that makes Claude Code, Claude Desktop, Cowork, and the Agent SDK work together as a single engine running both technical and business sides of a software company.

**Core insight**: Don't build what Anthropic ships. Configure it.

---

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/PROJECT-BRIEF.md` | Vision, goals, Anthropic product mapping |
| `docs/ARCHITECTURE.md` | 5-layer engine architecture |
| `docs/PRD.md` | Configuration requirements by phase |
| `docs/EPICS.md` | 53 stories across 12 epics |
| `docs/PRODUCTS.md` | Anthropic product catalog + pricing |
| `docs/CONFIGURATION.md` | Full engine blueprint (settings, agents, skills, MCP, hooks, rules, memory) |
| `docs/WORKFLOWS.md` | Technical + business operations playbook |
| `docs/SELF-HOSTING.md` | Optional: Tailscale/tmux/Docker for air-gapped setups |

---

## Three Phases

### Phase 1: Developer Engine (Done)
- CLAUDE.md hierarchy (user → project → repo)
- 28 agents across 6 chains
- 17 skills with keyword triggers
- 18 MCP servers
- 5 hooks (format, port, session)
- 8 path-scoped rules
- 6 memory files
- 100+ keyword mappings

### Phase 2: Team Engine (Next)
- Shared settings via git
- Agent Teams (parallel work, worktree isolation)
- CI/CD with Agent SDK (auto PR review)
- Scheduled cloud tasks
- Cowork for non-technical staff

### Phase 3: Company Engine (Future)
- Agent SDK custom pipelines
- Enterprise SSO/SCIM/audit
- API cost optimization (95% via caching + batch)
- Pattern distribution + marketplace

---

## Anthropic Products Used

| Product | Role in Kun |
|---------|-------------|
| **Claude Code** (CLI, Desktop, Web, iOS) | Primary development interface |
| **Cowork** | Business operations for non-devs |
| **Claude Apps** | Slack, Figma, Asana integrations |
| **Agent SDK** | Custom CI/CD and automation agents |
| **API** | Programmatic access with cost optimization |
| **Enterprise** | SSO, SCIM, audit logging |

---

## Configuration Engine (The Core Value)

| Component | Count | Details |
|-----------|-------|---------|
| Agents | 28 | Stack, Design, UI, DevOps, VCS, Specialized chains |
| Skills | 17 | /dev, /build, /deploy, /atom, /test, /security, etc. |
| MCP Servers | 18 | shadcn, github, vercel, neon, stripe, figma, etc. |
| Rules | 8 | Auth, i18n, prisma, tailwind, testing, deployment |
| Hooks | 5 | Auto-format, port management, session logging |
| Memory | 6 | Preferences, repos, atoms, templates, blocks, reports |
| Keywords | 100+ | One word → complete workflow |

---

## Pattern Library

Reference patterns from `/Users/abdout/codebase/`:

```
├── src/components/
│   ├── ui/           # 54 shadcn/ui primitives
│   ├── atom/         # 62 atomic components
│   └── template/     # Full-page layouts
├── src/registry/     # 31 templates
└── .claude/
    ├── agents/       # Specialized agents
    └── commands/     # Custom slash commands
```

---

## Architecture Principles

1. **Configuration over infrastructure** — Don't build what Anthropic ships
2. **Architecture-first** — Humans design systems, AI generates within constraints
3. **Guardrails as training data** — CLAUDE.md, agents, rules shape AI output
4. **Full spectrum** — Technical AND business operations
5. **Anthropic-native** — Use products as designed, don't wrap or abstract

---

## When Implementing

1. Check `docs/EPICS.md` for current stories
2. Reference `docs/ARCHITECTURE.md` for design decisions
3. Reference `docs/CONFIGURATION.md` for engine blueprint
4. Follow patterns from `/Users/abdout/codebase/`
5. Use conventional commits
6. PR workflow — no direct commits to main

---

## Quick Links

- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Agent SDK Docs](https://docs.anthropic.com/en/docs/agent-sdk/overview)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Claude Pricing](https://claude.ai/pricing)
- [databayt/codebase](https://github.com/databayt/codebase)

---

## Philosophy

> "The future of software is not just written. It's designed." — Craig Adam

Kun is the shift from "vibe coding" to intentional architecture:
- **Configuration is the product** — The agents, skills, rules ARE the engine
- **Patterns as training data** — Every good component teaches the next generation
- **Anthropic is the platform** — They build the products, we configure the intent
