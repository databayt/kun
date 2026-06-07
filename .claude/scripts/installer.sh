#!/bin/bash
# =============================================================================
# Quiet Wizard — macOS Installer
# =============================================================================
# Three-act guided installer: pre-flight form, silent batch, manual finishing.
# Wraps onboarding-mac.sh in osascript dialogs with deep-link action buttons.
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
# ── Bootstrap: ensure git, then clone kun ───────────────────────
# git is needed to clone the repo that installs git, so the wrapper
# must provide it first. On macOS, git ships with the Xcode Command
# Line Tools; detect them prompt-free via `xcode-select -p` (same as
# the backend, onboarding-mac.sh). Without this, the clone below fails
# with a misleading "check network" alert on a fresh Mac.
if ! xcode-select -p >/dev/null 2>&1; then
    notify "Installing developer tools" "Xcode Command Line Tools (includes git)"
    xcode-select --install >/dev/null 2>&1 || true
    ask_choice "macOS is installing the Command Line Tools (this provides git).\n\nClick Install in the system dialog and wait for it to finish, then click Done here." "Done" "Skip" >/dev/null
fi
if ! command -v git >/dev/null 2>&1 || ! git --version >/dev/null 2>&1; then
    osascript -e 'display alert "Setup needs git" message "git (Xcode Command Line Tools) is required but is not ready yet.\n\nFinish the Command Line Tools install, then re-run:\n\ncurl -fsSL https://kun.databayt.org/install | bash"' 2>/dev/null
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
# ACT 1 — Pre-flight (auto-detect, dialog only what's missing)
# =============================================================================
# Role is universal — every machine gets the full config, so we never ask.
ROLE="engineer"

# Resume from state file (only fields the wizard still surfaces)
REPOS_DIR=$(state_get reposDir)
HAS_GITHUB=$(state_get hasGithub)
HAS_ANTHROPIC=$(state_get hasAnthropic)
HOGWARTS_DEV=$(state_get hogwartsDev)   # set via --hogwarts-dev flag only; no dialog

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

# databayt org invite — required to clone private repos. Pre-flight check so the
# installer fails fast in Phase 3 (auth gate) rather than silent 404 in Phase 4 (clone).
HAS_DATABAYT_INVITE=$(state_get hasDatabaytInvite)
if [[ -z "$HAS_DATABAYT_INVITE" ]]; then
    ANS=$(ask_choice "Have you accepted the databayt org invite?\n\nThe installer can't clone private repos without it.\nNo invite yet? Ping the team — they send to your GitHub email." "Yes" "Open invite page" "Skip — I'll handle later")
    case "$ANS" in
        "Open invite page")
            open "https://github.com/orgs/databayt/invitations"
            ask_choice "Accept the invite, then click Done." "Done" "Skip" >/dev/null
            ;;
    esac
    state_set hasDatabaytInvite "1"
fi

if [[ -z "$HAS_ANTHROPIC" ]]; then
    ANS=$(ask_choice "Anthropic — company account (HR shares credentials + sends OTP).\n\nPing HR now if you don't have them yet — install proceeds in parallel while you wait. You'll finish sign-in after the install when HR's OTP arrives." "I have creds" "Open Claude login" "Skip — finish later")
    case "$ANS" in
        "Open Claude login")
            open "https://claude.ai/login"
            ask_choice "Claude login opened. Sign in with the company creds + OTP when HR sends them — no rush, install continues in background." "Done / will finish later" "Skip" >/dev/null
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

# =============================================================================
# ACT 2 — Silent batch (in terminal; notifications on phase transitions)
# =============================================================================
notify "Starting install..." "~15-20 minutes"

# Backend gets: role (positional, universal), --quiet, plus opt-in flags.
# No --name/--email passed — backend auto-derives git identity from gh api user
# after Phase 3 auth. No GIST_ID passed — secrets pulled manually later.
BACKEND_ARGS=("$ROLE" "--quiet")
[[ -n "$REPOS_DIR" && "$REPOS_DIR" != "$HOME" ]] && BACKEND_ARGS+=("--repos-dir" "$REPOS_DIR")
[[ "$HOGWARTS_DEV" == "1" ]] && BACKEND_ARGS+=("--hogwarts-dev")

