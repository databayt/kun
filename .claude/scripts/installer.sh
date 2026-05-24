#!/bin/bash
# =============================================================================
# Quiet Wizard — macOS Installer
# =============================================================================
# 2 dialogs (identity, hogwarts) → silent batch with 1 unavoidable click
# (GitHub Authorize on the auto-opened device-flow page) → done panel.
#
# Bootstrap:
#   curl -fsSL https://kun.databayt.org/install | bash
# Direct:
#   bash <(curl -fsSL https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/installer.sh)
#
# State file at: ~/Library/Application Support/Databayt/installer-state.json
# (auto-resumes from last completed step)
# =============================================================================

set -e

# ── State file ──────────────────────────────────────────────────
STATE_DIR="$HOME/Library/Application Support/Databayt"
STATE_FILE="$STATE_DIR/installer-state.json"
mkdir -p "$STATE_DIR"

state_get() {
    [[ -f "$STATE_FILE" ]] || { echo ""; return; }
    /usr/bin/python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('$1',''))" 2>/dev/null
}
state_set() {
    /usr/bin/python3 -c "
import json, os
p = '$STATE_FILE'
d = json.load(open(p)) if os.path.exists(p) else {}
d['$1'] = '$2'
json.dump(d, open(p, 'w'), indent=2)
"
}

# ── osascript helpers ───────────────────────────────────────────
ask_text() {
    local prompt="$1" default="${2:-}"
    osascript <<EOF 2>/dev/null
try
    set r to display dialog "$prompt" default answer "$default" with title "Databayt Setup"
    return text returned of r
on error
    return ""
end try
EOF
}
ask_choice() {
    local prompt="$1" opt1="$2" opt2="$3" opt3="${4:-}"
    local buttons="{\"$opt1\", \"$opt2\""
    [[ -n "$opt3" ]] && buttons="$buttons, \"$opt3\""
    buttons="$buttons}"
    osascript <<EOF 2>/dev/null
try
    set r to display dialog "$prompt" buttons $buttons default button "$opt1" with title "Databayt Setup"
    return button returned of r
on error
    return ""
end try
EOF
}
notify() {
    osascript -e "display notification \"$1\" with title \"Databayt Setup\" subtitle \"$2\"" 2>/dev/null || true
}
ask_role() {
    osascript <<'EOF' 2>/dev/null
set roles to {"engineer", "business", "content", "ops"}
try
    set r to choose from list roles with prompt "Pick your role (default: engineer):" default items {"engineer"} with title "Databayt Setup"
    if r is false then return ""
    return item 1 of r
on error
    return ""
end try
EOF
}

# ── Bootstrap: ensure git, then clone kun ───────────────────────
# git is needed to clone the repo that installs git, so the wrapper
# must provide it first. On macOS, git ships with the Xcode Command
# Line Tools; detect prompt-free via `xcode-select -p`.
if ! xcode-select -p >/dev/null 2>&1; then
    notify "Installing developer tools" "Xcode Command Line Tools (includes git)"
    xcode-select --install >/dev/null 2>&1 || true
    ask_choice "macOS is installing the Command Line Tools (provides git).\n\nClick Install in the system dialog, wait for it to finish, then click Done." "Done" "Skip" >/dev/null
fi
if ! command -v git >/dev/null 2>&1 || ! git --version >/dev/null 2>&1; then
    osascript -e 'display alert "Setup needs git" message "git (Xcode Command Line Tools) is required but not ready yet.\n\nFinish the Command Line Tools install, then re-run:\n\ncurl -fsSL https://kun.databayt.org/install | bash"' 2>/dev/null
    exit 1
fi

