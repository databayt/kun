# Epics and Stories: Kun (كن)
## Remote AI Development Infrastructure

> **BMAD Phase**: Planning (Story Breakdown)
> **Version**: 1.0
> **Date**: 2026-01-10
> **Total Stories**: 42

---

## Epic Overview

| Epic | Phase | Stories | Priority |
|------|-------|---------|----------|
| E1: Server Preparation | 1 | 6 | P0 |
| E2: Tailscale VPN | 1 | 4 | P0 |
| E3: tmux Configuration | 1 | 5 | P0 |
| E4: Mobile Access | 1 | 4 | P0 |
| E5: Pattern Library | 1 | 4 | P1 |
| E6: Team Accounts | 2 | 4 | P0 |
| E7: Tailscale ACLs | 2 | 4 | P0 |
| E8: Secrets Management | 2 | 5 | P0 |
| E9: Systemd Services | 2 | 4 | P1 |
| E10: Monitoring | 2 | 4 | P1 |
| E11: Container Isolation | 3 | 5 | P0 |
| E12: Usage Billing | 3 | 5 | P0 |

---

## Phase 1: Individual Setup

### Epic 1: Server Preparation

**Epic Description**: Prepare a Linux server with all required dependencies for running Claude Code remotely.

---

#### Story 1.1: System Update and Base Packages

**As a** developer
**I want** an updated Ubuntu system with essential tools
**So that** I have a stable foundation for development

**Acceptance Criteria**:
- [ ] Ubuntu 22.04 or 24.04 LTS installed
- [ ] System fully updated (`apt update && apt upgrade`)
- [ ] Essential packages installed (git, curl, wget, htop, build-essential)
- [ ] System rebooted and stable

**Tasks**:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget tmux htop build-essential
sudo reboot
```

**Story Points**: 1
**Priority**: P0

---

#### Story 1.2: SSH Server Configuration

**As a** developer
**I want** SSH enabled and configured securely
**So that** I can connect remotely

**Acceptance Criteria**:
- [ ] openssh-server installed
- [ ] SSH service enabled at boot
- [ ] SSH service running
- [ ] Connection test successful

**Tasks**:
```bash
sudo apt install -y openssh-server
sudo systemctl enable ssh
sudo systemctl start ssh
sudo systemctl status ssh
```

**Story Points**: 1
**Priority**: P0

---

#### Story 1.3: Node.js 20.x Installation

**As a** developer
**I want** Node.js 20.x LTS installed
**So that** I can run Claude Code

**Acceptance Criteria**:
- [ ] NodeSource repository added
- [ ] Node.js 20.x installed
- [ ] `node --version` returns 20.x
- [ ] npm functional

**Tasks**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

**Story Points**: 1
**Priority**: P0

---

#### Story 1.4: pnpm Installation

**As a** developer
**I want** pnpm installed globally
**So that** I can use the standard package manager

**Acceptance Criteria**:
- [ ] pnpm installed via npm
- [ ] `pnpm --version` works
- [ ] pnpm accessible from any directory

**Tasks**:
```bash
npm install -g pnpm
pnpm --version
```

**Story Points**: 1
**Priority**: P0

---

#### Story 1.5: Claude Code Installation

**As a** developer
**I want** Claude Code CLI installed
**So that** I can use AI-assisted development

**Acceptance Criteria**:
- [ ] Claude Code installed globally
- [ ] `claude --version` works
- [ ] Claude can be authenticated

**Tasks**:
```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude auth
```

**Story Points**: 1
**Priority**: P0

---

#### Story 1.6: tmux Installation

**As a** developer
**I want** tmux installed
**So that** I can have persistent terminal sessions

**Acceptance Criteria**:
- [ ] tmux installed
- [ ] `tmux -V` returns version
- [ ] Can create and attach to sessions

**Tasks**:
```bash
sudo apt install -y tmux
tmux -V
tmux new-session -d -s test
tmux attach -t test
```

**Story Points**: 1
**Priority**: P0

---

### Epic 2: Tailscale VPN

**Epic Description**: Set up Tailscale for secure remote access without port forwarding.

---

#### Story 2.1: Tailscale Installation

**As a** developer
**I want** Tailscale installed
**So that** I can create a secure VPN connection

**Acceptance Criteria**:
- [ ] Tailscale installed from official script
- [ ] `tailscale --version` works
- [ ] tailscaled service running

**Tasks**:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale --version
systemctl status tailscaled
```

