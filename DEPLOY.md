# Kun Deployment Guide

> كن (Kun) - "Be!" - Remote AI Development Infrastructure

---

## Quick Start

### Phase 1: Individual Setup (15 minutes)

On your Linux server:

```bash
# Clone the repository
git clone https://github.com/databayt/kun.git
cd kun

# Run Phase 1 setup
bash scripts/phase1/setup.sh

# Install pattern library (optional)
bash scripts/phase1/install-patterns.sh
```

### Mobile Connection

1. Install **Tailscale** on your phone (App Store / Play Store)
2. Install **Termius** on your phone
3. Configure Termius:
   - Host: `[your-tailscale-ip]`
   - Port: `22`
   - Username: `[your-username]`
4. Connect and run: `tmux attach -t claude`

---

## Phase 1: Individual Setup

### Prerequisites

- Ubuntu 22.04 or 24.04 LTS
- 16GB+ RAM recommended
- SSD storage

### What Gets Installed

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| pnpm | Latest | Package manager |
| Claude Code | Latest | AI development |
| Tailscale | Latest | VPN access |
| tmux | 3.x | Persistent sessions |

### Manual Steps

If you prefer manual installation:

```bash
# 1. System update
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget tmux htop build-essential openssh-server

# 2. Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. pnpm & Claude Code
npm install -g pnpm @anthropic-ai/claude-code

# 4. Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh

# 5. tmux configuration
cp config/tmux/tmux.conf ~/.tmux.conf

# 6. Create session
tmux new-session -d -s claude -n claude
```

### Verify Installation

```bash
# Check versions
node --version      # Should be 20.x
claude --version    # Should show version
tailscale status    # Should show connected

# Check tmux
tmux list-sessions  # Should show 'claude'
```

---

## Phase 2: Team Server

### Prerequisites

- Phase 1 completed
- Tailscale Teams subscription ($6/user/month for 10+ users)

### Setup

```bash
# Run Phase 2 setup (requires root)
sudo bash scripts/phase2/setup.sh

# Add team members
sudo bash scripts/phase2/add-user.sh dev1 dev1@databayt.com
sudo bash scripts/phase2/add-user.sh dev2 dev2@databayt.com
# ... repeat for all developers
```

### Tailscale ACLs

1. Go to https://login.tailscale.com/admin/acls
2. Copy contents of `config/tailscale/acls.json`
3. Update email addresses for your team
4. Apply the configuration
5. Tag your server as `kun-server` in the Machines tab

### Secrets Configuration

Edit `/etc/claude-code/env.sh`:

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export GITHUB_TOKEN="ghp_your-token-here"
```

### Enable Services

```bash
# Enable tmux auto-start for a user
sudo systemctl enable kun-tmux@dev1
sudo systemctl start kun-tmux@dev1

# Enable health checks
sudo systemctl enable kun-health.timer
sudo systemctl start kun-health.timer
```

---

## Phase 3: Commercial Platform

### Prerequisites

- Phase 1 & 2 completed
- Docker installed
- (Optional) Stripe account for billing

### Setup

```bash
# Install Docker if needed
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Run Phase 3 setup
bash scripts/phase3/setup.sh

# Configure environment
cp docker/.env.example docker/.env
# Edit docker/.env with your values
```

### Start User Container

```bash
# Start a container for a specific user
USER_ID=client1 SSH_PORT=2222 docker-compose -f docker/docker-compose.yml up -d

# Connect to the container
ssh -p 2222 developer@localhost
```

### Multiple Users

```bash
# Start multiple containers with different ports
USER_ID=client1 SSH_PORT=2222 docker-compose -f docker/docker-compose.yml up -d
USER_ID=client2 SSH_PORT=2223 docker-compose -f docker/docker-compose.yml up -d
USER_ID=client3 SSH_PORT=2224 docker-compose -f docker/docker-compose.yml up -d
```

---

## Monitoring

### Netdata Dashboard

Access real-time metrics at: `http://[tailscale-ip]:19999`

### Health Checks

```bash
# Run manual health check
npm run health
# or
bash scripts/monitoring/health-check.sh
```

### Logs

```bash
# View health check logs
tail -f /var/log/kun/health.log

# View systemd service logs
journalctl -u claude-tmux -f
journalctl -u kun-tmux@dev1 -f
```

### Slack Alerts

Set the `SLACK_WEBHOOK_URL` environment variable:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

---

## Troubleshooting

### Tailscale Not Connecting

```bash
# Check status
tailscale status

# Re-authenticate
sudo tailscale up --ssh

# Check firewall
sudo ufw status
sudo ufw allow tailscale
```

### tmux Session Lost

```bash
# List sessions
tmux list-sessions

# Create new session
tmux new-session -d -s claude -n claude

# If session exists but can't attach
tmux kill-session -t claude
tmux new-session -s claude -n claude
```

### Claude Code Not Working

```bash
# Check version
claude --version

# Re-install
npm install -g @anthropic-ai/claude-code

# Check API key
echo $ANTHROPIC_API_KEY
```

### SSH Connection Refused

```bash
# Check SSH service
sudo systemctl status ssh

# Restart SSH
sudo systemctl restart ssh

# Check Tailscale SSH
tailscale status
```

---

## Directory Structure

```
/Users/abdout/kun/
├── CLAUDE.md                      # Project context
├── DEPLOY.md                      # This file
├── REMOTE-INFRASTRUCTURE.md       # Technical reference
├── package.json                   # npm scripts
│
├── docs/                          # BMAD documentation
│   ├── PROJECT-BRIEF.md
│   ├── ARCHITECTURE.md
│   ├── PRD.md
│   └── EPICS.md
│
├── scripts/
│   ├── phase1/
│   │   ├── setup.sh              # Phase 1 installation
│   │   └── install-patterns.sh   # Pattern library setup
│   ├── phase2/
│   │   ├── setup.sh              # Phase 2 installation
│   │   └── add-user.sh           # Add developer account
│   ├── phase3/
│   │   └── setup.sh              # Docker setup
│   ├── monitoring/
│   │   └── health-check.sh       # Health monitoring
│   └── status.sh                 # Status overview
│
├── config/
│   ├── tmux/
│   │   └── tmux.conf             # tmux configuration
│   ├── systemd/
│   │   ├── claude-tmux.service   # tmux service
│   │   ├── kun-health.service    # Health check service
│   │   └── kun-health.timer      # Health check timer
│   ├── tailscale/
│   │   └── acls.json             # Tailscale ACL template
│   └── claude/
│       └── CLAUDE.md             # Claude context template
│
└── docker/
    ├── Dockerfile                # User container image
    ├── docker-compose.yml        # Container orchestration
    └── entrypoint.sh             # Container entrypoint
```

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run setup:phase1` | Run Phase 1 setup |
| `npm run setup:phase2` | Run Phase 2 setup (requires sudo) |
| `npm run setup:phase3` | Run Phase 3 Docker setup |
| `npm run health` | Run health check |
| `npm run status` | Show status overview |
| `npm run docker:build` | Build Docker image |
| `npm run docker:run` | Start Docker container |

---

## Support

- GitHub Issues: https://github.com/databayt/kun/issues
- Documentation: See `docs/` directory
- BMAD Methodology: https://github.com/bmad-code-org/BMAD-METHOD

---

## License

MIT License - See LICENSE file
