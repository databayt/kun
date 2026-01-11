# Remote Claude Code Infrastructure - Method of Statement

## Executive Summary

This document outlines the complete implementation plan for building a **Remote AI Development Server** that enables:
- Team members to access Claude Code from anywhere (laptop, phone)
- Centralized configuration and secrets management
- Future scalability to a 24/7 solar-powered "supercomputer" with Starlink
- Usage-based rental model for external developers

---

## Philosophical Foundation: Architecture-First AI Development

> "The future of software is not just written. It's designed." - Craig Adam

### The New Paradigm

We're entering an era where **AI generates the code, but humans design the systems**. The most valuable developers won't be "vibe coders" chasing velocity - they'll be **architects who harness AI's power while maintaining clarity and direction**.

**Key Principles for This Infrastructure:**

1. **Systems Over Snippets** - Our centralized server isn't just a machine; it's an *environment* that defines how AI-generated code integrates into our architecture.

2. **Guardrails, Not Just Features** - CLAUDE.md files, shared configs, and patterns aren't bureaucracy - they're **training data for our AI collaborators**.

3. **Curated Examples** - The databayt/codebase repository becomes our "pattern library" that AI learns from. Clean it, document it, treat it as sacred.

4. **Human Review Layer** - The architecture ensures humans own tradeoffs while AI handles implementation velocity.

### Why This Matters for Remote Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│              The Traditional Model (Chaos)                   │
│                                                              │
│   Dev A ──> Vibe Code ──> Ship                              │
│   Dev B ──> Vibe Code ──> Ship                              │
│   Dev C ──> Vibe Code ──> Tech Debt Mountain               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│           The Architecture-First Model (Intentional)        │
│                                                              │
│                  ┌────────────────────┐                     │
│                  │  Central Server    │                     │
│                  │  ├── CLAUDE.md     │  ← Shared context   │
│                  │  ├── Patterns      │  ← Guardrails       │
│                  │  └── Codebase ref  │  ← Training data    │
│                  └─────────┬──────────┘                     │
│                            │                                 │
│        ┌───────────────────┼───────────────────┐            │
│        ▼                   ▼                   ▼            │
│     Dev A               Dev B               Dev C           │
│   (Same context)    (Same patterns)    (Same guardrails)   │
│                                                              │
│   Result: Coherent, scalable, maintainable code             │
└─────────────────────────────────────────────────────────────┘
```

**The server isn't just compute - it's the architectural backbone that ensures everyone (human and AI) builds within the same intentional constraints.**

---

## Phase 1: Core Infrastructure Setup

### 1.1 Linux Desktop Server Preparation (Ubuntu 22.04/24.04 LTS)

**Hardware Requirements:**
- Linux desktop (Ubuntu 22.04 LTS or later)
- Minimum 16GB RAM, 8+ cores for comfortable AI development
- SSD storage (500GB+ for projects and caches)
- UPS for power protection

**Initial Configuration:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl wget tmux htop neofetch build-essential openssh-server

# Enable SSH (equivalent to macOS Remote Login)
sudo systemctl enable ssh
sudo systemctl start ssh

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

**SSH Configuration (/etc/ssh/sshd_config):**
```bash
# Recommended secure settings
PermitRootLogin no
PasswordAuthentication no  # After setting up SSH keys
PubkeyAuthentication yes
```

### 1.2 Tailscale VPN Setup (Mesh Network)

**Why Tailscale:**
- Zero-config VPN based on WireGuard
- No port forwarding needed
- Works across NAT, firewalls
- Free tier: 3 users, 100 devices

**Server Installation:**
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate and connect
sudo tailscale up

# Enable SSH via Tailscale (no keys needed!)
sudo tailscale up --ssh

# Get your Tailscale IP
tailscale ip -4
```

**Team Setup:**
1. Create Tailscale account at https://login.tailscale.com
2. Invite team members via Admin Console > Users
3. Each member installs Tailscale on their devices
4. Configure ACLs for access control:

