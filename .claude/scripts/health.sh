#!/bin/bash
# Kun Config Health Check — verify and report Claude Code config health
# Usage: bash ~/.claude/scripts/health.sh [--report]
# --report: post results to the Config Health Dashboard issue in databayt/kun
#           (discovered by label `config-health`; created if absent).
# The daily maintain heartbeat (maintain.sh) runs this and posts weekly/on-RED.

set -e

CLAUDE_DIR="$HOME/.claude"
REPORT="${1:-}"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
HOSTNAME=$(hostname -s 2>/dev/null || echo "unknown")
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
SKILL_COUNT=$(ls -d "$CLAUDE_DIR/skills/"*/ 2>/dev/null | wc -l | tr -d ' ')
RULE_COUNT=$(ls "$CLAUDE_DIR/rules/"*.md 2>/dev/null | wc -l | tr -d ' ')

[ "$AGENT_COUNT" -gt 0 ] && check pass "agents/" "$AGENT_COUNT files" || check fail "agents/" "empty"
[ "$SKILL_COUNT" -gt 0 ] && check pass "skills/" "$SKILL_COUNT dirs" || check fail "skills/" "empty"
[ "$RULE_COUNT" -gt 0 ] && check pass "rules/" "$RULE_COUNT files" || check warn "rules/" "empty"
[ -d "$CLAUDE_DIR/memory" ] && check pass "memory/" "exists" || check warn "memory/" "missing"

# ── MCP server count (universal — every machine gets the full fleet) ──
# Secrets are scoped, not config: a server without a key just doesn't
# connect, so the full mcp.json is expected on every machine. Expectations
# come from engine.json (the declared truth) with hardcoded fallbacks.
EXPECTED=18
EXPECTED_SKILLS=30
ENGINE_JSON_SRC="${KUN_ROOT:-$HOME/kun}/.claude/engine.json"
if [ -f "$ENGINE_JSON_SRC" ] && command -v jq &> /dev/null; then
    EXPECTED=$(jq -r '.counts.project_mcp // 18' "$ENGINE_JSON_SRC")
    EXPECTED_SKILLS=$(jq -r '.counts.project_skills // 30' "$ENGINE_JSON_SRC")
fi
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    MCP_COUNT=$(grep -c '"description"' "$CLAUDE_DIR/mcp.json" 2>/dev/null || echo 0)
    [ "$MCP_COUNT" -ge "$EXPECTED" ] && check pass "MCP servers" "$MCP_COUNT (expected ≥$EXPECTED)" || \
        check warn "MCP servers" "$MCP_COUNT (expected ≥$EXPECTED)"
fi

# ── Expected skills (universal — full skill set on every machine; commands retired) ──
[ "$SKILL_COUNT" -ge "$EXPECTED_SKILLS" ] && check pass "skills" "$SKILL_COUNT (expected ≥$EXPECTED_SKILLS)" || \
    check warn "skills" "$SKILL_COUNT (expected ≥$EXPECTED_SKILLS)"
LEFTOVER_CMDS=$(ls "$CLAUDE_DIR/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$LEFTOVER_CMDS" = "0" ] && check pass "commands retired" "none left" || \
    check warn "commands retired" "$LEFTOVER_CMDS stale file(s) in ~/.claude/commands — re-run setup.sh to prune"

# ── Permissions ──────────────────────────────────────────────────
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    PERM=$(stat -f "%Lp" "$CLAUDE_DIR/settings.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/settings.json" 2>/dev/null)
    [[ "$PERM" == "600" ]] && check pass "settings perms" "600" || check warn "settings perms" "$PERM (should be 600)"
fi
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    PERM=$(stat -f "%Lp" "$CLAUDE_DIR/mcp.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/mcp.json" 2>/dev/null)
    [[ "$PERM" == "600" ]] && check pass "mcp perms" "600" || check warn "mcp perms" "$PERM (should be 600)"
fi

# ── CLI + agent matrix ───────────────────────────────────────────
if command -v claude &> /dev/null; then
    CLI_VERSION=$(claude --version 2>/dev/null | head -1 || echo "unknown")
    check pass "claude CLI" "$CLI_VERSION"
else
    check fail "claude CLI" "not installed"
fi

# Agent fleet matrix (c/a/o/claw) — claude is required, the rest are lanes.
AGENTS_LIB="$(dirname "${BASH_SOURCE[0]}")/lib/agents.sh"
[ -f "$AGENTS_LIB" ] || AGENTS_LIB="$HOME/kun/.claude/scripts/lib/agents.sh"
if [ -f "$AGENTS_LIB" ]; then
    # shellcheck disable=SC1090
    . "$AGENTS_LIB"
    command -v agy &>/dev/null && check pass "agent: agy" "$(agy --version 2>/dev/null | head -1)" || check warn "agent: agy" "not installed (secondary lane)"
    if command -v opencode &>/dev/null; then
        if _ag_opencode_bypass; then
            check pass "agent: opencode" "$(opencode --version 2>/dev/null | head -1) · permission: allow"
        else
            check warn "agent: opencode" "installed, bypass config not set (run onboarding or agents_configure_opencode)"
        fi
    else
        check warn "agent: opencode" "not installed (tertiary lane)"
    fi
    command -v openclaw &>/dev/null && check pass "agent: openclaw" "$(openclaw --version 2>/dev/null | head -1) (gateway)" || check warn "agent: openclaw" "not installed (optional gateway)"
    if _ag_alias_present c claude && _ag_alias_present a agy && _ag_alias_present o opencode && _ag_alias_present claw openclaw; then
        check pass "agent aliases" "c a o claw"
    else
        MISSING_ALIASES=""
        _ag_alias_present c claude || MISSING_ALIASES="$MISSING_ALIASES c"
        _ag_alias_present a agy || MISSING_ALIASES="$MISSING_ALIASES a"
        _ag_alias_present o opencode || MISSING_ALIASES="$MISSING_ALIASES o"
        _ag_alias_present claw openclaw || MISSING_ALIASES="$MISSING_ALIASES claw"
        check warn "agent aliases" "missing:$MISSING_ALIASES — onboarding writes the block"
    fi
