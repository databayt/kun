# Product Requirements: Kun (كن)

## 1. Overview

### Purpose
Define the requirements for the Kun engine — the configuration layer that turns Anthropic's product suite into a unified operating system.

### Scope

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1: Developer Engine | Individual developer configuration | Done |
| Phase 2: Team Engine | Shared config + coordination across roles | Current |
| Phase 3: Company Engine | Full operations + custom automation | Future |

### Constraints

| Constraint | Value |
|------------|-------|
| Team model | Engineer, business, content, ops |
| Revenue pipeline | Pilot product first |
| License | SSPL (open source, commercial use requires license) |

## 2. Phase 1: Developer Engine (Done)

| Requirement | Priority | Status |
|-------------|----------|--------|
| User-level CLAUDE.md defines stack and preferences | P0 | Done |
| Project-level CLAUDE.md provides project context | P0 | Done |
| Repo-level CLAUDE.md maps keywords to workflows | P0 | Done |
| Stack chain agents (nextjs, react, typescript, tailwind, prisma, shadcn, authjs) | P0 | Done |
| Design chain (orchestration, architecture, pattern, structure) | P0 | Done |
| UI chain (atom, template, block) | P0 | Done |
| DevOps chain (build, deploy, test) | P0 | Done |
| VCS chain (git, github) | P0 | Done |
| Specialized agents | P1 | Done |
| Skill library with keyword triggers | P0 | Done |
| MCP servers connected | P0 | Done |
| Lifecycle hooks (format, port, session) | P0 | Done |
| Path-scoped rules | P0 | Done |
| Memory files persisting cross-session | P1 | Done |

## 3. Phase 2: Team Engine (Current)

### Team Configuration

| Requirement | Priority |
|-------------|----------|
| Shared `settings.json` via git | P0 |
| Local override support | P0 |
| One-command installer | P0 |
| Role-based configs (engineer, business, content, ops) | P0 |
| Accessibility: screen reader compatible outputs | P0 |

### Pilot Product

| Requirement | Priority |
|-------------|----------|
| Flagship feature — multi-pass QA clean | P0 |
| Notifications — SMS + in-app | P0 |
| Messaging — internal communication | P1 |
| Arabic RTL — complete | P0 |

### Agent Teams (experimental)

| Requirement | Priority |
|-------------|----------|
| Lead agent coordination | P0 |
| Parallel agent execution | P0 |
| Git worktree isolation | P0 |
| Consolidated PR output | P0 |

### CI/CD & Automation

| Requirement | Priority |
|-------------|----------|
| GitHub Actions code review via Agent SDK | P0 |
| Pattern compliance check in CI | P0 |
| Scheduled cloud tasks | P1 |

## 4. Phase 3: Company Engine (Future)

### Agent SDK Platform

| Requirement | Priority |
|-------------|----------|
| CI/CD review agent in GitHub Actions | P0 |
| Deploy verification agent | P0 |
| Onboarding automation agent | P1 |

### Enterprise & Optimization

| Requirement | Priority |
|-------------|----------|
| SSO (SAML/OIDC) + SCIM | P0 |
| Audit logging | P0 |
| Prompt caching | P0 |
| Batch API for CI/CD | P0 |
| Pattern distribution packaging | P1 |

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Keyword → workflow start | < 3 seconds |
| Performance | Autopilot cycle | 100 turns |
| Reliability | Configuration load | 100% success |
| Usability | Engineer onboarding | < 30 minutes |
| Usability | Non-dev onboarding | < 1 hour |
| Accessibility | Screen reader | Full support |
| Quality | Pattern compliance | 90%+ |
| Security | Destructive commands | Always blocked |
| Security | Secrets | Never in git |
| Cost | API reduction (Phase 3) | ~95% via caching + batch |
