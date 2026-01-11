# Architecture Document: Kun (كن)
## Remote AI Development Infrastructure

> **BMAD Phase**: Solutioning
> **Version**: 1.0
> **Date**: 2026-01-10
> **Status**: Approved

---

## 1. Architecture Overview

### 1.1 High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           KUN ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Clients   │    │   Network   │    │   Server    │                 │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤                 │
│  │ Termius     │───▶│ Tailscale   │───▶│ Ubuntu LTS  │                 │
│  │ (iOS/Android)    │ VPN Mesh    │    │ 22.04/24.04 │                 │
│  ├─────────────┤    │             │    ├─────────────┤                 │
│  │ SSH Client  │───▶│ WireGuard   │───▶│ tmux Server │                 │
│  │ (Laptop)    │    │ Protocol    │    │             │                 │
│  ├─────────────┤    └─────────────┘    ├─────────────┤                 │
│  │ VSCode SSH  │                       │ Claude Code │                 │
│  │ Remote      │                       │ CLI         │                 │
│  └─────────────┘                       └─────────────┘                 │
│                                               │                          │
│                                               ▼                          │
│                        ┌─────────────────────────────────────┐          │
│                        │           Shared Resources           │          │
│                        ├─────────────────────────────────────┤          │
│                        │ ┌───────────┐   ┌───────────────┐  │          │
│                        │ │ CLAUDE.md │   │ databayt/     │  │          │
│                        │ │ (Global)  │   │ codebase      │  │          │
│                        │ └───────────┘   └───────────────┘  │          │
│                        │ ┌───────────┐   ┌───────────────┐  │          │
│                        │ │ Secrets   │   │ .claude/      │  │          │
│                        │ │ (Vault)   │   │ agents        │  │          │
│                        │ └───────────┘   └───────────────┘  │          │
│                        └─────────────────────────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| VPN | Tailscale | Secure mesh network |
| Server | Ubuntu LTS | Host environment |
| Sessions | tmux | Persistent terminals |
| AI | Claude Code CLI | AI-assisted development |
| Secrets | 1Password/Vault | Centralized credentials |
| Patterns | databayt/codebase | Shared component library |
| Monitoring | Netdata | Real-time metrics |

---

## 2. Infrastructure Topology

### 2.1 Phase 1: Individual Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                     INDIVIDUAL DEVELOPER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Device                       Linux Desktop                 │
│  ──────────                        ─────────────                 │
│  ┌──────────┐                      ┌──────────────────────────┐ │
│  │ Phone    │                      │ Ubuntu 22.04/24.04       │ │
│  │ (Termius)│───┐                  │                          │ │
│  └──────────┘   │                  │  ┌─────────────────────┐ │ │
│                 │   Tailscale      │  │ tmux session        │ │ │
│  ┌──────────┐   │   VPN Mesh       │  │ ├── window: claude  │ │ │
│  │ Laptop   │───┼─────────────────▶│  │ │   └── Claude Code │ │ │
│  │ (SSH)    │   │                  │  │ └── window: server  │ │ │
│  └──────────┘   │                  │  └─────────────────────┘ │ │
│                 │                  │                          │ │
│  ┌──────────┐   │                  │  Shared Resources:       │ │
│  │ Tablet   │───┘                  │  ├── ~/.claude/CLAUDE.md │ │
│  │ (VSCode) │                      │  ├── ~/repos/codebase    │ │
│  └──────────┘                      │  └── ~/.ssh/             │ │
│                                    └──────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Phase 2: Team Server

