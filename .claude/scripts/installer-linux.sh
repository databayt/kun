#!/bin/bash
# =============================================================================
# Quiet Wizard — Linux Installer
# =============================================================================
# Three-act guided installer for Linux. Detects zenity → kdialog → TUI fallback.
# Wraps onboarding-linux.sh with native dialogs and deep-link action buttons.
#
# Bootstrap:
#   curl -fsSL https://kun.databayt.org/install | bash
# Direct:
#   bash <(curl -fsSL https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/installer-linux.sh)
#
# State file: ${XDG_CONFIG_HOME:-~/.config}/databayt/installer-state.json
#
# NOTE: Claude Desktop is NOT available on Linux. Wrapper skips desktop
# sign-in and computer-use toggle steps. Linux users use CLI + browser +
# IDE plugins.
# =============================================================================

set -e

# ── Detect GUI backend ──────────────────────────────────────────
GUI=""
if [[ -n "$DISPLAY" || -n "$WAYLAND_DISPLAY" ]]; then
    if command -v zenity >/dev/null 2>&1; then GUI="zenity"
    elif command -v kdialog >/dev/null 2>&1; then GUI="kdialog"
    fi
fi
[[ "${1:-}" == "--no-gui" ]] && { GUI=""; shift; }

# ── State file ──────────────────────────────────────────────────
STATE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/databayt"
STATE_FILE="$STATE_DIR/installer-state.json"
mkdir -p "$STATE_DIR"

state_get() {
    [[ -f "$STATE_FILE" ]] || { echo ""; return; }
    python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('$1',''))" 2>/dev/null
}
state_set() {
    python3 -c "
import json, os
p = '$STATE_FILE'
d = json.load(open(p)) if os.path.exists(p) else {}
d['$1'] = '$2'
json.dump(d, open(p, 'w'), indent=2)
"
}

# ── Dialog abstraction (zenity / kdialog / TUI) ─────────────────
ask_text() {
    local prompt="$1" default="${2:-}"
    case "$GUI" in
        zenity)  zenity --entry --title="Databayt Setup" --text="$prompt" --entry-text="$default" 2>/dev/null || echo "" ;;
        kdialog) kdialog --title "Databayt Setup" --inputbox "$prompt" "$default" 2>/dev/null || echo "" ;;
        *)       printf "\033[1m%s\033[0m " "$prompt"
                 [[ -n "$default" ]] && printf "[%s] " "$default"
                 read -r ans </dev/tty
                 echo "${ans:-$default}" ;;
    esac
}
ask_yesno() {
    local prompt="$1"
    case "$GUI" in
        zenity)  zenity --question --title="Databayt Setup" --text="$prompt" 2>/dev/null && echo "Yes" || echo "No" ;;
        kdialog) kdialog --title "Databayt Setup" --yesno "$prompt" 2>/dev/null && echo "Yes" || echo "No" ;;
        *)       printf "\033[1m%s\033[0m [y/N] " "$prompt"; read -r ans </dev/tty
                 [[ "$ans" =~ ^[Yy] ]] && echo "Yes" || echo "No" ;;
    esac
}
ask_choice() {
    # ask_choice <prompt> <opt1> <opt2> [opt3] — TUI uses numbered menu
    local prompt="$1" opt1="$2" opt2="$3" opt3="${4:-}"
    case "$GUI" in
        zenity)
            local rows=("$opt1" "$opt2")
            [[ -n "$opt3" ]] && rows+=("$opt3")
            zenity --list --title="Databayt Setup" --text="$prompt" --column=Option "${rows[@]}" --hide-header 2>/dev/null || echo ""
            ;;
        kdialog)
            local args=("$opt1" "$opt1" "$opt2" "$opt2")
            [[ -n "$opt3" ]] && args+=("$opt3" "$opt3")
            kdialog --title "Databayt Setup" --menu "$prompt" "${args[@]}" 2>/dev/null || echo ""
            ;;
        *)
            printf "\n\033[1m%s\033[0m\n" "$prompt"
            printf "  1) %s\n" "$opt1"
            printf "  2) %s\n" "$opt2"
            [[ -n "$opt3" ]] && printf "  3) %s\n" "$opt3"
            printf "  > "; read -r n </dev/tty
            case "$n" in 1) echo "$opt1";; 2) echo "$opt2";; 3) echo "$opt3";; *) echo "";; esac
            ;;
    esac
}
notify() {
    case "$GUI" in
        zenity)  zenity --notification --text="$1: $2" 2>/dev/null || true ;;
        kdialog) kdialog --passivepopup "$1: $2" 4 2>/dev/null || true ;;
        *)       printf "\033[1;36m[%s]\033[0m %s\n" "$1" "$2" ;;
    esac
}
open_url() {
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
    elif command -v gio >/dev/null 2>&1; then gio open "$1" >/dev/null 2>&1 &
    else printf "Open: %s\n" "$1"
    fi
}

