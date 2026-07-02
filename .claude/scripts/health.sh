#!/bin/bash
# Kun Config Health Check — verify and report Claude Code config health
# Usage: bash ~/.claude/scripts/health.sh [--report]
# --report: post results to GitHub issue databayt/kun#health

set -e

CLAUDE_DIR="$HOME/.claude"
REPORT="${1:-}"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
HOSTNAME=$(hostname -s 2>/dev/null || echo "unknown")
WHO=$(whoami)
OS=$(uname -s)
ERRORS=0
WARNINGS=0
CHECKS=""

check() {
    local status="$1" name="$2" detail="$3"
    if [[ "$status" == "pass" ]]; then
        CHECKS="${CHECKS}| ✅ | ${name} | ${detail} |\n"
    elif [[ "$status" == "warn" ]]; then
        CHECKS="${CHECKS}| ⚠️ | ${name} | ${detail} |\n"
        WARNINGS=$((WARNINGS + 1))
    else
        CHECKS="${CHECKS}| ❌ | ${name} | ${detail} |\n"
        ERRORS=$((ERRORS + 1))
    fi
}

# ── Detect role from mcp.json ───────────────────────────────────
ROLE="unknown"
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    if grep -q '"shadcn"' "$CLAUDE_DIR/mcp.json" 2>/dev/null; then
        ROLE="engineer"
    elif grep -q '"linear"' "$CLAUDE_DIR/mcp.json" 2>/dev/null; then
        ROLE="business"
    elif grep -q '"figma"' "$CLAUDE_DIR/mcp.json" 2>/dev/null; then
        ROLE="content"
    elif grep -q '"posthog"' "$CLAUDE_DIR/mcp.json" 2>/dev/null; then
        ROLE="ops"
    fi
fi

# ── Core files ───────────────────────────────────────────────────
[ -f "$CLAUDE_DIR/CLAUDE.md" ] && check pass "CLAUDE.md" "exists" || check fail "CLAUDE.md" "missing"
[ -f "$CLAUDE_DIR/settings.json" ] && check pass "settings.json" "exists" || check fail "settings.json" "missing"
[ -f "$CLAUDE_DIR/mcp.json" ] && check pass "mcp.json" "exists" || check fail "mcp.json" "missing"

# ── JSON validity ────────────────────────────────────────────────
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    python3 -c "import json; json.load(open('$CLAUDE_DIR/settings.json'))" 2>/dev/null && \
        check pass "settings.json" "valid JSON" || check fail "settings.json" "invalid JSON"
fi
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    python3 -c "import json; json.load(open('$CLAUDE_DIR/mcp.json'))" 2>/dev/null && \
        check pass "mcp.json" "valid JSON" || check fail "mcp.json" "invalid JSON"
fi

