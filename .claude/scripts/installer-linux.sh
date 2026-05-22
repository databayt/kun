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
ask_role() {
    case "$GUI" in
        zenity)  zenity --list --title="Databayt Setup" --text="Pick your role:" --column=Role engineer business content ops 2>/dev/null || echo "" ;;
        kdialog) kdialog --title "Databayt Setup" --menu "Pick your role:" engineer engineer business business content content ops ops 2>/dev/null || echo "" ;;
        *)       ask_choice "Pick your role:" engineer business content ops ;;
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

# ── Bootstrap: clone kun if not present ─────────────────────────
if [[ ! -d "$HOME/kun" ]]; then
    notify "Cloning" "kun repo"
    git clone https://github.com/databayt/kun.git "$HOME/kun" >/dev/null 2>&1 || {
        echo "Could not clone databayt/kun. Check network and try again." >&2
        exit 1
    }
fi

BACKEND="$HOME/kun/.claude/scripts/onboarding-linux.sh"
if [[ ! -f "$BACKEND" ]]; then
    echo "Backend script missing: $BACKEND" >&2
    exit 1
fi

# =============================================================================
# ACT 1 — Pre-flight
# =============================================================================
WELCOME=$(ask_choice "Welcome — this sets up a fresh Linux box for databayt.\n\nAbout 15-20 minutes (mostly silent downloads).\n\nReady?" "Start" "Cancel")
[[ "$WELCOME" != "Start" ]] && { notify "Cancelled" "Run again anytime"; exit 0; }

ROLE=$(state_get role)
GIST_ID=$(state_get gistId)
GIT_NAME_ARG=$(state_get gitName)
GIT_EMAIL_ARG=$(state_get gitEmail)
WITH_TAILSCALE=$(state_get withTailscale)
REPOS_DIR=$(state_get reposDir)
HAS_GITHUB=$(state_get hasGithub)
HAS_ANTHROPIC=$(state_get hasAnthropic)

# Account guidance
if [[ -z "$HAS_GITHUB" ]]; then
    ANS=$(ask_choice "Do you have a GitHub account?" "Yes, I have one" "No, create one" "Skip")
    if [[ "$ANS" == "No, create one" ]]; then
        open_url "https://github.com/join"
        ask_choice "GitHub sign-up opened. Done when you've created the account." "Done" "Skip" >/dev/null
    fi
    state_set hasGithub "1"
fi
if [[ -z "$HAS_ANTHROPIC" ]]; then
    ANS=$(ask_choice "Do you have an Anthropic account?\n(For Claude Code CLI + claude.ai/code in browser.)" "Yes, I have one" "No, create one" "Skip")
    if [[ "$ANS" == "No, create one" ]]; then
        open_url "https://claude.ai/login"
        ask_choice "Anthropic sign-in opened. Done when you've created the account." "Done" "Skip" >/dev/null
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

# Role: auto-detect from existing mcp.json
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
        [[ -z "$ROLE" ]] && { notify "Cancelled" "No role"; exit 0; }
    fi
    state_set role "$ROLE"
fi

# Git identity
if [[ -z "$GIT_NAME_ARG" ]]; then
    EXISTING_NAME=$(git config --global user.name 2>/dev/null || echo "")
    if [[ -n "$EXISTING_NAME" ]]; then
        GIT_NAME_ARG="$EXISTING_NAME"
        GIT_EMAIL_ARG=$(git config --global user.email 2>/dev/null || echo "")
    else
        GIT_NAME_ARG=$(ask_text "Your full name (for git commits):")
        [[ -z "$GIT_NAME_ARG" ]] && { notify "Cancelled" "No name"; exit 0; }
        GIT_EMAIL_ARG=$(ask_text "Your email (for git commits):")
        [[ -z "$GIT_EMAIL_ARG" ]] && { notify "Cancelled" "No email"; exit 0; }
    fi
    state_set gitName "$GIT_NAME_ARG"
    state_set gitEmail "$GIT_EMAIL_ARG"
