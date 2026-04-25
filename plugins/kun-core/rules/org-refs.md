---
paths:
  - "**/CLAUDE.md"
  - "**/AGENTS.md"
  - "**/.claude/**"
description: Databayt org references — repo registry, lookup priority, naming
---

# Org References Rules

Active when CLAUDE.md / AGENTS.md / `.claude/` files are involved. Defines the canonical view of the databayt org.

## Org repos (13 live + 1 archived)

Authoritative registry: `.claude/memory/repositories.json`. Quick reference:

### Tier 1 — Revenue products
| Repo | Purpose | Stack | Status |
|------|---------|-------|--------|
| **hogwarts** | Multi-tenant school SaaS — LMS, SIS, billing | Next.js 16 + Prisma + Auth.js | Live (King Fahad pilot) |
| **souq** | Multi-vendor marketplace | Next.js + Prisma | Dormant |
| **mkan** | Rental marketplace | Next.js + Prisma | Live |
| **shifa** | Medical appointments | Next.js + Prisma | Dormant |

### Tier 2 — Engine + libraries
| Repo | Purpose | Status |
|------|---------|--------|
| **kun** | Code Machine config layer (this repo) | Live |
| **codebase** | Pattern library, agents, blocks | Reference |
| **shadcn** | databayt fork of shadcn/ui | Synced weekly |
| **radix** | databayt fork of Radix Primitives | Synced weekly |

### Tier 3 — Infrastructure / mobile / marketing
| Repo | Purpose | Status |
|------|---------|--------|
| **swift-app** | iOS/SwiftUI Hogwarts companion | Live |
| **marketing** | databayt.org landing | Live |
| **apple** | Apple HIG design reference | Reference |
| **distributed-computer** | Rust/libp2p P2P infra, HWC token | Dormant |
| **.github** | Org-level profile/templates | Live |
| **spma** | Old Saudi org website | Archived |

## Lookup priority

When implementing, check sources in this order:

1. **codebase** (`databayt/codebase`) — patterns, agents, components, templates
2. **shadcn** (`databayt/shadcn`) — UI component library
3. **radix** (`databayt/radix`) — UI primitives
4. **upstream** — only if no local pattern matches

## Reference keywords

| Say | Action |
|-----|--------|
| `from codebase` | Clone pattern from databayt/codebase |
| `from shadcn` | Use shadcn/ui component |
| `from radix` | Use Radix primitive |
| `like hogwarts` | Reference hogwarts patterns |
| `like souq` | Reference souq patterns |
| `like mkan` | Reference mkan patterns |
| `like shifa` | Reference shifa patterns |
| `repositories` | Show full repo registry |

## Repo naming

Naming follows: lowercase, single word where possible, no hyphens unless multi-word concept (`swift-app`, `distributed-computer`). Don't create new repos without captain approval.

## Stack consistency

Web products use the same stack: Next.js 16 + React 19 + Prisma 6 + TypeScript 5 + Tailwind 4 + shadcn/ui + Auth.js v5. Mobile = SwiftUI + MVVM. Infra = Rust + libp2p.

Stack drift across products is a tech-debt flag — `tech-lead` agent monitors.

## Captain orchestration

Captain reads `repositories.json` to know what's live. Per-repo agent ownership in `repositories.json[].agent`. Per-human focus in `.claude/memory/capacity.json`.

## Never

- Reference a repo that's not in `repositories.json`
- Hardcode org name as anything but `databayt`
- Create a new repo without an entry in `repositories.json`
- Treat `archived` repos as live targets

## Reference

- Memory: `.claude/memory/repositories.json`
- Doc: `content/docs/repositories.mdx`
- Captain: `.claude/agents/captain.md`