# ── Bootstrap: ensure git, then clone kun ───────────────────────
# git is needed to clone the repo that installs git, so the wrapper
# must provide it first. The backend (onboarding-linux.sh) re-checks
# and no-ops if git is already present. Fresh Linux images ship curl
# but often not git — without this, the clone below fails with a
# misleading "check network" message.
if ! command -v git >/dev/null 2>&1; then
    notify "Installing" "git (prerequisite for clone)"
    if   command -v apt-get >/dev/null 2>&1; then sudo apt-get update -y >/dev/null 2>&1 && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git >/dev/null 2>&1
    elif command -v dnf     >/dev/null 2>&1; then sudo dnf install -y git >/dev/null 2>&1
    elif command -v pacman  >/dev/null 2>&1; then sudo pacman -S --noconfirm --needed git >/dev/null 2>&1
    elif command -v zypper  >/dev/null 2>&1; then sudo zypper install -y git >/dev/null 2>&1
    fi
fi
if ! command -v git >/dev/null 2>&1; then
    echo "git is required but could not be installed automatically." >&2
    echo "Install git, then re-run:  curl -fsSL https://kun.databayt.org/install | bash" >&2
    exit 1
fi

# ── Clone kun if not present ────────────────────────────────────
if [[ ! -d "$HOME/kun" ]]; then
    notify "Cloning" "kun repo"
    if ! clone_err=$(git clone https://github.com/databayt/kun.git "$HOME/kun" 2>&1); then
        echo "Could not clone databayt/kun:" >&2
        echo "$clone_err" >&2
        echo "If github.com is blocked on your network (proxy/VPN/firewall), that's the likely cause —" >&2
        echo "raw.githubusercontent.com can stay reachable while github.com is blocked." >&2
        exit 1
    fi
fi

BACKEND="$HOME/kun/.claude/scripts/onboarding-linux.sh"
if [[ ! -f "$BACKEND" ]]; then
    echo "Backend script missing: $BACKEND" >&2
    exit 1
fi

# =============================================================================
# ACT 1 — Pre-flight
# =============================================================================
# Role is universal — every machine gets the full config, so we never ask.
ROLE="engineer"

# Resume from state file (only fields the wizard still surfaces)
REPOS_DIR=$(state_get reposDir)
HAS_GITHUB=$(state_get hasGithub)
HAS_DATABAYT_INVITE=$(state_get hasDatabaytInvite)
HAS_ANTHROPIC=$(state_get hasAnthropic)
HOGWARTS_DEV=$(state_get hogwartsDev)   # set via --hogwarts-dev flag only; no dialog

# Account guidance
if [[ -z "$HAS_GITHUB" ]]; then
    ANS=$(ask_choice "Do you have a GitHub account?" "Yes, I have one" "No, create one" "Skip")
    if [[ "$ANS" == "No, create one" ]]; then
        open_url "https://github.com/join"
        ask_choice "GitHub sign-up opened. Done when you've created the account." "Done" "Skip" >/dev/null
    fi
    state_set hasGithub "1"
fi
if [[ -z "$HAS_DATABAYT_INVITE" ]]; then
    ANS=$(ask_choice "Have you accepted the databayt org invite?\n(The installer can't clone private repos without it.)" "Yes" "Open invite page" "Skip — I'll handle later")
    if [[ "$ANS" == "Open invite page" ]]; then
        open_url "https://github.com/orgs/databayt/invitations"
        ask_choice "Accept the invite, then click Done." "Done" "Skip" >/dev/null
    fi
    state_set hasDatabaytInvite "1"
fi
if [[ -z "$HAS_ANTHROPIC" ]]; then
    ANS=$(ask_choice "Anthropic — company account (HR shares credentials + sends OTP).\nPing HR now; install proceeds in parallel while you wait." "I have creds" "Open Claude login" "Skip — finish later")
    if [[ "$ANS" == "Open Claude login" ]]; then
        open_url "https://claude.ai/login"
        ask_choice "Claude login opened. Sign in when HR's OTP arrives — no rush, install continues in background." "Done / will finish later" "Skip" >/dev/null
    fi
    state_set hasAnthropic "1"
fi

# Repos dir
if [[ -z "$REPOS_DIR" ]]; then
    CHOICE=$(ask_choice "Where do you want databayt org repos saved?\n(Default: home root)" "Home root (~/)" "~/databayt/" "Custom...")
    case "$CHOICE" in
        "Home root (~/)") REPOS_DIR="$HOME" ;;
        "~/databayt/")    REPOS_DIR="$HOME/databayt"; mkdir -p "$REPOS_DIR" ;;
        "Custom...")
            CUSTOM=$(ask_text "Enter absolute path:" "$HOME/projects/databayt")
            [[ -z "$CUSTOM" ]] && CUSTOM="$HOME"
            REPOS_DIR="$CUSTOM"; mkdir -p "$REPOS_DIR" ;;
        *) REPOS_DIR="$HOME" ;;
    esac
    state_set reposDir "$REPOS_DIR"
