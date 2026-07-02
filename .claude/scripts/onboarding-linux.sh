#!/bin/bash
# =============================================================================
# Computer Onboarding — Linux
# =============================================================================
# Fresh Linux box to fully working dev environment in one command.
# Auto-detects distro (Debian/Ubuntu, Fedora/RHEL, Arch/Manjaro, openSUSE).
#
# Usage:
#   bash onboarding-linux.sh <role> [gist_id] [flags]
#
# Roles:
#   engineer | business | content | ops
#
# Flags:
#   --quiet            Skip terminal prompts (for wrapper/CI use)
#   --name <name>      Pre-supply git identity (skips prompt)
#   --email <email>    Pre-supply git email (skips prompt)
#   --essentials-only  Clone only kun/hogwarts/codebase (default: all org repos)
#
# One-liner:
#   git clone https://github.com/databayt/kun.git ~/kun && bash ~/kun/.claude/scripts/onboarding-linux.sh engineer
#
# NOTE: Claude Desktop is NOT available for Linux. Linux users get:
#   Claude Code CLI, claude.ai/code in browser,
#   plus VS Code/WebStorm Claude plugins.
# =============================================================================

set -e

# ── Args ────────────────────────────────────────────────────────
ROLE="" GIST_ID="" QUIET=0 GIT_NAME_ARG="" GIT_EMAIL_ARG=""
ALL_REPOS=1 REPOS_DIR="$HOME" HOGWARTS_DEV=0
AGENTS_SEL="all" DETECT_ONLY=0 DRY_RUN=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --quiet)            QUIET=1; shift ;;
        --name)             GIT_NAME_ARG="$2"; shift 2 ;;
        --email)            GIT_EMAIL_ARG="$2"; shift 2 ;;
        --repos-dir)        REPOS_DIR="$2"; shift 2 ;;
        --essentials-only)  ALL_REPOS=0; shift ;;
        --hogwarts-dev)     HOGWARTS_DEV=1; shift ;;
        --agents=*)         AGENTS_SEL="${1#--agents=}"; shift ;;
        --agents)           AGENTS_SEL="$2"; shift 2 ;;
        --detect-only)      DETECT_ONLY=1; shift ;;
        --dry-run)          DRY_RUN=1; shift ;;
        --*)                echo "Unknown flag: $1" >&2; exit 1 ;;
        *)
            if [[ -z "$ROLE" ]]; then ROLE="$1"
            elif [[ -z "$GIST_ID" ]]; then GIST_ID="$1"
            fi
            shift ;;
    esac
done
mkdir -p "$REPOS_DIR" 2>/dev/null || true

# ── Colors ──────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m'
D='\033[2m' BD='\033[1m' NC='\033[0m'

