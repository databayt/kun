#!/bin/bash
# =============================================================================
# lib/agents.sh — the agent fleet: detect, install-target, aliases, bypass
# =============================================================================
# Shared by installer.sh (scan-first wizard), onboarding-mac.sh / -linux.sh
# (Phase 0 scan + Phase 5 installs), and health.sh (agent matrix).
#
# The fleet (one login-alias per lane):
#   c — Claude Code (primary)       bypass: --dangerously-skip-permissions
#   a — Antigravity `agy` (second)  bypass: --dangerously-skip-permissions
#   o — opencode (tertiary)         bypass: config-level "permission": "allow"
#   h — Hermes (optional)           assistant GATEWAY (NousResearch), not a coding CLI
#
# Source it:  . "$(dirname "$0")/lib/agents.sh"
# Functions:  agents_detect_all | agents_detect_json | agents_delta <sel>
#             agents_write_alias_block <sel> | agents_configure_opencode
#             agents_selected_contains <sel> <name>
# <sel> is "all" or a csv of: code,desktop,agy,opencode,hermes
# (legacy token "openclaw" in persisted wizard state is normalized to "hermes")
# =============================================================================

# Colors (guard: don't clobber a sourcing script's palette)
_AG_G='\033[0;32m'; _AG_R='\033[0;31m'; _AG_Y='\033[1;33m'; _AG_D='\033[2m'; _AG_NC='\033[0m'

_ag_has() { command -v "$1" >/dev/null 2>&1; }

_ag_ver() { # _ag_ver <cmd> → first line of --version or empty
    _ag_has "$1" && "$1" --version 2>/dev/null | head -1 || true
}

_ag_alias_present() { # _ag_alias_present <name> <tool> — OUR alias/function in any rc
    local name="$1" tool="$2" rc
    for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
        [ -f "$rc" ] || continue
        grep -qE "^(alias $name=.*$tool|function $name .*$tool)" "$rc" 2>/dev/null && return 0
    done
    return 1
}

_ag_opencode_bypass() { # opencode's yolo is config-level, not a flag
    [ -f "$HOME/.config/opencode/opencode.json" ] && \
        grep -q '"permission"[[:space:]]*:[[:space:]]*"allow"' "$HOME/.config/opencode/opencode.json" 2>/dev/null
}

agents_selected_contains() { # agents_selected_contains "<sel>" <name>
    local sel="${1:-all}" name="$2"
    sel="${sel//openclaw/hermes}"  # legacy token from pre-Hermes wizard state
    [ "$sel" = "all" ] && return 0
    case ",$sel," in *",$name,"*) return 0 ;; *) return 1 ;; esac
}

# ── Scan ─────────────────────────────────────────────────────────
_ag_row() { # _ag_row <label> <status:ok|miss|warn> <detail>
    case "$2" in
        ok)   printf "  ${_AG_G}✓${_AG_NC} %-16s %s\n" "$1" "$3" ;;
        warn) printf "  ${_AG_Y}○${_AG_NC} %-16s %s\n" "$1" "$3" ;;
        *)    printf "  ${_AG_R}✗${_AG_NC} %-16s ${_AG_R}%s${_AG_NC}\n" "$1" "${3:-MISSING}" ;;
    esac
}

