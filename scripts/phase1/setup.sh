#!/bin/bash
#
# Kun Phase 1 Setup Script
# Remote AI Development Infrastructure
#
# Usage: bash scripts/phase1/setup.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   كن (Kun) - Remote AI Development Infrastructure            ║"
echo "║   Phase 1: Individual Setup                                   ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if running on Linux
if [[ "$(uname)" != "Linux" ]]; then
    log_error "This script is designed for Linux (Ubuntu). Detected: $(uname)"
    exit 1
fi

# Check Ubuntu version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        log_warn "This script is optimized for Ubuntu. Detected: $ID"
    fi
    log_info "Detected OS: $PRETTY_NAME"
fi

# ============================================================
# Step 1: System Update
# ============================================================
log_info "Step 1/6: Updating system packages..."

sudo apt update
sudo apt upgrade -y

log_success "System updated"

# ============================================================
# Step 2: Install Essential Packages
# ============================================================
log_info "Step 2/6: Installing essential packages..."

sudo apt install -y \
    git \
    curl \
    wget \
    tmux \
    htop \
    build-essential \
    openssh-server \
    jq \
    unzip

# Enable and start SSH
sudo systemctl enable ssh
sudo systemctl start ssh

log_success "Essential packages installed"

# ============================================================
# Step 3: Install Node.js 20.x LTS
# ============================================================
log_info "Step 3/6: Installing Node.js 20.x LTS..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_info "Node.js already installed: $NODE_VERSION"

    if [[ ! "$NODE_VERSION" =~ ^v20 ]]; then
        log_warn "Node.js version is not 20.x. Upgrading..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

log_success "Node.js $(node --version) installed"

# ============================================================
# Step 4: Install pnpm and Claude Code
# ============================================================
log_info "Step 4/6: Installing pnpm and Claude Code..."

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi
log_success "pnpm $(pnpm --version) installed"

# Install Claude Code
if ! command -v claude &> /dev/null; then
    npm install -g @anthropic-ai/claude-code
fi
log_success "Claude Code $(claude --version 2>/dev/null || echo 'installed') ready"

# ============================================================
# Step 5: Install and Configure Tailscale
# ============================================================
log_info "Step 5/6: Installing Tailscale..."

if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
fi

# Start Tailscale with SSH
log_info "Starting Tailscale with SSH enabled..."
log_warn "You will need to authenticate in your browser..."

sudo tailscale up --ssh

# Get Tailscale IP
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "Not connected")
log_success "Tailscale installed. IP: $TAILSCALE_IP"

# ============================================================
# Step 6: Configure tmux
# ============================================================
log_info "Step 6/6: Configuring tmux..."

# Copy tmux config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUN_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

if [ -f "$KUN_DIR/config/tmux/tmux.conf" ]; then
    cp "$KUN_DIR/config/tmux/tmux.conf" ~/.tmux.conf
    log_success "tmux configuration installed"
else
    # Create default config
    cat > ~/.tmux.conf << 'EOF'
# Kun tmux Configuration
# Mouse support (critical for mobile)
set -g mouse on

# Extended history
set -g history-limit 50000

# Status bar
set -g status-bg colour235
set -g status-fg white
set -g status-left '[#S] '
set -g status-right '%Y-%m-%d %H:%M | #(tailscale ip -4 2>/dev/null || echo "offline")'
set -g status-right-length 50

# Easy splits
bind | split-window -h
bind - split-window -v

# Reload config
bind r source-file ~/.tmux.conf \; display "Reloaded!"

# Start windows at 1
set -g base-index 1
setw -g pane-base-index 1

# Faster escape
set -sg escape-time 0
EOF
    log_success "Default tmux configuration created"
fi

# Create Claude session
log_info "Creating persistent Claude session..."
tmux kill-session -t claude 2>/dev/null || true
tmux new-session -d -s claude -n claude
tmux new-window -t claude -n server
log_success "tmux session 'claude' created with windows: claude, server"

# ============================================================
# Summary
# ============================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Phase 1 Complete!                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Tailscale IP: $TAILSCALE_IP"
echo ""
echo "Next steps:"
echo "  1. Install Tailscale on your phone"
echo "  2. Install Termius on your phone"
echo "  3. Configure Termius:"
echo "     - Host: $TAILSCALE_IP"
echo "     - Port: 22"
echo "     - User: $USER"
echo "  4. Connect and run: tmux attach -t claude"
echo ""
echo "Quick commands:"
echo "  tmux attach -t claude        # Attach to Claude session"
echo "  tmux list-sessions           # List all sessions"
echo "  tailscale status             # Check VPN status"
echo ""