```json
// https://login.tailscale.com/admin/acls
{
  "groups": {
    "group:admins": ["admin@databayt.com"],
    "group:developers": ["dev1@databayt.com", "dev2@databayt.com"]
  },
  "acls": [
    {"action": "accept", "src": ["group:admins"], "dst": ["*:*"]},
    {"action": "accept", "src": ["group:developers"], "dst": ["tag:dev-server:22"]}
  ],
  "ssh": [
    {"action": "accept", "src": ["group:admins"], "dst": ["tag:dev-server"], "users": ["root", "autogroup:nonroot"]},
    {"action": "accept", "src": ["group:developers"], "dst": ["tag:dev-server"], "users": ["developer"]}
  ]
}
```

### 1.3 tmux Persistent Sessions

**Configuration (~/.tmux.conf):**
```bash
# Mouse support
set -g mouse on

# Longer history
set -g history-limit 50000

# Status bar
set -g status-bg colour235
set -g status-fg white
set -g status-left '[#S] '
set -g status-right '%Y-%m-%d %H:%M'

# Easy split keys
bind | split-window -h
bind - split-window -v

# Reload config
bind r source-file ~/.tmux.conf \; display "Reloaded!"
```

**Usage Workflow:**
```bash
# Create named session for Claude Code with two windows
tmux new-session -s claude -n claude

# Create second window for dev server/team work
# Press Ctrl+B, then C to create new window
# Or run: tmux new-window -t claude -n server

# Inside first window, start Claude Code
claude

# Detach: Ctrl+B, then D
# Reattach from anywhere:
tmux attach -t claude

# List windows in session
tmux list-windows -t claude

# Switch windows (phone-friendly, no key chords)
tmux select-window -t claude:claude
tmux select-window -t claude:server
```

**Enable Mouse Support (critical for phone scrolling):**
```bash
# Add to ~/.tmux.conf
printf '\nset -g mouse on\n' >> ~/.tmux.conf
tmux source-file ~/.tmux.conf
```

---

## Phase 1.5: Agentic Pipeline Structure

> "Agentic coding makes output cheap. Context is the expensive part." - Pete Sena

### The Build Loop Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  Agentic Build Pipeline                      │
│                                                              │
│   IDEA ──> SPEC ──> PLAN ──> APPROVAL ──> BUILD ──> PR     │
│     │       │        │         │           │        │       │
│     ▼       ▼        ▼         ▼           ▼        ▼       │
│   Messy   Claude   PRD      Human      Feature   Preview    │
│  thought  refines  doc      reviews    branch    URL        │
│           idea              gate                   │        │
│                                                    ▼        │
│                                                  SHIP       │
└─────────────────────────────────────────────────────────────┘
```

### Custom Slash Commands Setup

Create custom commands in `~/.claude/commands/`:

**`~/.claude/commands/spec.md` - Turn idea into spec:**
```markdown
# /spec - Turn messy idea into structured specification

Take the user's rough idea and create a structured specification:

1. **Problem Statement**: What problem does this solve?
2. **User Story**: As a [user], I want [goal], so that [benefit]
3. **Acceptance Criteria**: Bullet list of "done" conditions
4. **Out of Scope**: What this does NOT include
5. **Technical Considerations**: Dependencies, constraints

Output in markdown format suitable for team review.
```

**`~/.claude/commands/plan.md` - Create PRD from spec:**
```markdown
# /plan - Create implementation plan (PRD)

From the specification, create a detailed implementation plan:

1. **Overview**: 1-2 sentence summary
2. **Files to Create/Modify**: List with brief description
3. **Implementation Steps**: Ordered checklist
4. **Testing Strategy**: How to verify it works
5. **Rollback Plan**: How to undo if needed

Ask for explicit approval before proceeding to implementation.
```

**`~/.claude/commands/ship.md` - Create PR and request review:**
```markdown
# /ship - Create PR with summary

1. Create a feature branch if not already on one
2. Stage and commit changes with conventional commit message
3. Push to remote
4. Create PR with:
   - Summary of changes
   - Testing done
   - Screenshots if UI changes
5. Output the PR URL for review
```

### Git Safety Rails

**Protected Main Branch (configure on GitHub):**
- Require PR reviews before merging
- Require status checks to pass
- Block force pushes
- Block deletions

**Local Git Hooks (~/.claude/hooks/):**
```bash
# pre-commit hook to prevent commits to main
#!/bin/bash
branch=$(git symbolic-ref HEAD 2>/dev/null | cut -d"/" -f 3)
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "Direct commits to main/master blocked. Use feature branch."
  exit 1
