#!/bin/bash
# Antigravity bridge — make the secondary agent (`agy`) reuse the kun config.
#
# Wires ~/.gemini/ to the config setup.sh already installed in ~/.claude/:
#   • MCP fleet   ~/.claude/mcp.json  → ~/.gemini/config/mcp_config.json (transformed)
#   • skills      ~/.gemini/skills    → ~/.claude/skills      (symlink)
#   • playbook    ~/.gemini/AGENTS.md → ~/.claude/CLAUDE.md   (symlink)
#   • doctrine    ~/.gemini/GEMINI.md ← .claude/antigravity/GEMINI.md (copy)
#
# Idempotent. Called by setup.sh after the MCP copy; safe to run standalone.
# Usage: bash .claude/scripts/antigravity-sync.sh

# `kun compile --only agy` is the maintained version of this script (same behaviour, plus --check and a
# merge that keeps servers kun does not own). Delegate to it; KUN_SYNC_LEGACY=1 runs the original below.
_KUN="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -z "${KUN_SYNC_LEGACY:-}" ] && command -v node >/dev/null 2>&1 && [ -f "$_KUN/.claude/scripts/compile/index.mjs" ]; then
    exec node "$_KUN/.claude/scripts/compile/index.mjs" --only agy
fi

CLAUDE_DIR="$HOME/.claude"
GEMINI_DIR="$HOME/.gemini"
KUN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

D='\033[2m' G='\033[0;32m' NC='\033[0m'
info() { echo -e "  ${D}·${NC} $1"; }
pass() { echo -e "  ${G}✓${NC} $1"; }

mkdir -p "$GEMINI_DIR/config"

# ── 1. MCP fleet ──────────────────────────────────────────────────
# Antigravity reads the same shape as Claude (top-level mcpServers,
# command/args/env for stdio) but remote servers use `serverUrl` instead of
# Claude's `type:http|sse` + `url`, and it ignores `registries`/`description`.
# Transform rather than symlink so all servers — incl. the ~8 remote ones —
# actually connect.
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    python3 - "$CLAUDE_DIR/mcp.json" "$GEMINI_DIR/config/mcp_config.json" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src))
out = {}
for name, s in (data.get("mcpServers") or {}).items():
    if not isinstance(s, dict):
        continue
    entry = {}
    # remote server → serverUrl (Antigravity's key for http/sse endpoints)
    if s.get("type") in ("http", "sse") or "serverUrl" in s or "url" in s:
        url = s.get("serverUrl") or s.get("url")
        if not url:
            continue
        entry["serverUrl"] = url
    elif "command" in s:                       # local stdio server
        entry["command"] = s["command"]
        if "args" in s:
            entry["args"] = s["args"]
    else:
        continue
    if isinstance(s.get("env"), dict):
        entry["env"] = s["env"]
    if isinstance(s.get("headers"), dict):
        entry["headers"] = s["headers"]
    out[name] = entry
with open(dst, "w") as f:
    json.dump({"mcpServers": out}, f, indent=2)
    f.write("\n")
print(len(out))
PY
    chmod 600 "$GEMINI_DIR/config/mcp_config.json" 2>/dev/null || true
    MCP_N=$(python3 -c "import json;print(len(json.load(open('$GEMINI_DIR/config/mcp_config.json'))['mcpServers']))" 2>/dev/null || echo "?")
    pass "MCP fleet ($MCP_N → ~/.gemini/config/mcp_config.json)"
else
    info "~/.claude/mcp.json missing — run setup.sh first; MCP not synced"
fi

# ── 2. Skills parity ──────────────────────────────────────────────
# Same SKILL.md layout on both sides, so one directory symlink shares them all.
if [ -d "$CLAUDE_DIR/skills" ]; then
    if [ ! -e "$GEMINI_DIR/skills" ] || [ -L "$GEMINI_DIR/skills" ]; then
        ln -sfn "$CLAUDE_DIR/skills" "$GEMINI_DIR/skills"
        pass "skills → ~/.claude/skills"
    else
        info "~/.gemini/skills is a real directory — left in place"
    fi
else
    info "~/.claude/skills missing — skills not bridged"
fi

# ── 3. Shared playbook ────────────────────────────────────────────
# Antigravity reads ~/.gemini/AGENTS.md for cross-tool rules; point it at the
# kun playbook so both agents share one brain.
if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
    if [ ! -e "$GEMINI_DIR/AGENTS.md" ] || [ -L "$GEMINI_DIR/AGENTS.md" ]; then
        ln -sf "$CLAUDE_DIR/CLAUDE.md" "$GEMINI_DIR/AGENTS.md"
        pass "playbook (AGENTS.md → ~/.claude/CLAUDE.md)"
    else
        info "~/.gemini/AGENTS.md is a real file — left in place"
    fi
fi

# ── 4. Antigravity-specific doctrine ──────────────────────────────
# GEMINI.md takes precedence over AGENTS.md in Antigravity — the place for
# "you are the secondary agent" overrides without touching the shared playbook.
GEMINI_TEMPLATE=""
for cand in "$KUN_DIR/.claude/antigravity/GEMINI.md" "$CLAUDE_DIR/antigravity/GEMINI.md"; do
    [ -f "$cand" ] && { GEMINI_TEMPLATE="$cand"; break; }
done
if [ -n "$GEMINI_TEMPLATE" ]; then
    cp "$GEMINI_TEMPLATE" "$GEMINI_DIR/GEMINI.md"
    pass "doctrine (~/.gemini/GEMINI.md)"
else
    info "GEMINI.md template not found — doctrine skipped"
fi

# ── 5. Workspace skills mirror ────────────────────────────────────
# .agents/skills is the workspace copy of .claude/skills (Antigravity/Codex). Nothing generated
# it before mirror-agents.mjs; it copies what differs and never deletes.
if command -v node >/dev/null 2>&1 && [ -f "$KUN_DIR/.claude/scripts/mirror-agents.mjs" ]; then
    node "$KUN_DIR/.claude/scripts/mirror-agents.mjs" | tail -1 | sed 's/^/  · /'
    pass "workspace skills (.agents/skills ← .claude/skills)"
fi