ERRORS=0
pass() { echo -e "  ${G}✓${NC} $1"; }
fail() { echo -e "  ${R}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
info() { echo -e "  ${D}·${NC} $1"; }

# Open a URL in the user's default browser; best-effort, returns silently.
# Covers desktop Linux (xdg-open), Wayland (wlview), Debian (sensible-browser),
# and WSL (wslview) so the install one-liner works on every Linux flavor.
open_url() {
    local url="$1"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    elif command -v wslview >/dev/null 2>&1; then
        wslview "$url" >/dev/null 2>&1 &
    elif command -v sensible-browser >/dev/null 2>&1; then
        sensible-browser "$url" >/dev/null 2>&1 &
    fi
}

# Copy text to the system clipboard; returns 0 if any backend worked.
# Wayland first (modern default), then X11, then WSL's clip.exe.
copy_clipboard() {
    local text="$1"
    if command -v wl-copy >/dev/null 2>&1 && printf '%s' "$text" | wl-copy >/dev/null 2>&1; then return 0; fi
    if command -v xclip   >/dev/null 2>&1 && printf '%s' "$text" | xclip -selection clipboard >/dev/null 2>&1; then return 0; fi
    if command -v xsel    >/dev/null 2>&1 && printf '%s' "$text" | xsel --clipboard --input >/dev/null 2>&1; then return 0; fi
    if command -v clip.exe >/dev/null 2>&1 && printf '%s' "$text" | clip.exe >/dev/null 2>&1; then return 0; fi
    return 1
}

# Smart apt install — skip if up-to-date, upgrade if outdated, install if missing.
# Most teammates already have git/curl/ca-certificates; this avoids reinstall churn.
apt_smart() {
    local pkg="$1"
    if dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
        if apt list --upgradable 2>/dev/null | grep -q "^$pkg/"; then
            sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade "$pkg" >/dev/null 2>&1 \
                && pass "$pkg upgraded" || pass "$pkg present (upgrade failed)"
        else
            pass "$pkg up to date"
        fi
    else
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$pkg" >/dev/null 2>&1 \
            && pass "$pkg installed" || fail "$pkg install failed"
    fi
}

# Smart snap install — refresh if installed, install if missing. Pass --classic as $2.
snap_smart() {
    local pkg="$1"
    local classic=""
    [[ "$2" == "--classic" ]] && classic="--classic"
    if snap list "$pkg" &>/dev/null; then
        sudo snap refresh "$pkg" >/dev/null 2>&1 \
            && pass "$pkg refreshed (or already latest)" || pass "$pkg present"
    else
        sudo snap install $classic "$pkg" >/dev/null 2>&1 \
            && pass "$pkg installed" || fail "$pkg install failed"
    fi
}

# Smart npm -g install — always pulls @latest (idempotent: noop if already latest).
npm_global_smart() {
    local pkg="$1" cmd="${2:-$1}"
    local before=""
    command -v "$cmd" &>/dev/null && before=$("$cmd" --version 2>/dev/null | head -1)
    npm install -g "${pkg}@latest" --silent >/dev/null 2>&1
    if command -v "$cmd" &>/dev/null; then
        local after=$("$cmd" --version 2>/dev/null | head -1)
        if [[ -z "$before" ]]; then
            pass "$cmd installed ($after)"
        elif [[ "$before" != "$after" ]]; then
            pass "$cmd upgraded ($before → $after)"
        else
            pass "$cmd up to date ($after)"
        fi
    else
        fail "$cmd install failed"
    fi
}

step() {
    echo ""
    echo -e "${BD}[$1/8]${NC} ${B}$2${NC}"
    echo "PROGRESS:$1/8:$2" >&2
}

# ── Validate ────────────────────────────────────────────────────
if false; then  # usage block kept for reference; no longer triggered (role defaults to "engineer")
    echo -e "${BD}Computer Onboarding — Linux${NC}"
    echo ""
    echo "Usage: bash onboarding-linux.sh [role] [flags]"
    echo ""
    echo "Roles: engineer | business | content | ops"
    echo ""
    echo "Flags:"
    echo "  --quiet            Skip terminal prompts"
    echo "  --name <name>      Pre-supply git identity"
    echo "  --email <email>    Pre-supply git email"
    echo "  --essentials-only  Skip optional org repos"
    echo "  --repos-dir <dir>  Where to save databayt repos (default: \$HOME)"
    echo "  --hogwarts-dev     Set up hogwarts local dev (pnpm + DB seed + build)"
    echo ""
    echo "One-liner:"
    echo "  git clone https://github.com/databayt/kun.git ~/kun && bash ~/kun/.claude/scripts/onboarding-linux.sh engineer"
    exit 0
fi

if [[ "$(uname -s)" != "Linux" ]]; then
    echo -e "${R}This script is for Linux. Use onboarding-mac.sh or onboarding-windows.ps1.${NC}"
    exit 1
fi

# Role is a label only — every machine gets the full config. Default to "engineer"
# when omitted, keep validating explicit values for backward compat with old callers.
if [[ -z "$ROLE" ]]; then
    ROLE="engineer"
fi

if [[ "$ROLE" != "engineer" && "$ROLE" != "business" && "$ROLE" != "content" && "$ROLE" != "ops" ]]; then
    echo -e "${R}Invalid role: $ROLE${NC}"
    echo "Valid: engineer (default), business, content, ops"
    exit 1
fi

# ── Distro detect ───────────────────────────────────────────────
DISTRO_ID="unknown"
PKG=""
PKG_INSTALL=""
PKG_REFRESH=""
if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    DISTRO_ID="${ID:-unknown}"
fi
case "$DISTRO_ID" in
    debian|ubuntu|linuxmint|pop|elementary)
        PKG="apt"; PKG_REFRESH="sudo apt-get update -y"; PKG_INSTALL="sudo DEBIAN_FRONTEND=noninteractive apt-get install -y" ;;
    fedora|rhel|centos|rocky|almalinux)
        PKG="dnf"; PKG_REFRESH="sudo dnf check-update -y || true"; PKG_INSTALL="sudo dnf install -y" ;;
    arch|manjaro|endeavouros)
        PKG="pacman"; PKG_REFRESH="sudo pacman -Sy --noconfirm"; PKG_INSTALL="sudo pacman -S --noconfirm --needed" ;;
    opensuse*|suse|sles)
        PKG="zypper"; PKG_REFRESH="sudo zypper refresh"; PKG_INSTALL="sudo zypper install -y" ;;
    *)
        echo -e "${R}Unsupported distro: $DISTRO_ID${NC}"
        echo "Supported: Debian/Ubuntu/Mint, Fedora/RHEL/Rocky, Arch/Manjaro, openSUSE"
        exit 1 ;;