agents_detect_all() {
    echo ""
    printf "${_AG_D}Scan — system${_AG_NC}\n"
    _ag_row "os" ok "$(uname -s) $(uname -m) ($(sw_vers -productVersion 2>/dev/null || uname -r))"
    local t
    for t in brew git node pnpm gh; do
        if _ag_has "$t"; then _ag_row "$t" ok "$(_ag_ver "$t" | head -c 60)"; else _ag_row "$t" miss; fi
    done
    echo ""
    printf "${_AG_D}Scan — agents${_AG_NC}\n"
    # Claude Code
    if _ag_has claude; then _ag_row "claude" ok "$(_ag_ver claude)"; else _ag_row "claude" miss; fi
    _ag_alias_present c claude && _ag_row "  alias c" ok "bypass launcher" || _ag_row "  alias c" miss "no launcher"
    # Claude Desktop
    if [ -d "/Applications/Claude.app" ]; then
        if [ -e "$HOME/Library/Application Support/Claude/claude_desktop_config.json" ]; then
            _ag_row "claude desktop" ok "app + MCP config"
        else
            _ag_row "claude desktop" warn "app present, MCP config not wired"
        fi
    else
        _ag_row "claude desktop" miss
    fi
    # Antigravity
    if _ag_has agy; then _ag_row "agy" ok "$(_ag_ver agy)"; else _ag_row "agy" miss; fi
    _ag_alias_present a agy && _ag_row "  alias a" ok "bypass launcher" || _ag_row "  alias a" miss "no launcher"
    # opencode
    if _ag_has opencode; then
        if _ag_opencode_bypass; then
            _ag_row "opencode" ok "$(_ag_ver opencode) · permission: allow"
        else
            _ag_row "opencode" warn "$(_ag_ver opencode) · bypass config not set"
        fi
    else
        _ag_row "opencode" miss
    fi
    _ag_alias_present o opencode && _ag_row "  alias o" ok "launcher" || _ag_row "  alias o" miss "no launcher"
    # Hermes (gateway)
    if _ag_has hermes; then _ag_row "hermes" ok "$(_ag_ver hermes) (gateway)"; else _ag_row "hermes" warn "not installed (optional gateway)"; fi
    _ag_alias_present h hermes && _ag_row "  alias h" ok "launcher" || _ag_row "  alias h" miss "no launcher"
    # Engine
    if [ -f "$HOME/.claude/CLAUDE.md" ]; then _ag_row "~/.claude" ok "engine installed"; else _ag_row "~/.claude" miss "engine not installed"; fi
    echo ""
}

agents_detect_json() { # machine-readable for wrappers (installer.sh)
    local claude_v agy_v oc_v hermes_v
    claude_v=$(_ag_ver claude); agy_v=$(_ag_ver agy); oc_v=$(_ag_ver opencode); hermes_v=$(_ag_ver hermes)
    printf '{'
    printf '"claude":{"installed":%s,"version":"%s","alias":%s},' \
        "$(_ag_has claude && echo true || echo false)" "$claude_v" "$(_ag_alias_present c claude && echo true || echo false)"
    printf '"desktop":{"installed":%s,"config":%s},' \
        "$([ -d /Applications/Claude.app ] && echo true || echo false)" \
        "$([ -e "$HOME/Library/Application Support/Claude/claude_desktop_config.json" ] && echo true || echo false)"
    printf '"agy":{"installed":%s,"version":"%s","alias":%s},' \
        "$(_ag_has agy && echo true || echo false)" "$agy_v" "$(_ag_alias_present a agy && echo true || echo false)"
    printf '"opencode":{"installed":%s,"version":"%s","alias":%s,"bypass":%s},' \
        "$(_ag_has opencode && echo true || echo false)" "$oc_v" "$(_ag_alias_present o opencode && echo true || echo false)" "$(_ag_opencode_bypass && echo true || echo false)"
    printf '"hermes":{"installed":%s,"version":"%s","alias":%s},' \
        "$(_ag_has hermes && echo true || echo false)" "$hermes_v" "$(_ag_alias_present h hermes && echo true || echo false)"
    printf '"gh_auth":%s,' "$(gh auth status >/dev/null 2>&1 && echo true || echo false)"
    printf '"databayt_member":%s,' "$([ "$(gh api user/memberships/orgs/databayt --jq .state 2>/dev/null)" = "active" ] && echo true || echo false)"
    printf '"kun_repo":%s,' "$([ -d "$HOME/kun" ] && echo true || echo false)"
    printf '"engine":%s' "$([ -f "$HOME/.claude/CLAUDE.md" ] && echo true || echo false)"
    printf '}\n'
}

