# Kun — Configuration Engine

> **The brain. This is the project you're reading about.**

---

## Overview

| Field | Value |
|-------|-------|
| **Repo** | [databayt/kun](https://github.com/databayt/kun) |
| **URL** | [kun-two.vercel.app](https://kun-two.vercel.app) |
| **Language** | TypeScript |
| **Size** | 369 KB |
| **Created** | 2026-01-11 |
| **Last Push** | 2026-03-30 |

---

## What It Does

Kun is the configuration engine that transforms Anthropic's product suite into a unified operating system for Databayt. It contains:

- **CLAUDE.md hierarchy** — Context that shapes all AI output
- **28 agents** — Specialized expertise (stack, design, UI, DevOps, VCS, specialized)
- **17 skills** — Keyword-triggered workflows (/dev, /build, /deploy, /test, etc.)
- **18 MCP servers** — External tool integrations (GitHub, Vercel, Neon, Stripe, Figma, etc.)
- **8 rules** — Path-scoped guardrails (auth, i18n, prisma, tailwind, testing)
- **5 hooks** — Automation (auto-format, port management, session logging)
- **6 memory files** — Cross-session learning
- **100+ keywords** — One word → complete workflow
- **Documentation** — MDX-based docs site via fumadocs

---

## Structure

```
kun/
├── .claude/
│   ├── agents/       # 28 specialized agents
│   ├── commands/     # Custom slash commands (skills)
│   ├── rules/        # Path-scoped rules
│   └── CLAUDE.md     # Project-level instructions
├── content/docs/     # MDX documentation (fumadocs)
├── docs/             # Markdown documentation
│   ├── PROJECT-BRIEF.md
│   ├── ARCHITECTURE.md
│   ├── CONFIGURATION.md
│   ├── EPICS.md
│   ├── PRD.md
│   ├── PRODUCTS.md
│   ├── WORKFLOWS.md
│   ├── SELF-HOSTING.md
│   └── repositories/  # Individual repo details
├── scripts/          # Setup and utility scripts
├── src/              # Next.js app (docs site)
└── CLAUDE.md         # Root configuration
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.1, React 19.2.3 |
| Language | TypeScript 5.9 |
| Docs | fumadocs (MDX) |
| UI | Radix UI, shiki (code highlighting) |
| State | jotai |
| Validation | zod 4 |
| Font | geist |

---

## Three Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Developer Engine | Done — all components configured |
| 2 | Team Engine | Next — shared settings, agent teams, CI/CD |
| 3 | Company Engine | Future — Agent SDK pipelines, enterprise, marketplace |

---

## What Kun Does for Itself

- Self-documents via MDX docs site
- Tracks its own epics and stories
- Evolves configuration based on team feedback
- Manages the relationship between all 14 repositories