esac

# Per-distro package name overrides
pkg_name() {
    local generic="$1"
    case "$PKG:$generic" in
        pacman:gh) echo "github-cli" ;;
        apt:python3-pip) echo "python3-pip" ;;
        *) echo "$generic" ;;
    esac
}

echo ""
echo -e "${BD}Computer Onboarding — Linux ($DISTRO_ID / $PKG)${NC}"
echo -e "Role: ${G}$ROLE${NC} · Agents: ${G}$AGENTS_SEL${NC}"

# =============================================================================
# PHASE 0: Scan — detect first, install only the delta
# =============================================================================
# Agent fleet library — detection, alias block, opencode bypass config.
# (Desktop rows report against /Applications on mac; on Linux the Desktop
# lane is the optional beta — the scan simply shows it missing.)
# shellcheck disable=SC1090
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/agents.sh"

agents_detect_all
if [[ "$DETECT_ONLY" == "1" ]]; then
    exit 0
fi
if [[ "$DRY_RUN" == "1" ]]; then
    echo -e "${BD}Dry run — a real run with --agents=$AGENTS_SEL would install:${NC}"
    DELTA=$(agents_delta "$AGENTS_SEL")
    if [[ -n "$DELTA" ]]; then
        echo "$DELTA" | sed 's/^/  · /'
    else
        echo "  (nothing — the selected agents are already fully provisioned)"
    fi
    exit 0
fi

# =============================================================================
# PHASE 1: System Foundation
# =============================================================================
step "1" "System Foundation — build tools, git, Node.js, pnpm, gh CLI"

info "Refreshing package index..."
eval "$PKG_REFRESH" >/dev/null 2>&1 || true

# Build essentials
case "$PKG" in
    apt)    $PKG_INSTALL build-essential curl ca-certificates >/dev/null 2>&1 ;;
    dnf)    $PKG_INSTALL '@development-tools' curl ca-certificates >/dev/null 2>&1 ;;
    pacman) $PKG_INSTALL base-devel curl ca-certificates >/dev/null 2>&1 ;;
    zypper) $PKG_INSTALL -t pattern devel_basis; $PKG_INSTALL curl ca-certificates >/dev/null 2>&1 ;;
esac
pass "Build tools"

# Git — apt_smart handles install + upgrade idempotently (apt-only; other distros
# use their package manager directly since apt_smart is apt-specific)
case "$PKG" in
    apt) apt_smart git ;;
    *)   $PKG_INSTALL git >/dev/null 2>&1 && pass "Git" || fail "Git install failed" ;;
esac

# GitHub CLI (gh) — apt needs custom repo for current version
if ! command -v gh >/dev/null 2>&1; then
    info "Installing GitHub CLI..."
    case "$PKG" in
        apt)
            # Official gh apt repo
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null 2>&1 && \
            sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
            sudo apt-get update -y >/dev/null 2>&1 && \
            apt_smart gh
            ;;
        *)  $PKG_INSTALL "$(pkg_name gh)" >/dev/null 2>&1 && pass "GitHub CLI" ;;
    esac
elif [[ "$PKG" == "apt" ]]; then
    # Already installed via apt — let apt_smart check for upgrades
    apt_smart gh
else
    pass "GitHub CLI ($(gh --version 2>/dev/null | head -1))"
fi

# Node.js via nvm (distro packages often lag — nvm gives us LTS reliably).
# nvm install --lts is idempotent: noop if already on latest LTS, upgrades otherwise.
if [[ ! -d "$HOME/.nvm" ]]; then
    info "Installing nvm + Node 24 LTS..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash >/dev/null 2>&1
fi
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
NODE_BEFORE=$(node --version 2>/dev/null || echo "none")
nvm install --lts >/dev/null 2>&1
nvm use --lts >/dev/null 2>&1
NODE_AFTER=$(node --version 2>/dev/null || echo "")
if [[ "$NODE_BEFORE" == "none" ]]; then
    pass "Node.js installed ($NODE_AFTER)"
elif [[ "$NODE_BEFORE" != "$NODE_AFTER" ]]; then
    pass "Node.js upgraded ($NODE_BEFORE → $NODE_AFTER)"
