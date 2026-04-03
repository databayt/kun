# Epics and Stories: Kun (كن)

> **Version**: 3.0
> **Date**: 2026-03-30
> **Total Stories**: 53

---

## Epic Overview

| Epic | Phase | Stories | Priority | Status |
|------|-------|---------|----------|--------|
| E1: CLAUDE.md Configuration | 1 | 5 | P0 | Done |
| E2: Agent Fleet | 1 | 6 | P0 | Done |
| E3: Skill Library | 1 | 5 | P0 | Done |
| E4: MCP Ecosystem | 1 | 5 | P0 | Done |
| E5: Hook Automation | 1 | 4 | P0 | Done |
| E6: Rules & Memory | 1 | 4 | P1 | Done |
| E7: Team Onboarding | 2 | 5 | P0 | Planned |
| E8: Hogwarts Pilot | 2 | 5 | P0 | In Progress |
| E9: Agent Teams & CI/CD | 2 | 5 | P0 | Planned |
| E10: Revenue & Operations | 2 | 5 | P0 | Planned |
| E11: Agent SDK Platform | 3 | 4 | P0 | Future |
| E12: Scale & Optimization | 3 | 4 | P0 | Future |

---

## Phase 1: Developer Engine (Done)

### Epic 1: CLAUDE.md Configuration

**Goal**: Establish the context hierarchy that shapes all AI output.

#### Story 1.1: User-Level CLAUDE.md
- [x] `~/.claude/CLAUDE.md` defines stack, mode, preferences
- [x] Component hierarchy: ui → atom → template → block → micro
**Points**: 2 | **Priority**: P0

#### Story 1.2: Project-Level CLAUDE.md
- [x] Root `CLAUDE.md` per project with architecture and vision
- [x] Pattern library paths referenced
**Points**: 2 | **Priority**: P0

#### Story 1.3: Repo-Level CLAUDE.md
- [x] `.claude/CLAUDE.md` maps 100+ keywords to actions
- [x] MCP trigger table and slash command reference
**Points**: 3 | **Priority**: P0

#### Story 1.4: Keyword System
- [x] Workflow, creation, quality, framework, animation keywords
**Points**: 3 | **Priority**: P1

#### Story 1.5: Configuration Hierarchy Validation
- [x] Project > Repo > User priority order
**Points**: 1 | **Priority**: P0

---

### Epic 2: Agent Fleet

**Goal**: Cover the full technology stack with specialized AI agents.

#### Story 2.1: Stack Chain (7 agents)
- [x] nextjs, react, typescript, tailwind, prisma, shadcn, authjs
**Points**: 5 | **Priority**: P0

#### Story 2.2: Design Chain (4 agents)
- [x] orchestration, architecture, pattern, structure
**Points**: 3 | **Priority**: P0

#### Story 2.3: UI Chain (4 agents)
- [x] shadcn, atom, template, block
**Points**: 3 | **Priority**: P0

#### Story 2.4: DevOps Chain (3 agents)
- [x] build, deploy, test
**Points**: 2 | **Priority**: P0

#### Story 2.5: VCS Chain (2 agents)
- [x] git, github
**Points**: 2 | **Priority**: P0

#### Story 2.6: Specialized Agents (8)
- [x] middleware, i18n, semantic, sse, optimize, performance, comment, icon
- [x] Formal handoff protocol between agents
**Points**: 3 | **Priority**: P1

---

### Epic 3: Skill Library

**Goal**: Codify common workflows as reusable, triggerable skills.

#### Story 3.1: Workflow Skills
- [x] /dev, /build, /quick, /deploy
**Points**: 3 | **Priority**: P0

#### Story 3.2: Creation Skills
- [x] /atom, /template, /block, /saas
**Points**: 3 | **Priority**: P0

#### Story 3.3: Quality Skills
- [x] /test, /security, /performance, /fix
**Points**: 3 | **Priority**: P0

#### Story 3.4: Documentation Skills
- [x] /docs, /codebase, /repos
**Points**: 2 | **Priority**: P1

#### Story 3.5: Handover QA
- [x] 5-pass testing on both localhost and production
**Points**: 3 | **Priority**: P0

---

### Epic 4: MCP Ecosystem

**Goal**: Connect Claude Code to all external tools via MCP.

#### Story 4.1: UI & Design MCPs (5)
- [x] shadcn, figma, tailwind, a11y, storybook
**Points**: 2 | **Priority**: P0

#### Story 4.2: Testing MCPs (2)
- [x] browser (headless), browser-headed
**Points**: 1 | **Priority**: P0

#### Story 4.3: DevOps MCPs (4)
- [x] github, vercel, sentry, gcloud
**Points**: 2 | **Priority**: P0

#### Story 4.4: Data & Auth MCPs (4)
- [x] neon, postgres, stripe, keychain
**Points**: 2 | **Priority**: P0

#### Story 4.5: Knowledge & PM MCPs (3)
- [x] ref, context7, linear
**Points**: 1 | **Priority**: P1

---

### Epic 5: Hook Automation

**Goal**: Automate repetitive tasks at lifecycle events.

