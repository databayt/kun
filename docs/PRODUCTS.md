# Anthropic Product Catalog

> **Version**: 2.0
> **Date**: 2026-03-30
> **Purpose**: Map every Anthropic product to its role in Databayt's operations

---

## 1. Claude Code

The agentic coding tool. Kun's primary development interface.

### Surfaces

| Surface | Description | Databayt User |
|---------|-------------|---------------|
| **Terminal CLI** | Full-featured command line | Osman Abdout (MacBook M4) |
| **Desktop App** | Visual diffs, multiple sessions | All team members |
| **claude.ai/code** | Browser-based, zero setup | Ali, Samia, Sedon (Windows) |
| **iOS App** | Mobile access | Osman A. (iPhone 16e), Samia (iPhone 13 Mini) |
| **VS Code Extension** | Inline diffs, @-mentions | Optional for any member |

### Key Capabilities

| Feature | Description | Kun Usage |
|---------|-------------|-----------|
| **File operations** | Read, Write, Edit across codebase | All agents and skills |
| **Bash execution** | Run commands, scripts, git | Build, deploy, test |
| **MCP** | 3,000+ tool integrations | 18 servers configured |
| **Hooks** | 21 lifecycle events | 5 hooks (format, port, session) |
| **Agent Teams** | Lead + teammate parallel (Experimental) | Parallel feature development |
| **Git Worktrees** | Isolated repo copy per agent | No merge conflicts |
| **Skills** | Organized instruction folders | 17 skills configured |
| **Subagents** | Specialized agents for subtasks | 28 agents across 6 chains |
| **Remote Control** | Continue session from another device | Phone → Desktop handoff |
| **Scheduled Tasks** | Cloud, Desktop, or /loop | Monitoring, maintenance |

### Configuration Files

| File | Scope | Purpose |
|------|-------|---------|
| `~/.claude/settings.json` | Global | Permissions, hooks, env vars |
| `.claude/settings.json` | Project (shared) | Team settings |
| `~/.claude/CLAUDE.md` | Global | Stack, preferences, mode |
| `CLAUDE.md` | Project root | Project context |
| `~/.claude/mcp.json` | Global | MCP server config |
| `~/.claude/agents/*.md` | Global | Agent definitions |

---

## 2. Claude Desktop App

Standalone macOS/Windows application.

### Features

| Feature | Description | Databayt Usage |
|---------|-------------|----------------|
| **Chat** | Conversational AI | General queries, planning |
| **Cowork mode** | Agentic knowledge work | Ali (business), Samia (content) |
| **Code tab** | Full Claude Code in visual UI | Visual diff review |
| **Multiple sessions** | Side-by-side sessions | Parallel workstreams |
| **Scheduled tasks** | Recurring local tasks | Daily builds |
| **Voice mode** | Spoken interaction | Accessibility for Samia |

---

## 3. Cowork (Research Preview)

Agentic knowledge work for non-coding tasks. Available on Max and Enterprise plans.

### Databayt Use Cases

| Team Member | Use Case |
|-------------|----------|
| **Ali Aseel** | Client outreach, proposals, market research, financial analysis |
| **Samia Hamd** | Arabic content, documentation, research synthesis, UX writing |
| **Osman Abdout** | Project planning, architecture documents, specifications |

### Capabilities

| Capability | Company Function |
|-----------|-----------------|
| Task decomposition | Project management |
| Parallel workstreams | Operations |
| File management | Documentation |
| Scheduled tasks | Maintenance |
| Enterprise connectors | Google Drive, Gmail (future) |

---

## 4. Agent SDK

Build production AI agents programmatically. Python and TypeScript.

### Databayt Roadmap (Phase 2-3)

| Agent | Purpose | Status |
|-------|---------|--------|
| PR Review | Auto-review every pull request | Phase 2 |
| Deploy Verify | Post-deploy health check | Phase 2 |
| School Onboarding | Automated tenant setup | Phase 3 |
| Report Generator | Client reports | Phase 3 |

---

## 5. Plans & Pricing

### Databayt's Current Plan

| Item | Plan | Cost | User |
|------|------|------|------|
| **Primary** | Max 20x | $200/month | Osman Abdout |
| **Shared access** | (same account) | Included | Desktop/Web for team |

### All Plans

| Plan | Price | Code | Cowork | Models |
|------|-------|------|--------|--------|
| **Free** | $0 | Limited | - | Sonnet |
| **Pro** | $20/mo | Yes | - | All |
| **Max 5x** | $100/mo | Yes | Yes | All |
| **Max 20x** | $200/mo | Yes | Yes | All + priority Opus |
| **Team Premium** | $125/seat/mo | Yes | - | All |
| **Enterprise** | Custom | Yes | Yes | SSO/SCIM/Audit |

### API Pricing (for Agent SDK / CI/CD)

| Model | Input/MTok | Output/MTok |
|-------|-----------|-------------|
| **Opus 4.6** | $5 | $25 |
| **Sonnet 4.6** | $3 | $15 |
| **Haiku 4.5** | $1 | $5 |

### Databayt Growth Path

| Stage | Plan | Monthly Cost | When |
|-------|------|-------------|------|
| **Now** | Max 20x (1 seat) | $200 | Current |
| **Team grows** | + Pro seats ($20/each) | $260 | When Ali/Samia need own accounts |
| **Revenue stable** | Team Premium (4 seats) | $500 | When $1K/month achieved |
| **Scale** | Enterprise | Custom | Multiple products, clients |

### Cost Optimization Techniques

| Technique | Savings | When to Use |
|-----------|---------|-------------|
| Prompt Caching | 90% | Repeated CLAUDE.md context |
| Batch API | 50% | Non-urgent CI/CD reviews |
| Haiku for exploration | 80% vs Opus | Search, lookups |

---

## 6. Model Selection Guide

### By Task

| Task | Model | Rationale |
|------|-------|-----------|
| Architecture design | Opus 4.6 | Deepest reasoning |
| Complex features | Opus 4.6 | Highest code quality |
| Code review | Opus 4.6 | Catches subtle issues |
| Routine changes | Sonnet 4.6 | Fast, good enough |
| Exploration/search | Haiku 4.5 | Cheapest, fast |
| Documentation | Sonnet 4.6 | Good writing, fast |

### By Kun Agent

| Agent Chain | Default Model |
|-------------|--------------|
| Stack, Design, UI, DevOps, VCS | Opus 4.6 |
| Explore subagents | Haiku 4.5 |

---

## 7. Feature Availability Matrix

| Feature | Free | Pro | Max | Team Prem | Enterprise |
|---------|------|-----|-----|-----------|------------|
| Claude Code | Limited | Yes | Yes | Yes | Yes |
| Cowork | - | - | Yes | - | Yes |
| Agent Teams | - | Yes | Yes | Yes | Yes |
| Scheduled Cloud Tasks | - | Yes | Yes | Yes | Yes |
| Agent SDK | API key | API key | API key | API key | API key |
| SSO/SCIM | - | - | - | - | Yes |
| 1M Context | - | Beta | Yes | Yes | Yes |
| Opus 4.6 Priority | - | - | 20x only | - | Yes |

---

## 8. References

- [Claude Code Overview](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Models](https://docs.anthropic.com/en/docs/about-claude/models)
- [Agent SDK](https://docs.anthropic.com/en/docs/agent-sdk/overview)
- [Pricing](https://claude.ai/pricing)
- [Cowork](https://support.anthropic.com/en/articles/13345190-get-started-with-cowork)
- [MCP Protocol](https://modelcontextprotocol.io)