# ── Clone kun if not present ────────────────────────────────────
if [[ ! -d "$HOME/kun" ]]; then
    notify "Cloning kun repo..." "Setting up"
    if ! clone_err=$(git clone https://github.com/databayt/kun.git "$HOME/kun" 2>&1); then
        echo "$clone_err" >&2
        osascript -e 'display alert "Setup failed" message "Could not clone databayt/kun. See the Terminal window for the exact git error.\n\nIf github.com is blocked on your network (proxy/VPN/firewall), that is the likely cause — the raw CDN can stay reachable while github.com is blocked."' 2>/dev/null
        exit 1
    fi
fi

BACKEND="$HOME/kun/.claude/scripts/onboarding-mac.sh"
if [[ ! -f "$BACKEND" ]]; then
    osascript -e 'display alert "Setup failed" message "Backend script missing: ~/kun/.claude/scripts/onboarding-mac.sh"' 2>/dev/null
    exit 1
fi

# =============================================================================
# ACT 1 — Two dialogs (or fewer, after autofill)
# =============================================================================
# Consent implied by `curl … | bash` — no welcome modal. Ctrl+C aborts.
echo ""
echo "════════════════════════════════════════════════════"
echo " Databayt Setup — ~20 min · 2 dialogs · 1 click"
echo "════════════════════════════════════════════════════"
echo " Press Ctrl+C any time to abort. State auto-saves."
echo "════════════════════════════════════════════════════"
echo ""

# Resume from state file
ROLE=$(state_get role)
GIT_NAME_ARG=$(state_get gitName)
GIT_EMAIL_ARG=$(state_get gitEmail)
HOGWARTS_DEV=$(state_get hogwartsDev)

# ── Identity card: name + email + role ─────────────────────────
# Autofill from git config + mcp.json. Dialog only what's missing.
if [[ -z "$GIT_NAME_ARG" ]]; then
    GIT_NAME_ARG=$(git config --global user.name 2>/dev/null || echo "")
fi
if [[ -z "$GIT_EMAIL_ARG" ]]; then
    GIT_EMAIL_ARG=$(git config --global user.email 2>/dev/null || echo "")
fi
if [[ -z "$ROLE" && -f "$HOME/.claude/mcp.json" ]]; then
    if   grep -q '"shadcn"'  "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="engineer"
    elif grep -q '"linear"'  "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="business"
    elif grep -q '"figma"'   "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="content"
    elif grep -q '"posthog"' "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="ops"
    fi
fi

# Ask for whatever wasn't auto-detected
if [[ -z "$GIT_NAME_ARG" ]]; then
    GIT_NAME_ARG=$(ask_text "Identity 1/3 — your full name (for git commits):")
    [[ -z "$GIT_NAME_ARG" ]] && { notify "Cancelled" "No name given"; exit 0; }
fi
if [[ -z "$GIT_EMAIL_ARG" ]]; then
    GIT_EMAIL_ARG=$(ask_text "Identity 2/3 — your email (for git commits):")
    [[ -z "$GIT_EMAIL_ARG" ]] && { notify "Cancelled" "No email given"; exit 0; }
fi
if [[ -z "$ROLE" ]]; then
    ROLE=$(ask_role)
    [[ -z "$ROLE" ]] && ROLE="engineer"  # default — keep moving
fi
state_set gitName "$GIT_NAME_ARG"
state_set gitEmail "$GIT_EMAIL_ARG"
state_set role "$ROLE"

# ── Hogwarts local dev (engineer-only, gates ~10 min) ──────────
if [[ "$ROLE" == "engineer" && -z "$HOGWARTS_DEV" ]]; then
    HD_ANS=$(ask_choice "Set up hogwarts local dev now? (pnpm + DB seed + build, ~10 min)\n\nSkip if this machine won't run hogwarts locally — you can add later." "Yes" "No")
    [[ "$HD_ANS" == "Yes" ]] && HOGWARTS_DEV="1" || HOGWARTS_DEV="0"
    state_set hogwartsDev "$HOGWARTS_DEV"
fi

# =============================================================================
# ACT 2 — Silent batch (1 unavoidable Authorize click during Phase 3)
# =============================================================================
notify "Starting install..." "1 GitHub Authorize click around minute 2"

BACKEND_ARGS=("$ROLE")
BACKEND_ARGS+=("--quiet" "--name" "$GIT_NAME_ARG" "--email" "$GIT_EMAIL_ARG")
[[ "$HOGWARTS_DEV" == "1" ]] && BACKEND_ARGS+=("--hogwarts-dev")

echo ""
echo "════════════════════════════════════════════════════"
echo " Installing — minimize the terminal and walk away"
echo " (one Authorize click in the browser ~2 min in)"
echo "════════════════════════════════════════════════════"
echo " Role: $ROLE"
echo "════════════════════════════════════════════════════"
echo ""

set +e
bash "$BACKEND" "${BACKEND_ARGS[@]}" 2> >(while IFS= read -r line; do
    echo "$line" >&2
    if [[ "$line" == PROGRESS:* ]]; then
        IFS=':' read -r _ phase label <<< "$line"
        notify "Phase $phase" "$label"
    fi
done)
BACKEND_RC=$?
set -e

if [[ "$BACKEND_RC" -ne 0 ]]; then
    RETRY=$(ask_choice "Install hit an issue (exit $BACKEND_RC).\n\nWhat now?" "Retry" "Skip" "Quit")
    case "$RETRY" in
        Retry) exec bash "$0" ;;
        Quit)  exit "$BACKEND_RC" ;;
    esac
fi
state_set silentBatch "done"

# =============================================================================
# ACT 3 — Done. No dialogs; auto-install what we can; list the rest.
# =============================================================================
notify "Almost done" "Wrapping up"

# Silent: VS Code Claude extension
if command -v code >/dev/null 2>&1 && [[ "$(state_get vsCodeExt)" != "1" ]]; then
    if code --list-extensions 2>/dev/null | grep -q "anthropic.claude-code"; then
        state_set vsCodeExt "1"
    else
        code --install-extension anthropic.claude-code >/dev/null 2>&1 && state_set vsCodeExt "1" || true
    fi
fi

# Health check
HEALTH_STATUS="(health.sh not found)"
if [[ -f "$HOME/.claude/scripts/health.sh" ]]; then
    HEALTH_STATUS=$(bash "$HOME/.claude/scripts/health.sh" 2>&1 | head -1 || true)
fi

# Final panel: one-shot summary + optional follow-ups
FINAL_MSG="Setup complete · Role: $ROLE\n"
FINAL_MSG+="Config: $HEALTH_STATUS\n\n"
FINAL_MSG+="Next: open a new terminal and type 'c' to start Claude Code.\n\n"
FINAL_MSG+="Optional follow-ups (do later, in any order):\n"
[[ -d "/Applications/Claude.app" ]]    && FINAL_MSG+="  • Sign in to Claude Desktop (open -a Claude)\n"
[[ "$ROLE" == "engineer" && -d "/Applications/WebStorm.app" ]] && FINAL_MSG+="  • WebStorm plugin: Settings → Plugins → 'Claude Code'\n"
FINAL_MSG+="  • Secrets from Gist: bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>\n"
FINAL_MSG+="  • Mobile / remote: install Claude on iOS/Android, or open claude.ai/code in any browser\n\n"
FINAL_MSG+="Docs: https://kun.databayt.org/docs/onboarding"

RESULT=$(ask_choice "$FINAL_MSG" "Done" "Open Docs")
if [[ "$RESULT" == "Open Docs" ]]; then
    open "https://kun.databayt.org/docs/onboarding"
fi

state_set lastStep "done"
state_set timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
notify "All done" "Open a new terminal to start"
