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
    echo "  engineer  — full agent fleet, all MCPs, all skills, hooks"
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

mkdir -p "$CLAUDE_DIR"/{agents,commands,rules,memory,scripts,skills}
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

# ── Full config (universal — every machine is a full autonomous worker) ──
# Role no longer scopes capability; it's only a label + secrets-trust tier.
# Secrets stay scoped via which Gist you're handed — MCP servers without a
# key simply don't connect, so a full mcp.json is safe everywhere.
echo -e "${B}Full config${NC}"

# Commands are retired — kun verbs are skills now (a same-named skill shadows a
# command anyway). Prune stale ~/.claude/commands copies of migrated names.
PRUNED=0
for stale in "$CLAUDE_DIR/commands/"*.md; do
    [ -e "$stale" ] || continue
    base="$(basename "$stale" .md)"
    if [ -f "$KUN_DIR/.claude/skills/$base/SKILL.md" ]; then
        rm -f "$stale"
        PRUNED=$((PRUNED + 1))
    fi
done
[ "$PRUNED" -gt 0 ] && info "pruned $PRUNED shadowed command(s)"

# All workflows (saved multi-agent scripts: handover.js, qa.js — resolved by Workflow({ name }))
if [ -d "$KUN_DIR/.claude/workflows" ]; then
    mkdir -p "$CLAUDE_DIR/workflows"
    cp "$KUN_DIR/.claude/workflows/"*.js "$CLAUDE_DIR/workflows/" 2>/dev/null || true
    WF_COUNT=$(ls "$CLAUDE_DIR/workflows/"*.js 2>/dev/null | wc -l | tr -d ' ')
    info "workflows ($WF_COUNT)"
fi

# All kun-authored skills (each is a dir: SKILL.md + optional scripts/ + references/)
if [ -d "$KUN_DIR/.claude/skills" ]; then
    cp -r "$KUN_DIR/.claude/skills/"* "$CLAUDE_DIR/skills/" 2>/dev/null || true
    SKILL_COUNT=$(ls -d "$CLAUDE_DIR/skills/"*/ 2>/dev/null | wc -l | tr -d ' ')
    info "skills ($SKILL_COUNT)"
fi

# Full agent index
if [ -f "$KUN_DIR/.claude/agents/_index.md" ]; then
    cp "$KUN_DIR/.claude/agents/_index.md" "$CLAUDE_DIR/agents/_index.md"
    info "agent index (_index.md)"
fi

# Full settings + hooks
if [[ "$(uname)" == "Darwin" ]]; then
    cp "$KUN_DIR/.claude/settings.json" "$CLAUDE_DIR/settings.json"
else
    cp "$KUN_DIR/.claude/settings-windows.json" "$CLAUDE_DIR/settings.json" 2>/dev/null || \
        cp "$KUN_DIR/.claude/settings.json" "$CLAUDE_DIR/settings.json"
fi
chmod 600 "$CLAUDE_DIR/settings.json" 2>/dev/null || true
info "settings (full + hooks)"

# Full MCP fleet
if [ -f "$KUN_DIR/.claude/mcp.json" ]; then
    cp "$KUN_DIR/.claude/mcp.json" "$CLAUDE_DIR/mcp.json"
    chmod 600 "$CLAUDE_DIR/mcp.json" 2>/dev/null || true
    MCP_COUNT=$(grep -c '"description"' "$CLAUDE_DIR/mcp.json" 2>/dev/null || echo 0)
    info "MCP servers ($MCP_COUNT)"
fi

# Antigravity bridge — the secondary agent (`agy`) reuses the same MCP fleet,
# skills, and playbook. Ship the doctrine template, then wire ~/.gemini/.
mkdir -p "$CLAUDE_DIR/antigravity"
cp "$KUN_DIR/.claude/antigravity/"* "$CLAUDE_DIR/antigravity/" 2>/dev/null || true
if [ -f "$KUN_DIR/.claude/scripts/antigravity-sync.sh" ]; then
    bash "$KUN_DIR/.claude/scripts/antigravity-sync.sh"
fi

# Codebase clone (every machine)
CODEBASE_DIR="$HOME/codebase"
if [ ! -d "$CODEBASE_DIR" ]; then
    echo ""
    echo -e "${Y}Cloning codebase...${NC}"
    git clone git@github.com:databayt/codebase.git "$CODEBASE_DIR" 2>/dev/null || \
    git clone https://github.com/databayt/codebase.git "$CODEBASE_DIR" 2>/dev/null || \
    info "clone failed — run manually: git clone git@github.com:databayt/codebase.git ~/codebase"
fi

# Claude CLI (install if missing)
if ! command -v claude &> /dev/null; then
    echo ""
    echo -e "${Y}Installing Claude Code CLI...${NC}"
    curl -fsSL https://claude.ai/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Antigravity CLI — secondary agent (install if missing)
if ! command -v agy &> /dev/null; then
    echo ""
    echo -e "${Y}Installing Antigravity CLI (secondary agent)...${NC}"
    curl -fsSL https://antigravity.google/cli/install.sh | bash
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

# Antigravity bridge (~/.gemini — secondary agent reuses the kun config)
if [ -f "$HOME/.gemini/config/mcp_config.json" ]; then
    python3 -c "import json; json.load(open('$HOME/.gemini/config/mcp_config.json'))" 2>/dev/null && \
        pass "antigravity mcp_config.json valid JSON" || fail "antigravity mcp_config.json invalid JSON"
else
    info "antigravity mcp_config.json missing (run antigravity-sync.sh)"
fi
[ -e "$HOME/.gemini/AGENTS.md" ] && pass "antigravity AGENTS.md → playbook" || info "antigravity AGENTS.md missing"
[ -e "$HOME/.gemini/skills" ]    && pass "antigravity skills → ~/.claude/skills" || info "antigravity skills missing"

# Directories
[ -d "$CLAUDE_DIR/agents" ] && [ "$(ls "$CLAUDE_DIR/agents/"*.md 2>/dev/null | wc -l)" -gt 0 ] && \
    pass "agents/ ($AGENT_COUNT files)" || fail "agents/ empty"
[ -d "$CLAUDE_DIR/skills" ] && [ "$(ls -d "$CLAUDE_DIR/skills/"*/ 2>/dev/null | wc -l)" -gt 0 ] && \
    pass "skills/ ($SKILL_COUNT dirs)" || fail "skills/ empty"
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
command -v agy &> /dev/null && pass "agy CLI (secondary)" || info "agy CLI not installed (optional)"

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