```
┌──────────────────────────────────────────────────────────────────┐
│                        CENTRAL SERVER                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Tailscale   │  │ SSH Server  │  │ Netdata     │              │
│  │ (tailscaled)│  │ (openssh)   │  │ (Monitor)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │              systemd Services                     │           │
│  ├──────────────────────────────────────────────────┤           │
│  │ claude-tmux.service  - Persistent sessions       │           │
│  │ tailscaled.service   - VPN connectivity          │           │
│  │ netdata.service      - Monitoring                │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐           │
│  │              User Accounts                        │           │
│  ├──────────────────────────────────────────────────┤           │
│  │ /home/dev1/    - Developer 1 home                │           │
│  │ /home/dev2/    - Developer 2 home                │           │
│  │ /home/dev3/    - Developer 3 home                │           │
│  │ ...            - (10+ developers)                │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐           │
│  │              Shared Configuration                 │           │
│  ├──────────────────────────────────────────────────┤           │
│  │ /etc/claude-code/env.sh     - Team secrets       │           │
│  │ /etc/claude-code/CLAUDE.md  - Global context     │           │
│  │ /opt/databayt/codebase      - Pattern library    │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
         │
         │ Tailscale ACLs
         ▼
┌────────────────────────────────────────────────────────────────┐
│                      TEAM ACCESS                                │
├────────────────────────────────────────────────────────────────┤
│  group:admins     ──▶ Full access (root, all ports)           │
│  group:developers ──▶ SSH access (port 22, own user)           │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 Phase 3: Commercial Platform

```
┌─────────────────────────────────────────────────────────────────────┐
│                      COMMERCIAL PLATFORM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │                    API Gateway                             │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │      │
│  │  │ Auth        │  │ Rate Limit  │  │ Usage Meter │        │      │
│  │  │ (JWT/OAuth) │  │ (per-tier)  │  │ (Stripe)    │        │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │      │
│  └───────────────────────────────────────────────────────────┘      │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │                 Container Orchestration                    │      │
│  │  ┌──────────────────────────────────────────────────┐     │      │
│  │  │              Docker / Kubernetes                  │     │      │
│  │  ├──────────────────────────────────────────────────┤     │      │
│  │  │  Pod: user-001   Pod: user-002   Pod: user-003   │     │      │
│  │  │  ├── claude      ├── claude      ├── claude      │     │      │
│  │  │  ├── tmux        ├── tmux        ├── tmux        │     │      │
│  │  │  └── patterns    └── patterns    └── patterns    │     │      │
│  │  └──────────────────────────────────────────────────┘     │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │                   Pattern Library                          │      │
│  │  ┌─────────────────────────────────────────────────────┐  │      │
│  │  │ databayt/codebase - 54 UI + 62 Atoms + 31 Templates │  │      │
│  │  │ databayt/patterns - Enterprise patterns             │  │      │
│  │  │ community/patterns - Community contributed          │  │      │
│  │  └─────────────────────────────────────────────────────┘  │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Security Architecture

### 3.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                       SECURITY LAYERS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 4: Session Isolation (Phase 3)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Docker containers per user                                │   │
│  │ Resource limits (CPU, memory)                             │   │
│  │ Isolated filesystems                                      │   │
│  │ Network namespaces                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ▲                                   │
│  Layer 3: Secrets Management                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1Password CLI or HashiCorp Vault                          │   │
│  │ Environment variables via /etc/claude-code/env.sh         │   │
│  │ No secrets in git repositories                            │   │
│  │ API keys scoped per project                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ▲                                   │
│  Layer 2: System Security                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ SSH key authentication only (password disabled)           │   │
│  │ Non-root user for development                             │   │
│  │ UFW firewall (allow only Tailscale)                       │   │
│  │ Fail2ban for SSH protection                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ▲                                   │
│  Layer 1: Network Security                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Tailscale VPN (WireGuard-based) - No exposed ports        │   │
│  │ Tailscale SSH - Certificate-based authentication          │   │
│  │ ACL-based access control per user group                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Access Control Matrix

| Role | Tailscale Access | SSH Users | tmux Sessions | Secrets |
|------|------------------|-----------|---------------|---------|
| Admin | All ports | root, developer | All | Full |
| Developer | Port 22 | own-user | Own + shared | Project-scoped |
| External | Port 22 | isolated-user | Own only | Read-only patterns |

### 3.3 Tailscale ACL Configuration

```json
{
  "groups": {
    "group:admins": ["admin@databayt.org"],
    "group:developers": [
      "dev1@databayt.com",
      "dev2@databayt.com",
      "dev3@databayt.com"
    ]
  },
  "tagOwners": {
    "tag:kun-server": ["group:admins"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["group:admins"],
      "dst": ["*:*"]
    },
    {
      "action": "accept",
      "src": ["group:developers"],
      "dst": ["tag:kun-server:22"]
    }
  ],
  "ssh": [
    {
      "action": "accept",
      "src": ["group:admins"],
      "dst": ["tag:kun-server"],
      "users": ["root", "autogroup:nonroot"]
    },
    {
      "action": "accept",
      "src": ["group:developers"],
      "dst": ["tag:kun-server"],
      "users": ["autogroup:nonroot"]
    }
  ]
}
```

---

## 4. Data Architecture

### 4.1 Directory Structure