**Story Points**: 1
**Priority**: P0

---

#### Story 2.2: Tailscale Authentication

**As a** developer
**I want** the server connected to my Tailscale network
**So that** my devices can reach it

**Acceptance Criteria**:
- [ ] Server authenticated to Tailscale
- [ ] Device visible in Tailscale admin console
- [ ] Tailscale IP assigned

**Tasks**:
```bash
sudo tailscale up
# Follow browser authentication
tailscale status
```

**Story Points**: 1
**Priority**: P0

---

#### Story 2.3: Tailscale SSH Enable

**As a** developer
**I want** Tailscale SSH enabled
**So that** I don't need to manage SSH keys

**Acceptance Criteria**:
- [ ] Tailscale SSH feature enabled
- [ ] Can SSH via Tailscale without password/key
- [ ] SSH works using Tailscale hostname

**Tasks**:
```bash
sudo tailscale up --ssh
# Test from another device:
# ssh <tailscale-hostname>
```

**Story Points**: 1
**Priority**: P0

---

#### Story 2.4: Document Tailscale IP

**As a** developer
**I want** the Tailscale IP documented
**So that** I can connect from any device

**Acceptance Criteria**:
- [ ] IPv4 address obtained
- [ ] IPv6 address obtained (if applicable)
- [ ] Hostname documented
- [ ] Information saved to project notes

**Tasks**:
```bash
tailscale ip -4
tailscale ip -6
tailscale status
```

**Story Points**: 1
**Priority**: P0

---

### Epic 3: tmux Configuration

**Epic Description**: Configure tmux for optimal mobile experience with persistent sessions.

---

#### Story 3.1: tmux Mouse Support

**As a** developer
**I want** mouse support in tmux
**So that** I can scroll on mobile devices

**Acceptance Criteria**:
- [ ] Mouse mode enabled in ~/.tmux.conf
- [ ] Scrolling works in terminal
- [ ] Click-to-select works

**Tasks**:
```bash
echo 'set -g mouse on' >> ~/.tmux.conf
tmux source-file ~/.tmux.conf
```

**Story Points**: 1
**Priority**: P0

---

#### Story 3.2: tmux History Configuration

**As a** developer
**I want** extended scrollback history
**So that** I can review past output

**Acceptance Criteria**:
- [ ] History limit set to 50000 lines
- [ ] Configuration persisted
- [ ] Can scroll back through long history

**Tasks**:
```bash
echo 'set -g history-limit 50000' >> ~/.tmux.conf
tmux source-file ~/.tmux.conf
```

**Story Points**: 1
**Priority**: P1

---

#### Story 3.3: tmux Status Bar

**As a** developer
**I want** a useful status bar
**So that** I know which session/window I'm in

**Acceptance Criteria**:
- [ ] Session name visible
- [ ] Current time visible
- [ ] Colors configured for readability

**Tasks**:
```bash
cat >> ~/.tmux.conf << 'EOF'
set -g status-bg colour235
set -g status-fg white
set -g status-left '[#S] '
set -g status-right '%Y-%m-%d %H:%M'
EOF
tmux source-file ~/.tmux.conf
```

**Story Points**: 1
**Priority**: P2

---

#### Story 3.4: tmux Key Bindings

**As a** developer
**I want** convenient key bindings
**So that** I can split windows easily

**Acceptance Criteria**:
- [ ] `|` splits horizontally
- [ ] `-` splits vertically
- [ ] `r` reloads config

**Tasks**:
```bash
cat >> ~/.tmux.conf << 'EOF'
bind | split-window -h
bind - split-window -v
bind r source-file ~/.tmux.conf \; display "Reloaded!"
EOF
```

**Story Points**: 1
**Priority**: P2

---

#### Story 3.5: Create Claude Session

**As a** developer
**I want** a dedicated tmux session for Claude
**So that** I have a consistent workspace

**Acceptance Criteria**:
- [ ] Session named "claude" created
- [ ] Window named "claude" for Claude Code
- [ ] Second window "server" for other tasks
- [ ] Session persists across disconnects