echo ""
echo "════════════════════════════════════════════════════"
echo " Databayt Setup — Silent Install in Progress"
echo "════════════════════════════════════════════════════"
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

# 3a. Claude Desktop sign-in (only if Desktop installed — works without Pro/Max too;
#     just won't unlock the Chat/Cowork/Code tabs on free tier)
if [[ -d "/Applications/Claude.app" ]] && [[ "$(state_get desktopSignedIn)" != "1" ]]; then
    ANS=$(ask_choice "Sign in to Claude Desktop:\n\nUse the company creds + OTP from HR (same account as Claude Code CLI). No rush — skip if HR hasn't sent the OTP yet, finish later from the app." "Open Claude" "Done" "Skip")
    case "$ANS" in
        "Open Claude") open -a Claude; ANS=$(ask_choice "Signed in?" "Done" "Skip");;
    esac
    [[ "$ANS" == "Done" ]] && state_set desktopSignedIn "1"
fi

# 3b. Computer-use toggle (only if Desktop installed)
if [[ -d "/Applications/Claude.app" ]] && [[ "$(state_get computerUse)" != "1" ]]; then
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

# 3d. WebStorm Claude plugin (only if WebStorm is installed)
if [[ -d "/Applications/WebStorm.app" ]] && [[ "$(state_get webstormPlugin)" != "1" ]]; then
    ANS=$(ask_choice "(Optional) Install Claude Code plugin in WebStorm:\n\n1. Click [Open WebStorm]\n2. Settings → Plugins → Marketplace → search 'Claude Code' → Install\n3. Click [Done]" "Open WebStorm" "Done" "Skip")
    case "$ANS" in
        "Open WebStorm") open -a WebStorm; ANS=$(ask_choice "Plugin installed?" "Done" "Skip");;
    esac
    [[ "$ANS" == "Done" ]] && state_set webstormPlugin "1"
fi

# 3e. Final health check
notify "Verifying..." "Running health check"
HEALTH_STATUS="(health.sh not found)"
if [[ -f "$HOME/.claude/scripts/health.sh" ]]; then
    HEALTH_STATUS=$(bash "$HOME/.claude/scripts/health.sh" 2>&1 | head -1 || true)
fi

# Final dialog
FINAL_MSG="Setup complete!\n\n"
FINAL_MSG+="Config health: $HEALTH_STATUS\n\n"
FINAL_MSG+="Tools: git, node, pnpm, gh, vercel, claude, agy\n"
FINAL_MSG+="Agents: 'c' = Claude Code (primary) · 'a' = Antigravity (secondary)\n"
FINAL_MSG+="Repos: ~/kun, ~/hogwarts, ~/codebase, +org repos\n"
FINAL_MSG+="Config: ~/.claude/ (agents, skills, MCP, hooks)\n\n"
FINAL_MSG+="Next:\n"
FINAL_MSG+="  1. Open a new terminal and type 'c' for Claude Code (or 'a' for Antigravity)\n"
FINAL_MSG+="  2. If HR's OTP arrived, finish Anthropic sign-in (mobile app + Desktop)\n"
FINAL_MSG+="  3. Load secrets when you have the Gist ID:\n"
FINAL_MSG+="     bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>\n\n"
FINAL_MSG+="Mobile: install Claude on iPhone/Android with the same Anthropic account."

ask_choice "$FINAL_MSG" "Done" "View Docs" >/dev/null

if [[ "$(ask_choice "Open onboarding docs?" "Open" "Skip")" == "Open" ]]; then
    open "https://github.com/databayt/kun/blob/main/content/docs/onboarding.mdx"
fi

state_set lastStep "done"
state_set timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
notify "All done" "Open a new terminal to start"
