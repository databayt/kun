# Product Requirements: Kun (كن)

> **Version**: 3.0
> **Date**: 2026-03-30

---

## 1. Overview

### Purpose

Define the requirements for the Kun engine — the configuration layer that transforms Anthropic's product suite into Databayt's operating system, serving 4 team members across 14 repositories with a $1K/month sustainability target.

### Scope

| Phase | Scope | Users | Status |
|-------|-------|-------|--------|
| Phase 1: Developer Engine | Individual developer configuration | Osman Abdout (primary) | Done |
| Phase 2: Team Engine | Shared config + coordination for 4 members | Full Databayt team | Next |
| Phase 3: Company Engine | Full operations + custom automation | Team + CI/CD + clients | Future |

### Constraints

| Constraint | Value |
|-----------|-------|
| Team size | 4 (2 engineers, 1 business, 1 content/research) |
| Budget | $200/month Claude Code Max |
| Capital | $500 remaining |
| Revenue target | $1K/month |
| Primary product | Hogwarts (education SaaS) |

---

## 2. Phase 1: Developer Engine (Done)

### FR-1.1: CLAUDE.md Configuration

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.1.1 | User-level CLAUDE.md defines stack, mode, preferences | P0 | Done |
| FR-1.1.2 | Project-level CLAUDE.md provides project context | P0 | Done |
| FR-1.1.3 | Repo-level CLAUDE.md maps keywords to workflows | P0 | Done |
| FR-1.1.4 | Project > Repo > User priority respected | P0 | Done |
| FR-1.1.5 | 100+ keyword mappings | P1 | Done |

### FR-1.2: Agent Fleet

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.2.1 | Stack chain: nextjs, react, typescript, tailwind, prisma, shadcn, authjs | P0 | Done |
| FR-1.2.2 | Design chain: orchestration, architecture, pattern, structure | P0 | Done |
| FR-1.2.3 | UI chain: shadcn, atom, template, block | P0 | Done |
| FR-1.2.4 | DevOps chain: build, deploy, test | P0 | Done |
| FR-1.2.5 | VCS chain: git, github | P0 | Done |
| FR-1.2.6 | Specialized: middleware, i18n, semantic, sse, optimize, performance, comment | P1 | Done |
| FR-1.2.7 | Reference chain: hogwarts, souq, mkan, shifa | P1 | Done |
| FR-1.2.8 | Orchestration master routes tasks | P0 | Done |

### FR-1.3: Skill Library

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.3.1 | Workflow: /dev, /build, /quick, /deploy | P0 | Done |
| FR-1.3.2 | Creation: /atom, /template, /block, /saas | P0 | Done |
| FR-1.3.3 | Quality: /test, /security, /performance, /fix | P0 | Done |
| FR-1.3.4 | Documentation: /docs, /codebase, /repos | P1 | Done |
| FR-1.3.5 | QA: /handover runs 5-pass QA | P0 | Done |

### FR-1.4: MCP, Hooks, Rules, Memory

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.4.1 | 18 MCP servers (UI, DevOps, Data, Testing, Knowledge, PM) | P0 | Done |
| FR-1.4.2 | 5 hooks (format, port, browser, session) | P0 | Done |
| FR-1.4.3 | 8 path-scoped rules (auth, i18n, prisma, tailwind, testing, deploy, multi-repo, org-refs) | P0 | Done |
| FR-1.4.4 | 6 memory files (preferences, repos, atoms, templates, blocks, reports) | P1 | Done |
| FR-1.4.5 | 38 allow rules, 4 deny rules in settings | P0 | Done |

---

## 3. Phase 2: Team Engine (Next)

Grounded in Databayt's actual team: 4 members, 3 on Windows, 1 on macOS.

### FR-2.1: Team Onboarding

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.1.1 | Cross-platform installer | P0 | install.sh (macOS) + install.ps1 (Windows) work for all 4 members |
| FR-2.1.2 | Shared settings.json | P0 | `.claude/settings.json` in git, team-wide allow/deny rules |
| FR-2.1.3 | Local overrides | P0 | `.claude/settings.local.json` for personal preferences |
| FR-2.1.4 | Accessibility setup | P0 | Screen reader compatibility verified for Samia |
| FR-2.1.5 | Onboarding docs | P1 | Each member productive within 30 minutes |

### FR-2.2: Role-Based Configuration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.2.1 | Engineer config (Osman A. + Sedon) | P0 | Full agent fleet, all MCPs, CLI access |
| FR-2.2.2 | Business config (Ali) | P0 | Cowork, Claude Desktop, Stripe MCP, client templates |
| FR-2.2.3 | Content config (Samia) | P0 | Cowork, web search, i18n tools, accessible UI |
| FR-2.2.4 | Cost tracking per member | P1 | Know who uses how much of the $200/month budget |