fi

# =============================================================================
# ACT 2 — Silent batch
# =============================================================================
notify "Installing" "~15-20 min in terminal"

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
    RETRY=$(ask_choice "Install hit an issue (exit $BACKEND_RC). What now?" "Retry" "Skip" "Quit")
    case "$RETRY" in
        Retry) exec bash "$0" ;;
        Quit)  exit "$BACKEND_RC" ;;
    esac
fi
state_set silentBatch "done"

# =============================================================================
# ACT 3 — Manual finishing (no Claude Desktop on Linux)
# =============================================================================
notify "Almost done" "Final clicks"

# 3a. VS Code Claude extension — auto-install
if command -v code >/dev/null 2>&1 && [[ "$(state_get vsCodeExt)" != "1" ]]; then
    if code --list-extensions 2>/dev/null | grep -q "anthropic.claude-code"; then
        state_set vsCodeExt "1"
    else
        code --install-extension anthropic.claude-code >/dev/null 2>&1 && state_set vsCodeExt "1" || true
    fi
fi

# 3b. WebStorm Claude plugin (only if WebStorm is installed)
if command -v webstorm >/dev/null 2>&1 || [[ -d "/snap/webstorm" ]]; then
    if [[ "$(state_get webstormPlugin)" != "1" ]]; then
        ANS=$(ask_choice "(Optional) Install Claude Code plugin in WebStorm:\n\n1. Click [Open WebStorm]\n2. Settings → Plugins → Marketplace → 'Claude Code' → Install\n3. Click [Done]" "Open WebStorm" "Done" "Skip")
        case "$ANS" in
            "Open WebStorm")
                if command -v webstorm >/dev/null 2>&1; then webstorm & else snap run webstorm & fi
                ANS=$(ask_choice "Plugin installed?" "Done" "Skip")
                ;;
        esac
        [[ "$ANS" == "Done" ]] && state_set webstormPlugin "1"
    fi
fi

# 3c. Final verify
notify "Verifying" "Health check"
HEALTH_STATUS="(health.sh not found)"
if [[ -f "$HOME/.claude/scripts/health.sh" ]]; then
    HEALTH_STATUS=$(bash "$HOME/.claude/scripts/health.sh" 2>&1 | head -1 || true)
fi

FINAL_MSG="Setup complete!\n\n"
FINAL_MSG+="Config health: $HEALTH_STATUS\n\n"
FINAL_MSG+="Tools: git, node, pnpm, gh, vercel, claude\n"
FINAL_MSG+="Repos: ~/kun, ~/hogwarts, ~/codebase, +org repos\n"
FINAL_MSG+="Config: ~/.claude/ (agents, skills, MCP)\n\n"
FINAL_MSG+="Linux note: no Claude Desktop. Use:\n"
FINAL_MSG+="  • CLI: 'claude' / 'c'\n"
FINAL_MSG+="  • Browser: https://claude.ai/code\n"
FINAL_MSG+="  • IDE: VS Code + WebStorm Claude plugins\n\n"
FINAL_MSG+="Next:\n"
FINAL_MSG+="  1. If HR's OTP arrived, finish Anthropic sign-in: run 'claude' or open claude.ai/code\n"
FINAL_MSG+="  2. Load secrets when you have the Gist ID:\n"
FINAL_MSG+="     bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>\n\n"
FINAL_MSG+="Mobile: install Claude on iPhone/Android with the same account."

ask_choice "$FINAL_MSG" "Done" "View Docs" >/dev/null

if [[ "$(ask_yesno "Open onboarding docs in browser?")" == "Yes" ]]; then
    open_url "https://github.com/databayt/kun/blob/main/content/docs/onboarding.mdx"
fi

state_set lastStep "done"
state_set timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
notify "All done" "Open a new terminal to start"
