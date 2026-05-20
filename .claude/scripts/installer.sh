#!/bin/bash
# =============================================================================
# Quiet Wizard — macOS Installer
# =============================================================================
# Three-act guided installer: pre-flight form, silent batch, manual finishing.
# Wraps onboarding-mac.sh in osascript dialogs with deep-link action buttons.
#
# Bootstrap:
#   curl -fsSL https://kun.databayt.com/install | bash
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
    # ask_text <prompt> <default> → echoes user input or empty if cancelled
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
    # ask_choice <prompt> <opt1> <opt2> [opt3] → echoes chosen button or empty
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
    set r to choose from list roles with prompt "Pick your role:" default items {"engineer"} with title "Databayt Setup"
    if r is false then return ""
    return item 1 of r
on error
    return ""
end try
EOF
}

# ── Bootstrap: clone kun if not present ─────────────────────────
if [[ ! -d "$HOME/kun" ]]; then
    notify "Cloning kun repo..." "Setting up"
    if ! git clone https://github.com/databayt/kun.git "$HOME/kun" >/dev/null 2>&1; then
        osascript -e 'display alert "Setup failed" message "Could not clone databayt/kun. Check your network and try again."' 2>/dev/null
        exit 1
    fi
fi

BACKEND="$HOME/kun/.claude/scripts/onboarding-mac.sh"
if [[ ! -f "$BACKEND" ]]; then
    osascript -e 'display alert "Setup failed" message "Backend script missing: ~/kun/.claude/scripts/onboarding-mac.sh"' 2>/dev/null
    exit 1
fi

# =============================================================================
# ACT 1 — Pre-flight (auto-detect, dialog only what's missing)
# =============================================================================
WELCOME=$(ask_choice "Welcome — this sets up a fresh Mac for databayt.\n\nAbout 20 minutes (mostly silent downloads).\n\nReady?" "Start" "Cancel")
[[ "$WELCOME" != "Start" ]] && { notify "Setup cancelled" "Run again anytime"; exit 0; }

# Resume from state file if present
ROLE=$(state_get role)
GIST_ID=$(state_get gistId)
GIT_NAME_ARG=$(state_get gitName)
GIT_EMAIL_ARG=$(state_get gitEmail)
WITH_TAILSCALE=$(state_get withTailscale)
PRO_MAX=$(state_get proMax)
REPOS_DIR=$(state_get reposDir)
HAS_GITHUB=$(state_get hasGithub)
HAS_ANTHROPIC=$(state_get hasAnthropic)

# Accounts: confirm or guide creation
if [[ -z "$HAS_GITHUB" ]]; then
    ANS=$(ask_choice "Do you have a GitHub account?\n\n(You'll use it to clone repos and authenticate.)" "Yes, I have one" "No, create one" "Skip")
    case "$ANS" in
        "No, create one")
            open "https://github.com/join"
            ask_choice "GitHub sign-up opened in browser.\n\nCreate the account, then come back and click Done." "Done" "Skip" >/dev/null
            ;;
    esac
    state_set hasGithub "1"
fi

if [[ -z "$HAS_ANTHROPIC" ]]; then
    ANS=$(ask_choice "Do you have an Anthropic account?\n\n(For Claude Desktop sign-in and the Claude Code CLI.)" "Yes, I have one" "No, create one" "Skip")
    case "$ANS" in
        "No, create one")
            open "https://claude.ai/login"
            ask_choice "Anthropic sign-in opened.\n\nCreate the account (or sign in), then click Done.\n\nNote: Pro/Max sub unlocks Desktop Chat/Cowork/Code tabs." "Done" "Skip" >/dev/null
            ;;
    esac
    state_set hasAnthropic "1"
fi

# Repos directory: ask where to save databayt org repos
if [[ -z "$REPOS_DIR" ]]; then
    CHOICE=$(ask_choice "Where do you want databayt org repos saved?\n\nDefault: home root (~/kun, ~/hogwarts, ...)" "Home root (~/)" "~/databayt/" "Custom...")
    case "$CHOICE" in
        "Home root (~/)")   REPOS_DIR="$HOME" ;;
        "~/databayt/")      REPOS_DIR="$HOME/databayt"; mkdir -p "$REPOS_DIR" ;;
        "Custom...")
            CUSTOM=$(ask_text "Enter absolute path:" "$HOME/projects/databayt")
            [[ -z "$CUSTOM" ]] && CUSTOM="$HOME"
            REPOS_DIR="$CUSTOM"; mkdir -p "$REPOS_DIR"
            ;;
        *) REPOS_DIR="$HOME" ;;
    esac
    state_set reposDir "$REPOS_DIR"