else
    pass "Node.js up to date ($NODE_AFTER)"
fi

# pnpm + Vercel CLI — @latest is idempotent (noop if already latest)
npm_global_smart pnpm
npm_global_smart vercel

# =============================================================================
# PHASE 2: Applications (snap-first; fall back to direct install)
# =============================================================================
step "2" "Applications — VS Code, WebStorm, Chrome"

# snap availability — preferred for desktop apps on Linux
HAS_SNAP=0
command -v snap >/dev/null 2>&1 && HAS_SNAP=1

# IDEs on every machine — snap_smart handles install + refresh idempotently
if [[ "$HAS_SNAP" == "1" ]]; then
    snap_smart code --classic
    snap_smart webstorm --classic
else
    command -v code      >/dev/null 2>&1 && pass "VS Code (manual)"  || info "snap missing — install VS Code from https://code.visualstudio.com/"
    command -v webstorm  >/dev/null 2>&1 && pass "WebStorm (manual)" || info "snap missing — install WebStorm from https://www.jetbrains.com/webstorm/"
fi

# Chrome — only via snap or manual install (no official package in most distros)
if ! command -v google-chrome >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
    case "$PKG" in
        apt)
            # Add Google's repo
            curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg 2>/dev/null && \
            echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list >/dev/null && \
            sudo apt-get update -y >/dev/null 2>&1 && \
            $PKG_INSTALL google-chrome-stable >/dev/null 2>&1 && pass "Chrome installed" || info "Chrome skipped — install manually"
            ;;
        *)
            info "Chrome — install from https://www.google.com/chrome/ (Chromium also available via $PKG)"
            ;;
    esac
else
    pass "Browser (Chrome/Chromium)"
fi

# =============================================================================
# PHASE 3: GitHub
# =============================================================================
step "3" "GitHub — SSH key, authentication, git config"

# Remember if git identity is already set; we'll backfill from gh api user later
# (after auth) if it isn't. Placing this after auth lets the universal wizard skip
# asking for name/email up front.
EXISTING_GIT_NAME=$(git config --global user.name 2>/dev/null || echo "")

# SSH key — comment is metadata only; gh auth ties it to the right user later
if [[ ! -f "$HOME/.ssh/id_ed25519" ]]; then
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
    ssh-keygen -t ed25519 -C "databayt-onboarding-$(hostname -s)" -f "$HOME/.ssh/id_ed25519" -N "" >/dev/null
    eval "$(ssh-agent -s)" >/dev/null
    ssh-add "$HOME/.ssh/id_ed25519" 2>/dev/null
    pass "SSH key generated"
else
    pass "SSH key exists"
fi

# GitHub auth — robust on headless/remote/piped (curl|bash) installs.
# gh auth login is interactive; when this runs via `curl ... | bash`, stdin is
# the script (not a terminal), so the device flow can't read input and "fails
# to auth via web". Drive it from /dev/tty, with a token-paste fallback.
if ! gh auth status >/dev/null 2>&1; then
    if [ -e /dev/tty ]; then
        info "Connect your device to GitHub — opening the device page in your browser. If you don't have a GitHub account yet, sign up from that page (free)."
        # Pre-open the device-flow URL so the user doesn't have to copy it
        # from gh's output. The one-time code from gh is auto-copied to the
        # clipboard below — user just pastes when the page asks for it.
        open_url "https://github.com/login/device"

        # Run gh interactively while tee'ing its output to a temp file. A
        # background watcher pulls the XXXX-XXXX device code out of the file
        # as soon as gh prints it and copies it to the clipboard.
        ghout=$(mktemp)
        (
            while sleep 0.3; do
                [ -s "$ghout" ] || continue
                code=$(grep -oE '[A-Z0-9]{4}-[A-Z0-9]{4}' "$ghout" 2>/dev/null | head -1)
                if [ -n "$code" ]; then
                    if copy_clipboard "$code"; then
                        printf '\n  %b✓%b One-time code %s copied to clipboard — paste it on the page.\n\n' "${G}" "${NC}" "$code" >/dev/tty
                    fi
                    exit 0
                fi
            done
        ) &
        watcher_pid=$!
        gh auth login -p ssh -w </dev/tty 2>&1 | tee "$ghout" >/dev/tty || true
        kill "$watcher_pid" 2>/dev/null
        wait "$watcher_pid" 2>/dev/null
        rm -f "$ghout"

        if ! gh auth status >/dev/null 2>&1; then
            {
                echo ""
                echo "Web/device auth didn't complete (common on headless/remote boxes)."
                echo "Fallback — paste a GitHub Personal Access Token:"
                echo "  1. https://github.com/settings/tokens (classic) -> Generate new token"
                echo "  2. Scopes: repo, read:org, admin:public_key"
                echo "  3. Paste below:"
            } >/dev/tty
            gh auth login -p ssh --with-token </dev/tty || true
        fi
    else
        info "No terminal for interactive GitHub login."
        echo "Run once in a real terminal, then re-run the installer:" >&2
        echo "  gh auth login -p ssh        # device flow, no local browser needed" >&2
    fi
    if gh auth status >/dev/null 2>&1; then
        pass "GitHub authenticated"
    else
        fail "GitHub auth not completed — run 'gh auth login -p ssh' then re-run"
    fi