# ── Directories ──────────────────────────────────────────────────
AGENT_COUNT=$(ls "$CLAUDE_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
CMD_COUNT=$(ls "$CLAUDE_DIR/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
RULE_COUNT=$(ls "$CLAUDE_DIR/rules/"*.md 2>/dev/null | wc -l | tr -d ' ')

[ "$AGENT_COUNT" -gt 0 ] && check pass "agents/" "$AGENT_COUNT files" || check fail "agents/" "empty"
[ "$CMD_COUNT" -gt 0 ] && check pass "commands/" "$CMD_COUNT files" || check fail "commands/" "empty"
[ "$RULE_COUNT" -gt 0 ] && check pass "rules/" "$RULE_COUNT files" || check warn "rules/" "empty"
[ -d "$CLAUDE_DIR/memory" ] && check pass "memory/" "exists" || check warn "memory/" "missing"

# ── MCP server count (universal — every machine gets the full fleet) ──
# Secrets are scoped, not config: a server without a key just doesn't
# connect, so the full mcp.json is expected on every machine.
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    MCP_COUNT=$(grep -c '"description"' "$CLAUDE_DIR/mcp.json" 2>/dev/null || echo 0)
    EXPECTED=18
    [ "$MCP_COUNT" -ge "$EXPECTED" ] && check pass "MCP servers" "$MCP_COUNT (expected ≥$EXPECTED)" || \
        check warn "MCP servers" "$MCP_COUNT (expected ≥$EXPECTED)"
fi

# ── Expected commands (universal — full skill set on every machine) ──
EXPECTED_CMDS=20
[ "$CMD_COUNT" -ge "$EXPECTED_CMDS" ] && check pass "commands" "$CMD_COUNT (expected ≥$EXPECTED_CMDS)" || \
    check warn "commands" "$CMD_COUNT (expected ≥$EXPECTED_CMDS)"

# ── Permissions ──────────────────────────────────────────────────
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    PERM=$(stat -f "%Lp" "$CLAUDE_DIR/settings.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/settings.json" 2>/dev/null)
    [[ "$PERM" == "600" ]] && check pass "settings perms" "600" || check warn "settings perms" "$PERM (should be 600)"
fi
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    PERM=$(stat -f "%Lp" "$CLAUDE_DIR/mcp.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/mcp.json" 2>/dev/null)
    [[ "$PERM" == "600" ]] && check pass "mcp perms" "600" || check warn "mcp perms" "$PERM (should be 600)"
fi

# ── CLI ──────────────────────────────────────────────────────────
if command -v claude &> /dev/null; then
    CLI_VERSION=$(claude --version 2>/dev/null | head -1 || echo "unknown")
    check pass "claude CLI" "$CLI_VERSION"
else
    check fail "claude CLI" "not installed"
fi

# ── Staleness (CLAUDE.md age) ────────────────────────────────────
if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
    if [[ "$OS" == "Darwin" ]]; then
        MOD_EPOCH=$(stat -f %m "$CLAUDE_DIR/CLAUDE.md")
    else
        MOD_EPOCH=$(stat -c %Y "$CLAUDE_DIR/CLAUDE.md")
    fi
    NOW_EPOCH=$(date +%s)
    AGE_DAYS=$(( (NOW_EPOCH - MOD_EPOCH) / 86400 ))
    if [ "$AGE_DAYS" -le 7 ]; then
        check pass "config age" "${AGE_DAYS}d old"
    elif [ "$AGE_DAYS" -le 30 ]; then
        check warn "config age" "${AGE_DAYS}d old — consider re-running setup"
    else
        check fail "config age" "${AGE_DAYS}d old — stale, re-run setup"
    fi
fi

# ── Engine consistency (kun repo) ────────────────────────────────
# Reads the kun repo's .claude/engine.json (single source of truth) and warns
# when docs or repo reality drift from it. Skipped on machines without ~/kun.
KUN_ROOT="${KUN_ROOT:-$HOME/kun}"
ENGINE_JSON="$KUN_ROOT/.claude/engine.json"
if [ -f "$ENGINE_JSON" ] && command -v jq &> /dev/null; then
    EC_AGENTS=$(jq -r '.counts.project_agents' "$ENGINE_JSON")
    EC_CMDS=$(jq -r '.counts.commands' "$ENGINE_JSON")
    EC_CARDS=$(jq -r '.counts.pattern_cards' "$ENGINE_JSON")
    EC_RULES=$(jq -r '.counts.project_rules' "$ENGINE_JSON")
    EC_DOMAIN_RULES=$(jq -r '.counts.domain_rules' "$ENGINE_JSON")
    EC_MCP=$(jq -r '.counts.project_mcp' "$ENGINE_JSON")
    ER_AGENTS=$(find "$KUN_ROOT/.claude/agents" -maxdepth 1 -name '*.md' ! -name '_index*' 2>/dev/null | wc -l | tr -d ' ')
    ER_CMDS=$(find "$KUN_ROOT/.claude/commands" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_CARDS=$(find "$KUN_ROOT/.claude/patterns/cards" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_RULES=$(find "$KUN_ROOT/.claude/rules" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_DOMAIN_RULES=$(find "$KUN_ROOT/.claude/rules" -mindepth 2 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_MCP=$(jq '.mcpServers | length' "$KUN_ROOT/.claude/mcp.json" 2>/dev/null || echo "?")
    [ "$EC_AGENTS" = "$ER_AGENTS" ] && check pass "engine agents" "$ER_AGENTS" || check warn "engine agents" "engine.json=$EC_AGENTS actual=$ER_AGENTS"
    [ "$EC_CMDS" = "$ER_CMDS" ] && check pass "engine commands" "$ER_CMDS" || check warn "engine commands" "engine.json=$EC_CMDS actual=$ER_CMDS"
    [ "$EC_CARDS" = "$ER_CARDS" ] && check pass "engine cards" "$ER_CARDS" || check warn "engine cards" "engine.json=$EC_CARDS actual=$ER_CARDS"
    [ "$EC_RULES" = "$ER_RULES" ] && check pass "engine rules" "$ER_RULES" || check warn "engine rules" "engine.json=$EC_RULES actual=$ER_RULES"
    [ "$EC_DOMAIN_RULES" = "$ER_DOMAIN_RULES" ] && check pass "engine domain-rules" "$ER_DOMAIN_RULES" || check warn "engine domain-rules" "engine.json=$EC_DOMAIN_RULES actual=$ER_DOMAIN_RULES"
    [ "$EC_MCP" = "$ER_MCP" ] && check pass "engine mcp" "$ER_MCP" || check warn "engine mcp" "engine.json=$EC_MCP actual=$ER_MCP"
    if grep -rq "Opus 4\.6\|Opus 4\.7\|claude-opus-4-6\|claude-opus-4-7" "$KUN_ROOT/docs" "$KUN_ROOT/.claude/CLAUDE.md" 2>/dev/null; then
        check warn "engine model refs" "stale Opus 4.6/4.7 in docs"
    else
        check pass "engine model refs" "$(jq -r '.model_label' "$ENGINE_JSON") canonical"
    fi
    if grep -q "28 Agents\|17 Skills\|18 MCP Servers" "$KUN_ROOT/docs/ARCHITECTURE.md" 2>/dev/null; then
        check warn "engine doc counts" "stale count box in ARCHITECTURE.md"
    else
        check pass "engine doc counts" "current"
    fi
    if [ -f "$KUN_ROOT/.claude/scripts/build-plugin.sh" ]; then
        if bash "$KUN_ROOT/.claude/scripts/build-plugin.sh" --check >/dev/null 2>&1; then
            check pass "plugin parity" "kun-stack + kun-company in sync"
        else
            check warn "plugin parity" "plugins drifted — run build-plugin.sh"
        fi
    fi
    if [ -f "$KUN_ROOT/.claude/scripts/generate-vocab.mjs" ] && command -v node &> /dev/null; then
        if node "$KUN_ROOT/.claude/scripts/generate-vocab.mjs" --check >/dev/null 2>&1; then
            check pass "vocabulary" "registry ↔ CLAUDE.md ↔ spellbook in sync"
        else
            check warn "vocabulary" "drift or dangling targets — run generate-vocab.mjs"
        fi
    fi
fi

# ── Build status line ────────────────────────────────────────────
if [ $ERRORS -gt 0 ]; then
    STATUS="❌ $ERRORS errors"
elif [ $WARNINGS -gt 0 ]; then
    STATUS="⚠️ $WARNINGS warnings"
else
    STATUS="✅ healthy"
fi

# ── Output ───────────────────────────────────────────────────────
echo "$STATUS — $ROLE @ $HOSTNAME"
echo ""
echo "| | Check | Detail |"
echo "|---|-------|--------|"
echo -e "$CHECKS"

# ── Report to GitHub ─────────────────────────────────────────────
if [[ "$REPORT" == "--report" ]]; then
    if ! command -v gh &> /dev/null; then
        echo "gh CLI not installed — cannot report to GitHub"
        exit 1
    fi

    BODY="### $HOSTNAME — $ROLE
**Status**: $STATUS
**Time**: $TIMESTAMP
**OS**: $OS
**CLI**: $(claude --version 2>/dev/null | head -1 || echo 'N/A')

| | Check | Detail |
|---|-------|--------|
$(echo -e "$CHECKS")
---"

    # Find or create the health issue
    ISSUE_NUM=$(gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>/dev/null || echo "")

    if [ -z "$ISSUE_NUM" ]; then
        # Create the issue
        gh issue create --repo databayt/kun \
            --title "Config Health Dashboard" \
            --label "config-health" \
            --body "$(cat <<'ISSUEBODY'
# Config Health Dashboard

Automated health reports from all team members' Claude Code configurations.

Each comment below is a health check from a team member's machine. Latest comment = latest status.

**Setup**: each member runs `bash ~/.claude/scripts/health.sh --report`
**Schedule**: runs automatically via Claude Code `/schedule` or manually
ISSUEBODY
)"
        ISSUE_NUM=$(gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>/dev/null)
    fi

    if [ -n "$ISSUE_NUM" ]; then
        gh issue comment "$ISSUE_NUM" --repo databayt/kun --body "$BODY"
        echo "Reported to databayt/kun#$ISSUE_NUM"
    else
        echo "Could not find or create health issue"
        exit 1
    fi
fi
