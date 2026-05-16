#!/bin/bash
# Kun bootstrap (macOS/Linux) — single-paste cold start.
# Paste: curl -fsSL https://kun.databayt.org/install.sh | bash
# Spec: github.com/databayt/kun/issues/28
# Mirrors bootstrap.ps1's 16-step flow with brew + launchd + osascript.

set -uo pipefail  # not -e — we report per-step and aggregate

# ── Parse args ────────────────────────────────────────────────────
ROLE='engineer'
GIST_ID='68453b25fa9d28c94426c55c179b3838'
TRACK=false
DRY_RUN=false
SKIP_OAUTH=false
SKIP_IDE=false
SKIP_DESKTOP=false

while [ $# -gt 0 ]; do
    case "$1" in
        --role) ROLE="$2"; shift 2 ;;
        --gist-id) GIST_ID="$2"; shift 2 ;;
        --track) TRACK=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --skip-oauth) SKIP_OAUTH=true; shift ;;
        --skip-ide) SKIP_IDE=true; shift ;;
        --skip-desktop) SKIP_DESKTOP=true; shift ;;
        *) shift ;;
    esac
done

STARTED=$(date +%s)
TOTAL_STEPS=16
CURRENT_STEP=0

# ── Detect OS (mac vs linux) ──────────────────────────────────────
OS="$(uname -s)"
IS_MAC=false
IS_LINUX=false
case "$OS" in
    Darwin) IS_MAC=true ;;
    Linux)  IS_LINUX=true ;;
    *) echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

# ── Log file ──────────────────────────────────────────────────────
LOGS_DIR="$HOME/.claude/logs"
mkdir -p "$LOGS_DIR"
LOG_FILE="$LOGS_DIR/bootstrap-$(date '+%Y%m%dT%H%M%S').log"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [INFO] bootstrap start ($OS)" > "$LOG_FILE"

write_step() {
    local n="$1" desc="$2" status="${3:-start}" detail="${4:-}"
    CURRENT_STEP="$n"
    local icon color
    case "$status" in
        start) icon='⏳'; color='\033[0;36m' ;;
        ok)    icon='✅'; color='\033[0;32m' ;;
        skip)  icon='⏭ '; color='\033[2m' ;;
        warn)  icon='⚠️ '; color='\033[1;33m' ;;
        fail)  icon='❌'; color='\033[0;31m' ;;
    esac
    local nc='\033[0m'
    local prefix="[${n}/${TOTAL_STEPS}]"
    local line="${prefix} ${icon} ${desc}"
    [ -n "$detail" ] && line="${line} · ${detail}"
    printf '%b%s%b\n' "$color" "$line" "$nc"
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [${status^^}] step ${n} — ${desc} ${detail:+· $detail}" >> "$LOG_FILE"
}

beep() { printf '\a'; }

# ── Banner ────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  KUN BOOTSTRAP — single-paste cold start ($OS)"
echo "  Role: ${ROLE} · $($DRY_RUN && echo 'DRY RUN' || echo 'live')"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Log: $LOG_FILE"
echo ""

# ── [0] No ExecutionPolicy on Unix; verify bash >= 3.2 ────────────
write_step 0 "Verify bash 3.2+ + curl + git" start
[ -n "${BASH_VERSION:-}" ] || { write_step 0 "not running under bash" fail; exit 1; }
command -v curl >/dev/null 2>&1 || { write_step 0 "curl missing" fail; exit 1; }
write_step 0 "bash ${BASH_VERSION%%(*} + curl present" ok

# ── [1] sudo / elevation check ────────────────────────────────────
write_step 1 "Elevation check (sudo cache)" start
if [ "$DRY_RUN" = true ]; then
    write_step 1 "[dry-run] would request sudo for brew/launchd" skip
