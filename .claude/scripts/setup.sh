#!/bin/bash
# Kun Engine Setup — install, update, and verify Claude Code config
# Usage: cd ~/kun && bash .claude/scripts/setup.sh <role>
# Roles: engineer, business, content, ops

set -e

ROLE="${1:-}"
KUN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
MODE="install"

# Colors
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' D='\033[2m' NC='\033[0m'
pass() { echo -e "  ${G}✓${NC} $1"; }
fail() { echo -e "  ${R}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
info() { echo -e "  ${D}·${NC} $1"; }

# ── Role validation ──────────────────────────────────────────────
if [[ -z "$ROLE" ]]; then
    echo -e "${B}Kun Engine Setup${NC}"
    echo ""
    echo "Usage: bash .claude/scripts/setup.sh <role>"
    echo ""
    echo "Roles:"
    echo "  engineer  — full agent fleet, all MCPs, all commands, hooks"
    echo "  business  — Cowork, Stripe, proposals, client workflows"
    echo "  content   — Cowork, translation, content calendar, Figma"
    echo "  ops       — monitoring, costs, incidents, Sentry, Vercel"
    echo ""
    echo "One-liner:"
    echo "  cd ~/kun && bash .claude/scripts/setup.sh engineer"
    exit 0
fi

if [[ "$ROLE" != "engineer" && "$ROLE" != "business" && "$ROLE" != "content" && "$ROLE" != "ops" ]]; then
    echo -e "${R}Invalid role: $ROLE${NC}"
    echo "Valid: engineer, business, content, ops"
    exit 1
fi

[ -d "$CLAUDE_DIR/agents" ] && MODE="update"

echo -e "${B}Kun Engine Setup${NC} — ${G}$ROLE${NC} ($MODE)"
echo ""

# ── Common config (all roles) ───────────────────────────────────
echo -e "${B}Common config${NC}"

mkdir -p "$CLAUDE_DIR"/{agents,commands,rules,memory,scripts}
info "directories"

cp "$KUN_DIR/.claude/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
info "CLAUDE.md"

cp "$KUN_DIR/.claude/agents/"*.md "$CLAUDE_DIR/agents/" 2>/dev/null || true
AGENT_COUNT=$(ls "$CLAUDE_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
info "agents ($AGENT_COUNT)"

if [ -d "$KUN_DIR/.claude/rules" ]; then
    cp "$KUN_DIR/.claude/rules/"*.md "$CLAUDE_DIR/rules/" 2>/dev/null || true
fi
RULE_COUNT=$(ls "$CLAUDE_DIR/rules/"*.md 2>/dev/null | wc -l | tr -d ' ')
info "rules ($RULE_COUNT)"

cp "$KUN_DIR/.claude/memory/"*.json "$CLAUDE_DIR/memory/" 2>/dev/null || true
info "memory"

cp "$KUN_DIR/.claude/scripts/"*.sh "$CLAUDE_DIR/scripts/" 2>/dev/null || true
cp "$KUN_DIR/.claude/scripts/"*.ps1 "$CLAUDE_DIR/scripts/" 2>/dev/null || true
cp "$KUN_DIR/.claude/scripts/"*.json "$CLAUDE_DIR/scripts/" 2>/dev/null || true
cp "$KUN_DIR/.claude/scripts/"*.md "$CLAUDE_DIR/scripts/" 2>/dev/null || true
chmod +x "$CLAUDE_DIR/scripts/"*.sh 2>/dev/null || true
info "scripts"

echo ""

# ── Scoped config (role-specific) ───────────────────────────────
echo -e "${B}Scoped config ($ROLE)${NC}"

# Commands/skills per role
COMMON_CMDS="docs repos screenshot codebase"
case "$ROLE" in
    engineer)
        cp "$KUN_DIR/.claude/commands/"*.md "$CLAUDE_DIR/commands/" 2>/dev/null || true
        ;;
    business)
        for cmd in $COMMON_CMDS proposal pricing weekly; do
            cp "$KUN_DIR/.claude/commands/$cmd.md" "$CLAUDE_DIR/commands/" 2>/dev/null || true
        done
        ;;
    content)
        for cmd in $COMMON_CMDS translate content-calendar weekly; do
            cp "$KUN_DIR/.claude/commands/$cmd.md" "$CLAUDE_DIR/commands/" 2>/dev/null || true
        done
        ;;
    ops)
        for cmd in $COMMON_CMDS monitor costs incident weekly; do
            cp "$KUN_DIR/.claude/commands/$cmd.md" "$CLAUDE_DIR/commands/" 2>/dev/null || true
        done
        ;;