fi

# Role: auto-detect from existing mcp.json, else ask
if [[ -z "$ROLE" ]]; then
    if [[ -f "$HOME/.claude/mcp.json" ]]; then
        if grep -q '"shadcn"' "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="engineer"
        elif grep -q '"linear"' "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="business"
        elif grep -q '"figma"' "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="content"
        elif grep -q '"posthog"' "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="ops"
        fi
    fi
    if [[ -z "$ROLE" ]]; then
        ROLE=$(ask_role)
        [[ -z "$ROLE" ]] && { notify "Cancelled" "No role selected"; exit 0; }
    fi
    state_set role "$ROLE"
fi

# Git identity: auto-detect, else ask
if [[ -z "$GIT_NAME_ARG" ]]; then
    EXISTING_NAME=$(git config --global user.name 2>/dev/null || echo "")
    if [[ -n "$EXISTING_NAME" ]]; then
        GIT_NAME_ARG="$EXISTING_NAME"
        GIT_EMAIL_ARG=$(git config --global user.email 2>/dev/null || echo "")
    else
        GIT_NAME_ARG=$(ask_text "Your full name (for git commits):")
        [[ -z "$GIT_NAME_ARG" ]] && { notify "Cancelled" "No name given"; exit 0; }
        GIT_EMAIL_ARG=$(ask_text "Your email (for git commits):")
        [[ -z "$GIT_EMAIL_ARG" ]] && { notify "Cancelled" "No email given"; exit 0; }
    fi
    state_set gitName "$GIT_NAME_ARG"
    state_set gitEmail "$GIT_EMAIL_ARG"
fi

# Gist ID: ask once, persist; can skip
if [[ -z "$GIST_ID" ]]; then
    GIST_ID=$(ask_text "Secrets Gist ID (or leave blank to skip — you can load later):")
    state_set gistId "$GIST_ID"
fi

# Pro/Max: affects Act 3 (Claude Desktop sign-in, computer-use toggle)
if [[ -z "$PRO_MAX" ]]; then
    PM_ANS=$(ask_choice "Do you have a Claude Pro or Max subscription?\n\n(Affects whether you get the Desktop Chat/Cowork/Code tabs.)" "Yes" "No")
    [[ "$PM_ANS" == "Yes" ]] && PRO_MAX="1" || PRO_MAX="0"
    state_set proMax "$PRO_MAX"
fi

# Tailscale: optional (default off)
if [[ -z "$WITH_TAILSCALE" ]]; then
    TS_ANS=$(ask_choice "Enable Tailscale SSH? (For remote control from iPhone/laptop.)\n\nCan be added later." "Yes" "No")
    [[ "$TS_ANS" == "Yes" ]] && WITH_TAILSCALE="1" || WITH_TAILSCALE="0"
    state_set withTailscale "$WITH_TAILSCALE"
fi

# =============================================================================
# ACT 2 — Silent batch (in terminal; notifications on phase transitions)
# =============================================================================
notify "Starting install..." "~15-20 minutes"

BACKEND_ARGS=("$ROLE")
[[ -n "$GIST_ID" ]] && BACKEND_ARGS+=("$GIST_ID")
BACKEND_ARGS+=("--quiet" "--name" "$GIT_NAME_ARG" "--email" "$GIT_EMAIL_ARG")
[[ -n "$REPOS_DIR" && "$REPOS_DIR" != "$HOME" ]] && BACKEND_ARGS+=("--repos-dir" "$REPOS_DIR")
[[ "$WITH_TAILSCALE" == "1" ]] && BACKEND_ARGS+=("--with-tailscale")

echo ""
echo "════════════════════════════════════════════════════"
echo " Databayt Setup — Silent Install in Progress"
echo "════════════════════════════════════════════════════"
echo " Role: $ROLE"
echo " You can minimize this terminal and do other work."
echo "════════════════════════════════════════════════════"
echo ""