```
/
├── etc/
│   └── claude-code/
│       ├── env.sh              # Shared environment variables
│       ├── CLAUDE.md           # Global Claude context
│       └── settings.json       # Team settings
│
├── opt/
│   └── databayt/
│       └── codebase/           # Pattern library (read-only)
│           ├── src/
│           │   ├── components/
│           │   │   ├── ui/     # 54 shadcn/ui primitives
│           │   │   ├── atom/   # 62 atomic components
│           │   │   └── template/ # Full-page layouts
│           │   └── registry/
│           └── .claude/
│               ├── agents/     # 11 specialized agents
│               └── commands/   # Custom slash commands
│
├── home/
│   ├── dev1/
│   │   ├── .claude/            # User-specific Claude config
│   │   ├── .tmux.conf          # User tmux config
│   │   └── projects/           # User's project directories
│   ├── dev2/
│   └── ...
│
└── var/
    └── log/
        └── kun/                # Kun-specific logs
            ├── sessions.log
            └── health.log
```

### 4.2 Configuration Hierarchy

```
Priority (High → Low):
┌─────────────────────────────────────────────────────────────────┐
│ 1. Project-level: ~/projects/myapp/CLAUDE.md                   │
│    └── Specific instructions for this project                  │
├─────────────────────────────────────────────────────────────────┤
│ 2. User-level: ~/.claude/CLAUDE.md                             │
│    └── Personal preferences and patterns                       │
├─────────────────────────────────────────────────────────────────┤
│ 3. Team-level: /etc/claude-code/CLAUDE.md                      │
│    └── Shared team conventions                                 │
├─────────────────────────────────────────────────────────────────┤
│ 4. Pattern library: /opt/databayt/codebase/CLAUDE.md           │
│    └── Core architectural patterns                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Technology Stack

### 5.1 Core Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| OS | Ubuntu LTS | 22.04/24.04 | Host environment |
| Runtime | Node.js | 20.x LTS | Claude Code |
| Package Manager | pnpm | Latest | Package management |
| VPN | Tailscale | Latest | Secure networking |
| Terminal | tmux | 3.x | Session persistence |
| AI | Claude Code | Latest | AI development |

### 5.2 Monitoring Stack

| Tool | Purpose |
|------|---------|
| Netdata | Real-time metrics |
| journalctl | System logs |
| Custom scripts | Health checks |
| Slack webhooks | Alerting |

### 5.3 Phase 3 Stack

| Technology | Purpose |
|------------|---------|
| Docker | Container isolation |
| Kubernetes (optional) | Orchestration |
| Stripe | Usage billing |
| PostgreSQL | Usage database |
| Redis | Session cache |

---

## 6. Scalability Architecture

### 6.1 Vertical Scaling (Phase 1-2)

| Stage | RAM | Cores | Concurrent Users |
|-------|-----|-------|------------------|
| Start | 16GB | 8 | 3-5 |
| Growth | 32GB | 16 | 8-12 |
| Enterprise | 64GB | 32 | 15-20 |

### 6.2 Horizontal Scaling (Phase 3)

```
                    ┌─────────────────────┐
                    │   Load Balancer     │
                    │   (Tailscale Exit)  │
                    └─────────┬───────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ Node 1  │         │ Node 2  │         │ Node N  │
    │ (Solar) │         │ (Grid)  │         │ (Cloud) │
    │ 16 users│         │ 16 users│         │ 16 users│
    └─────────┘         └─────────┘         └─────────┘
```

### 6.3 Resource Limits per User (Phase 3)

```yaml
resources:
  limits:
    cpu: "2"
    memory: "4Gi"
  requests:
    cpu: "0.5"
    memory: "1Gi"