fi
```

---

## Phase 2: Mobile Access Setup

### 2.1 Termius (iOS/Android) Configuration

**Installation:**
1. Download Termius from App Store / Play Store
2. Create account for sync across devices

**Connection Setup:**
1. Add New Host:
   - Label: `Claude Dev Server`
   - Hostname: `<tailscale-ip>` or `<machine-name>.tail-net.ts.net`
   - Port: 22
   - Username: `developer` (or your username)

2. With Tailscale SSH enabled, no password/key needed!

**tmux Integration in Termius:**
- Settings > Terminal > Enable "tmux integration"
- This allows seamless attach/detach from mobile

### 2.2 Alternative: SSH from any device

```bash
# From laptop/phone terminal
ssh <tailscale-ip>

# Attach to existing Claude session
tmux attach -t claude-dev
```

---

## Phase 3: Centralized Configuration

### 3.1 Claude Code Configuration Hierarchy

```
/home/developer/
├── .claude/
│   ├── settings.json          # User-level settings
│   └── CLAUDE.md              # Personal instructions
│
/home/developer/projects/
├── mkan/
│   └── CLAUDE.md              # Project-specific (from github/databayt/codebase)
│
/etc/claude-code/              # System-wide (custom, for team)
└── shared-config.json
```

### 3.2 Shared Team Configuration

**Create shared settings directory:**
```bash
sudo mkdir -p /etc/claude-code
sudo chmod 755 /etc/claude-code
```

**Shared environment file (/etc/claude-code/env.sh):**
```bash
# Source this in .bashrc for all developers
export ANTHROPIC_API_KEY="sk-ant-..."  # Team API key
export CLAUDE_CONFIG_DIR="/etc/claude-code"

# GitHub tokens for databayt repos
export GITHUB_TOKEN="ghp_..."

# Project paths
export DATABAYT_CODEBASE="/home/developer/repos/databayt/codebase"
```

**Developer .bashrc addition:**
```bash
# Load shared Claude Code config
if [ -f /etc/claude-code/env.sh ]; then
    source /etc/claude-code/env.sh
fi
```

### 3.3 Secrets Management with 1Password or Vault

**Option A: 1Password CLI**
```bash
# Install 1Password CLI
curl -sS https://downloads.1password.com/linux/keys/1password.asc | \
  sudo gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg

# Reference secrets without exposing them
export ANTHROPIC_API_KEY="op://Development/Claude-API/credential"
```

**Option B: HashiCorp Vault (for larger teams)**
```bash
# Install Vault
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt install vault

# Start dev server
vault server -dev

# Store and retrieve secrets
vault kv put secret/claude api_key="sk-ant-..."
export ANTHROPIC_API_KEY=$(vault kv get -field=api_key secret/claude)
```

### 3.4 GitHub Integration (databayt repos)

**Clone databayt/codebase with SSH:**
```bash
# Setup SSH key for GitHub
ssh-keygen -t ed25519 -C "developer@databayt.com"
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Add public key to GitHub

# Clone repos
mkdir -p ~/repos/databayt
cd ~/repos/databayt
git clone git@github.com:databayt/codebase.git
git clone git@github.com:databayt/mkan.git
```

**Shared Git Configuration:**
```bash
# /etc/gitconfig (system-wide)
[user]
    name = Databayt Team
    email = dev@databayt.com
[core]
    editor = vim
[init]
    defaultBranch = main
```

### 3.5 Databayt Codebase as Pattern Library

> "Every good function, every well-labeled type, every carefully enforced boundary is a breadcrumb the model will follow." - Craig Adam

The `databayt/codebase` repository serves as the **architectural source of truth** - the patterns Claude learns from.

**Directory Structure for Pattern Library:**
```
~/repos/databayt/codebase/
├── CLAUDE.md                    # Master context for all projects
├── patterns/
│   ├── nextjs/                  # Next.js patterns (App Router, RSC)
│   ├── prisma/                  # Database patterns
│   ├── auth/                    # Authentication patterns
│   ├── i18n/                    # Internationalization patterns
│   └── components/              # UI component patterns
├── templates/
│   ├── api-route.ts            # Template for API routes
│   ├── server-action.ts        # Template for server actions
│   └── component.tsx           # Template for React components
└── .claude/
    ├── commands/               # Shared slash commands
    └── settings.json           # Shared Claude settings