**Tasks**:
```bash
tmux new-session -d -s claude -n claude
tmux new-window -t claude -n server
tmux send-keys -t claude:claude 'claude' Enter
tmux list-sessions
```

**Story Points**: 1
**Priority**: P0

---

### Epic 4: Mobile Access

**Epic Description**: Configure mobile access via Termius for on-the-go development.

---

#### Story 4.1: Phone Tailscale Setup

**As a** developer
**I want** Tailscale on my phone
**So that** I can access the VPN network

**Acceptance Criteria**:
- [ ] Tailscale app installed
- [ ] Logged into same account as server
- [ ] Phone visible in Tailscale admin
- [ ] VPN connected

**Tasks**:
1. Install Tailscale from App Store / Play Store
2. Sign in with same account
3. Enable VPN connection
4. Verify connection in admin console

**Story Points**: 1
**Priority**: P0

---

#### Story 4.2: Termius Installation

**As a** developer
**I want** Termius installed
**So that** I can SSH from my phone

**Acceptance Criteria**:
- [ ] Termius app installed
- [ ] Account created (optional)
- [ ] App opens successfully

**Tasks**:
1. Install Termius from App Store / Play Store
2. Create account (for sync) or skip

**Story Points**: 1
**Priority**: P0

---

#### Story 4.3: Termius Host Configuration

**As a** developer
**I want** the server configured in Termius
**So that** I can connect with one tap

**Acceptance Criteria**:
- [ ] Host created with Tailscale IP
- [ ] Port set to 22
- [ ] Username configured
- [ ] Connection test successful

**Configuration**:
- Label: `Kun Server`
- Hostname: `[tailscale-ip]`
- Port: `22`
- Username: `[your-username]`

**Story Points**: 1
**Priority**: P0

---

#### Story 4.4: Mobile Workflow Verification

**As a** developer
**I want** to verify the complete mobile workflow
**So that** I can confidently develop on the go

**Acceptance Criteria**:
- [ ] Connect from Termius succeeds
- [ ] `tmux attach -t claude` works
- [ ] Can type commands
- [ ] Can scroll output
- [ ] Session survives app background

**Test Script**:
```bash
# From Termius:
tmux attach -t claude
# Type a command
ls -la
# Scroll up and down
# Press home button
# Reopen Termius
# Session should still be attached
```

**Story Points**: 1
**Priority**: P0

---

### Epic 5: Pattern Library

**Epic Description**: Integrate the databayt/codebase pattern library for consistent development.

---

#### Story 5.1: GitHub SSH Key Setup

**As a** developer
**I want** SSH access to GitHub
**So that** I can clone private repositories

**Acceptance Criteria**:
- [ ] ED25519 key generated
- [ ] Key added to ssh-agent
- [ ] Public key added to GitHub
- [ ] `ssh -T git@github.com` succeeds

**Tasks**:
```bash
ssh-keygen -t ed25519 -C "developer@databayt.com"
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
# Add to GitHub: Settings > SSH Keys
ssh -T git@github.com
```

**Story Points**: 1
**Priority**: P1

---

#### Story 5.2: Clone Pattern Library

**As a** developer
**I want** databayt/codebase cloned locally
**So that** Claude can reference patterns

**Acceptance Criteria**:
- [ ] Repository cloned to ~/repos/databayt/codebase
- [ ] All files accessible
- [ ] Can pull updates

**Tasks**:
```bash
mkdir -p ~/repos/databayt
cd ~/repos/databayt
git clone git@github.com:databayt/codebase.git
ls codebase/
```

**Story Points**: 1
**Priority**: P1

---

#### Story 5.3: Link Custom Commands

**As a** developer
**I want** Claude custom commands available
**So that** I can use /spec, /plan, /ship

**Acceptance Criteria**:
- [ ] Commands directory symlinked
- [ ] /spec command available
- [ ] /plan command available
- [ ] /ship command available

**Tasks**:
```bash
mkdir -p ~/.claude
ln -s ~/repos/databayt/codebase/.claude/commands ~/.claude/commands
ls ~/.claude/commands/
```

**Story Points**: 1
**Priority**: P2

---

#### Story 5.4: Configure CLAUDE.md

**As a** developer
**I want** a local CLAUDE.md referencing patterns
**So that** Claude knows our architecture

