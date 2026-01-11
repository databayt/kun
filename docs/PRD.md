# Product Requirements Document: Kun (كن)
## Remote AI Development Infrastructure

> **BMAD Phase**: Planning
> **Version**: 1.0
> **Date**: 2026-01-10
> **Status**: Approved

---

## 1. Overview

### 1.1 Purpose

This PRD defines the functional and non-functional requirements for Kun (كن), a remote AI development infrastructure enabling distributed teams to access Claude Code from anywhere with shared patterns and centralized configuration.

### 1.2 Scope

| Phase | Scope | Target Users |
|-------|-------|--------------|
| Phase 1 | Individual developer setup | Solo developers |
| Phase 2 | Team server with shared resources | 10+ developers |
| Phase 3 | Commercial platform with isolation | External clients |

---

## 2. Functional Requirements

### 2.1 Phase 1: Individual Setup

#### FR-1.1: Server Preparation

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.1.1 | Install Ubuntu LTS | P0 | Ubuntu 22.04 or 24.04 running |
| FR-1.1.2 | Install Node.js 20.x | P0 | `node --version` returns 20.x |
| FR-1.1.3 | Install pnpm | P0 | `pnpm --version` works |
| FR-1.1.4 | Install Claude Code | P0 | `claude --version` works |
| FR-1.1.5 | Enable SSH | P0 | SSH service active and enabled |
| FR-1.1.6 | Install tmux | P0 | `tmux -V` returns version |

#### FR-1.2: Tailscale VPN

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.2.1 | Install Tailscale | P0 | `tailscale --version` works |
| FR-1.2.2 | Authenticate to network | P0 | Device appears in Tailscale admin |
| FR-1.2.3 | Enable Tailscale SSH | P0 | `tailscale up --ssh` successful |
| FR-1.2.4 | Document Tailscale IP | P0 | IP recorded and accessible |

#### FR-1.3: tmux Configuration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.3.1 | Enable mouse support | P0 | Scrolling works in tmux |
| FR-1.3.2 | Increase history limit | P1 | 50000 lines of scrollback |
| FR-1.3.3 | Create named session | P0 | `tmux attach -t claude` works |
| FR-1.3.4 | Configure status bar | P2 | Session name and time visible |

#### FR-1.4: Mobile Access

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.4.1 | Termius connectivity | P0 | SSH from Termius succeeds |
| FR-1.4.2 | tmux attachment | P0 | Can attach to session from phone |
| FR-1.4.3 | Mouse scrolling | P0 | Can scroll terminal on phone |
| FR-1.4.4 | Keyboard input | P0 | Can type commands on phone |

#### FR-1.5: Pattern Library

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.5.1 | Clone databayt/codebase | P1 | Repository cloned to ~/repos |
| FR-1.5.2 | Link custom commands | P2 | /spec, /plan, /ship available |
| FR-1.5.3 | Symlink agents | P2 | Agents accessible to Claude |

---

### 2.2 Phase 2: Team Server

#### FR-2.1: User Management

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.1.1 | Create developers group | P0 | Group exists with correct GID |
| FR-2.1.2 | Create user accounts | P0 | 10+ users with home directories |
| FR-2.1.3 | Configure permissions | P0 | Shared dirs 755, private dirs 700 |
| FR-2.1.4 | Shell defaults | P1 | bash with proper .bashrc |

#### FR-2.2: Tailscale ACLs

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.2.1 | Define admin group | P0 | Admins have full access |
| FR-2.2.2 | Define developer group | P0 | Developers have SSH only |
| FR-2.2.3 | Apply server tag | P0 | Server tagged as kun-server |
| FR-2.2.4 | Configure SSH rules | P0 | SSH limited to own user |

#### FR-2.3: Secrets Management

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.3.1 | Create /etc/claude-code | P0 | Directory exists with 755 |
| FR-2.3.2 | Create env.sh | P0 | Environment file sourced |
| FR-2.3.3 | Store API keys | P0 | ANTHROPIC_API_KEY available |
| FR-2.3.4 | Store GitHub token | P1 | GITHUB_TOKEN available |
| FR-2.3.5 | 1Password/Vault setup | P2 | Secrets rotatable without user changes |

#### FR-2.4: Shared Configuration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.4.1 | Global CLAUDE.md | P0 | /etc/claude-code/CLAUDE.md exists |
| FR-2.4.2 | Shared agents | P1 | Agents in shared location |
| FR-2.4.3 | Shared commands | P1 | Commands in shared location |
| FR-2.4.4 | Pattern library | P0 | /opt/databayt/codebase accessible |

