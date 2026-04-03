# Project Brief: Kun (كن)

> **Version**: 3.0
> **Date**: 2026-03-30
> **Status**: Active

---

## 1. What is Kun

Kun (كن — Arabic for "Be!") is **the optimal configuration** — agents, skills, hooks, MCP servers, rules, and memory — that makes Claude Code, Claude Desktop, Cowork, and the Agent SDK work together as a single engine running both the technical and business sides of **Databayt**.

Kun is not a server. Not a platform. It is the brain that coordinates 14 repositories, 4 team members, and every tool in the stack — from git commit to Stripe checkout to team standup.

**One word, and it happens.**

---

## 2. The Company

### Databayt (داتابايت)

- **Website**: [databayt.org](https://databayt.org)
- **GitHub**: [github.com/databayt](https://github.com/databayt)
- **License**: SSPL (open source, commercial use requires license)
- **Philosophy**: Open source, shared economy, state-of-the-art stack
- **Design inspiration**: Apple, Tesla, Airbnb, Uber

Databayt builds products that automate real-world operations — schools, rentals, commerce, healthcare — using a shared component library (codebase) and a unified configuration engine (kun). Every product shares the same DNA: Next.js, TypeScript, Prisma, shadcn/ui, Arabic-first RTL, atomic component hierarchy.

### What We Believe

- **Configuration over infrastructure** — Don't build what Anthropic ships. Configure it.
- **Architecture over vibe coding** — Humans design systems, AI generates within constraints.
- **Patterns as training data** — Every good component teaches the next generation.
- **Full spectrum** — AI assists the entire company, not just developers.
- **Open source, shared economy** — Build in the open, sustain through value.

---

## 3. The Team

| # | Name | Role |
|---|------|------|
| 1 | **Abdout** | Builder — engineering everything |
| 2 | **Ali** | QA Engineer + Sales — issue reporting, sales@databayt.org, outreach for schools/sponsors/investors/early adopters/contributors |
| 3 | **Samia** | R&D — Claude/Anthropic products, sharing economy research, revenue distribution, Kun caretaker |
| 4 | **Sedon** | Executor — clear task maps, reliable delivery, Saudi operations |

---

## 4. The Driver: Establish Real-World Solutions

### Financial Reality

We are starting the company. Not in survival mode — in building mode.

| Expense | Monthly Cost |
|---------|-------------|
| Claude Code (Max plan) | $200 |
| Services (Neon, Vercel, AWS, Namecheap) | ~$300 |
| Team salary | $0 (equity/sweat phase) |
| **Total monthly burn** | **~$500** |

### Current Budget

- **Remaining capital**: $5,000 (~10 months runway at $500/month)
- **Revenue pipeline**: Ahmed Baha / King Fahad Schools (Sudan) — interested client, meeting April 4, 2026
- **Outreach**: Ali actively looking for schools, sponsors, investors, early adopters, leads, clients, contributors

### Strategy: Open Source, Sharing Economy

We don't care about starting slow. We care about:
1. **Establishing real-world solutions** that actually work for schools
2. **Building community** — pushing contributors to participate
3. **Sharing economy model** — transparent, fair revenue distribution
4. **Market leadership** — targeting lead school solutions in Sudan and MENA

The pitch is the same for everyone — Ahmed Baha, future schools, sponsors, investors: we are open source and we are sharing economy.

### Pilot: King Fahad Schools

Ahmed Baha is an interested client. The pitch is partnership, not sales:
1. **Admission flow** — end-to-end online application (wizard, admin review, status tracking, notifications)
2. **Seeded school data** — announcements, events, and content so the system feels real

### Growth Strategy

| Channel | Owner | What |
|---------|-------|------|
| **Schools (clients)** | Ali | Direct outreach, sales@databayt.org |
| **Sponsors** | Ali | Organizations supporting education tech |
| **Investors** | Ali | Seed/angel, aligned with sharing economy |
| **Early adopters** | Ali | Schools willing to pilot |
| **Contributors** | Ali + Community | Open source developers |
| **Revenue model** | Samia | Researching sharing economy, fair distribution |
| **Product R&D** | Samia | Claude/Anthropic products, Kun engine |

---

## 5. The Products

### Tier 1: Revenue Products

#### Hogwarts — Educational Automation (FLAGSHIP)

- **URL**: [ed.databayt.org](https://ed.databayt.org)
- **Repo**: [databayt/hogwarts](https://github.com/databayt/hogwarts) — 1.7 GB, most active
- **Status**: Active development (multiple commits/day)
- **Stack**: Next.js 16, React 19, Prisma 6, NextAuth 5, Stripe 20, Sentry, Socket.io, i18next
- **Features**: Multi-tenant SaaS, admission, LMS, SIS, finance, library, exams, timetable, SMS/notifications
- **Revenue model**: SaaS subscriptions, per-school pricing
- **Next milestone**: King Fahad Schools pilot (admission + notifications + messaging)
- **Details**: [repositories/hogwarts.md](./repositories/hogwarts.md)

#### Mkan — Rental Marketplace

- **URL**: [mkan.vercel.app](https://mkan.vercel.app)
- **Repo**: [databayt/mkan](https://github.com/databayt/mkan)
- **Status**: Phase 1 complete, production readiness
- **Stack**: Next.js 16, React 19, Prisma 6, NextAuth 5, Mapbox, Sentry
- **Features**: Property listings, search, booking, host dashboard, Airbnb-inspired design
- **Revenue model**: Transaction fees, premium listings
- **Details**: [repositories/mkan.md](./repositories/mkan.md)

### Tier 2: Supporting Products

#### Souq — Multi-Vendor E-Commerce

- **URL**: [souq-smoky.vercel.app](https://souq-smoky.vercel.app)
- **Repo**: [databayt/souq](https://github.com/databayt/souq)
- **Status**: MVP, low activity
- **Features**: Multi-vendor, customer storefront, vendor dashboards, admin panel
- **Details**: [repositories/souq.md](./repositories/souq.md)

#### Shifa — Medical Platform

- **URL**: [shifa-lovat.vercel.app](https://shifa-lovat.vercel.app)
- **Repo**: [databayt/shifa](https://github.com/databayt/shifa)
- **Status**: Early stage, paused
- **Features**: Patient records, appointments, medical workflows
- **Details**: [repositories/shifa.md](./repositories/shifa.md)

### Tier 3: Infrastructure

| Repo | Purpose | Details |
|------|---------|---------|
| **[codebase](./repositories/codebase.md)** | Pattern library — atoms, templates, blocks | Accelerates all product development |
| **[kun](./repositories/kun.md)** | Configuration engine — this project | Coordinates everything |
| **[shadcn](./repositories/shadcn.md)** | UI component library (shadcn/ui fork) | Shared UI primitives |
| **[radix](./repositories/radix.md)** | Radix UI primitives fork | Foundation for shadcn |
| **[swift-app](./repositories/swift-app.md)** | iOS companion for Hogwarts | Native Swift/SwiftUI |
| **[marketing](./repositories/marketing.md)** | Landing pages for all products | Company website |
| **[spma](./repositories/spma.md)** | Project management tool | Internal use |
| **[apple](./repositories/apple.md)** | Apple design experiments | R&D |
| **[distributed-computer](./repositories/distributed-computer.md)** | Rust infrastructure, Hogwarts Coin | Future/R&D |

---

## 6. The Stack

### Core

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16, React 19 | Full-stack web |
| Language | TypeScript 5 (strict) | Type safety |
| Database | Prisma 6 + Neon (PostgreSQL) | ORM + serverless DB |
| Auth | NextAuth v5 (Auth.js) | Authentication |
| Styling | Tailwind CSS 4 + shadcn/ui | Design system |
| Payments | Stripe | Billing + subscriptions |
| Mobile | Swift/SwiftUI (iOS), Kotlin (Android planned) | Native apps |

### Services

| Service | Purpose | Cost |
|---------|---------|------|
| Vercel | Hosting + deployment | Free tier + pro |
| Neon | PostgreSQL databases | Free tier + scaling |
| GitHub | Code + CI/CD | Free (org) |
| Namecheap | Domains | Annual |
| AWS (S3/CloudFront) | File storage + CDN | Pay-as-you-go |
| Figma | Design | Free tier |
| Sentry | Error monitoring | Free tier |
| Upstash | Redis + rate limiting | Free tier |

### AI Engine

| Product | Role | Cost |
|---------|------|------|
| Claude Code (Max) | Primary development interface | $200/month |
| Claude Desktop | Team access (Windows/Mac) | Included |
| Claude iOS | Mobile access | Included |
| Cowork | Business operations | Included |
| Agent SDK | CI/CD automation (Phase 2) | API pricing |

### Component Hierarchy

| Level | Name | Description |
|-------|------|-------------|
| 1 | `ui` | Radix primitives (shadcn/ui) |
| 2 | `atom` | 2+ primitives composed |
| 3 | `template` | Full-page layouts |
| 4 | `block` | UI + business logic |
| 5 | `micro` | Mini micro-services |

---

## 7. Kun's Role

Kun is the operating system of Databayt. It doesn't write code — it **coordinates** how code gets written, reviewed, tested, deployed, and maintained across all 14 repositories.

### What Kun Controls

| Domain | How |
|--------|-----|
| **Development** | 28 agents, 17 skills, 100+ keywords |
| **Code quality** | Rules, hooks, automated review |
| **Deployment** | Vercel MCP, deploy skills |
| **Database** | Neon MCP, Prisma agents |
| **Design** | Figma MCP, component mapping |
| **Testing** | Browser MCP, Playwright, Vitest |
| **Team coordination** | Agent teams, shared settings |
| **Business ops** | Cowork, scheduled tasks |
| **Memory** | Cross-session learning, pattern library |
| **Cost management** | Model selection, caching strategy |

### How Kun Operates

Kun acts with **moderate autonomy for the good of the company**. It has its own judgment — it researches, plans, follows up, and self-improves. It manages:

- Repository health and synchronization
- Team productivity and follow-up
- Subscription and service management
- R&D — reading, web research, continuous learning
- Path optimization across all company operations

### Configuration Engine (The Core)

| Component | Count | Purpose |
|-----------|-------|---------|
| Agents | 28 | Specialized expertise across 6 chains |
| Skills | 17 | Keyword-triggered workflows |
| MCP Servers | 18 | External tool integrations |
| Rules | 8 | Path-scoped guardrails |
| Hooks | 5 | Auto-format, port management, session logging |
| Memory | 6 | Cross-session learning |
| Keywords | 100+ | One word → complete workflow |

---

## 8. Three-Month Plan (April — June 2026)

### Month 1: Hogwarts Pilot + Foundation

| Week | Focus | Owner |
|------|-------|-------|
| 1 (Apr 1-4) | QA fixes, seed school content, **Ahmed meeting Fri Apr 4** | Abdout + Ali |
| 2 (Apr 7-11) | Iterate on Ahmed's feedback, continue outreach | Abdout + Ali |
| 3 (Apr 14-18) | Pilot live usage, community groundwork | Full team |
| 4 (Apr 21-25) | Solidify product, expand outreach | Full team |

### Month 2: Establish + Grow

| Week | Focus | Owner |
|------|-------|-------|
| 1-2 | Product quality, feature requests from pilot | Abdout + Kun |
| 3 | Outreach: more schools, sponsors, contributors | Ali |
| 4 | Sharing economy model design, Kun improvements | Samia + Abdout |

### Month 3: Market Presence

| Week | Focus | Owner |
|------|-------|-------|
| 1-2 | Community building, contributor onboarding | Full team |
| 3 | Marketing, case study from pilot | Ali + Samia |
| 4 | Q3 planning, revenue model finalization | Full team |

### Team Assignments by Strength

| Member | Role | Deliverables |
|--------|------|-------------|
| **Abdout** | Builder | Code, architecture, deployment |
| **Ali** | QA + Sales | Issue reporting, sales@databayt.org, outreach for all support types |
| **Samia** | R&D | Claude/Anthropic research, sharing economy models, revenue distribution |
| **Sedon** | Executor | Clear task maps, Saudi operations, bank/payments |
| **Kun** | Engine | Coordination, follow-up, optimization (Samia taking over care) |

---

## 9. Services & Credentials

Kun maintains awareness of all service accounts and credentials for operational continuity.

| Service | Purpose | Account |
|---------|---------|---------|
| GitHub | Code hosting | github.com/databayt |
| Vercel | Deployment | vercel.com (databayt) |
| Neon | Databases | neon.tech |
| Namecheap | Domains | databayt.org + subdomains |
| Figma | Design | figma.com |
| Stripe | Payments | stripe.com |
| AWS | S3/CloudFront | aws.amazon.com |
| Sentry | Error monitoring | sentry.io |
| Upstash | Redis | upstash.com |

Email accounts: [team]@databayt.org

---

## 10. Repository Map

14 repositories under [github.com/databayt](https://github.com/databayt):

| Repo | Type | Status | Last Active | Detail |
|------|------|--------|-------------|--------|
| [hogwarts](./repositories/hogwarts.md) | Product | Active (daily) | 2026-03-30 | Flagship SaaS — education |
| [mkan](./repositories/mkan.md) | Product | Phase 1 done | 2026-02-06 | Rental marketplace |
| [souq](./repositories/souq.md) | Product | MVP | 2025-12-21 | E-commerce |
| [shifa](./repositories/shifa.md) | Product | Paused | 2025-12-28 | Medical |
| [codebase](./repositories/codebase.md) | Library | Active | 2026-01-31 | Pattern library |
| [kun](./repositories/kun.md) | Engine | Active | 2026-03-30 | This project |
| [shadcn](./repositories/shadcn.md) | Library | Fork sync | 2025-12-01 | UI components |
| [radix](./repositories/radix.md) | Library | Fork sync | 2025-12-07 | UI primitives |
| [swift-app](./repositories/swift-app.md) | Mobile | Phase 2 | 2026-02-10 | iOS app |
| [marketing](./repositories/marketing.md) | Website | Active | 2026-01-29 | Landing pages |
| [spma](./repositories/spma.md) | Internal | Early | 2026-02-23 | Project management |
| [apple](./repositories/apple.md) | R&D | Experiment | 2026-02-06 | Design lab |
| [distributed-computer](./repositories/distributed-computer.md) | R&D | Concept | 2025-12-17 | Rust/blockchain |
| [.github](./repositories/dotgithub.md) | Config | Static | 2025-08-09 | Org profile |

---

## 11. The Name

كن (Kun) — "Be!" — the divine command of creation from the Quran. One word, and reality manifests.

With Kun configured:
- "dev" → server running, browser open
- "deploy" → production deployment with verification
- "saas billing" → schema + API + UI + Stripe integration
- "handover" → 5-pass QA across environments

> "The future of software is not just written. It's designed." — Craig Adam

---

## 12. References

### Company
- [databayt.org](https://databayt.org)
- [github.com/databayt](https://github.com/databayt)

### Anthropic
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Agent SDK](https://docs.anthropic.com/en/docs/agent-sdk/overview)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Claude Pricing](https://claude.ai/pricing)

### Kun Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design
- [CONFIGURATION.md](./CONFIGURATION.md) — Engine blueprint
- [PRODUCTS.md](./PRODUCTS.md) — Anthropic product catalog
- [WORKFLOWS.md](./WORKFLOWS.md) — Operations playbook
- [EPICS.md](./EPICS.md) — Development stories