# Stream backend output to terminal, watch stderr for PROGRESS markers → notifications
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
        # Skip: continue to Act 3
    esac
fi
state_set silentBatch "done"

# =============================================================================
# ACT 3 — Manual finishing (deep-link dialogs only when human is needed)
# =============================================================================
notify "Almost done" "Final clicks coming up"

# 3a. Claude Desktop sign-in (Pro/Max only)
if [[ "$PRO_MAX" == "1" && -d "/Applications/Claude.app" ]] && [[ "$(state_get desktopSignedIn)" != "1" ]]; then
    ANS=$(ask_choice "Sign in to Claude Desktop:\n\nClicking [Open Claude] launches the app. Sign in with your Anthropic account, then click [Done]." "Open Claude" "Done" "Skip")
    case "$ANS" in
        "Open Claude") open -a Claude; ANS=$(ask_choice "Signed in?" "Done" "Skip");;
    esac
    [[ "$ANS" == "Done" ]] && state_set desktopSignedIn "1"
fi

# 3b. Computer-use toggle (Pro/Max only)
if [[ "$PRO_MAX" == "1" ]] && [[ "$(state_get computerUse)" != "1" ]]; then
    ANS=$(ask_choice "(Optional) Enable Claude Desktop's computer-use:\n\n1. Click [Open Settings] below\n2. In Claude Desktop → Settings → General, toggle 'Allow Claude to use your computer'\n3. Click [Done]" "Open Settings" "Done" "Skip")
    case "$ANS" in
        "Open Settings")
            open -a Claude
            open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            ANS=$(ask_choice "Toggle enabled?" "Done" "Skip")
            ;;
    esac
    [[ "$ANS" == "Done" ]] && state_set computerUse "1"
fi

# 3c. VS Code Claude extension — auto-install if `code` on PATH
if command -v code >/dev/null 2>&1 && [[ "$(state_get vsCodeExt)" != "1" ]]; then
    if code --list-extensions 2>/dev/null | grep -q "anthropic.claude-code"; then
        state_set vsCodeExt "1"
    else
        code --install-extension anthropic.claude-code >/dev/null 2>&1 && state_set vsCodeExt "1" || true
    fi
fi

# 3d. WebStorm Claude plugin (engineer)
if [[ "$ROLE" == "engineer" && -d "/Applications/WebStorm.app" ]] && [[ "$(state_get webstormPlugin)" != "1" ]]; then
    ANS=$(ask_choice "(Optional) Install Claude Code plugin in WebStorm:\n\n1. Click [Open WebStorm]\n2. Settings → Plugins → Marketplace → search 'Claude Code' → Install\n3. Click [Done]" "Open WebStorm" "Done" "Skip")
    case "$ANS" in
        "Open WebStorm") open -a WebStorm; ANS=$(ask_choice "Plugin installed?" "Done" "Skip");;
    esac
    [[ "$ANS" == "Done" ]] && state_set webstormPlugin "1"
fi

# 3e. Final health check
notify "Verifying..." "Running health check"
HEALTH_OUT=""
if [[ -f "$HOME/.claude/scripts/health.sh" ]]; then
    HEALTH_OUT=$(bash "$HOME/.claude/scripts/health.sh" 2>&1 | tail -5 || true)
fi

# Final dialog
FINAL_MSG="Setup complete! Role: $ROLE\n\n"
FINAL_MSG+="Tools: git, node, pnpm, gh, claude, opencode\n"
FINAL_MSG+="Repos: ~/kun"
[[ "$ROLE" == "engineer" ]] && FINAL_MSG+=", ~/hogwarts, ~/codebase, +org repos"
FINAL_MSG+="\nConfig: ~/.claude/ (agents, skills, MCP, hooks)\n\n"
FINAL_MSG+="Next: open a new terminal and type 'c' to start Claude Code.\n\n"
FINAL_MSG+="Mobile: install Claude on iPhone/Android with the same Anthropic account."

ask_choice "$FINAL_MSG" "Done" "View Docs" >/dev/null

if [[ "$(ask_choice "Open onboarding docs?" "Open" "Skip")" == "Open" ]]; then
    open "https://github.com/databayt/kun/blob/main/content/docs/onboarding.mdx"
fi

state_set lastStep "done"
state_set timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
notify "All done" "Open a new terminal to start"