**Acceptance Criteria**:
- [ ] ~/.claude/CLAUDE.md created
- [ ] References pattern library
- [ ] Includes project conventions

**Tasks**:
```bash
cat > ~/.claude/CLAUDE.md << 'EOF'
# Kun Development Context

## Pattern Library
Reference patterns at: ~/repos/databayt/codebase/

## Architecture
- Mirror-pattern: URL routes mirror component directories
- Component hierarchy: UI → Atoms → Templates → Blocks
- File patterns: content.tsx, actions.ts, config.ts, validation.ts

## Agents
Use specialized agents from codebase/.claude/agents/ for domain work.
EOF
```

**Story Points**: 1
**Priority**: P2

---

## Phase 2: Team Server

### Epic 6: Team Accounts

**Epic Description**: Create user accounts for all team members with proper permissions.

---

#### Story 6.1: Create Developers Group

**As a** sysadmin
**I want** a developers group
**So that** shared resources can be managed

**Acceptance Criteria**:
- [ ] Group "developers" created
- [ ] GID assigned
- [ ] Group visible in /etc/group

**Tasks**:
```bash
sudo groupadd developers
grep developers /etc/group
```

**Story Points**: 1
**Priority**: P0

---

#### Story 6.2: Create User Accounts

**As a** sysadmin
**I want** individual accounts for each developer
**So that** access is personalized and auditable

**Acceptance Criteria**:
- [ ] 10+ user accounts created
- [ ] Users in developers group
- [ ] Home directories created
- [ ] bash shell set

**Tasks**:
```bash
# For each developer:
sudo useradd -m -G developers -s /bin/bash dev1
sudo useradd -m -G developers -s /bin/bash dev2
# ... etc
```

**Story Points**: 2
**Priority**: P0

---

#### Story 6.3: Configure Shell Environment

**As a** developer
**I want** a properly configured shell
**So that** shared config is loaded

**Acceptance Criteria**:
- [ ] .bashrc sources shared env.sh
- [ ] PATH includes npm globals
- [ ] Prompt shows username@host

**Tasks**:
```bash
# Add to /etc/skel/.bashrc (for new users)
cat >> /etc/skel/.bashrc << 'EOF'
if [ -f /etc/claude-code/env.sh ]; then
    source /etc/claude-code/env.sh
fi
EOF
```

**Story Points**: 1
**Priority**: P1

---

#### Story 6.4: Shared Directory Setup

**As a** sysadmin
**I want** shared directories accessible to all developers
**So that** patterns and configs are shared

**Acceptance Criteria**:
- [ ] /opt/databayt owned by root:developers
- [ ] Permissions set to 755
- [ ] Developers can read but not write

**Tasks**:
```bash
sudo mkdir -p /opt/databayt
sudo chown root:developers /opt/databayt
sudo chmod 755 /opt/databayt
```

**Story Points**: 1
**Priority**: P0

---

### Epic 7: Tailscale ACLs

**Epic Description**: Configure Tailscale access control for team security.

---

#### Story 7.1: Define Admin Group

**As a** sysadmin
**I want** an admin group with full access
**So that** administrators can manage the server

**Acceptance Criteria**:
- [ ] group:admins defined in ACL
- [ ] Admin emails listed
- [ ] Admins have "*:*" access

**ACL Snippet**:
```json
{
  "groups": {
    "group:admins": ["admin@databayt.com"]
  },
  "acls": [
    {"action": "accept", "src": ["group:admins"], "dst": ["*:*"]}
  ]
}
```

**Story Points**: 1
**Priority**: P0

---

#### Story 7.2: Define Developer Group

**As a** sysadmin
**I want** a developer group with SSH-only access
**So that** developers have limited but sufficient access

**Acceptance Criteria**:
- [ ] group:developers defined
- [ ] Developer emails listed
- [ ] Access limited to port 22

**ACL Snippet**:
```json
{
  "groups": {
    "group:developers": ["dev1@databayt.com", "dev2@databayt.com"]
  },
  "acls": [
    {"action": "accept", "src": ["group:developers"], "dst": ["tag:kun-server:22"]}
  ]
}
```

**Story Points**: 1
**Priority**: P0

---

#### Story 7.3: Apply Server Tag

**As a** sysadmin
**I want** the server tagged as kun-server
**So that** ACLs can target it specifically