esac
CMD_COUNT=$(ls "$CLAUDE_DIR/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
info "commands ($CMD_COUNT)"

# Agent index per role
ROLE_INDEX="$KUN_DIR/.claude/agents/_index-${ROLE}.md"
if [[ "$ROLE" == "engineer" ]]; then
    ROLE_INDEX="$KUN_DIR/.claude/agents/_index.md"
fi
if [ -f "$ROLE_INDEX" ]; then
    cp "$ROLE_INDEX" "$CLAUDE_DIR/agents/_index.md"
    info "agent index (_index.md)"
fi

# Settings per role
if [[ "$ROLE" == "engineer" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
        cp "$KUN_DIR/.claude/settings.json" "$CLAUDE_DIR/settings.json"
    else
        cp "$KUN_DIR/.claude/settings-windows.json" "$CLAUDE_DIR/settings.json"
    fi
    info "settings (full + hooks)"
else
    cat > "$CLAUDE_DIR/settings.json" << 'SETTINGS'
{
  "env": {
    "DEV_PORT": "3000"
  }
}
SETTINGS
    info "settings (minimal)"
fi
chmod 600 "$CLAUDE_DIR/settings.json" 2>/dev/null || true

# MCP per role
case "$ROLE" in
    engineer)  MCP_SRC="$KUN_DIR/.claude/mcp.json" ;;
    business)  MCP_SRC="$KUN_DIR/.claude/mcp-business.json" ;;
    content)   MCP_SRC="$KUN_DIR/.claude/mcp-content.json" ;;
    ops)       MCP_SRC="$KUN_DIR/.claude/mcp-ops.json" ;;
esac
if [ -f "$MCP_SRC" ]; then
    cp "$MCP_SRC" "$CLAUDE_DIR/mcp.json"
    chmod 600 "$CLAUDE_DIR/mcp.json" 2>/dev/null || true
    MCP_COUNT=$(grep -c '"description"' "$CLAUDE_DIR/mcp.json" 2>/dev/null || echo 0)
    info "MCP servers ($MCP_COUNT)"
fi

# Codebase clone (engineer only)
if [[ "$ROLE" == "engineer" ]]; then
    CODEBASE_DIR="$HOME/codebase"
    if [ ! -d "$CODEBASE_DIR" ]; then
        echo ""
        echo -e "${Y}Cloning codebase...${NC}"
        git clone git@github.com:databayt/codebase.git "$CODEBASE_DIR" 2>/dev/null || \
        git clone https://github.com/databayt/codebase.git "$CODEBASE_DIR" 2>/dev/null || \
        info "clone failed — run manually: git clone git@github.com:databayt/codebase.git ~/codebase"
    fi
fi

# Claude CLI (install if missing)
if ! command -v claude &> /dev/null; then
    echo ""
    echo -e "${Y}Installing Claude Code CLI...${NC}"
    curl -fsSL https://claude.ai/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

echo ""

# ── Health check ─────────────────────────────────────────────────
echo -e "${B}Health check${NC}"
ERRORS=0

# Core files
[ -f "$CLAUDE_DIR/CLAUDE.md" ] && pass "CLAUDE.md" || fail "CLAUDE.md missing"
[ -f "$CLAUDE_DIR/settings.json" ] && pass "settings.json" || fail "settings.json missing"
[ -f "$CLAUDE_DIR/mcp.json" ] && pass "mcp.json" || fail "mcp.json missing"

# JSON validity
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    python3 -c "import json; json.load(open('$CLAUDE_DIR/settings.json'))" 2>/dev/null && \
        pass "settings.json valid JSON" || fail "settings.json invalid JSON"
fi
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    python3 -c "import json; json.load(open('$CLAUDE_DIR/mcp.json'))" 2>/dev/null && \
        pass "mcp.json valid JSON" || fail "mcp.json invalid JSON"
fi

# Directories
[ -d "$CLAUDE_DIR/agents" ] && [ "$(ls "$CLAUDE_DIR/agents/"*.md 2>/dev/null | wc -l)" -gt 0 ] && \
    pass "agents/ ($AGENT_COUNT files)" || fail "agents/ empty"
[ -d "$CLAUDE_DIR/commands" ] && [ "$(ls "$CLAUDE_DIR/commands/"*.md 2>/dev/null | wc -l)" -gt 0 ] && \
    pass "commands/ ($CMD_COUNT files)" || fail "commands/ empty"
[ -d "$CLAUDE_DIR/rules" ] && pass "rules/" || fail "rules/ missing"
[ -d "$CLAUDE_DIR/memory" ] && pass "memory/" || fail "memory/ missing"

# Agent index
[ -f "$CLAUDE_DIR/agents/_index.md" ] && \
    pass "agent index" || info "no agent index (using all agents)"

# Permissions
SETTINGS_PERM=$(stat -f "%Lp" "$CLAUDE_DIR/settings.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/settings.json" 2>/dev/null)
MCP_PERM=$(stat -f "%Lp" "$CLAUDE_DIR/mcp.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/mcp.json" 2>/dev/null)
[[ "$SETTINGS_PERM" == "600" ]] && pass "settings.json permissions (600)" || info "settings.json permissions ($SETTINGS_PERM)"
[[ "$MCP_PERM" == "600" ]] && pass "mcp.json permissions (600)" || info "mcp.json permissions ($MCP_PERM)"

# CLI
command -v claude &> /dev/null && pass "claude CLI installed" || fail "claude CLI not found"

echo ""

# ── Summary ──────────────────────────────────────────────────────
if [ $ERRORS -eq 0 ]; then
    echo -e "${G}Setup complete${NC} — $ROLE ($MODE)"
else
    echo -e "${Y}Setup complete with $ERRORS issue(s)${NC} — $ROLE ($MODE)"
fi

echo ""
echo -e "${D}Config: $CLAUDE_DIR${NC}"
echo -e "${D}Re-run anytime: cd ~/kun && bash .claude/scripts/setup.sh $ROLE${NC}"
