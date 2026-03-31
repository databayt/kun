#!/bin/bash
# Kun Engine Installer (macOS/Linux)
# Usage: cd ~/kun && bash .claude/scripts/install.sh [role]
# Roles: engineer (default), business, content

set -e

ROLE="${1:-engineer}"
KUN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$HOME/.claude-backup-$(date +%Y%m%d-%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Kun Engine Installer ===${NC}"
echo -e "Role: ${GREEN}$ROLE${NC}"
echo ""

# Validate role
if [[ "$ROLE" != "engineer" && "$ROLE" != "business" && "$ROLE" != "content" && "$ROLE" != "ops" ]]; then
    echo -e "${RED}Invalid role: $ROLE${NC}"
    echo "Valid roles: engineer, business, content, ops"
    exit 1
fi

# Check if Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo -e "${YELLOW}Installing Claude Code CLI...${NC}"
    curl -fsSL https://claude.ai/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Backup existing config
if [ -d "$CLAUDE_DIR" ]; then
    echo -e "${YELLOW}Backing up existing config to $BACKUP_DIR...${NC}"
    cp -r "$CLAUDE_DIR" "$BACKUP_DIR"
fi

# Create directory structure
echo "Creating directory structure..."
mkdir -p "$CLAUDE_DIR/agents"
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/rules"
mkdir -p "$CLAUDE_DIR/memory"
mkdir -p "$CLAUDE_DIR/scripts"

# Copy CLAUDE.md (all roles)
echo "Installing CLAUDE.md..."
cp "$KUN_DIR/.claude/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"

# Copy agents (all roles get all agents — they're just definitions)
echo "Installing agents..."
cp "$KUN_DIR/.claude/agents/"*.md "$CLAUDE_DIR/agents/" 2>/dev/null || true

# Copy role-specific agent index as the default index
if [[ "$ROLE" == "business" && -f "$KUN_DIR/.claude/agents/_index-business.md" ]]; then
    cp "$KUN_DIR/.claude/agents/_index-business.md" "$CLAUDE_DIR/agents/_index.md"
elif [[ "$ROLE" == "content" && -f "$KUN_DIR/.claude/agents/_index-content.md" ]]; then
    cp "$KUN_DIR/.claude/agents/_index-content.md" "$CLAUDE_DIR/agents/_index.md"
elif [[ "$ROLE" == "ops" && -f "$KUN_DIR/.claude/agents/_index-ops.md" ]]; then
    cp "$KUN_DIR/.claude/agents/_index-ops.md" "$CLAUDE_DIR/agents/_index.md"
fi

# Copy commands/skills based on role
echo "Installing skills for $ROLE..."
if [[ "$ROLE" == "engineer" ]]; then
    # Engineers get all skills
    cp "$KUN_DIR/.claude/commands/"*.md "$CLAUDE_DIR/commands/" 2>/dev/null || true
elif [[ "$ROLE" == "business" ]]; then
    # Business: docs, repos, screenshot, codebase + proposal, pricing, weekly
    for cmd in docs repos screenshot codebase proposal pricing weekly; do
        cp "$KUN_DIR/.claude/commands/$cmd.md" "$CLAUDE_DIR/commands/" 2>/dev/null || true
    done
elif [[ "$ROLE" == "content" ]]; then
    # Content: docs, repos, screenshot, codebase + translate, content-calendar, weekly
    for cmd in docs repos screenshot codebase translate content-calendar weekly; do
        cp "$KUN_DIR/.claude/commands/$cmd.md" "$CLAUDE_DIR/commands/" 2>/dev/null || true
    done
elif [[ "$ROLE" == "ops" ]]; then
    # Ops: docs, repos, screenshot, codebase + monitor, costs, incident, weekly
    for cmd in docs repos screenshot codebase monitor costs incident weekly; do
        cp "$KUN_DIR/.claude/commands/$cmd.md" "$CLAUDE_DIR/commands/" 2>/dev/null || true
    done
fi

# Copy rules (all roles)
echo "Installing rules..."
if [ -d "$KUN_DIR/.claude/rules" ]; then
    cp "$KUN_DIR/.claude/rules/"*.md "$CLAUDE_DIR/rules/" 2>/dev/null || true
fi

# Copy memory files
echo "Installing memory..."
cp "$KUN_DIR/.claude/memory/"*.json "$CLAUDE_DIR/memory/" 2>/dev/null || true

# Copy scripts
echo "Installing scripts..."
cp "$KUN_DIR/.claude/scripts/"*.sh "$CLAUDE_DIR/scripts/" 2>/dev/null || true
cp "$KUN_DIR/.claude/scripts/"*.ps1 "$CLAUDE_DIR/scripts/" 2>/dev/null || true
cp "$KUN_DIR/.claude/scripts/"*.json "$CLAUDE_DIR/scripts/" 2>/dev/null || true
chmod +x "$CLAUDE_DIR/scripts/"*.sh 2>/dev/null || true

# Install settings based on role
echo "Installing settings..."
if [[ "$ROLE" == "engineer" ]]; then
    # Engineers get full settings with hooks
    cp "$KUN_DIR/.claude/settings.json" "$CLAUDE_DIR/settings.json"
else
    # Business/content get minimal settings (no dev hooks)
    cat > "$CLAUDE_DIR/settings.json" << 'EOF'
{
  "env": {
    "CODEBASE_PATH": "",
    "DEV_PORT": "3000"
  }
}
EOF
fi

# Install MCP servers based on role
echo "Installing MCP servers for $ROLE..."
if [[ "$ROLE" == "engineer" ]]; then
    cp "$KUN_DIR/.claude/mcp.json" "$CLAUDE_DIR/mcp.json"
elif [[ "$ROLE" == "business" ]]; then
    cp "$KUN_DIR/.claude/mcp-business.json" "$CLAUDE_DIR/mcp.json"
elif [[ "$ROLE" == "content" ]]; then
    cp "$KUN_DIR/.claude/mcp-content.json" "$CLAUDE_DIR/mcp.json"
elif [[ "$ROLE" == "ops" ]]; then
    cp "$KUN_DIR/.claude/mcp-ops.json" "$CLAUDE_DIR/mcp.json"
fi

# Set permissions
chmod 600 "$CLAUDE_DIR/settings.json" 2>/dev/null || true
chmod 600 "$CLAUDE_DIR/mcp.json" 2>/dev/null || true

# Update shell profile
SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && [ ! -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.bashrc"

if ! grep -q "claude" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# Claude Code (Kun Engine)" >> "$SHELL_RC"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
fi

# Clone codebase reference (engineers only)
if [[ "$ROLE" == "engineer" ]]; then
    CODEBASE_DIR="$HOME/codebase"
    if [ ! -d "$CODEBASE_DIR" ]; then
        echo -e "${YELLOW}Cloning pattern library to $CODEBASE_DIR...${NC}"
        git clone git@github.com:databayt/codebase.git "$CODEBASE_DIR" 2>/dev/null || {
            echo -e "${YELLOW}SSH clone failed, trying HTTPS...${NC}"
            git clone https://github.com/databayt/codebase.git "$CODEBASE_DIR" || true
        }
    fi
fi

echo ""
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo ""
echo "Role: $ROLE"
echo "Config: $CLAUDE_DIR"
[ -d "$BACKUP_DIR" ] && echo "Backup: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Restart your terminal"
if [[ "$ROLE" == "engineer" ]]; then
    echo "  2. Run: bash $CLAUDE_DIR/scripts/secrets.sh <GIST_ID>"
    echo "  3. Run: claude"
else
    echo "  2. Open Claude Desktop or claude.ai/code"
fi
echo ""
echo "Setup time: ~5 minutes"
