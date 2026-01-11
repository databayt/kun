#!/bin/bash
#
# Kun Pattern Library Installation
# Clones databayt/codebase and configures Claude Code
#
# Usage: bash scripts/phase1/install-patterns.sh
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo ""
echo "Installing Kun Pattern Library..."
echo ""

# ============================================================
# GitHub SSH Setup
# ============================================================
if [ ! -f ~/.ssh/id_ed25519 ]; then
    log_info "Generating SSH key for GitHub..."
    ssh-keygen -t ed25519 -C "developer@databayt.com" -N "" -f ~/.ssh/id_ed25519

    echo ""
    echo "Add this public key to GitHub (Settings > SSH Keys):"
    echo ""
    cat ~/.ssh/id_ed25519.pub
    echo ""
    read -p "Press Enter after adding the key to GitHub..."
fi

# Start ssh-agent
eval "$(ssh-agent -s)" > /dev/null 2>&1
ssh-add ~/.ssh/id_ed25519 2>/dev/null || true

# Test GitHub connection
log_info "Testing GitHub connection..."
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    log_success "GitHub SSH connection successful"
else
    log_warn "GitHub SSH test inconclusive. Proceeding anyway..."
fi

# ============================================================
# Clone Pattern Library
# ============================================================
REPOS_DIR=~/repos/databayt

log_info "Creating repositories directory..."
mkdir -p "$REPOS_DIR"

if [ -d "$REPOS_DIR/codebase" ]; then
    log_info "Pattern library exists. Pulling latest..."
    cd "$REPOS_DIR/codebase"
    git pull origin main || git pull origin master || log_warn "Could not pull updates"
else
    log_info "Cloning databayt/codebase..."
    cd "$REPOS_DIR"
    git clone git@github.com:databayt/codebase.git || {
        log_warn "SSH clone failed. Trying HTTPS..."
        git clone https://github.com/databayt/codebase.git
    }
fi

log_success "Pattern library installed at: $REPOS_DIR/codebase"

# ============================================================
# Configure Claude Code
# ============================================================
log_info "Configuring Claude Code..."

mkdir -p ~/.claude

# Link custom commands if available
if [ -d "$REPOS_DIR/codebase/.claude/commands" ]; then
    rm -f ~/.claude/commands
    ln -s "$REPOS_DIR/codebase/.claude/commands" ~/.claude/commands
    log_success "Custom commands linked"
fi

# Create local CLAUDE.md
cat > ~/.claude/CLAUDE.md << EOF
# Kun Development Context

## Pattern Library
Reference patterns at: $REPOS_DIR/codebase/

### Component Hierarchy
- UI: 54 shadcn/ui primitives (src/components/ui/)
- Atoms: 62 composed components (src/components/atom/)
- Templates: 31 full-page layouts (src/registry/)
- Blocks: UI with business logic (src/components/root/block/)

## Architecture Principles
- Mirror-pattern: URL routes map 1:1 to component directories
- Server-first by default, client components when necessary
- Strict TypeScript, no \`any\`
- Conventional commits (feat/fix/docs/refactor)

## When Implementing
1. Check pattern library for existing patterns
2. Follow file naming conventions:
   - content.tsx - Feature UI
   - actions.ts - Server actions
   - config.ts - Enums and options
   - validation.ts - Zod schemas
   - type.ts - TypeScript types
3. Use specialized agents for domain work

## Available Agents
$(ls "$REPOS_DIR/codebase/.claude/agents/" 2>/dev/null | sed 's/\.md$//' | sed 's/^/- /' || echo "- (none found)")
EOF

log_success "Claude Code configured"

# ============================================================
# Summary
# ============================================================
echo ""
echo "Pattern Library Installation Complete!"
echo ""
echo "Installed components:"
echo "  - Pattern library: $REPOS_DIR/codebase/"
echo "  - Custom commands: ~/.claude/commands/"
echo "  - Claude context: ~/.claude/CLAUDE.md"
echo ""
echo "To use custom commands in Claude Code:"
echo "  /spec   - Turn idea into specification"
echo "  /plan   - Create implementation plan"
echo "  /ship   - Create PR with summary"
echo ""
