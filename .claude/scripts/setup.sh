#!/bin/bash
# Kun Engine Setup — install, update, and verify Claude Code config
# Usage: cd ~/kun && bash .claude/scripts/setup.sh <role> [--quiet]
# Roles: engineer, business, content, ops
# The role persists to ~/.claude/.kun-role, so refresh runs (and the daily
# maintain heartbeat) can omit it: bash .claude/scripts/setup.sh --quiet

set -e

QUIET=0
ROLE=""
for arg in "$@"; do
    case "$arg" in
        --quiet) QUIET=1 ;;
        --*) echo "Unknown flag: $arg" >&2; exit 1 ;;
        *) [ -z "$ROLE" ] && ROLE="$arg" ;;
    esac
done

KUN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
MODE="install"

# Colors
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' D='\033[2m' NC='\033[0m'
pass() { [ "$QUIET" = 1 ] || echo -e "  ${G}✓${NC} $1"; }
fail() { echo -e "  ${R}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
info() { [ "$QUIET" = 1 ] || echo -e "  ${D}·${NC} $1"; }
say()  { [ "$QUIET" = 1 ] || echo -e "$1"; }

# ── Role validation ──────────────────────────────────────────────
# Fall back to the persisted role so unattended refreshes need no args.
if [[ -z "$ROLE" && -f "$CLAUDE_DIR/.kun-role" ]]; then
    ROLE="$(tr -d '[:space:]' < "$CLAUDE_DIR/.kun-role")"
fi

# Minimal interaction: role is a label only (every machine gets the full
# config), so a bare `setup.sh` just works — default to engineer.
if [[ -z "$ROLE" ]]; then
    ROLE="engineer"
    say "${D}No role given — defaulting to engineer (role is a label; config is universal)${NC}"
fi

if [[ "$ROLE" != "engineer" && "$ROLE" != "business" && "$ROLE" != "content" && "$ROLE" != "ops" ]]; then
    echo -e "${R}Invalid role: $ROLE${NC}"
    echo "Valid: engineer, business, content, ops"
    exit 1
fi

[ -d "$CLAUDE_DIR/agents" ] && MODE="update"

say "${B}Kun Engine Setup${NC} — ${G}$ROLE${NC} ($MODE)"
say ""

# ── Common config (all roles) ───────────────────────────────────
say "${B}Common config${NC}"

mkdir -p "$CLAUDE_DIR"/{agents,commands,rules,memory,scripts,skills,hooks}
echo "$ROLE" > "$CLAUDE_DIR/.kun-role"
info "directories"

# User-global CLAUDE.md — install from the TEMPLATE only if missing. Never
# clobber: ~/.claude/CLAUDE.md is the teammate's personal global config
# (Component Hierarchy, imports, machine quirks); the kun PROJECT CLAUDE.md
# loads separately inside the repo and must not overwrite it.
if [ ! -f "$CLAUDE_DIR/CLAUDE.md" ]; then
    if [ -f "$KUN_DIR/.claude/templates/user-CLAUDE.md" ]; then
        cp "$KUN_DIR/.claude/templates/user-CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
        info "CLAUDE.md (installed from template)"
    else
        cp "$KUN_DIR/.claude/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
        info "CLAUDE.md (template missing — used project copy)"
    fi
else
    info "CLAUDE.md (existing — left untouched)"
fi

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

# Shared script libs (health.sh sources lib/agents.sh — keep the installed
# copy self-contained instead of leaning on the ~/kun fallback)
if [ -d "$KUN_DIR/.claude/scripts/lib" ]; then
    mkdir -p "$CLAUDE_DIR/scripts/lib"
    cp "$KUN_DIR/.claude/scripts/lib/"* "$CLAUDE_DIR/scripts/lib/" 2>/dev/null || true
    info "scripts/lib"
fi

# User-global hooks (e.g. session-maintain-status.sh runs in EVERY project,
# so it must live under ~/.claude/hooks, not only inside the kun repo)
if [ -d "$KUN_DIR/.claude/hooks" ]; then
    cp "$KUN_DIR/.claude/hooks/"*.sh "$CLAUDE_DIR/hooks/" 2>/dev/null || true
    chmod +x "$CLAUDE_DIR/hooks/"*.sh 2>/dev/null || true
    info "hooks"
fi

say ""

# ── Full config (universal — every machine is a full autonomous worker) ──
# Role no longer scopes capability; it's only a label + secrets-trust tier.
# Secrets stay scoped via which Gist you're handed — MCP servers without a
# key simply don't connect, so a full mcp.json is safe everywhere.
say "${B}Full config${NC}"

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

# ── Manifest prune ───────────────────────────────────────────────
# ~/.claude mixes engine-managed items with personal ones. The manifest
# records what THIS installer shipped; a manifest-listed item that has since
# left the kun source gets pruned. Personal (non-manifest) items are never
# touched, and the first run (no manifest yet) prunes nothing.
MANIFEST="$CLAUDE_DIR/.kun-manifest.json"
PRUNE_OUT=$(python3 - "$KUN_DIR" "$CLAUDE_DIR" "$MANIFEST" <<'PYEOF'
import json, os, shutil, sys, time

kun, claude, manifest_path = sys.argv[1], sys.argv[2], sys.argv[3]

def names(path, kind):
    if not os.path.isdir(path):
        return []
    if kind == "dir":
        return sorted(d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d)))
    return sorted(f for f in os.listdir(path) if f.endswith(kind))

src = {
    "skills":    names(os.path.join(kun, ".claude/skills"), "dir"),
    "agents":    names(os.path.join(kun, ".claude/agents"), ".md"),
    "workflows": names(os.path.join(kun, ".claude/workflows"), ".js"),
    "rules":     names(os.path.join(kun, ".claude/rules"), ".md"),
}

pruned = []
if os.path.isfile(manifest_path):
    try:
        with open(manifest_path) as f:
            old = json.load(f)
    except Exception:
        old = {}
    targets = {
        "skills":    (os.path.join(claude, "skills"), True),
        "agents":    (os.path.join(claude, "agents"), False),
        "workflows": (os.path.join(claude, "workflows"), False),
        "rules":     (os.path.join(claude, "rules"), False),
    }
    for key, (base, is_dir) in targets.items():
        for name in old.get(key, []):
            if name in src[key]:
                continue  # still shipped by the engine
            target = os.path.join(base, name)
            if is_dir and os.path.isdir(target):
                shutil.rmtree(target)
                pruned.append(f"{key}/{name}")
            elif not is_dir and os.path.isfile(target):
                os.remove(target)
                pruned.append(f"{key}/{name}")

new = {"schema": 1, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **src}
tmp = manifest_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(new, f, indent=2)
    f.write("\n")
os.replace(tmp, manifest_path)

print(len(pruned))
for p in pruned:
    print(p)
PYEOF
) || PRUNE_OUT="0"
PRUNE_COUNT=$(echo "$PRUNE_OUT" | head -1)
if [ "${PRUNE_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    info "pruned $PRUNE_COUNT stale engine item(s): $(echo "$PRUNE_OUT" | tail -n +2 | tr '\n' ' ')"
else
    info "manifest current (no stale engine items)"
fi

# Full agent index
if [ -f "$KUN_DIR/.claude/agents/_index.md" ]; then
    cp "$KUN_DIR/.claude/agents/_index.md" "$CLAUDE_DIR/agents/_index.md"
    info "agent index (_index.md)"
fi

# Full settings + hooks — engine-defined keys win, but personal top-level
# keys the engine doesn't define (model, effortLevel, voice, …) survive the
# refresh. Anything deeper than top level is engine territory.
SRC_SETTINGS="$KUN_DIR/.claude/settings.json"
if [[ "$(uname)" != "Darwin" ]] && [ -f "$KUN_DIR/.claude/settings-windows.json" ]; then
    SRC_SETTINGS="$KUN_DIR/.claude/settings-windows.json"
fi
python3 - "$SRC_SETTINGS" "$CLAUDE_DIR/settings.json" <<'PYEOF' || cp "$SRC_SETTINGS" "$CLAUDE_DIR/settings.json"
import json, os, sys
src_path, dst_path = sys.argv[1], sys.argv[2]
with open(src_path) as f:
    merged = json.load(f)
if os.path.isfile(dst_path):
    try:
        with open(dst_path) as f:
            old = json.load(f)
        for key, value in old.items():
            if key not in merged:
                merged[key] = value  # personal key — preserve
    except Exception:
        pass  # unreadable old settings — engine copy wins wholesale
tmp = dst_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(merged, f, indent=2)
    f.write("\n")
os.replace(tmp, dst_path)
PYEOF
chmod 600 "$CLAUDE_DIR/settings.json" 2>/dev/null || true
info "settings (engine keys refreshed, personal keys preserved)"

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
    if [ "$QUIET" = 1 ]; then
        bash "$KUN_DIR/.claude/scripts/antigravity-sync.sh" >/dev/null 2>&1 || true
    else
        bash "$KUN_DIR/.claude/scripts/antigravity-sync.sh"
    fi
fi

# Codebase clone (every machine)
CODEBASE_DIR="$HOME/codebase"
if [ ! -d "$CODEBASE_DIR" ]; then
    say ""
    say "${Y}Cloning codebase...${NC}"
    git clone git@github.com:databayt/codebase.git "$CODEBASE_DIR" 2>/dev/null || \
    git clone https://github.com/databayt/codebase.git "$CODEBASE_DIR" 2>/dev/null || \
    info "clone failed — run manually: git clone git@github.com:databayt/codebase.git ~/codebase"
fi

# Claude CLI (install if missing)
if ! command -v claude &> /dev/null; then
    say ""
    say "${Y}Installing Claude Code CLI...${NC}"
    curl -fsSL https://claude.ai/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Antigravity CLI — secondary agent (install if missing)
if ! command -v agy &> /dev/null; then
    say ""
    say "${Y}Installing Antigravity CLI (secondary agent)...${NC}"
    curl -fsSL https://antigravity.google/cli/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
fi

# Arm the daily maintain heartbeat (pull → refresh → health → report)
if [ -f "$KUN_DIR/.claude/scripts/maintain.sh" ]; then
    bash "$KUN_DIR/.claude/scripts/maintain.sh" --install --quiet || info "maintain scheduling failed (non-fatal)"
    info "maintain heartbeat armed"
fi

say ""

# ── Health check ─────────────────────────────────────────────────
say "${B}Health check${NC}"
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

# Manifest
[ -f "$MANIFEST" ] && pass "manifest (.kun-manifest.json)" || fail "manifest missing"

# Permissions
SETTINGS_PERM=$(stat -f "%Lp" "$CLAUDE_DIR/settings.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/settings.json" 2>/dev/null)
MCP_PERM=$(stat -f "%Lp" "$CLAUDE_DIR/mcp.json" 2>/dev/null || stat -c "%a" "$CLAUDE_DIR/mcp.json" 2>/dev/null)
[[ "$SETTINGS_PERM" == "600" ]] && pass "settings.json permissions (600)" || info "settings.json permissions ($SETTINGS_PERM)"
[[ "$MCP_PERM" == "600" ]] && pass "mcp.json permissions (600)" || info "mcp.json permissions ($MCP_PERM)"

# CLI
command -v claude &> /dev/null && pass "claude CLI installed" || fail "claude CLI not found"
command -v agy &> /dev/null && pass "agy CLI (secondary)" || info "agy CLI not installed (optional)"

say ""

# ── Summary ──────────────────────────────────────────────────────
if [ $ERRORS -eq 0 ]; then
    say "${G}Setup complete${NC} — $ROLE ($MODE)"
else
    echo -e "${Y}Setup complete with $ERRORS issue(s)${NC} — $ROLE ($MODE)"
fi

say ""
say "${D}Config: $CLAUDE_DIR${NC}"
say "${D}Re-run anytime: cd ~/kun && bash .claude/scripts/setup.sh $ROLE${NC}"