**Acceptance Criteria**:
- [ ] tag:kun-server defined
- [ ] Tag applied to server
- [ ] Tag visible in Tailscale admin

**Tasks**:
```bash
# In Tailscale admin, apply tag to machine
# Or via CLI:
sudo tailscale up --ssh --advertise-tags=tag:kun-server
```

**Story Points**: 1
**Priority**: P0

---

#### Story 7.4: Configure SSH ACLs

**As a** sysadmin
**I want** SSH access scoped per group
**So that** users can only access appropriate accounts

**Acceptance Criteria**:
- [ ] Admins can SSH as any user
- [ ] Developers can SSH as own user only
- [ ] Root access restricted to admins

**ACL Snippet**:
```json
{
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

**Story Points**: 1
**Priority**: P0

---

### Epic 8: Secrets Management

**Epic Description**: Centralize secrets for team access without per-user configuration.

---

#### Story 8.1: Create Config Directory

**As a** sysadmin
**I want** /etc/claude-code directory
**So that** shared configuration has a home

**Acceptance Criteria**:
- [ ] Directory created
- [ ] Permissions set correctly
- [ ] Accessible by developers

**Tasks**:
```bash
sudo mkdir -p /etc/claude-code
sudo chmod 755 /etc/claude-code
```

**Story Points**: 1
**Priority**: P0

---

#### Story 8.2: Create Environment File

**As a** sysadmin
**I want** env.sh with shared variables
**So that** all users have access to secrets

**Acceptance Criteria**:
- [ ] env.sh created
- [ ] ANTHROPIC_API_KEY defined
- [ ] GITHUB_TOKEN defined
- [ ] File permissions 644

**Tasks**:
```bash
sudo cat > /etc/claude-code/env.sh << 'EOF'
# Kun Shared Environment
export ANTHROPIC_API_KEY="sk-ant-..."
export GITHUB_TOKEN="ghp_..."
export DATABAYT_CODEBASE="/opt/databayt/codebase"
EOF
sudo chmod 644 /etc/claude-code/env.sh
```

**Story Points**: 1
**Priority**: P0

---

#### Story 8.3: Global CLAUDE.md

**As a** developer
**I want** a team-wide CLAUDE.md
**So that** all Claude sessions share context

**Acceptance Criteria**:
- [ ] /etc/claude-code/CLAUDE.md created
- [ ] Team conventions documented
- [ ] Pattern library referenced

**Tasks**:
```bash
sudo cat > /etc/claude-code/CLAUDE.md << 'EOF'
# Kun Team Context

## Pattern Library
/opt/databayt/codebase/ - Reference for all patterns

## Conventions
- Mirror-pattern architecture
- Strict TypeScript
- Conventional commits
- PR workflow (no direct to main)

## Anti-Patterns
- No inline styles
- No console.log in production
- No hardcoded strings
EOF
```

**Story Points**: 1
**Priority**: P0

---

#### Story 8.4: 1Password CLI Setup

**As a** sysadmin
**I want** 1Password CLI configured
**So that** secrets can be rotated without user changes

**Acceptance Criteria**:
- [ ] 1Password CLI installed
- [ ] Service account configured
- [ ] op:// references working

**Tasks**:
```bash
# Install 1Password CLI
curl -sS https://downloads.1password.com/linux/keys/1password.asc | \
  sudo gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg
# Configure service account
op account add
```

**Story Points**: 2
**Priority**: P2

---

#### Story 8.5: Clone Pattern Library to /opt

**As a** sysadmin
**I want** pattern library in /opt/databayt
**So that** all users can reference it

**Acceptance Criteria**:
- [ ] Repository cloned
- [ ] Owned by root:developers
- [ ] Read-only for developers

**Tasks**:
```bash
sudo git clone git@github.com:databayt/codebase.git /opt/databayt/codebase
sudo chown -R root:developers /opt/databayt/codebase
sudo chmod -R 755 /opt/databayt/codebase
```

**Story Points**: 1
**Priority**: P0

---

### Epic 9: Systemd Services

**Epic Description**: Configure auto-start services for reliability.

---

#### Story 9.1: Create tmux Service

**As a** sysadmin
**I want** tmux sessions auto-created on boot
**So that** sessions are always available

**Acceptance Criteria**:
- [ ] Service file created
- [ ] Service starts on boot
- [ ] Service creates claude session

**Tasks**:
```bash
sudo cat > /etc/systemd/system/claude-tmux.service << 'EOF'
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
EOF
```

**Story Points**: 1
**Priority**: P1

---

#### Story 9.2: Enable Service

**As a** sysadmin
**I want** the service enabled at boot
**So that** it starts automatically

**Acceptance Criteria**:
- [ ] Service enabled
- [ ] Service started
- [ ] Service status healthy

**Tasks**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable claude-tmux
sudo systemctl start claude-tmux
sudo systemctl status claude-tmux
```