#### FR-2.5: Systemd Services

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.5.1 | Create claude-tmux.service | P1 | Service file created |
| FR-2.5.2 | Enable auto-start | P1 | Starts on boot |
| FR-2.5.3 | Configure restart | P1 | Restarts on failure |
| FR-2.5.4 | Log to journald | P2 | Logs viewable via journalctl |

#### FR-2.6: Monitoring

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.6.1 | Install Netdata | P1 | Dashboard at port 19999 |
| FR-2.6.2 | Configure metrics | P1 | CPU, memory, disk visible |
| FR-2.6.3 | Health check script | P1 | Script runs every 5 minutes |
| FR-2.6.4 | Slack alerting | P2 | Alerts sent on service failure |

---

### 2.3 Phase 3: Commercial Platform

#### FR-3.1: Container Isolation

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.1.1 | Create Dockerfile | P0 | Container builds successfully |
| FR-3.1.2 | Install Claude Code in container | P0 | Claude works in container |
| FR-3.1.3 | Network isolation | P0 | Containers cannot see each other |
| FR-3.1.4 | Resource limits | P0 | CPU and memory limits enforced |
| FR-3.1.5 | Persistent volumes | P0 | User data survives restart |

#### FR-3.2: Usage Metering

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.2.1 | Track compute time | P0 | Container uptime recorded |
| FR-3.2.2 | Track Claude tokens | P0 | API calls metered |
| FR-3.2.3 | Track storage | P1 | Disk usage recorded |
| FR-3.2.4 | Export to database | P0 | Metrics in PostgreSQL |
| FR-3.2.5 | Usage API | P1 | /api/usage endpoint |

#### FR-3.3: Billing Integration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.3.1 | Stripe integration | P0 | Stripe SDK configured |
| FR-3.3.2 | Usage-based products | P0 | Products in Stripe dashboard |
| FR-3.3.3 | Meter readings | P0 | Usage sent to Stripe |
| FR-3.3.4 | Invoice generation | P0 | Invoices auto-generated |
| FR-3.3.5 | Payment webhooks | P1 | Failed payments handled |

#### FR-3.4: API Gateway

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.4.1 | JWT authentication | P0 | Tokens validated |
| FR-3.4.2 | Rate limiting | P0 | Limits per tier |
| FR-3.4.3 | Session endpoints | P0 | CRUD for sessions |
| FR-3.4.4 | Usage endpoints | P1 | GET usage stats |
| FR-3.4.5 | API documentation | P2 | OpenAPI spec |

#### FR-3.5: Pattern Marketplace

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.5.1 | Browse patterns | P1 | List available patterns |
| FR-3.5.2 | Install patterns | P1 | Add to user container |
| FR-3.5.3 | Version management | P2 | Lock to specific version |
| FR-3.5.4 | Rating system | P3 | Users can rate patterns |

#### FR-3.6: Off-Grid Setup

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.6.1 | Solar installation | P2 | 800W panels installed |
| FR-3.6.2 | Battery bank | P2 | 5kWh LiFePO4 operational |
| FR-3.6.3 | Starlink setup | P2 | Internet via satellite |
| FR-3.6.4 | 48-hour autonomy | P2 | Runs 2 days without sun |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-P1 | SSH connection latency | < 100ms within Tailscale |
| NFR-P2 | tmux keystroke latency | < 50ms |
| NFR-P3 | Claude Code startup | < 5 seconds |
| NFR-P4 | Session attach time | < 2 seconds |

### 3.2 Availability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-A1 | Server uptime | 99.9% (8.76 hours/year downtime) |
| NFR-A2 | Session persistence | 7+ days without restart |
| NFR-A3 | Service recovery | < 5 minutes after failure |
| NFR-A4 | Data durability | < 1 hour data loss on failure |

### 3.3 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-S1 | Phase 1 users | 1-3 concurrent |
| NFR-S2 | Phase 2 users | 10-15 concurrent |
| NFR-S3 | Phase 3 users | 50+ concurrent (with scaling) |
| NFR-S4 | Pattern library size | 1000+ patterns |

### 3.4 Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SE1 | Authentication | SSH keys + Tailscale certificates |
| NFR-SE2 | Encryption in transit | WireGuard (Tailscale) |
| NFR-SE3 | Secrets storage | Encrypted at rest |
| NFR-SE4 | Access logging | All SSH sessions logged |
| NFR-SE5 | Session isolation | No cross-user access (Phase 3) |