else
    GH_USER=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
    pass "GitHub authenticated ($GH_USER)"
fi

# Push SSH key to GitHub
KEY_FP=$(ssh-keygen -lf "$HOME/.ssh/id_ed25519.pub" 2>/dev/null | awk '{print $2}')
if ! gh ssh-key list 2>/dev/null | grep -q "$KEY_FP"; then
    HOSTNAME=$(hostname -s)
    gh ssh-key add "$HOME/.ssh/id_ed25519.pub" --title "databayt-$HOSTNAME" 2>/dev/null && \
        pass "SSH key on GitHub" || info "SSH key may already be on GitHub"
else
    pass "SSH key on GitHub"
fi

# Git identity — set only if not already configured. Priority:
#   1. --name/--email installer args (legacy compat)
#   2. existing ~/.gitconfig (idempotent re-runs)
#   3. gh api user (auto-derive from the GitHub account just authed)
#   4. $(whoami) fallback (quiet mode + gh unreachable)
if [[ -z "$EXISTING_GIT_NAME" ]]; then
    if [[ -n "$GIT_NAME_ARG" ]]; then
        GIT_NAME="$GIT_NAME_ARG"; GIT_EMAIL="$GIT_EMAIL_ARG"
        info "Git identity from installer args"
    else
        GH_LOGIN=$(gh api user --jq '.login' 2>/dev/null || echo "")
        GH_NAME=$(gh api user --jq '.name // .login' 2>/dev/null || echo "")
        if [[ -n "$GH_LOGIN" ]]; then
            GIT_NAME="$GH_NAME"
            GIT_EMAIL="${GH_LOGIN}@users.noreply.github.com"
            info "Git identity auto-derived from GitHub ($GH_LOGIN)"
        elif [[ "$QUIET" == "1" ]]; then
            GIT_NAME="$(whoami)"; GIT_EMAIL="$(whoami)@$(hostname -s).local"
            info "Quiet mode — placeholder git identity (override via 'git config --global')"
        else
            read -p "  Full name (for git commits): " GIT_NAME
            read -p "  Email (for git commits): " GIT_EMAIL
        fi
    fi
    git config --global user.name "$GIT_NAME"
    git config --global user.email "$GIT_EMAIL"
    pass "Git config: $GIT_NAME <$GIT_EMAIL>"
else
    GIT_EMAIL=$(git config --global user.email 2>/dev/null || echo "")
    pass "Git config: $EXISTING_GIT_NAME <$GIT_EMAIL>"
fi

# Pre-clone gate: must be an active member of github.com/databayt to clone private repos.
state=$(gh api user/memberships/orgs/databayt --jq .state 2>/dev/null || echo "")
if [[ -z "$state" ]]; then
    fail "Cannot check databayt org membership (token may lack read:org scope)"
    info "Run: gh auth refresh -h github.com -s read:org -w   then re-run this script"
    exit 1
elif [[ "$state" != "active" ]]; then
    fail "Not an active member of github.com/databayt"
    info "Open the invite, accept it, then re-run this script (idempotent)"
    open_url "https://github.com/orgs/databayt/invitations"
    exit 1
fi
pass "databayt org membership active"

# SSH push capability: ssh -T against github.com always exits non-zero, so grep the banner.
ssh_out=$(ssh -T -o StrictHostKeyChecking=accept-new -o BatchMode=yes git@github.com 2>&1 || true)
if [[ "$ssh_out" == *"successfully authenticated"* ]]; then
    pass "SSH push to GitHub works"
else
    fail "SSH not authenticated to GitHub (clone+push will fail)"
    info "Re-run: gh auth login -p ssh -w   to upload your SSH key"
    exit 1
fi

# =============================================================================
# PHASE 4: Clone Repositories
# =============================================================================
step "4" "Clone Repositories"