```

**Master CLAUDE.md for databayt/codebase:**
```markdown
# Databayt Codebase - Architectural Foundation

This repository contains the patterns and templates that define
how all databayt projects should be built.

## Core Principles
1. Architecture-first: Design systems, not just features
2. Type safety: Strict TypeScript, no `any`
3. Conventional commits: feat/fix/docs/refactor
4. PR workflow: No direct commits to main

## Pattern Usage
When building new features, reference patterns in this repo:
- API routes: See patterns/nextjs/api-routes/
- Database: See patterns/prisma/
- Components: See patterns/components/

## Anti-Patterns (DO NOT)
- No inline styles except for dynamic values
- No `console.log` in production code
- No hardcoded strings (use i18n)
- No God components (max 200 lines)
```

**Symlink Patterns to All Projects:**
```bash
# In each project (e.g., mkan), symlink shared commands
ln -s ~/repos/databayt/codebase/.claude/commands ~/.claude/commands

# Or copy and customize per project
cp -r ~/repos/databayt/codebase/.claude/commands ~/repos/mkan/.claude/
```

**Vercel Preview Deployments (for mkan):**
```bash
# Already configured in mkan via Vercel Git integration
# Every feature branch gets: https://mkan-git-[branch]-databayt.vercel.app

# Review on phone:
# 1. Push branch
# 2. Wait for Vercel deployment (< 2 min)
# 3. Open preview URL on phone
# 4. Comment on PR with feedback
```

---

## Phase 4: 24/7 Headless Server Setup

### 4.1 Headless Configuration

**Disable GUI (save resources):**
```bash
# Set default to multi-user (no GUI)
sudo systemctl set-default multi-user.target

# Disable display manager
sudo systemctl disable gdm  # or lightdm, sddm

# Reboot
sudo reboot
```

**Auto-login for developer user:**
```bash
# /etc/systemd/system/getty@tty1.service.d/override.conf
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin developer --noclear %I $TERM
```

### 4.2 Systemd Service for Claude Sessions

**Create service file (/etc/systemd/system/claude-tmux.service):**
```ini
[Unit]
Description=Claude Code tmux session
After=network.target

[Service]
Type=forking
User=developer
ExecStart=/usr/bin/tmux new-session -d -s claude-main
ExecStop=/usr/bin/tmux kill-session -t claude-main
Restart=always

[Install]
WantedBy=multi-user.target
```

**Enable service:**
```bash
sudo systemctl enable claude-tmux
sudo systemctl start claude-tmux
```

### 4.3 Monitoring & Health Checks

**Install monitoring stack:**
```bash
# Netdata for real-time monitoring
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at http://<tailscale-ip>:19999
```

**Health check script (/opt/scripts/health-check.sh):**
```bash
#!/bin/bash
WEBHOOK_URL="https://hooks.slack.com/services/..."

check_service() {
    if ! systemctl is-active --quiet $1; then
        curl -X POST -H 'Content-type: application/json' \
          --data "{\"text\":\"Service $1 is down on Claude Server\"}" \
          $WEBHOOK_URL
    fi
}

check_service tailscaled
check_service claude-tmux
```

---

## Phase 5: Solar + Starlink Off-Grid Setup

### 5.1 Power Consumption Analysis

| Component | Idle (W) | Active (W) | Daily (Wh) |
|-----------|----------|------------|------------|
| Linux Server (mini PC) | 15 | 65 | 800 |
| Starlink Mini | 20 | 40 | 720 |
| Router/Switch | 5 | 10 | 180 |
| UPS Overhead | 5 | 10 | 180 |
| **Total** | **45** | **125** | **~1900** |

### 5.2 Solar System Sizing

**For 24/7 operation with 2 days autonomy:**

```
Daily consumption: 1,900 Wh
2-day autonomy: 3,800 Wh battery capacity
Solar sizing (5 peak sun hours): 400-600W panels

Recommended Setup:
- 4x 200W monocrystalline panels (800W total)
- 5kWh LiFePO4 battery bank
- 60A MPPT charge controller
- 2000W pure sine wave inverter
```

### 5.3 Starlink Configuration

**Starlink Mini Setup (recommended for low power):**
```
- Power: 20-40W average
- Speed: 50-200 Mbps
- Latency: 25-50ms
- Monthly: ~$120/month
```

**Network Configuration:**
```bash
# Static IP assignment in Starlink router
# Set server to static IP on local network