#### Story 5.1: Auto-Format on Save
- [x] Prettier runs after every Write/Edit
**Points**: 1 | **Priority**: P0

#### Story 5.2: Port Management
- [x] Kill port 3000 before `pnpm dev`, open Chrome after
**Points**: 1 | **Priority**: P0

#### Story 5.3: Session Logging
- [x] Print model + timestamp on start, log end to session-log.txt
**Points**: 1 | **Priority**: P1

#### Story 5.4: Future Hooks (Phase 2)
- [ ] PreToolUse guard for destructive git operations
- [ ] PostToolUse test runner after code changes
**Points**: 2 | **Priority**: P2

---

### Epic 6: Rules & Memory

**Goal**: Enforce conventions and learn across sessions.

#### Story 6.1: Path-Scoped Rules (8)
- [x] auth, i18n, prisma, tailwind, testing, deployment, multi-repo, org-refs
**Points**: 3 | **Priority**: P0

#### Story 6.2: Preference Memory
- [x] Port 3000, single .env, pnpm-only
**Points**: 1 | **Priority**: P0

#### Story 6.3: Component Memory
- [x] 59 atoms, 31 templates, 4 blocks tracked
**Points**: 2 | **Priority**: P1

#### Story 6.4: Repository Memory
- [x] 14 databayt repos with paths, stacks, sync config
**Points**: 1 | **Priority**: P1

---

## Phase 2: Team Engine (Current Focus)

### Epic 7: Team Onboarding

**Goal**: Get all 4 Databayt team members productive with Kun.

#### Story 7.1: Cross-Platform Installer
- [ ] install.sh (macOS for Abdout) + install.ps1 (Windows for Ali, Samia, Sedon)
- [ ] Sets up agents, skills, rules, settings, MCP
**Points**: 3 | **Priority**: P0 | **Owner**: Abdout + Kun

#### Story 7.2: Shared Settings via Git
- [ ] `.claude/settings.json` committed to each product repo
- [ ] `.claude/settings.local.json` for personal overrides (.gitignore)
**Points**: 2 | **Priority**: P0 | **Owner**: Abdout

#### Story 7.3: Accessibility Setup for Samia
- [ ] Screen reader compatibility verified (VoiceOver, NVDA)
- [ ] Cowork workflows tested with assistive technology
- [ ] Keyboard-only navigation confirmed
**Points**: 2 | **Priority**: P0 | **Owner**: Abdout + Samia

#### Story 7.4: Role-Based Configurations
- [ ] Engineer config: full agents, MCPs, CLI
- [ ] Business config: Cowork, Stripe MCP, client templates
- [ ] Content config: Cowork, web search, i18n tools
**Points**: 2 | **Priority**: P0 | **Owner**: Kun

#### Story 7.5: Onboarding Documentation
- [ ] Quick-start guide per role (< 5 min read)
- [ ] Workflow cheat sheets for Ali and Samia
**Points**: 2 | **Priority**: P1 | **Owner**: Samia + Kun

---

### Epic 8: Hogwarts Pilot (King Fahad Schools)

**Goal**: Ship the admission + notifications pilot to first paying customer.

#### Story 8.1: Admission Block Polish
- [ ] /handover admission passes all 5 QA checks
- [ ] Controlled selects, enum labels, i18n complete
- [ ] Application forms, enrollment workflow stable
**Points**: 5 | **Priority**: P0 | **Owner**: Abdout + Kun

#### Story 8.2: Notification System
- [ ] Twilio SMS integration working
- [ ] In-app notifications functional
- [ ] Push notifications (web + mobile)
**Points**: 3 | **Priority**: P0 | **Owner**: Abdout

#### Story 8.3: Messaging System
- [ ] School-to-parent messaging
- [ ] Socket.io real-time delivery
- [ ] Message history and search
**Points**: 3 | **Priority**: P0 | **Owner**: Abdout

#### Story 8.4: Pilot Deployment
- [ ] ed.databayt.org stable and monitored
- [ ] King Fahad Schools tenant created and configured
- [ ] Sentry error monitoring active
**Points**: 2 | **Priority**: P0 | **Owner**: Abdout + Kun

#### Story 8.5: Client Training
- [ ] Arabic user guide for school staff
- [ ] Video walkthroughs (voiceover by Samia)
- [ ] Onboarding support plan
**Points**: 3 | **Priority**: P1 | **Owner**: Samia + Ali

---

### Epic 9: Agent Teams & CI/CD

**Goal**: Enable parallel development and automated quality checks.

#### Story 9.1: Lead Agent Configuration
- [ ] Lead assigns subtasks, runs in Delegate mode
- [ ] Uses orchestration agent as base
**Points**: 3 | **Priority**: P0

#### Story 9.2: Worktree Isolation
- [ ] `isolation: worktree` in agent frontmatter
- [ ] Auto-cleaned on completion
**Points**: 2 | **Priority**: P0

#### Story 9.3: GitHub Actions Review
- [ ] Agent SDK reviews every PR
- [ ] Posts review comments, flags anti-patterns
**Points**: 3 | **Priority**: P0