**Story Points**: 1
**Priority**: P1

---

#### Story 9.3: Configure Restart Policy

**As a** sysadmin
**I want** services to restart on failure
**So that** they self-heal

**Acceptance Criteria**:
- [ ] Restart=always configured
- [ ] RestartSec delay set
- [ ] Service recovers after simulated failure

**Story Points**: 1
**Priority**: P1

---

#### Story 9.4: Journald Logging

**As a** sysadmin
**I want** service logs in journald
**So that** I can debug issues

**Acceptance Criteria**:
- [ ] Logs visible via journalctl
- [ ] Logs include service name
- [ ] Can filter by time

**Tasks**:
```bash
journalctl -u claude-tmux.service
journalctl -u claude-tmux.service --since "1 hour ago"
```

**Story Points**: 1
**Priority**: P2

---

### Epic 10: Monitoring

**Epic Description**: Set up monitoring and alerting for server health.

---

#### Story 10.1: Install Netdata

**As a** sysadmin
**I want** Netdata installed
**So that** I can monitor server metrics

**Acceptance Criteria**:
- [ ] Netdata installed
- [ ] Dashboard at port 19999
- [ ] CPU/memory/disk visible

**Tasks**:
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
# Access at http://[tailscale-ip]:19999
```

**Story Points**: 1
**Priority**: P1

---

#### Story 10.2: Create Health Check Script

**As a** sysadmin
**I want** automated health checks
**So that** issues are detected quickly

**Acceptance Criteria**:
- [ ] Script created in /opt/scripts/
- [ ] Checks critical services
- [ ] Returns non-zero on failure

**Tasks**:
```bash
sudo mkdir -p /opt/scripts
sudo cat > /opt/scripts/health-check.sh << 'EOF'
#!/bin/bash
check_service() {
    systemctl is-active --quiet $1 || exit 1
}
check_service tailscaled
check_service ssh
check_service claude-tmux
echo "All services healthy"
EOF
sudo chmod +x /opt/scripts/health-check.sh
```

**Story Points**: 1
**Priority**: P1

---

#### Story 10.3: Configure Slack Alerts

**As a** sysadmin
**I want** Slack notifications on failure
**So that** I'm alerted to issues

**Acceptance Criteria**:
- [ ] Webhook URL configured
- [ ] Alerts sent on service failure
- [ ] Alerts include service name

**Tasks**:
```bash
# Add to health-check.sh:
WEBHOOK_URL="https://hooks.slack.com/services/..."
alert() {
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"[KUN] $1\"}" $WEBHOOK_URL
}
```

**Story Points**: 1
**Priority**: P2

---

#### Story 10.4: Cron Job Setup

**As a** sysadmin
**I want** health checks running every 5 minutes
**So that** issues are caught quickly

**Acceptance Criteria**:
- [ ] Cron job created
- [ ] Runs every 5 minutes
- [ ] Errors logged

**Tasks**:
```bash
sudo crontab -e
# Add:
*/5 * * * * /opt/scripts/health-check.sh >> /var/log/kun-health.log 2>&1
```

**Story Points**: 1
**Priority**: P1

---

## Phase 3: Commercial Platform

### Epic 11: Container Isolation

**Epic Description**: Implement Docker-based isolation for external users.

---

#### Story 11.1: Create Dockerfile

**As a** platform operator
**I want** a Docker image for user environments
**So that** users are isolated

**Acceptance Criteria**:
- [ ] Dockerfile created
- [ ] Image builds successfully
- [ ] Claude Code works in container

**Dockerfile**:
```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    nodejs npm git tmux curl \
    && npm install -g @anthropic-ai/claude-code pnpm

RUN useradd -m developer
USER developer
WORKDIR /home/developer