### FR-2.3: Hogwarts Pilot Support

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.3.1 | Admission block QA | P0 | /handover admission passes all 5 QA checks |
| FR-2.3.2 | Notification system | P0 | Twilio + in-app notifications working |
| FR-2.3.3 | Messaging system | P0 | School-to-parent messaging functional |
| FR-2.3.4 | Deployment pipeline | P0 | ed.databayt.org deploys reliably |
| FR-2.3.5 | Client training materials | P1 | Arabic documentation for King Fahad Schools staff |

### FR-2.4: Agent Teams

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.4.1 | Lead agent coordination | P0 | Lead assigns subtasks to teammates |
| FR-2.4.2 | Parallel execution | P0 | 3+ agents work simultaneously |
| FR-2.4.3 | Git worktree isolation | P0 | Each agent in isolated branch |
| FR-2.4.4 | Consolidated output | P0 | Work merges into single PR |

### FR-2.5: CI/CD Integration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.5.1 | GitHub Actions review | P0 | Every PR auto-reviewed by Claude |
| FR-2.5.2 | Pattern compliance | P0 | CI verifies code follows CLAUDE.md |
| FR-2.5.3 | Scheduled cloud tasks | P1 | Daily health check, weekly dependency audit |
| FR-2.5.4 | Auto-fix pipeline | P1 | Trivial lint/type errors auto-fixed |

---

## 4. Phase 3: Company Engine (Future)

### FR-3.1: Agent SDK Pipelines

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1.1 | CI/CD review agent in GitHub Actions | P0 |
| FR-3.1.2 | Deploy verification agent | P0 |
| FR-3.1.3 | Client onboarding agent | P1 |
| FR-3.1.4 | Structured output (validated JSON) | P1 |

### FR-3.2: Cost Optimization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.2.1 | Prompt caching (90% savings) | P0 |
| FR-3.2.2 | Batch API for CI/CD (50% savings) | P0 |
| FR-3.2.3 | Model routing (Haiku for exploration) | P1 |
| FR-3.2.4 | Usage monitoring dashboard | P1 |

### FR-3.3: Pattern Distribution

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.3.1 | Kun config packaged for distribution | P1 |
| FR-3.3.2 | One-command install for external teams | P1 |
| FR-3.3.3 | Pattern marketplace | P2 |

---

## 5. Non-Functional Requirements

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-P1 | Keyword → workflow start | < 3 seconds |
| NFR-P2 | MCP tool response | < 5 seconds |
| NFR-P3 | Autopilot cycle length | 100 turns |

### Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-U1 | Developer onboarding | < 30 minutes |
| NFR-U2 | Non-dev onboarding | < 1 hour |
| NFR-U3 | Screen reader compatibility | WCAG 2.1 AA |
| NFR-U4 | Same config on CLI, Desktop, Web, iOS | 100% |

### Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SE1 | Destructive commands blocked | rm -rf, DROP TABLE |
| NFR-SE2 | Secrets never in git | Keychain or Vault |
| NFR-SE3 | Explicit allow-list permissions | Prompt for unknown |

### Cost

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-C1 | Claude Code plan | $200/month (Max 20x) |
| NFR-C2 | Total monthly expenses | < $400 (Claude + services) |
| NFR-C3 | Revenue from products | $1,000/month by June 2026 |

---

## 6. Acceptance Criteria Summary

### Phase 1 Complete When (Done)

- [x] CLAUDE.md hierarchy configured (user + project + repo)
- [x] 28 agents operational across 6 chains
- [x] 17 skills triggerable via keywords
- [x] 18 MCP servers connected
- [x] 5 hooks automating formatting, port, sessions
- [x] 8 rules auto-activating on file patterns
- [x] 6 memory files persisting cross-session
- [x] Works on CLI, Desktop, Web, and iOS

### Phase 2 Complete When

- [ ] All 4 team members onboarded and productive
- [ ] Hogwarts admission block passes /handover QA
- [ ] King Fahad Schools pilot deployed and operational
- [ ] Agent Teams running parallel features
- [ ] CI/CD reviewing every PR automatically
- [ ] Team generating $1K/month revenue

### Phase 3 Complete When

- [ ] Agent SDK agents in production CI/CD
- [ ] 95% cost reduction via caching + batch
- [ ] Pattern distribution installable in one command
- [ ] Multiple paying Hogwarts customers

---

## 7. Glossary

| Term | Definition |
|------|------------|
| **Kun (كن)** | Arabic for "Be!" — Databayt's configuration engine |
| **Databayt** | The company (databayt.org, github.com/databayt) |
| **Hogwarts** | Flagship education SaaS product |
| **CLAUDE.md** | Markdown context file loaded at session start |
| **Agent** | Specialized AI with domain expertise |
| **Skill** | Organized instruction folder triggered by slash command |
| **MCP** | Model Context Protocol — standard for AI tool integration |
| **Cowork** | Claude Desktop's agentic mode for knowledge work |