# Tailscale handles external connectivity
sudo tailscale up --accept-dns=false  # Use local DNS
```

### 5.4 Physical Installation Checklist

- [ ] Weatherproof enclosure (IP65+) for server
- [ ] Ventilation/cooling system
- [ ] Lightning protection for Starlink dish
- [ ] Battery temperature monitoring
- [ ] Surge protection on all circuits
- [ ] Remote power cycling capability (smart PDU)

---

## Phase 6: Developer Rental Platform (Future Vision)

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Databayt Compute Cloud                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Server 1 │    │ Server 2 │    │ Server N │              │
│  │ Solar+SL │    │ Solar+SL │    │ Solar+SL │              │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘              │
│       │               │               │                     │
│       └───────────────┴───────────────┘                     │
│                       │                                      │
│              ┌────────┴────────┐                            │
│              │ Tailscale Mesh  │                            │
│              └────────┬────────┘                            │
│                       │                                      │
│              ┌────────┴────────┐                            │
│              │  API Gateway    │                            │
│              │  (Usage Meter)  │                            │
│              └────────┬────────┘                            │
│                       │                                      │
└───────────────────────┴─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Developer A     Developer B     Developer C
```

### 6.2 Usage-Based Billing Model

**Pricing Tiers:**
```yaml
tiers:
  hobby:
    compute_hour: $0.05
    claude_token_1k: $0.002
    storage_gb_month: $0.10
    max_concurrent_sessions: 1

  professional:
    compute_hour: $0.03  # Volume discount
    claude_token_1k: $0.0015
    storage_gb_month: $0.05
    max_concurrent_sessions: 5
    priority_support: true

  team:
    compute_hour: $0.02
    claude_token_1k: $0.001
    storage_gb_month: $0.03
    max_concurrent_sessions: unlimited
    dedicated_resources: true
```

### 6.3 Billing Integration