else
    # Warm sudo cache so brew installs don't prompt mid-flow
    if sudo -n true 2>/dev/null; then
        write_step 1 "sudo cached" ok
    else
        echo "  Bootstrap needs sudo for some package installs. Enter password:"
        sudo -v || { write_step 1 "sudo declined" fail; exit 1; }
        write_step 1 "sudo granted" ok
        # Keep alive in background
        ( while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
    fi
fi

# ── [2] OS version check ──────────────────────────────────────────
write_step 2 "OS + arch check" start
ARCH="$(uname -m)"
if $IS_MAC; then
    MACOS_VER=$(sw_vers -productVersion 2>/dev/null)
    write_step 2 "macOS ${MACOS_VER:-?} · ${ARCH}" ok
else
    LINUX_DISTRO=$(grep -E '^PRETTY_NAME=' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"')
    write_step 2 "Linux ${LINUX_DISTRO:-?} · ${ARCH}" ok
fi

# ── [3] Logs directory already created above ──────────────────────
write_step 3 "Logs directory ready" ok "$LOGS_DIR"

# ── [4] Package manager bundle ────────────────────────────────────
write_step 4 "Installing CLI tools" start
install_pkg() {
    local name="$1"
    if $IS_MAC; then
        if brew list "$name" >/dev/null 2>&1; then
            write_step 4 "  ${name}" skip "already installed"
            return 0
        fi
        if [ "$DRY_RUN" = true ]; then
            write_step 4 "  ${name}" skip "[dry-run]"
            return 0
        fi
        if brew install "$name" >> "$LOG_FILE" 2>&1; then
            write_step 4 "  ${name}" ok "installed"
        else
            write_step 4 "  ${name}" warn "brew install failed (see log)"
        fi
    else
        # Linux: prefer apt, then dnf, then pacman
        if command -v "$name" >/dev/null 2>&1; then
            write_step 4 "  ${name}" skip "already on PATH"
            return 0
        fi
        if [ "$DRY_RUN" = true ]; then
            write_step 4 "  ${name}" skip "[dry-run]"
            return 0
        fi
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get install -y -q "$name" >> "$LOG_FILE" 2>&1 && write_step 4 "  ${name}" ok || write_step 4 "  ${name}" warn "apt failed"
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y -q "$name" >> "$LOG_FILE" 2>&1 && write_step 4 "  ${name}" ok || write_step 4 "  ${name}" warn "dnf failed"
        else
            write_step 4 "  ${name}" warn "no supported package manager"
        fi
    fi
}

# Install homebrew first on macOS if missing
if $IS_MAC && ! command -v brew >/dev/null 2>&1; then
    if [ "$DRY_RUN" = true ]; then
        write_step 4 "  Homebrew" skip "[dry-run] would install"
    else
        write_step 4 "  Homebrew" start
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" >> "$LOG_FILE" 2>&1
        # Add brew to PATH
        if [ -x /opt/homebrew/bin/brew ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -x /usr/local/bin/brew ]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
        command -v brew >/dev/null 2>&1 && write_step 4 "  Homebrew" ok || { write_step 4 "  Homebrew" fail; exit 1; }
    fi
fi

for pkg in git node gh; do install_pkg "$pkg"; done

# Claude Code CLI via npm (cross-platform — works after node lands)
if command -v npm >/dev/null 2>&1; then
    if command -v claude >/dev/null 2>&1; then
        write_step 4 "  Claude Code CLI" skip "already on PATH"
    elif [ "$DRY_RUN" = true ]; then
        write_step 4 "  Claude Code CLI" skip "[dry-run]"
    else
        npm install -g @anthropic-ai/claude-code >> "$LOG_FILE" 2>&1 && write_step 4 "  Claude Code CLI" ok || write_step 4 "  Claude Code CLI" warn "npm install failed"
    fi
fi

# Claude Desktop (macOS only)
if $IS_MAC && [ "$SKIP_DESKTOP" != true ]; then
    if [ -d "/Applications/Claude.app" ]; then
        write_step 4 "  Claude Desktop" skip "already installed"
    elif [ "$DRY_RUN" = true ]; then
        write_step 4 "  Claude Desktop" skip "[dry-run]"
    else
        brew install --cask claude >> "$LOG_FILE" 2>&1 && write_step 4 "  Claude Desktop" ok || write_step 4 "  Claude Desktop" warn "brew cask install failed"
    fi
fi

# ── [5] PATH refresh ──────────────────────────────────────────────
write_step 5 "Refreshing PATH" start
if $IS_MAC; then
    [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
    [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
fi
write_step 5 "PATH refreshed" ok

# ── [6] pnpm via npm (cross-platform) ─────────────────────────────
write_step 6 "Installing pnpm globally" start
if command -v pnpm >/dev/null 2>&1; then
    write_step 6 "pnpm already on PATH" skip
elif [ "$DRY_RUN" = true ]; then
    write_step 6 "[dry-run] would npm install -g pnpm" skip
else
    npm install -g pnpm >> "$LOG_FILE" 2>&1 && write_step 6 "pnpm installed" ok || write_step 6 "pnpm install failed" warn
fi

# ── [7] WebStorm (macOS via brew cask) ────────────────────────────
if [ "$SKIP_IDE" != true ] && $IS_MAC; then
    write_step 7 "Installing WebStorm" start
    if [ -d "/Applications/WebStorm.app" ]; then
        write_step 7 "WebStorm already installed" skip
    elif [ "$DRY_RUN" = true ]; then
        write_step 7 "[dry-run] would brew install webstorm" skip
    else
        brew install --cask webstorm >> "$LOG_FILE" 2>&1 && write_step 7 "WebStorm installed" ok || write_step 7 "WebStorm install failed" warn
    fi
else
    write_step 7 "WebStorm — skipped" skip
fi

# ── [8] Plugin pre-drop (macOS only) ──────────────────────────────
if $IS_MAC && [ "$SKIP_IDE" != true ]; then
    write_step 8 "Pre-dropping Claude Code [Beta] plugin" start
    if [ "$DRY_RUN" = true ]; then
        write_step 8 "[dry-run] would download + extract plugin" skip
    else
        # Marketplace API (same endpoints as Windows Drop-Plugin.ps1)
        PLUGIN_META=$(curl -fsSL --max-time 10 'https://plugins.jetbrains.com/api/plugins/27310/updates?channel=&size=1' 2>/dev/null)
        if [ -n "$PLUGIN_META" ]; then
            PLUGIN_FILE=$(echo "$PLUGIN_META" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["file"])' 2>/dev/null)
            if [ -n "$PLUGIN_FILE" ]; then
                WS_CONFIG=$(ls -dt "$HOME/Library/Application Support/JetBrains/WebStorm"* 2>/dev/null | head -1)
                if [ -n "$WS_CONFIG" ]; then
                    PLUGINS_DIR="$WS_CONFIG/plugins"
                    mkdir -p "$PLUGINS_DIR"
                    # Skip if already loaded
                    if ls "$PLUGINS_DIR" 2>/dev/null | grep -iq 'claude'; then
                        write_step 8 "Plugin already present" skip
                    else
                        TMP_ZIP="$(mktemp -t claude-plugin).zip"
                        if curl -fsSL "https://plugins.jetbrains.com/files/$PLUGIN_FILE" -o "$TMP_ZIP" 2>>"$LOG_FILE"; then
                            unzip -q "$TMP_ZIP" -d "$PLUGINS_DIR" 2>>"$LOG_FILE" && \
                                write_step 8 "Plugin installed to $PLUGINS_DIR" ok || \
                                write_step 8 "Plugin extract failed" warn
                            rm -f "$TMP_ZIP"
                        else
                            write_step 8 "Plugin download failed" warn "Marketplace unreachable"
                        fi
                    fi
                else
                    write_step 8 "WebStorm config dir not found — open WebStorm once first" warn
                fi
            else
                write_step 8 "Marketplace response missing 'file' field" warn
            fi
        else
            write_step 8 "Marketplace API unreachable" warn
        fi
    fi
else
    write_step 8 "Plugin pre-drop — skipped" skip
fi

# ── [9] Kun config (install.sh) ───────────────────────────────────
write_step 9 "Installing ~/.claude/ config via install.sh" start
INSTALL_URL="https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/install.sh"
if [ "$DRY_RUN" = true ]; then
    write_step 9 "[dry-run] would fetch $INSTALL_URL" skip
else
    if curl -fsSL "$INSTALL_URL" | bash -s -- "$ROLE" >> "$LOG_FILE" 2>&1; then
        write_step 9 "install.sh done" ok
    else
        write_step 9 "install.sh failed" fail
        exit 1
    fi
fi

# ── [10] Settings (handled by install.sh) ─────────────────────────
write_step 10 "settings.json (handled by install.sh)" ok

# ── [11] Shell rc c/cc block (handled by install.sh's updated logic) ──
write_step 11 "c/cc aliases in shell rc (handled by install.sh)" ok

# ── [12] OAuth batch ──────────────────────────────────────────────
write_step 12 "OAuth batch (3 sign-ins)" start
if [ "$DRY_RUN" = true ]; then
    write_step 12 "[dry-run] would walk gh + claude + JetBrains" skip
elif [ "$SKIP_OAUTH" = true ]; then
    write_step 12 "OAuth — skipped via --skip-oauth" skip
else
    beep
    echo ""
    echo "── OAuth batch: 3 sign-ins, ~5 minutes ─────────────────"
    echo "   Press Enter between each step."
    echo ""
    read -r -p "Press Enter to begin OAuth..."

    # 1. GitHub
    echo ""
    echo "   [1/3] GitHub"
    if command -v gh >/dev/null 2>&1; then
        if gh auth status 2>&1 | grep -q 'Logged in'; then
            echo "         ✅ already logged in"
        else
            gh auth login --web --git-protocol https --hostname github.com
        fi
    else
        echo "         gh CLI missing"
    fi

    # 2. Claude
    echo ""
    echo "   [2/3] Claude"
    if [ -f "$HOME/.claude/.credentials.json" ]; then
        echo "         ✅ already signed in"
    else
        echo "         Open a new shell and run: claude"
        echo "         Browser will open for sign-in."
        read -r -p "         Press Enter after 'Logged in' appears..."
    fi

    # 3. JetBrains (macOS only)
    echo ""
    if $IS_MAC && [ -d "/Applications/WebStorm.app" ]; then
        echo "   [3/3] JetBrains"
        echo "         Open WebStorm and sign in (or click Start trial)."
        read -r -p "         Press Enter after WebStorm shows the project window..."
    else
        echo "   [3/3] JetBrains — skipped (no WebStorm)"
    fi

    write_step 12 "OAuth batch complete" ok
fi

# ── [13] Secrets ──────────────────────────────────────────────────
write_step 13 "Pulling .env via secrets.sh" start
SECRETS_SCRIPT="$HOME/.claude/scripts/secrets.sh"
if [ ! -f "$SECRETS_SCRIPT" ]; then
    write_step 13 "secrets.sh missing — install.sh must run first" warn
elif [ "$DRY_RUN" = true ]; then
    write_step 13 "[dry-run] would call secrets.sh" skip
else
    bash "$SECRETS_SCRIPT" "$GIST_ID" >> "$LOG_FILE" 2>&1 && \
        write_step 13 ".env pulled from Gist" ok || \
        write_step 13 "secrets.sh failed" warn
fi

# ── [14] Repo clone ──────────────────────────────────────────────
write_step 14 "Cloning org repos via sync-repos.sh" start
SYNC_SCRIPT="$HOME/.claude/scripts/sync-repos.sh"
if [ ! -f "$SYNC_SCRIPT" ]; then
    write_step 14 "sync-repos.sh missing" warn
elif [ "$DRY_RUN" = true ]; then
    write_step 14 "[dry-run] would call sync-repos.sh" skip
else
    bash "$SYNC_SCRIPT" >> "$LOG_FILE" 2>&1 && \
        write_step 14 "org repos cloned" ok || \
        write_step 14 "sync-repos.sh had errors" warn
fi

# ── [15] maintain --install ──────────────────────────────────────
write_step 15 "Arming kun-maintain launchd agent" start
MAINTAIN_SCRIPT="$HOME/.claude/scripts/maintain.sh"
if [ ! -f "$MAINTAIN_SCRIPT" ]; then
    write_step 15 "maintain.sh missing — skipping" warn
elif [ "$DRY_RUN" = true ]; then
    write_step 15 "[dry-run] would call maintain.sh --install" skip
elif $IS_LINUX; then
    write_step 15 "Linux scheduling not yet supported (use cron manually)" warn
else
    bash "$MAINTAIN_SCRIPT" --install >> "$LOG_FILE" 2>&1 && \
        write_step 15 "kun-maintain armed for daily 09:00" ok || \
        write_step 15 "scheduled task creation failed" warn
fi

# ── [16] Final verify via doctor.sh ──────────────────────────────
write_step 16 "Verifying via doctor.sh" start
DOCTOR_SCRIPT="$HOME/.claude/scripts/doctor.sh"
DOCTOR_EXIT=-1
if [ ! -f "$DOCTOR_SCRIPT" ]; then
    write_step 16 "doctor.sh missing" fail
    DOCTOR_EXIT=1
elif [ "$DRY_RUN" = true ]; then
    write_step 16 "[dry-run] would run doctor.sh" skip
    DOCTOR_EXIT=0
else
    bash "$DOCTOR_SCRIPT" --quiet >> "$LOG_FILE" 2>&1
    DOCTOR_EXIT=$?
    case "$DOCTOR_EXIT" in
        0) write_step 16 "doctor: all green" ok ;;
        1) write_step 16 "doctor: errors (run 'doctor' to see)" fail ;;
        2) write_step 16 "doctor: warnings (run 'doctor' to see)" warn ;;
        3) write_step 16 "doctor: updates available (run 'doctor --update')" ok ;;
        *) write_step 16 "doctor: exit ${DOCTOR_EXIT}" warn ;;
    esac
fi

# ── Final state ──────────────────────────────────────────────────
ELAPSED=$(( $(date +%s) - STARTED ))
MINS=$(( ELAPSED / 60 ))
SECS=$(( ELAPSED % 60 ))

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ "$DOCTOR_EXIT" = "0" ] || [ "$DOCTOR_EXIT" = "3" ]; then
    echo "  ✅ KUN BOOTSTRAP COMPLETE"
else
    echo "  ⚠️  KUN BOOTSTRAP DONE WITH WARNINGS"
fi
echo "  Elapsed: ${MINS}m ${SECS}s · Log: $LOG_FILE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  • Open a new terminal and type:  c              (starts Claude)"
echo "  • Or open WebStorm in any cloned repo"
echo "  • Run 'doctor' any time to re-check health"
echo ""

exit $DOCTOR_EXIT
