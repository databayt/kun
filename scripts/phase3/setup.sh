#!/bin/bash
#
# Kun Phase 3 Setup Script
# Commercial Platform with Docker Isolation
#
# Usage: bash scripts/phase3/setup.sh
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

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   كن (Kun) - Remote AI Development Infrastructure            ║"
echo "║   Phase 3: Commercial Platform Setup                         ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUN_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# ============================================================
# Step 1: Check Prerequisites
# ============================================================
log_info "Step 1/5: Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    echo ""
    echo "Install Docker:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    echo ""
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed."
    exit 1
fi

log_success "Prerequisites met"

# ============================================================
# Step 2: Build Docker Image
# ============================================================
log_info "Step 2/5: Building Kun development image..."

cd "$KUN_DIR"
docker build -t kun-dev:latest -f docker/Dockerfile .

log_success "Docker image built: kun-dev:latest"

# ============================================================
# Step 3: Create Environment File
# ============================================================
log_info "Step 3/5: Creating environment configuration..."

if [ ! -f "$KUN_DIR/docker/.env" ]; then
    cat > "$KUN_DIR/docker/.env" << 'EOF'
# Kun Docker Environment
# Copy this file and update with your values

# User Configuration
USER_ID=user1
SSH_PORT=2222

# API Keys (DO NOT commit with real values)
ANTHROPIC_API_KEY=
GITHUB_TOKEN=

# SSH Public Key (for container access)
SSH_PUBLIC_KEY=

# Database (Phase 3 billing)
POSTGRES_PASSWORD=

# Stripe (Phase 3 billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF
    log_warn "Created docker/.env - Please update with your values"
else
    log_info "Environment file already exists"
fi

# ============================================================
# Step 4: Initialize Volumes
# ============================================================
log_info "Step 4/5: Initializing volumes..."

docker volume create kun-user-default-home 2>/dev/null || true

log_success "Volumes initialized"

# ============================================================
# Step 5: Test Container
# ============================================================
log_info "Step 5/5: Testing container..."

echo "Starting test container..."
docker run -d --name kun-test \
    --rm \
    -e SSH_PUBLIC_KEY="$(cat ~/.ssh/id_rsa.pub 2>/dev/null || echo '')" \
    kun-dev:latest \
    sleep 30

sleep 5

if docker ps | grep -q kun-test; then
    log_success "Test container running"
    docker stop kun-test 2>/dev/null || true
else
    log_warn "Test container may have issues"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Phase 3 Setup Complete!                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Quick start:"
echo "  1. Update docker/.env with your configuration"
echo "  2. Start a user container:"
echo "     USER_ID=user1 SSH_PORT=2222 docker-compose -f docker/docker-compose.yml up -d"
echo "  3. Connect via SSH:"
echo "     ssh -p 2222 developer@localhost"
echo ""
echo "Commands:"
echo "  npm run docker:build    # Rebuild image"
echo "  npm run docker:run      # Start default container"
echo ""
echo "Next steps for production:"
echo "  - Set up Stripe integration for billing"
echo "  - Configure Kubernetes for multi-node"
echo "  - Set up API gateway for authentication"
echo ""
