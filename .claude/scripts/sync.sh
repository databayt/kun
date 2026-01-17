#!/bin/bash
# Claude Code Team Configuration Sync (macOS/Linux)
# Usage: ~/.claude/scripts/sync.sh

set -e

CLAUDE_DIR="$HOME/.claude"
BASE_URL="https://raw.githubusercontent.com/databayt/codebase/main/.claude"

echo "=== Syncing Claude Code Configuration ==="
echo ""

# Backup current CLAUDE.md (preserves local modifications)
if [ -f "$CLAUDE_DIR/CLAUDE.local.md" ]; then
    echo "Your local customizations in CLAUDE.local.md will be preserved."
fi

# Sync main files
echo "Downloading latest configuration..."
curl -fsSL "$BASE_URL/CLAUDE.md" -o "$CLAUDE_DIR/CLAUDE.md"
curl -fsSL "$BASE_URL/mcp.json" -o "$CLAUDE_DIR/mcp.json"

# Sync agents (including product repo agents)
echo "Syncing agents..."
for agent in architecture atom block build deploy git-github i18n middleware nextjs pattern performance prisma react report shadcn structure tailwind template test typescript hogwarts souq mkan shifa comment optimize semantic sse authjs; do
    curl -fsSL "$BASE_URL/agents/$agent.md" -o "$CLAUDE_DIR/agents/$agent.md" 2>/dev/null || true
done

# Sync commands (including repos command)
echo "Syncing commands..."
for cmd in dev build deploy block codebase saas docs test security performance repos atom template screenshot clone nextjs motion; do
    curl -fsSL "$BASE_URL/commands/$cmd.md" -o "$CLAUDE_DIR/commands/$cmd.md" 2>/dev/null || true
done

# Sync memory files
echo "Syncing memory files..."
for mem in atom template block report repositories; do
    curl -fsSL "$BASE_URL/memory/$mem.json" -o "$CLAUDE_DIR/memory/$mem.json" 2>/dev/null || true
done

# Sync scripts
echo "Syncing scripts..."
for script in sync.sh sync.ps1 sync-repos.sh sync-repos.ps1; do
    curl -fsSL "$BASE_URL/scripts/$script" -o "$CLAUDE_DIR/scripts/$script" 2>/dev/null || true
done
chmod +x "$CLAUDE_DIR/scripts/"*.sh 2>/dev/null || true

echo ""
echo "=== Sync Complete ==="
echo "Run 'claude' to use updated configuration."