**Recommended Platform: [Stripe Usage Billing](https://stripe.com/docs/billing/subscriptions/usage-based)**

```javascript
// Track usage
const stripe = require('stripe')('sk_...');

// Record compute time
await stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId,
  {
    quantity: computeMinutes,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment'
  }
);
```

### 6.4 Session Isolation & Security

**Docker-based isolation per developer:**
```dockerfile
# Dockerfile for isolated dev environment
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    nodejs npm git tmux \
    && npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN useradd -m developer
USER developer
WORKDIR /home/developer

CMD ["tmux", "new-session", "-s", "main"]
```

**Kubernetes deployment (scale):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dev-session-${USER_ID}
spec:
  containers:
  - name: claude-env
    image: databayt/claude-dev:latest
    resources:
      limits:
        cpu: "2"
        memory: "4Gi"
```

---

## Implementation Timeline (Full Team Setup Priority)

### Day 1: Core Infrastructure
- [ ] Update Ubuntu, install dependencies (Node.js, tmux, SSH)
- [ ] Install and authenticate Claude Code
- [ ] Install Tailscale, get machine online
- [ ] Test SSH access via Tailscale IP
- [ ] Create tmux session with mouse support

### Day 2: Mobile Access Verification
- [ ] Install Tailscale on phone
- [ ] Install Termius on phone
- [ ] Test full workflow: phone -> Tailscale -> SSH -> tmux -> Claude Code
- [ ] Verify mouse scrolling works in tmux

### Day 3-4: Team Access & Secrets
- [ ] Invite team members to Tailscale network
- [ ] Configure Tailscale ACLs for access control
- [ ] Setup shared environment file (/etc/claude-code/env.sh)
- [ ] Configure secrets management (1Password CLI or Vault)
- [ ] Test team member access from their devices

### Day 5-6: GitHub & Patterns Integration
- [ ] Setup SSH key for GitHub
- [ ] Clone databayt/codebase and mkan repos
- [ ] Create/configure shared CLAUDE.md in codebase repo
- [ ] Setup custom slash commands (/spec, /plan, /ship)
- [ ] Configure Git safety rails (protected branches)
- [ ] Test end-to-end: idea -> spec -> plan -> PR

### Day 7: Reliability & Persistence
- [ ] Create systemd service for auto-start tmux session
- [ ] Setup Netdata monitoring
- [ ] Configure health check scripts
- [ ] Test persistence: reboot server, verify sessions survive
- [ ] Document runbook for team

### Future Phases (When Ready)
**Month 2-3: Off-Grid Setup**
- [ ] Source solar components (800W panels, 5kWh battery)
- [ ] Install Starlink Mini
- [ ] Configure weatherproof enclosure
- [ ] Test 48-hour autonomy

**Month 4+: Rental Platform**
- [ ] Build API gateway with session isolation
- [ ] Implement usage metering (Stripe)
- [ ] Launch beta program

---

## Critical Files to Reference

| Purpose | Path |
|---------|------|
| Project config | `/home/developer/repos/mkan/CLAUDE.md` |
| Tailscale ACLs | `https://login.tailscale.com/admin/acls` |
| tmux config | `~/.tmux.conf` |
| Shared env | `/etc/claude-code/env.sh` |
| Systemd service | `/etc/systemd/system/claude-tmux.service` |
| Health checks | `/opt/scripts/health-check.sh` |

---

## Verification Steps

1. **Remote Access Test:**
   ```bash
   # From phone (Termius) or laptop
   ssh <tailscale-ip>
   tmux attach -t claude-main
   claude --version
   ```

2. **Team Access Test:**
   - Have team member join Tailscale network
   - Verify they can SSH and attach to sessions

3. **Persistence Test:**
   - Start Claude session, disconnect
   - Reconnect after 24 hours, verify session intact

4. **Solar Test (if applicable):**
   - Monitor battery levels over 48 hours
   - Verify server stays online through night

---

## Quick-Start Commands (Copy-Paste Ready)

### On Linux Server (Ubuntu 22.04/24.04)
```bash
# 1. Update and install everything
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget tmux htop build-essential openssh-server
sudo systemctl enable ssh && sudo systemctl start ssh

# 2. Install Node.js and Claude Code
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm @anthropic-ai/claude-code

# 3. Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh

# 4. Get your Tailscale IP (share with team)
tailscale ip -4

# 5. Configure tmux for mobile
echo 'set -g mouse on' >> ~/.tmux.conf
echo 'set -g history-limit 50000' >> ~/.tmux.conf

# 6. Create persistent Claude session
tmux new-session -d -s claude -n claude
tmux send-keys -t claude:claude 'claude' Enter

# 7. Verify it's running
tmux list-sessions
```

### On Phone (iOS/Android)
```
1. Download Tailscale from app store
2. Sign in with same Tailscale account
3. Download Termius from app store
4. Create new host:
   - Hostname: [your tailscale IP from step 4]
   - Port: 22
   - Username: [your linux username]
5. Connect and run: tmux attach -t claude
```

### Daily Workflow
```bash
# Connect from anywhere
ssh [tailscale-ip]
tmux attach -t claude

# Start new feature
/spec "Add dark mode toggle to settings page"
# Review spec, then:
/plan
# Review plan, approve, then Claude builds
/ship
# Get PR URL, review on Vercel preview
```

---

## Sources & References

- [Tailscale SSH Documentation](https://tailscale.com/kb/1193/tailscale-ssh)
- [Tailscale for Teams](https://tailscale.com/learn/remote-access-for-remote-teams-securely-connecting-distributed-workforces-with-ss)
- [How to Run Claude Code from iPhone (Pete Sena)](https://petesena.medium.com/how-to-run-claude-code-from-your-iphone-using-tailscale-termius-and-tmux-2e16d0e5f68b)
- [Agile is Out, Architecture is Back (Craig Adam)](https://medium.com/@craig_32726/agile-is-out-architecture-is-back-7586910ab810)
- [Starlink Mini Solar Power](https://www.ecoflow.com/us/blog/starlink-mini-power-consumption)
- [Solar Power for Starlink Guide](https://dishycentral.com/solar-power-for-starlink)
- [Usage-Based Billing for AI](https://flexprice.io/blog/best-open-source-usage-based-billing-platform-for-an-ai-startup-(2025-guide))
- [AI-Driven Development Life Cycle (AWS)](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)