# clone_one — silent worker. Records "<repo>\t<status>" (ok|https|exists|fail) to the
# results file. Never prints, never touches ERRORS, and ALWAYS returns 0 so a failed
# clone can't trip `set -e` when reaped by `wait`. Short lines are < PIPE_BUF, so the
# concurrent O_APPEND writes stay atomic and never interleave.
clone_one() {
    local results="$1" repo="$2" dir="$REPOS_DIR/$2"
    if [[ -d "$dir" ]]; then
        printf '%s\texists\n' "$repo" >> "$results"; return 0
    fi
    if git clone "git@github.com:databayt/$repo.git" "$dir" >/dev/null 2>&1; then
        printf '%s\tok\n' "$repo" >> "$results"
    elif git clone "https://github.com/databayt/$repo.git" "$dir" >/dev/null 2>&1; then
        printf '%s\thttps\n' "$repo" >> "$results"
    else
        printf '%s\tfail\n' "$repo" >> "$results"
    fi
    return 0
}
symlink_home() {
    local repo="$1"
    [[ "$REPOS_DIR" == "$HOME" ]] && return
    [[ -d "$REPOS_DIR/$repo" && ! -e "$HOME/$repo" ]] && \
        ln -sf "$REPOS_DIR/$repo" "$HOME/$repo" && info "~/$repo → $REPOS_DIR/$repo"
}

# clone_parallel — clone every repo concurrently in bounded batches, then report +
# symlink sequentially in canonical order. Fixed-size batches (not `wait -n`) keep this
# portable across bash versions. pass/fail/ERRORS run only in this parent shell.
clone_parallel() {
    local cap=4 results; results="$(mktemp)"
    local -a all=("$@"); local i n=${#all[@]} repo status
    info "Cloning $n repos (up to $cap in parallel)..."
    for (( i=0; i<n; i+=cap )); do
        for repo in "${all[@]:i:cap}"; do clone_one "$results" "$repo" & done
        wait
    done
    for repo in "$@"; do
        status="$(awk -F'\t' -v r="$repo" '$1==r{print $2; exit}' "$results")"
        case "$status" in
            ok)     pass "$repo" ;;
            https)  pass "$repo (HTTPS)" ;;
            exists) pass "$repo (exists)" ;;
            *)      fail "$repo clone failed" ;;
        esac
        symlink_home "$repo"
    done
    rm -f "$results"
}

# Every machine clones the full org — any machine can be any task.
if [[ "$ALL_REPOS" == "1" ]]; then
    clone_parallel kun hogwarts codebase shadcn radix souq mkan shifa ios-app android-app crm distributed-computer marketing
else
    clone_parallel kun hogwarts codebase
fi

# =============================================================================
# PHASE 5: Agents — c/a/o/claw fleet (no Claude Desktop on Linux; the
# Desktop beta is manual — https://code.claude.com/docs/en/desktop-linux)
# =============================================================================
step "5" "Agents — the c/a/o/claw fleet (selected: $AGENTS_SEL)"

# Claude Code CLI — native installer (auto-updates in background, per
# code.claude.com/docs/en/setup). curl install.sh is idempotent: re-runs detect
# existing install and just refresh.
if agents_selected_contains "$AGENTS_SEL" code; then
    if ! command -v claude >/dev/null 2>&1; then
        info "Installing Claude Code CLI..."
        curl -fsSL https://claude.ai/install.sh | bash >/dev/null 2>&1
        export PATH="$HOME/.local/bin:$PATH"
        if ! grep -q ".local/bin" "$HOME/.bashrc" 2>/dev/null; then
            printf '\n# Claude Code\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.bashrc"
        fi
        pass "Claude Code CLI installed ($(claude --version 2>/dev/null | head -1))"
    else
        pass "Claude Code CLI ($(claude --version 2>/dev/null | head -1)) — auto-updates in background"
    fi
else
    info "Claude Code skipped (not in --agents)"
fi

# Antigravity CLI — secondary agent (`agy`). Fallback when Claude Code is
# unavailable + handles easy/cheap tasks (Gemini Flash). Idempotent installer,
# lands in ~/.local/bin (already on PATH from the Claude step above).
if agents_selected_contains "$AGENTS_SEL" agy; then
    if ! command -v agy >/dev/null 2>&1; then
        info "Installing Antigravity CLI (secondary agent)..."
        curl -fsSL https://antigravity.google/cli/install.sh | bash >/dev/null 2>&1
        export PATH="$HOME/.local/bin:$PATH"
        if command -v agy >/dev/null 2>&1; then
            pass "Antigravity CLI installed ($(agy --version 2>/dev/null | head -1))"
        else
            info "Antigravity CLI not ready (secondary agent — optional); re-run later or see docs/antigravity"
        fi
    else
        pass "Antigravity CLI ($(agy --version 2>/dev/null | head -1))"
    fi
