#!/bin/bash
# =============================================================================
# Quiet Wizard — Linux Installer
# =============================================================================
# 2 dialogs (identity, hogwarts) → silent batch with 1 unavoidable click
# (GitHub Authorize on the auto-opened device-flow page) → done panel.
# Detects zenity → kdialog → TUI fallback.
#
# Bootstrap:
#   curl -fsSL https://kun.databayt.org/install | bash
# Direct:
#   bash <(curl -fsSL https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/installer-linux.sh)
#
# State file: ${XDG_CONFIG_HOME:-~/.config}/databayt/installer-state.json
#
# NOTE: Claude Desktop is NOT available on Linux. Linux users use CLI +
# browser + IDE plugins.
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
    # 2-3 button choice
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
ask_identity() {
    # Identity card: ask name + email + role in ONE dialog when GUI supports it.
    # Returns "name|email|role" or empty on cancel.
    local default_name="$1" default_email="$2" default_role="${3:-engineer}"
    case "$GUI" in
        zenity)
            zenity --forms --title="Databayt Setup" \
                --text="Identity card — confirm your git identity and role." \
                --add-entry="Full name (for git commits)" \
                --add-entry="Email (for git commits)" \
                --add-combo="Role" --combo-values="engineer|business|content|ops" \
                2>/dev/null || echo ""
            ;;
        kdialog|*)
            # kdialog / TUI: chain three prompts but treat as one logical step
            local n="$default_name" e="$default_email" r="$default_role"
            [[ -z "$n" ]] && n=$(ask_text "Identity 1/3 — full name (for git commits):")
            [[ -z "$n" ]] && { echo ""; return; }
            [[ -z "$e" ]] && e=$(ask_text "Identity 2/3 — email (for git commits):")
            [[ -z "$e" ]] && { echo ""; return; }
            [[ -z "$r" ]] && r=$(ask_choice "Identity 3/3 — role:" "engineer" "business" "content")
            [[ -z "$r" ]] && r="engineer"
            echo "$n|$e|$r"
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
# ACT 1 — Two dialogs (or fewer, after autofill)
# =============================================================================
# Consent implied by `curl … | bash`. Ctrl+C aborts.
echo ""
echo "════════════════════════════════════════════════════"
echo " Databayt Setup — ~15-20 min · 2 dialogs · 1 click"
echo "════════════════════════════════════════════════════"
echo " Press Ctrl+C any time to abort. State auto-saves."
echo "════════════════════════════════════════════════════"
echo ""

ROLE=$(state_get role)
GIT_NAME_ARG=$(state_get gitName)
GIT_EMAIL_ARG=$(state_get gitEmail)
HOGWARTS_DEV=$(state_get hogwartsDev)

# Autofill from git config + mcp.json
[[ -z "$GIT_NAME_ARG"  ]] && GIT_NAME_ARG=$(git config --global user.name  2>/dev/null || echo "")
[[ -z "$GIT_EMAIL_ARG" ]] && GIT_EMAIL_ARG=$(git config --global user.email 2>/dev/null || echo "")
if [[ -z "$ROLE" && -f "$HOME/.claude/mcp.json" ]]; then
    if   grep -q '"shadcn"'  "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="engineer"
    elif grep -q '"linear"'  "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="business"
    elif grep -q '"figma"'   "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="content"
    elif grep -q '"posthog"' "$HOME/.claude/mcp.json" 2>/dev/null; then ROLE="ops"
    fi
fi

# Identity card — single dialog (zenity --forms) or chained (kdialog/TUI)
if [[ -z "$GIT_NAME_ARG" || -z "$GIT_EMAIL_ARG" || -z "$ROLE" ]]; then
    IDENTITY=$(ask_identity "$GIT_NAME_ARG" "$GIT_EMAIL_ARG" "$ROLE")
    if [[ -n "$IDENTITY" ]]; then
        IFS='|' read -r N E R <<< "$IDENTITY"
        [[ -n "$N" ]] && GIT_NAME_ARG="$N"
        [[ -n "$E" ]] && GIT_EMAIL_ARG="$E"
        [[ -n "$R" ]] && ROLE="$R"
    fi
    [[ -z "$GIT_NAME_ARG"  ]] && { notify "Cancelled" "No name";  exit 0; }
    [[ -z "$GIT_EMAIL_ARG" ]] && { notify "Cancelled" "No email"; exit 0; }
    [[ -z "$ROLE"          ]] && ROLE="engineer"
fi
state_set gitName  "$GIT_NAME_ARG"
state_set gitEmail "$GIT_EMAIL_ARG"
state_set role     "$ROLE"

# Hogwarts local dev — engineer-only
if [[ "$ROLE" == "engineer" && -z "$HOGWARTS_DEV" ]]; then
    HD_ANS=$(ask_yesno "Set up hogwarts local dev now? (pnpm + DB seed + build, ~10 min — skip if this machine won't run hogwarts locally)")
    [[ "$HD_ANS" == "Yes" ]] && HOGWARTS_DEV="1" || HOGWARTS_DEV="0"
    state_set hogwartsDev "$HOGWARTS_DEV"
fi

# =============================================================================
# ACT 2 — Silent batch (1 unavoidable Authorize click during Phase 3)
# =============================================================================
notify "Installing" "1 GitHub Authorize click around minute 2"

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
    RETRY=$(ask_choice "Install hit an issue (exit $BACKEND_RC). What now?" "Retry" "Skip" "Quit")
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
FINAL_MSG+="Linux note: no Claude Desktop — use:\n"
FINAL_MSG+="  • CLI: 'claude' / 'c'\n"
FINAL_MSG+="  • Browser: https://claude.ai/code\n"
FINAL_MSG+="  • IDE: VS Code + WebStorm Claude plugins\n\n"
FINAL_MSG+="Optional follow-ups (do later, in any order):\n"
( command -v webstorm >/dev/null 2>&1 || [[ -d "/snap/webstorm" ]] ) && [[ "$ROLE" == "engineer" ]] && \
    FINAL_MSG+="  • WebStorm plugin: Settings → Plugins → 'Claude Code'\n"
FINAL_MSG+="  • Secrets from Gist: bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>\n"
FINAL_MSG+="  • Mobile / remote: install Claude on iOS/Android, or open claude.ai/code in any browser\n\n"
FINAL_MSG+="Docs: https://kun.databayt.org/docs/onboarding"

RESULT=$(ask_choice "$FINAL_MSG" "Done" "Open Docs")
if [[ "$RESULT" == "Open Docs" ]]; then
    open_url "https://kun.databayt.org/docs/onboarding"
fi

state_set lastStep "done"
state_set timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
notify "All done" "Open a new terminal to start"
