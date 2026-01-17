#!/bin/bash
# Claude Code Team Configuration Installer (macOS/Linux)
# Usage: curl -fsSL https://raw.githubusercontent.com/databayt/codebase/main/scripts/setup-claude.sh | bash

set -e

REPO="https://github.com/databayt/claude-config.git"
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$HOME/.claude-backup-$(date +%Y%m%d-%H%M%S)"

echo "=== Claude Code Team Configuration Installer ==="
echo ""

# Check if Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo "Installing Claude Code CLI..."
    curl -fsSL https://claude.ai/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Backup existing config
if [ -d "$CLAUDE_DIR" ]; then
    echo "Backing up existing config to $BACKUP_DIR..."
    mv "$CLAUDE_DIR" "$BACKUP_DIR"
fi

# Create directory structure
mkdir -p "$CLAUDE_DIR"
mkdir -p "$CLAUDE_DIR/agents"
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/memory"
mkdir -p "$CLAUDE_DIR/scripts"
mkdir -p "$CLAUDE_DIR/bmad"

# Download config files from GitHub
echo "Downloading team configuration..."
BASE_URL="https://raw.githubusercontent.com/databayt/codebase/main/.claude"

curl -fsSL "$BASE_URL/CLAUDE.md" -o "$CLAUDE_DIR/CLAUDE.md"
curl -fsSL "$BASE_URL/settings.json" -o "$CLAUDE_DIR/settings.json"
curl -fsSL "$BASE_URL/mcp.json" -o "$CLAUDE_DIR/mcp.json"

# Download agents (including product repo agents)
echo "Downloading agents..."
for agent in architecture atom block build deploy git-github i18n middleware nextjs pattern performance prisma react report shadcn structure tailwind template test typescript hogwarts souq mkan shifa comment optimize semantic sse authjs; do
    curl -fsSL "$BASE_URL/agents/$agent.md" -o "$CLAUDE_DIR/agents/$agent.md" 2>/dev/null || true
done

# Download commands (including repos command)
echo "Downloading commands..."
for cmd in dev build deploy block codebase saas docs test security performance repos atom template screenshot clone nextjs motion; do
    curl -fsSL "$BASE_URL/commands/$cmd.md" -o "$CLAUDE_DIR/commands/$cmd.md" 2>/dev/null || true
done

# Download memory files
echo "Downloading memory files..."
for mem in atom template block report repositories; do
    curl -fsSL "$BASE_URL/memory/$mem.json" -o "$CLAUDE_DIR/memory/$mem.json" 2>/dev/null || true
done

# Download scripts
echo "Downloading scripts..."
for script in sync.sh sync.ps1 sync-repos.sh sync-repos.ps1; do
    curl -fsSL "$BASE_URL/scripts/$script" -o "$CLAUDE_DIR/scripts/$script" 2>/dev/null || true
done
chmod +x "$CLAUDE_DIR/scripts/"*.sh 2>/dev/null || true

# Set permissions
chmod 600 "$CLAUDE_DIR/settings.json"
chmod 600 "$CLAUDE_DIR/mcp.json"

# Create local overrides file
touch "$CLAUDE_DIR/CLAUDE.local.md"

# Update PATH in shell config
SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"

if ! grep -q "claude/bin" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# Claude Code" >> "$SHELL_RC"
    echo 'export PATH="$HOME/.claude/bin:$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
    echo "alias c='claude --dangerously-skip-permissions'" >> "$SHELL_RC"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "  1. Restart your terminal or run: source $SHELL_RC"
echo "  2. Set environment variables (ask team lead for values):"
echo "     export GITHUB_PERSONAL_ACCESS_TOKEN=..."
echo "     export NEON_API_KEY=..."
echo "  3. Run 'claude' or 'c' to start"
echo ""
echo "Config location: $CLAUDE_DIR"
echo "Backup location: $BACKUP_DIR"