fi

# opencode — tertiary agent. Bypass is CONFIG-LEVEL (no flag): merged into
# ~/.config/opencode/opencode.json as "permission": "allow".
if agents_selected_contains "$AGENTS_SEL" opencode; then
    if ! command -v opencode >/dev/null 2>&1; then
        info "Installing opencode (tertiary agent)..."
        curl -fsSL https://opencode.ai/install | bash >/dev/null 2>&1 || info "opencode installer failed — optional lane, continuing"
        export PATH="$HOME/.opencode/bin:$PATH"
    fi
    if command -v opencode >/dev/null 2>&1; then
        agents_configure_opencode
        pass "opencode ($(opencode --version 2>/dev/null | head -1)) · bypass = permission:allow"
    fi
fi

# OpenClaw — OPTIONAL assistant gateway (chat channels), not a coding CLI.
# npm install only; daemon onboarding is interactive and never runs headless.
if agents_selected_contains "$AGENTS_SEL" openclaw; then
    if ! command -v openclaw >/dev/null 2>&1; then
        npm install -g openclaw@latest --silent >/dev/null 2>&1 && \
            pass "OpenClaw installed ($(openclaw --version 2>/dev/null | head -1))" || \
            info "OpenClaw install failed — optional gateway, continuing"
        command -v openclaw >/dev/null 2>&1 && \
            info "OpenClaw daemon not started — interactive by design. Later: openclaw onboard --install-daemon"
    else
        pass "OpenClaw ($(openclaw --version 2>/dev/null | head -1))"
    fi
fi

# Launchers — one managed block in the shell rc (c / a / o / claw per selection).
# Migrates the legacy function lines; idempotent across re-runs.
for RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
    [[ ! -f "$RC" ]] && continue
    grep -q "function cc " "$RC" 2>/dev/null && sed -i '/function cc /d' "$RC"
done
agents_write_alias_block "$AGENTS_SEL"
pass "Shell launchers (managed block: c, a, o, claw per selection)"

# =============================================================================
# PHASE 6: Kun Engine
# =============================================================================
step "6" "Kun Engine — agents, skills, MCP, rules"

KUN_DIR="$HOME/kun"
if [[ -f "$KUN_DIR/.claude/scripts/setup.sh" ]]; then
    bash "$KUN_DIR/.claude/scripts/setup.sh" "$ROLE"
    pass "Kun Engine ($ROLE)"
else
    fail "Kun repo missing setup.sh"
fi

# Secrets
if [[ -n "$GIST_ID" && -f "$KUN_DIR/.claude/scripts/secrets.sh" ]]; then
    bash "$KUN_DIR/.claude/scripts/secrets.sh" "$GIST_ID"
    pass "Secrets loaded"
else
    info "Secrets skipped — run later: bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>"
fi

# Vercel env pull — per-product .env from team databayt (warns + continues if
# Vercel isn't logged in; teammate can run `vercel login` later and re-run).
if [[ -f "$KUN_DIR/.claude/scripts/vercel-pull.sh" ]]; then
    bash "$KUN_DIR/.claude/scripts/vercel-pull.sh" "$REPOS_DIR" || true
fi

# =============================================================================
# PHASE 7: Hogwarts Local Dev
# =============================================================================
step "7" "Hogwarts — dependencies, database, seed"

HOGWARTS_DIR="$REPOS_DIR/hogwarts"

# Heavy local-dev setup is opt-in (--hogwarts-dev), not role-gated
if [[ "$HOGWARTS_DEV" == "1" && -d "$HOGWARTS_DIR" ]]; then
    cd "$HOGWARTS_DIR"

    if [[ ! -f ".env" ]]; then
        if [[ -f "$HOME/.claude/.env" ]]; then
            cp "$HOME/.claude/.env" ".env"
            pass ".env from secrets"
        else
            info ".env missing — need gist ID"
        fi
    else
        pass ".env exists"
    fi

    info "Installing dependencies..."
    pnpm install 2>&1 | tail -1
    pass "pnpm install"

    info "Generating Prisma client..."
    npx prisma generate 2>&1 | tail -1
    pass "Prisma client"

    if grep -q "DATABASE_URL" ".env" 2>/dev/null; then
        info "Pushing schema to database..."
        npx prisma db push --skip-generate 2>&1 | tail -3
        pass "Database schema"

        info "Seeding database..."
        pnpm db:seed 2>&1 | tail -3 || info "Seed may need manual run"
    else
        info "Database setup skipped — no DATABASE_URL"
    fi

    info "Testing build..."
    if pnpm build 2>&1 | tail -3; then
        pass "Build passes"
    else
        info "Build issues — run 'pnpm build' for details"
    fi

    cd "$HOME"