#### Story 9.4: Pattern Compliance Check
- [ ] CI verifies component hierarchy
- [ ] Flags code that violates CLAUDE.md conventions
**Points**: 2 | **Priority**: P0

#### Story 9.5: Scheduled Cloud Tasks
- [ ] Daily Hogwarts health check
- [ ] Weekly dependency audit across all repos
**Points**: 2 | **Priority**: P1

---

### Epic 10: Revenue & Operations

**Goal**: Build the business workflows for sustainable revenue (open source, sharing economy).

#### Story 10.1: Stripe Billing Setup
- [ ] Hogwarts SaaS subscription tiers configured
- [ ] Payment collection working for pilot customer
- [ ] Invoice generation
**Points**: 3 | **Priority**: P0 | **Owner**: Abdout + Kun

#### Story 10.2: Client Outreach Templates
- [ ] School outreach email templates (Arabic + English)
- [ ] Product demo materials
- [ ] Pricing proposals
**Points**: 2 | **Priority**: P0 | **Owner**: Ali + Samia

#### Story 10.3: Cowork for Business Operations
- [ ] Ali configured with Cowork for client management
- [ ] Samia configured with Cowork for content + research
- [ ] Project context loaded for both
**Points**: 2 | **Priority**: P1 | **Owner**: Kun

#### Story 10.4: Financial Tracking
- [ ] Stripe MCP monitors revenue
- [ ] Monthly expense tracking (Claude, Vercel, Neon, AWS)
- [ ] Burn rate and runway visibility
**Points**: 2 | **Priority**: P1 | **Owner**: Kun

#### Story 10.5: Second Customer Pipeline
- [ ] Marketing site updated with Hogwarts showcase
- [ ] Outreach to additional schools
- [ ] Upwork/freelance pipeline for bridge income
**Points**: 3 | **Priority**: P1 | **Owner**: Ali

---

## Phase 3: Company Engine (Future)

### Epic 11: Agent SDK Platform

**Goal**: Custom automation agents for production pipelines.

#### Story 11.1: CI/CD Review Agent
- [ ] Agent SDK in GitHub Actions, loads Kun configuration
**Points**: 3 | **Priority**: P0

#### Story 11.2: Deploy Verification Agent
- [ ] Post-deploy health check, auto-rollback on failure
**Points**: 3 | **Priority**: P0

#### Story 11.3: Client Onboarding Agent
- [ ] Automated school tenant setup
**Points**: 3 | **Priority**: P1

#### Story 11.4: Structured Output Agents
- [ ] Agents return validated JSON, API-consumable
**Points**: 2 | **Priority**: P1

---

### Epic 12: Scale & Optimization

**Goal**: Cost optimization and multi-customer scaling.

#### Story 12.1: Cost Optimization
- [ ] Prompt caching (90%), Batch API (50%), model routing
**Points**: 3 | **Priority**: P0

#### Story 12.2: Multi-Tenant Scaling
- [ ] Hogwarts handles 10+ school tenants
- [ ] Performance under concurrent load
**Points**: 3 | **Priority**: P0

#### Story 12.3: Pattern Distribution
- [ ] Kun configuration packaged for external teams
**Points**: 2 | **Priority**: P1

#### Story 12.4: Additional Products
- [ ] Mkan soft launch
- [ ] Souq reactivation (if market opportunity)
**Points**: 3 | **Priority**: P2

---

## Summary

| Phase | Stories | P0 | P1 | P2 | Status |
|-------|---------|----|----|-----|--------|
| Phase 1: Developer Engine | 29 | 22 | 7 | 0 | Done |
| Phase 2: Team Engine | 20 | 13 | 7 | 0 | In Progress |
| Phase 3: Company Engine | 8 | 4 | 3 | 1 | Future |
| **Total** | **57** | **39** | **17** | **1** | |

---

## Sprint Plan (April — June 2026)

### Sprint 1 (April 1-14): Hogwarts Pilot Delivery
- Story 8.1 (admission polish) + 8.2 (notifications) + 8.3 (messaging)
- Owner: Abdout + Kun
- Goal: Core features ready for pilot

### Sprint 2 (April 15-30): Team Onboarding + Pilot Deploy
- Story 7.1 (installer) + 7.3 (accessibility) + 8.4 (deployment) + 8.5 (training)
- Owner: Full team
- Goal: Team productive, pilot deployed to King Fahad Schools

### Sprint 3 (May 1-14): Revenue + Quality
- Story 10.1 (billing) + 10.2 (outreach) + 9.3 (CI/CD review)
- Owner: Abdout (billing), Ali (outreach), Kun (CI/CD)
- Goal: First invoice sent, automated PR review

### Sprint 4 (May 15-31): Stabilize + Expand
- Story 10.4 (financial tracking) + 10.5 (second customer) + 9.5 (scheduled tasks)
- Owner: Ali (sales), Kun (automation)
- Goal: Revenue tracking, second customer in pipeline

### Sprint 5 (June): Scale
- Story 9.1 (agent teams) + 9.2 (worktree) + remaining Phase 2
- Goal: Full Phase 2 complete, sustainable revenue model established
