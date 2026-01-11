# Kun (كن) - Project Context

> "كن" (Kun) - "Be!" - The divine command of creation from the Quran.
> This infrastructure embodies the architecture-first paradigm where AI generates code within intentional constraints.

---

## Project Overview

**Kun** is a Remote AI Development Infrastructure enabling:
- Team members to access Claude Code from anywhere (laptop, phone)
- Centralized configuration and secrets management
- Shared patterns from databayt/codebase
- Future: Usage-based rental model for external developers

---

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/PROJECT-BRIEF.md` | Vision, goals, target users |
| `docs/ARCHITECTURE.md` | System design, topology, security |
| `docs/PRD.md` | Functional & non-functional requirements |
| `docs/EPICS.md` | 50 stories across 12 epics |
| `REMOTE-INFRASTRUCTURE.md` | Technical reference guide |

---

## Three Phases

### Phase 1: Individual Setup
- Tailscale VPN + Tailscale SSH
- tmux for persistent sessions
- Termius for mobile access
- Claude Code CLI

### Phase 2: Team Server (10+ Developers)
- Multi-user accounts
- Tailscale ACLs
- Centralized secrets (/etc/claude-code/)
- Shared CLAUDE.md and patterns
- Systemd services
- Netdata monitoring

### Phase 3: Commercial Platform
- Docker container isolation
- Usage metering
- Stripe billing
- Pattern marketplace
- (Optional) Solar + Starlink off-grid

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| OS | Ubuntu 22.04/24.04 LTS |
| VPN | Tailscale |
| Sessions | tmux |
| AI | Claude Code CLI |
| Runtime | Node.js 20.x |
| Package Manager | pnpm |
| Secrets | 1Password CLI / Vault |
| Monitoring | Netdata |

---

## Pattern Library Reference

When implementing features, reference patterns from:

```
/Users/abdout/codebase/
├── src/components/
│   ├── ui/           # 54 shadcn/ui primitives
│   ├── atom/         # 62 atomic components
│   └── template/     # Full-page layouts
├── src/registry/     # 31 templates
└── .claude/
    ├── agents/       # 11 specialized agents
    └── commands/     # Custom slash commands
```

---

## Architecture Principles

### 1. Mirror-Pattern
Every URL route maps 1:1 to directory structure.

### 2. Architecture-First
Design systems, not just features. AI generates code within intentional constraints.

### 3. Guardrails
CLAUDE.md files and patterns are training data for AI collaborators.

### 4. Human Review Layer
Humans own architectural tradeoffs; AI handles implementation velocity.

---

## Key Commands

```bash
# Phase 1 Quick Start
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
tmux new-session -d -s claude -n claude

# Attach from mobile
ssh [tailscale-ip]
tmux attach -t claude

# Check status
tailscale status
tmux list-sessions
systemctl status claude-tmux
```

---

## Directory Structure (Phase 2)

```
/
├── etc/claude-code/
│   ├── env.sh              # Shared environment
│   └── CLAUDE.md           # Team context
├── opt/databayt/codebase/  # Pattern library
└── home/
    ├── dev1/
    ├── dev2/
    └── ...
```

---

## Security

- **Network**: Tailscale VPN (WireGuard-based)
- **Auth**: Tailscale SSH (certificate-based)
- **Access**: ACL-based per user group
- **Secrets**: Never in git, managed via Vault/1Password

---

## When Implementing

1. Check `docs/EPICS.md` for current stories
2. Reference `docs/ARCHITECTURE.md` for design decisions
3. Follow patterns from `/Users/abdout/codebase/`
4. Use conventional commits
5. PR workflow - no direct commits to main

---

## Agents

For specialized work, reference agents from codebase:

| Domain | Agent Path |
|--------|------------|
| Architecture | `codebase/.claude/agents/architect.md` |
| Next.js | `codebase/.claude/agents/nextjs.md` |
| TypeScript | `codebase/.claude/agents/typescript.md` |
| Testing | `codebase/.claude/agents/test.md` |

---

## Quick Links

- [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD)
- [Tailscale Docs](https://tailscale.com/kb/)
- [tmux Cheatsheet](https://tmuxcheatsheet.com/)
- [Claude Code](https://claude.ai/code)

---

## Philosophy

> "The future of software is not just written. It's designed." - Craig Adam

Kun represents the shift from "vibe coding" to intentional architecture:
- **Speed without chaos**: AI generates fast, but within constraints
- **Patterns as training data**: Every good function teaches the next generation
- **Direction over velocity**: Move fast, but with a map