CMD ["tmux", "new-session", "-s", "main"]
```

**Story Points**: 2
**Priority**: P0

---

#### Story 11.2: Container Resource Limits

**As a** platform operator
**I want** resource limits per container
**So that** one user can't impact others

**Acceptance Criteria**:
- [ ] CPU limit: 2 cores
- [ ] Memory limit: 4GB
- [ ] Limits enforced

**Story Points**: 1
**Priority**: P0

---

#### Story 11.3: Network Isolation

**As a** platform operator
**I want** containers isolated from each other
**So that** users can't access other users' data

**Acceptance Criteria**:
- [ ] Containers in separate networks
- [ ] Cannot ping between containers
- [ ] External access only via gateway

**Story Points**: 2
**Priority**: P0

---

#### Story 11.4: Persistent Volumes

**As a** user
**I want** my data to persist across restarts
**So that** I don't lose work

**Acceptance Criteria**:
- [ ] /home/developer mounted as volume
- [ ] Data survives container restart
- [ ] Data isolated per user

**Story Points**: 1
**Priority**: P0

---

#### Story 11.5: Container Orchestration

**As a** platform operator
**I want** orchestrated container management
**So that** scaling is automated

**Acceptance Criteria**:
- [ ] Docker Compose or Kubernetes configured
- [ ] Containers start on demand
- [ ] Auto-cleanup of idle containers

**Story Points**: 3
**Priority**: P1

---

### Epic 12: Usage Billing

**Epic Description**: Implement usage-based billing via Stripe.

---

#### Story 12.1: Usage Metrics Collection

**As a** platform operator
**I want** to track usage metrics
**So that** I can bill accurately

**Metrics**:
- compute_minutes
- claude_tokens
- storage_gb

**Acceptance Criteria**:
- [ ] Metrics collected per user
- [ ] Stored in PostgreSQL
- [ ] Queryable via API

**Story Points**: 3
**Priority**: P0

---

#### Story 12.2: Stripe Integration

**As a** platform operator
**I want** Stripe configured for billing
**So that** payments are automated

**Acceptance Criteria**:
- [ ] Stripe SDK installed
- [ ] Products created in Stripe
- [ ] Webhook endpoint configured

**Story Points**: 2
**Priority**: P0

---

#### Story 12.3: Usage-Based Products

**As a** platform operator
**I want** metered billing products
**So that** users pay for what they use

**Tiers**:
```yaml
hobby:
  compute_hour: $0.05
  claude_token_1k: $0.002

professional:
  compute_hour: $0.03
  claude_token_1k: $0.0015
```

**Story Points**: 2
**Priority**: P0

---

#### Story 12.4: Meter Readings

**As a** platform operator
**I want** usage sent to Stripe
**So that** invoices are generated

**Acceptance Criteria**:
- [ ] Usage synced hourly
- [ ] Stripe subscription updated
- [ ] Dashboard shows usage

**Story Points**: 2
**Priority**: P0

---

#### Story 12.5: Invoice Automation

**As a** user
**I want** automatic invoices
**So that** billing is hands-off

**Acceptance Criteria**:
- [ ] Monthly invoices generated
- [ ] Email sent to user
- [ ] Failed payment retry

**Story Points**: 2
**Priority**: P0

---

## Story Summary by Phase

| Phase | Total Stories | P0 | P1 | P2 |
|-------|---------------|----|----|----|
| Phase 1 | 23 | 16 | 4 | 3 |
| Phase 2 | 17 | 10 | 5 | 2 |
| Phase 3 | 10 | 7 | 2 | 1 |
| **Total** | **50** | **33** | **11** | **6** |

---

## Sprint Planning Suggestion

### Sprint 1 (Days 1-7): Phase 1 Complete
- All Epic 1-5 stories
- Goal: Individual developer can use Claude Code from phone

### Sprint 2 (Days 8-14): Phase 2 Foundation
- Epic 6 + Epic 7 + Epic 8 stories
- Goal: Team accounts and security configured

### Sprint 3 (Days 15-21): Phase 2 Complete
- Epic 9 + Epic 10 stories
- Goal: Services auto-start, monitoring active

### Sprint 4-6 (Month 2): Phase 3 MVP
- Epic 11 + Epic 12 stories
- Goal: First external users billed successfully