```

---

## 7. Resilience Architecture

### 7.1 Failure Modes and Recovery

| Failure | Impact | Detection | Recovery |
|---------|--------|-----------|----------|
| tmux crash | Session lost | Health check | Auto-restart via systemd |
| Tailscale disconnect | No access | Health check | Auto-reconnect |
| Power loss | All sessions lost | UPS monitor | Auto-start on boot |
| Disk full | Cannot write | Netdata alert | Cleanup + notification |
| Claude API down | No AI | API monitoring | Graceful degradation |

### 7.2 Backup Strategy

```
Daily Backups:
├── /home/*/projects/    → Incremental backup
├── /etc/claude-code/    → Full backup
└── /opt/databayt/       → Git pull (source of truth on GitHub)

Retention:
├── Daily:   7 days
├── Weekly:  4 weeks
└── Monthly: 12 months
```

### 7.3 Health Check Script

```bash
#!/bin/bash
# /opt/scripts/health-check.sh

WEBHOOK_URL="https://hooks.slack.com/services/..."

check_service() {
    if ! systemctl is-active --quiet $1; then
        curl -X POST -H 'Content-type: application/json' \
          --data "{\"text\":\"[KUN] Service $1 is down\"}" \
          $WEBHOOK_URL
        return 1
    fi
    return 0
}

check_disk() {
    usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $usage -gt 90 ]; then
        curl -X POST -H 'Content-type: application/json' \
          --data "{\"text\":\"[KUN] Disk usage at $usage%\"}" \
          $WEBHOOK_URL
    fi
}

check_service tailscaled
check_service ssh
check_disk
```

---

## 8. Integration Points

### 8.1 External Integrations

| System | Integration Type | Purpose |
|--------|------------------|---------|
| GitHub | SSH + API | Repository access |
| Vercel | CLI | Preview deployments |
| Anthropic | API | Claude Code |
| Stripe | API | Usage billing (Phase 3) |
| Slack | Webhooks | Notifications |

### 8.2 Pattern Library Integration

```
Claude Code Session
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                      CLAUDE.md Context                         │
├───────────────────────────────────────────────────────────────┤
│ Reference: /opt/databayt/codebase/                            │
│ ├── src/components/ui/       → 54 primitives                  │
│ ├── src/components/atom/     → 62 atoms                       │
│ ├── src/registry/            → 31 templates                   │
│ ├── .claude/agents/          → 11 specialized agents          │
│ └── .claude/commands/        → Custom slash commands          │
│                                                                │
│ When implementing:                                             │
│ 1. Check codebase for existing patterns                       │
│ 2. Follow mirror-pattern architecture                         │
│ 3. Use standard file naming conventions                       │
│ 4. Reference appropriate agent for domain                     │
└───────────────────────────────────────────────────────────────┘
```

---

## 9. Deployment Architecture

### 9.1 Phase 1 Deployment (Manual)

```bash
# 1. System setup
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget tmux htop build-essential openssh-server

# 2. Node.js + Claude Code
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm @anthropic-ai/claude-code

# 3. Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh

# 4. tmux configuration
cat > ~/.tmux.conf << 'EOF'
set -g mouse on
set -g history-limit 50000
EOF
```

### 9.2 Phase 2 Deployment (Automated)

```bash
# Ansible playbook structure
kun-deployment/
├── inventory/
│   └── hosts.yml
├── playbooks/
│   ├── setup-server.yml
│   ├── setup-users.yml
│   ├── setup-monitoring.yml
│   └── deploy-patterns.yml
└── roles/
    ├── common/
    ├── tailscale/
    ├── claude-code/
    └── monitoring/
```

### 9.3 Phase 3 Deployment (Container)

```dockerfile
# Dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    nodejs npm git tmux curl \
    && npm install -g @anthropic-ai/claude-code pnpm

RUN useradd -m developer
USER developer
WORKDIR /home/developer

# Copy pattern library (read-only)
COPY --chown=developer:developer codebase /opt/databayt/codebase

CMD ["tmux", "new-session", "-s", "main"]
```

---

## 10. Decision Records

### ADR-001: Tailscale over Traditional VPN

**Status**: Accepted

**Context**: Need secure remote access without complex router configuration.

**Decision**: Use Tailscale instead of OpenVPN or WireGuard directly.

**Rationale**:
- Zero-config VPN
- Built-in SSH (no key management)
- Works across NAT without port forwarding
- Free tier sufficient for initial team

### ADR-002: tmux over Screen

**Status**: Accepted

**Context**: Need persistent terminal sessions.

**Decision**: Use tmux over GNU Screen.

**Rationale**:
- Better mobile scrolling with mouse support
- More active development
- Better window/pane management
- Industry standard

### ADR-003: Docker for Isolation (Phase 3)

**Status**: Proposed

**Context**: Need to isolate external users.

**Decision**: Use Docker containers per user.

**Rationale**:
- Strong isolation without VM overhead
- Resource limits
- Easy cleanup
- Path to Kubernetes if needed

---

## 11. References

- [Tailscale Documentation](https://tailscale.com/kb/)
- [tmux Manual](https://man7.org/linux/man-pages/man1/tmux.1.html)
- [Claude Code Documentation](https://claude.ai/code)
- [databayt/codebase](https://github.com/databayt/codebase)