### 3.5 Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-U1 | Mobile UX | Full functionality on Termius |
| NFR-U2 | Setup time | < 2 hours for Phase 1 |
| NFR-U3 | Onboarding | < 30 minutes for new team member |
| NFR-U4 | Documentation | Complete runbook available |

### 3.6 Maintainability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-M1 | Update process | < 30 minutes downtime |
| NFR-M2 | Log retention | 30 days |
| NFR-M3 | Backup frequency | Daily |
| NFR-M4 | Config as code | All configs in git |

---

## 4. Constraints

### 4.1 Technical Constraints

| Constraint | Description | Impact |
|------------|-------------|--------|
| OS | Ubuntu 22.04/24.04 LTS only | systemd required for services |
| Node.js | Version 20.x LTS | Claude Code dependency |
| Tailscale | Teams tier for 10+ users | $6/user/month cost |
| Storage | SSD required | HDD too slow for development |
| RAM | Minimum 16GB | For comfortable multi-user |

### 4.2 Business Constraints

| Constraint | Description |
|------------|-------------|
| Budget | Tailscale Teams tier ~$60/month for 10 users |
| Team Size | 10+ developers initially |
| Timeline | Phase 1 in 1 week, Phase 2 in 3 weeks |

### 4.3 Regulatory Constraints

| Constraint | Description |
|------------|-------------|
| Data Residency | Server location determines data residency |
| API Terms | Anthropic ToS for Claude API usage |
| Billing | Stripe compliance for Phase 3 |

---

## 5. Dependencies

### 5.1 External Services

| Service | Type | Criticality | Fallback |
|---------|------|-------------|----------|
| Tailscale | SaaS | Critical | Port forwarding + SSH |
| Anthropic API | SaaS | Critical | No fallback |
| GitHub | SaaS | High | Local git server |
| 1Password/Vault | SaaS/Self-hosted | Medium | Environment files |
| Stripe | SaaS | Medium (Phase 3) | Manual invoicing |

### 5.2 Pattern Library

| Component | Path | Count |
|-----------|------|-------|
| UI Components | codebase/src/components/ui/ | 54 |
| Atoms | codebase/src/components/atom/ | 62 |
| Templates | codebase/src/registry/ | 31 |
| Claude Agents | codebase/.claude/agents/ | 11 |
| Claude Commands | codebase/.claude/commands/ | 4 |

### 5.3 Hardware (Phase 3 Off-Grid)

| Component | Specification | Cost Estimate |
|-----------|---------------|---------------|
| Solar Panels | 4x 200W monocrystalline | $400 |
| Battery Bank | 5kWh LiFePO4 | $2000 |
| Charge Controller | 60A MPPT | $300 |
| Inverter | 2000W pure sine wave | $400 |
| Starlink Mini | Monthly subscription | $120/month |

---

## 6. Acceptance Criteria Summary

### 6.1 Phase 1 Complete When

- [ ] SSH via Tailscale works from laptop
- [ ] SSH via Termius works from phone
- [ ] tmux session persists across disconnects
- [ ] Claude Code responds to prompts
- [ ] Mouse scrolling works on mobile
- [ ] Pattern library accessible

### 6.2 Phase 2 Complete When

- [ ] 10+ user accounts created
- [ ] All users can SSH via Tailscale
- [ ] Shared CLAUDE.md applied to all sessions
- [ ] Secrets accessible without per-user config
- [ ] Netdata dashboard accessible
- [ ] Health checks running and alerting

### 6.3 Phase 3 Complete When

- [ ] Docker containers isolate users
- [ ] Usage metering records all activity
- [ ] Stripe charges based on usage
- [ ] API gateway authenticates requests
- [ ] 10+ external users active
- [ ] (Optional) Solar setup operational

---

## 7. Glossary

| Term | Definition |
|------|------------|
| **Kun (كن)** | Arabic for "Be!" - the divine command of creation |
| **Tailscale** | Zero-config VPN based on WireGuard |
| **tmux** | Terminal multiplexer for persistent sessions |
| **Termius** | SSH client for iOS and Android |
| **Claude Code** | Anthropic's AI-powered CLI development tool |
| **Pattern Library** | databayt/codebase repository with reusable components |
| **BMAD** | Breakthrough Method for Agile AI-Driven Development |

---

## 8. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Claude Code | Initial PRD |
