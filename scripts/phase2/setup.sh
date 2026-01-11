#!/bin/bash
#
# Kun Phase 2 Setup Script
# Team Server Configuration
#
# Usage: sudo bash scripts/phase2/setup.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   كن (Kun) - Remote AI Development Infrastructure            ║"
echo "║   Phase 2: Team Server Setup                                  ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUN_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# ============================================================
# Step 1: Create Developers Group
# ============================================================
log_info "Step 1/6: Creating developers group..."

if ! getent group developers > /dev/null 2>&1; then
    groupadd developers
    log_success "Group 'developers' created"
else
    log_info "Group 'developers' already exists"
fi

# ============================================================
# Step 2: Create Shared Directories
# ============================================================
log_info "Step 2/6: Creating shared directories..."

# Claude Code config directory
mkdir -p /etc/claude-code
chmod 755 /etc/claude-code

# Pattern library directory
mkdir -p /opt/databayt
chown root:developers /opt/databayt
chmod 755 /opt/databayt

# Scripts directory
mkdir -p /opt/scripts
chmod 755 /opt/scripts

# Logs directory
mkdir -p /var/log/kun
chmod 755 /var/log/kun

log_success "Shared directories created"

# ============================================================
# Step 3: Create Environment File
# ============================================================
log_info "Step 3/6: Creating shared environment file..."

if [ ! -f /etc/claude-code/env.sh ]; then
    cat > /etc/claude-code/env.sh << 'EOF'
# Kun Shared Environment
# Source this in user .bashrc

# API Keys (replace with actual values or use 1Password CLI)
# export ANTHROPIC_API_KEY="sk-ant-..."
# export GITHUB_TOKEN="ghp_..."

# Paths
export DATABAYT_CODEBASE="/opt/databayt/codebase"
export KUN_CONFIG="/etc/claude-code"

# Aliases
alias claude-session='tmux attach -t claude || tmux new-session -s claude'
alias kun-status='/opt/scripts/health-check.sh'

# Node.js path
export PATH="/usr/local/bin:$PATH"
EOF
    chmod 644 /etc/claude-code/env.sh
    log_success "Environment file created at /etc/claude-code/env.sh"
    log_warn "Remember to add your API keys to /etc/claude-code/env.sh"
else
    log_info "Environment file already exists"
fi

# ============================================================
# Step 4: Create Global CLAUDE.md
# ============================================================
log_info "Step 4/6: Creating global CLAUDE.md..."

cat > /etc/claude-code/CLAUDE.md << 'EOF'
# Kun Team Context

## Pattern Library
Reference patterns at: /opt/databayt/codebase/

## Component Hierarchy
- UI: shadcn/ui primitives (src/components/ui/)
- Atoms: Composed components (src/components/atom/)
- Templates: Full-page layouts (src/registry/)
- Blocks: UI with business logic

## Architecture Principles
1. Mirror-pattern: URL routes map to component directories
2. Server-first: Use client components only when necessary
3. Strict TypeScript: No `any` types
4. Conventional commits: feat/fix/docs/refactor

## File Patterns
- content.tsx - Feature UI composition
- actions.ts - Server actions & API calls
- config.ts - Enums, options, labels
- validation.ts - Zod schemas
- type.ts - TypeScript types
- form.tsx - React Hook Form components
- card.tsx - Card components and KPIs

## Anti-Patterns (DO NOT)
- No inline styles except for dynamic values
- No console.log in production code
- No hardcoded strings (use i18n)
- No God components (max 200 lines)
- No direct commits to main branch

## Git Workflow
1. Create feature branch
2. Implement with conventional commits
3. Create PR
4. Request review
5. Merge after approval
EOF

chmod 644 /etc/claude-code/CLAUDE.md
log_success "Global CLAUDE.md created"

# ============================================================
# Step 5: Install Systemd Services
# ============================================================
log_info "Step 5/6: Installing systemd services..."

# Copy service files
if [ -d "$KUN_DIR/config/systemd" ]; then
    cp "$KUN_DIR/config/systemd/"*.service /etc/systemd/system/ 2>/dev/null || true
fi

# Create main tmux service if not exists
cat > /etc/systemd/system/kun-tmux@.service << 'EOF'
[Unit]
Description=Kun tmux session for %i
After=network.target

[Service]
Type=forking
User=%i
ExecStart=/usr/bin/tmux new-session -d -s kun
ExecStop=/usr/bin/tmux kill-session -t kun
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
log_success "Systemd services installed"

# ============================================================
# Step 6: Install Monitoring
# ============================================================
log_info "Step 6/6: Installing monitoring..."

# Copy health check script
if [ -f "$KUN_DIR/scripts/monitoring/health-check.sh" ]; then
    cp "$KUN_DIR/scripts/monitoring/health-check.sh" /opt/scripts/
    chmod +x /opt/scripts/health-check.sh
fi

# Add cron job for health checks
if ! crontab -l 2>/dev/null | grep -q "health-check.sh"; then
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/scripts/health-check.sh >> /var/log/kun/health.log 2>&1") | crontab -
    log_success "Health check cron job installed"
fi

# Install Netdata (optional)
read -p "Install Netdata monitoring? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Installing Netdata..."
    bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait || log_warn "Netdata installation failed"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Phase 2 Complete!                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Created:"
echo "  - Group: developers"
echo "  - Directory: /etc/claude-code/"
echo "  - Directory: /opt/databayt/"
echo "  - Directory: /opt/scripts/"
echo "  - File: /etc/claude-code/env.sh"
echo "  - File: /etc/claude-code/CLAUDE.md"
echo "  - Service: kun-tmux@.service"
echo ""
echo "Next steps:"
echo "  1. Add API keys to /etc/claude-code/env.sh"
echo "  2. Clone pattern library: git clone ... /opt/databayt/codebase"
echo "  3. Create user accounts: sudo bash scripts/phase2/add-user.sh <username>"
echo "  4. Configure Tailscale ACLs (see config/tailscale/acls.json)"
echo ""