agents_delta() { # agents_delta <sel> — list what a run WOULD install (dry-run heart)
    local sel="${1:-all}"
    agents_selected_contains "$sel" code     && ! _ag_has claude   && echo "claude-code"
    agents_selected_contains "$sel" desktop  && [ ! -d /Applications/Claude.app ] && echo "claude-desktop"
    agents_selected_contains "$sel" agy      && ! _ag_has agy      && echo "antigravity"
    agents_selected_contains "$sel" opencode && ! _ag_has opencode && echo "opencode"
    agents_selected_contains "$sel" hermes   && ! _ag_has hermes   && echo "hermes"
    agents_selected_contains "$sel" opencode && ! _ag_opencode_bypass && echo "opencode-bypass-config"
    _ag_alias_present c claude && _ag_alias_present a agy && _ag_alias_present o opencode && _ag_alias_present h hermes || echo "alias-block"
}

# ── Aliases ──────────────────────────────────────────────────────
# One marked, idempotent block per rc file. Migrates the legacy single-line
# `alias c=` / `function c {` forms (and the env-sourcing line) into the block.
agents_write_alias_block() {
    local sel="${1:-all}" rc tmp
    for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
        [ -f "$rc" ] || continue
        tmp=$(mktemp)
        # strip previous marked block + known legacy lines
        awk '
            /^# BEGIN databayt agents/ { inblock=1; next }
            /^# END databayt agents/   { inblock=0; next }
            inblock { next }
            /^alias c='\''claude --dangerously-skip-permissions'\''$/ { next }
            /^alias a='\''agy --dangerously-skip-permissions'\''$/ { next }
            /^function c \{ claude --dangerously-skip-permissions "\$@"; \}$/ { next }
            /^function a \{ agy --dangerously-skip-permissions "\$@"; \}$/ { next }
            /^# Claude Code \(primary\)$/ { next }
            /^# Antigravity \(secondary\)$/ { next }
            /^\[ -f "\$HOME\/.claude\/.env" \] && set -a && \. "\$HOME\/.claude\/.env" && set \+a$/ { next }
            { print }
        ' "$rc" > "$tmp"
        {
            echo ""
            echo "# BEGIN databayt agents — managed by kun onboarding (lib/agents.sh); edits inside are overwritten"
            echo "[ -f \"\$HOME/.claude/.env\" ] && set -a && . \"\$HOME/.claude/.env\" && set +a"
            if agents_selected_contains "$sel" code; then
                echo "alias c='claude --dangerously-skip-permissions'   # Claude Code (primary)"
            fi
            if agents_selected_contains "$sel" agy; then
                echo "alias a='agy --dangerously-skip-permissions'      # Antigravity (secondary)"
            fi
            if agents_selected_contains "$sel" opencode; then
                echo "alias o='opencode'                                # opencode (bypass lives in ~/.config/opencode/opencode.json)"
            fi
            if agents_selected_contains "$sel" hermes; then
                echo "alias h='hermes'                                  # Hermes gateway (optional)"
            fi
            echo "# END databayt agents"
        } >> "$tmp"
        # preserve original file perms via cat-over (mv would drop them)
        cat "$tmp" > "$rc"
        rm -f "$tmp"
    done
}

# ── opencode bypass config ───────────────────────────────────────
# opencode has no --dangerously-skip-permissions flag; its yolo switch is the
# global config. Merge — never clobber an existing opencode.json's other keys.
agents_configure_opencode() {
    local cfg_dir="$HOME/.config/opencode" cfg="$HOME/.config/opencode/opencode.json"
    mkdir -p "$cfg_dir"
    python3 - "$cfg" <<'PYEOF'
import json, os, sys
cfg = sys.argv[1]
data = {}
if os.path.exists(cfg):
    try:
        with open(cfg) as f:
            data = json.load(f)
    except Exception:
        data = {}
data.setdefault("$schema", "https://opencode.ai/config.json")
data["permission"] = "allow"
with open(cfg, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PYEOF
}