fi

# Gist ID
if [[ -z "$GIST_ID" ]]; then
    GIST_ID=$(ask_text "Secrets Gist ID (or blank to skip):")
    state_set gistId "$GIST_ID"
fi

# Tailscale
if [[ -z "$WITH_TAILSCALE" ]]; then
    TS_ANS=$(ask_yesno "Enable Tailscale SSH? (Remote control from iPhone/laptop.)")
    [[ "$TS_ANS" == "Yes" ]] && WITH_TAILSCALE="1" || WITH_TAILSCALE="0"
    state_set withTailscale "$WITH_TAILSCALE"
fi

# Hogwarts local dev — opt-in (heavy: pnpm + DB seed + build, ~10 min)
HOGWARTS_DEV=$(state_get hogwartsDev)
if [[ -z "$HOGWARTS_DEV" ]]; then
    HD_ANS=$(ask_yesno "Set up hogwarts local dev now? (pnpm + DB seed + build, ~10 min — skip if this machine won't run hogwarts locally)")
    [[ "$HD_ANS" == "Yes" ]] && HOGWARTS_DEV="1" || HOGWARTS_DEV="0"
    state_set hogwartsDev "$HOGWARTS_DEV"
fi

# =============================================================================
# ACT 2 — Silent batch
# =============================================================================
notify "Installing" "~15-20 min in terminal"

BACKEND_ARGS=("$ROLE")
[[ -n "$GIST_ID" ]] && BACKEND_ARGS+=("$GIST_ID")
BACKEND_ARGS+=("--quiet" "--name" "$GIT_NAME_ARG" "--email" "$GIT_EMAIL_ARG")
[[ -n "$REPOS_DIR" && "$REPOS_DIR" != "$HOME" ]] && BACKEND_ARGS+=("--repos-dir" "$REPOS_DIR")
[[ "$WITH_TAILSCALE" == "1" ]] && BACKEND_ARGS+=("--with-tailscale")
[[ "$HOGWARTS_DEV" == "1" ]] && BACKEND_ARGS+=("--hogwarts-dev")

echo ""
echo "════════════════════════════════════════════════════"
echo " Databayt Setup — Silent Install in Progress"
echo "════════════════════════════════════════════════════"
echo " Role: $ROLE"
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

# 3b. WebStorm Claude plugin (engineer)
if [[ "$ROLE" == "engineer" ]] && command -v webstorm >/dev/null 2>&1 || [[ -d "/snap/webstorm" ]]; then
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

FINAL_MSG="Setup complete! Role: $ROLE\n\n"
FINAL_MSG+="Config health: $HEALTH_STATUS\n\n"
FINAL_MSG+="Tools: git, node, pnpm, gh, claude, opencode\n"
FINAL_MSG+="Repos: ~/kun"
[[ "$ROLE" == "engineer" ]] && FINAL_MSG+=", ~/hogwarts, ~/codebase, +org repos"
FINAL_MSG+="\nConfig: ~/.claude/ (agents, skills, MCP)\n\n"
FINAL_MSG+="Linux note: no Claude Desktop. Use:\n"
FINAL_MSG+="  • CLI: 'claude' / 'c' / 'opencode'\n"
FINAL_MSG+="  • Browser: https://claude.ai/code\n"
FINAL_MSG+="  • IDE: VS Code + WebStorm Claude plugins\n\n"
FINAL_MSG+="Mobile: install Claude on iPhone/Android with the same account."

ask_choice "$FINAL_MSG" "Done" "View Docs" >/dev/null

if [[ "$(ask_yesno "Open onboarding docs in browser?")" == "Yes" ]]; then
    open_url "https://github.com/databayt/kun/blob/main/content/docs/onboarding.mdx"
fi

state_set lastStep "done"
state_set timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
notify "All done" "Open a new terminal to start"