fi

# ── Maintain heartbeat (the machine supervises itself) ──────────
MAINTAIN_STATE="$CLAUDE_DIR/.kun-maintain.json"
if [ -f "$MAINTAIN_STATE" ] && command -v python3 &> /dev/null; then
    M_TS=$(python3 -c "import json;print(json.load(open('$MAINTAIN_STATE')).get('ts',''))" 2>/dev/null)
    M_VERDICT=$(python3 -c "import json;print(json.load(open('$MAINTAIN_STATE')).get('verdict',''))" 2>/dev/null)
    if [ -n "$M_TS" ]; then
        M_EPOCH=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$M_TS" +%s 2>/dev/null || date -u -d "$M_TS" +%s 2>/dev/null || echo 0)
        M_AGE_H=$(( ($(date +%s) - M_EPOCH) / 3600 ))
        if [ "$M_AGE_H" -le 48 ]; then
            check pass "maintain heartbeat" "last run ${M_AGE_H}h ago ($M_VERDICT)"
        else
            check warn "maintain heartbeat" "stale — ${M_AGE_H}h since last run; check the scheduler (maintain.sh --status)"
        fi
    else
        check warn "maintain heartbeat" "state unreadable — run: bash ~/.claude/scripts/maintain.sh"
    fi
else
    check warn "maintain heartbeat" "never ran — arm it: bash ~/.claude/scripts/maintain.sh --install"
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
    EC_SKILLS=$(jq -r '.counts.project_skills' "$ENGINE_JSON")
    EC_CARDS=$(jq -r '.counts.pattern_cards' "$ENGINE_JSON")
    EC_RULES=$(jq -r '.counts.project_rules' "$ENGINE_JSON")
    EC_DOMAIN_RULES=$(jq -r '.counts.domain_rules' "$ENGINE_JSON")
    EC_MCP=$(jq -r '.counts.project_mcp' "$ENGINE_JSON")
    ER_AGENTS=$(find "$KUN_ROOT/.claude/agents" -maxdepth 1 -name '*.md' ! -name '_index*' 2>/dev/null | wc -l | tr -d ' ')
    ER_SKILLS=$(find "$KUN_ROOT/.claude/skills" -mindepth 2 -maxdepth 2 -name 'SKILL.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_CARDS=$(find "$KUN_ROOT/.claude/patterns/cards" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_RULES=$(find "$KUN_ROOT/.claude/rules" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_DOMAIN_RULES=$(find "$KUN_ROOT/.claude/rules" -mindepth 2 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    ER_MCP=$(jq '.mcpServers | length' "$KUN_ROOT/.claude/mcp.json" 2>/dev/null || echo "?")
    [ "$EC_AGENTS" = "$ER_AGENTS" ] && check pass "engine agents" "$ER_AGENTS" || check warn "engine agents" "engine.json=$EC_AGENTS actual=$ER_AGENTS"
    [ "$EC_SKILLS" = "$ER_SKILLS" ] && check pass "engine skills" "$ER_SKILLS" || check warn "engine skills" "engine.json=$EC_SKILLS actual=$ER_SKILLS"
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

    # Find or create the health issue (label must exist before issue create).
    # On create, parse the issue number from the printed URL — re-listing
    # immediately after create races GitHub's eventually-consistent index.
    ISSUE_NUM=$(gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>/dev/null || echo "")

    if [ -z "$ISSUE_NUM" ]; then
        gh label create config-health --repo databayt/kun --force >/dev/null 2>&1 || true
        ISSUE_URL=$(gh issue create --repo databayt/kun \
            --title "Config Health Dashboard" \
            --label "config-health" \
            --body "$(cat <<'ISSUEBODY'
# Config Health Dashboard

Automated health reports from all team members' Claude Code configurations.

Each comment below is a health check from a team member's machine. Latest comment = latest status.

**Setup**: armed automatically by `setup.sh` / `setup.ps1` — the daily maintain heartbeat (`maintain.sh` / `maintain.ps1`) posts here weekly and immediately on RED
**Manual**: `bash ~/.claude/scripts/health.sh --report` (Windows: `health.ps1 -Report`)
ISSUEBODY
)" 2>/dev/null)
        ISSUE_NUM="${ISSUE_URL##*/}"
    fi

    if [ -n "$ISSUE_NUM" ]; then
        gh issue comment "$ISSUE_NUM" --repo databayt/kun --body "$BODY"
        echo "Reported to databayt/kun#$ISSUE_NUM"
    else
        echo "Could not find or create health issue"
        exit 1
    fi
fi