elif [[ "$HOGWARTS_DEV" == "1" ]]; then
    info "Hogwarts not cloned — skipped"
else
    info "Hogwarts local dev skipped (pass --hogwarts-dev to set it up)"
fi

# =============================================================================
# PHASE 8: Health Check
# =============================================================================
step "8" "Health Check"

ERRORS=0
command -v git >/dev/null 2>&1     && pass "git"      || fail "git"
command -v node >/dev/null 2>&1    && pass "node"     || fail "node"
command -v pnpm >/dev/null 2>&1    && pass "pnpm"     || fail "pnpm"
command -v gh >/dev/null 2>&1      && pass "gh"       || fail "gh"
command -v claude >/dev/null 2>&1  && pass "claude"   || fail "claude"
command -v agy >/dev/null 2>&1      && pass "agy (secondary)" || info "agy (secondary)"
command -v opencode >/dev/null 2>&1 && pass "opencode (tertiary)" || info "opencode (tertiary)"
command -v openclaw >/dev/null 2>&1 && pass "openclaw (gateway)" || info "openclaw (gateway, optional)"

[[ -f "$HOME/.ssh/id_ed25519" ]]    && pass "SSH key"     || fail "SSH key"
gh auth status >/dev/null 2>&1      && pass "GitHub auth" || fail "GitHub auth"

[[ -d "$REPOS_DIR/kun" ]]                && pass "kun repo"    || fail "kun"
[[ -d "$REPOS_DIR/hogwarts" ]]           && pass "hogwarts"     || fail "hogwarts"
[[ -d "$REPOS_DIR/codebase" ]]           && pass "codebase"     || fail "codebase"

[[ -f "$HOME/.claude/CLAUDE.md" ]]   && pass "Kun CLAUDE.md"  || fail "Kun CLAUDE.md"
[[ -f "$HOME/.claude/settings.json" ]] && pass "settings.json" || fail "settings.json"
[[ -f "$HOME/.claude/mcp.json" ]]    && pass "mcp.json"        || fail "mcp.json"

# =============================================================================
# Done
# =============================================================================
echo ""
echo -e "${BD}════════════════════════════════════════════${NC}"
if [[ $ERRORS -eq 0 ]]; then
    echo -e "${G}${BD}Linux onboarding complete!${NC} Role: $ROLE ($DISTRO_ID)"
else
    echo -e "${Y}${BD}Onboarding complete with $ERRORS issue(s)${NC}"
fi
echo -e "${BD}════════════════════════════════════════════${NC}"
echo ""
echo -e "${BD}Next steps:${NC}"
echo "  1. Restart shell (or: source ~/.bashrc)"
echo "  2. Run 'claude' → log in with Anthropic account"
echo "     Launchers: 'c' = Claude Code (primary) · 'a' = Antigravity (secondary)"
if [[ -z "$GIST_ID" ]]; then
    echo "  3. Load secrets later: bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>"
fi

echo ""
echo -e "${BD}Claude Desktop note:${NC}"
echo "  Not available on Linux. Use:"
echo "  • CLI: 'claude' / 'c' (primary) · 'agy' / 'a' (secondary)"
echo "  • Browser: https://claude.ai/code (same projects as CLI)"
echo "  • IDE: install Claude plugin from VS Code/WebStorm Marketplace"

if [[ "$HOGWARTS_DEV" == "1" ]]; then
    echo ""
    echo -e "${BD}Run hogwarts:${NC}"
    echo "  cd ~/hogwarts && pnpm dev"
    echo "  http://localhost:3000  — login: admin@kingfahad.edu / 1234"
fi

echo ""
echo -e "${BD}Mobile (Claude on iPhone/Android):${NC}"
echo "  iOS:     https://apps.apple.com/app/claude-by-anthropic/id6473753684"
echo "  Android: https://play.google.com/store/apps/details?id=com.anthropic.claude"

echo ""
echo -e "${D}Re-run: bash ~/kun/.claude/scripts/onboarding-linux.sh $ROLE${NC}"
