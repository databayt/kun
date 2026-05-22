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
#   --with-tailscale   Install Tailscale + 'tailscale up --ssh'
#
# One-liner:
#   git clone https://github.com/databayt/kun.git ~/kun && bash ~/kun/.claude/scripts/onboarding-linux.sh engineer
#
# NOTE: Claude Desktop is NOT available for Linux. Linux users get:
#   Claude Code CLI, OpenCode CLI, claude.ai/code in browser,
#   plus VS Code/WebStorm Claude plugins.
# =============================================================================

set -e

# ── Args ────────────────────────────────────────────────────────
ROLE="" GIST_ID="" QUIET=0 GIT_NAME_ARG="" GIT_EMAIL_ARG=""
WITH_TAILSCALE=0 ALL_REPOS=1 REPOS_DIR="$HOME" HOGWARTS_DEV=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --quiet)            QUIET=1; shift ;;
        --name)             GIT_NAME_ARG="$2"; shift 2 ;;
        --email)            GIT_EMAIL_ARG="$2"; shift 2 ;;
        --repos-dir)        REPOS_DIR="$2"; shift 2 ;;
        --with-tailscale)   WITH_TAILSCALE=1; shift ;;
        --essentials-only)  ALL_REPOS=0; shift ;;
        --hogwarts-dev)     HOGWARTS_DEV=1; shift ;;
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
step() {
    echo ""
    echo -e "${BD}[$1/8]${NC} ${B}$2${NC}"
    echo "PROGRESS:$1/8:$2" >&2
}

# ── Validate ────────────────────────────────────────────────────
if [[ -z "$ROLE" ]]; then
    echo -e "${BD}Computer Onboarding — Linux${NC}"
    echo ""
    echo "Usage: bash onboarding-linux.sh <role> [gist_id] [flags]"
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
    echo "  --with-tailscale   Install Tailscale + 'up --ssh'"
    echo ""
    echo "One-liner:"
    echo "  git clone https://github.com/databayt/kun.git ~/kun && bash ~/kun/.claude/scripts/onboarding-linux.sh engineer"
    exit 0
fi

if [[ "$(uname -s)" != "Linux" ]]; then
    echo -e "${R}This script is for Linux. Use onboarding-mac.sh or onboarding-windows.ps1.${NC}"
    exit 1
fi

if [[ "$ROLE" != "engineer" && "$ROLE" != "business" && "$ROLE" != "content" && "$ROLE" != "ops" ]]; then
    echo -e "${R}Invalid role: $ROLE${NC}"
    echo "Valid: engineer, business, content, ops"
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
echo -e "Role: ${G}$ROLE${NC}"
echo ""

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

# Git
if ! command -v git >/dev/null 2>&1; then
    $PKG_INSTALL git >/dev/null 2>&1
    pass "Git installed"
else
    pass "Git ($(git --version | cut -d' ' -f3))"
fi

# GitHub CLI (gh)
if ! command -v gh >/dev/null 2>&1; then
    info "Installing GitHub CLI..."
    case "$PKG" in
        apt)
            # Use the official gh apt repo for current version
            (type -p curl >/dev/null) && \
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null 2>&1 && \
            sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
            sudo apt-get update -y >/dev/null 2>&1 && \
            $PKG_INSTALL gh >/dev/null 2>&1
            ;;
        *)  $PKG_INSTALL "$(pkg_name gh)" >/dev/null 2>&1 ;;
    esac
    pass "GitHub CLI installed"
else
    pass "GitHub CLI"
fi

# Node.js via nvm (distro packages often lag — nvm gives us LTS reliably)
if ! command -v node >/dev/null 2>&1; then
    info "Installing nvm + Node 22 LTS..."
    if [[ ! -d "$HOME/.nvm" ]]; then
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
    fi
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install --lts >/dev/null 2>&1
    nvm use --lts >/dev/null 2>&1
    pass "Node.js installed ($(node --version))"
else
    pass "Node.js ($(node --version))"
fi

# pnpm
if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm >/dev/null 2>&1
    pass "pnpm installed"
else
    pass "pnpm ($(pnpm --version))"
fi

# =============================================================================
# PHASE 2: Applications (snap-first; fall back to direct install)
# =============================================================================
step "2" "Applications — VS Code, WebStorm, Chrome"

# snap availability — preferred for desktop apps on Linux
HAS_SNAP=0
command -v snap >/dev/null 2>&1 && HAS_SNAP=1

# IDEs on every machine — full workstation regardless of role
# VS Code
if ! command -v code >/dev/null 2>&1; then
    if [[ "$HAS_SNAP" == "1" ]]; then
        sudo snap install code --classic >/dev/null 2>&1 && pass "VS Code (snap)" || info "VS Code snap install failed — install manually"
    else
        info "snap not available — install VS Code manually from https://code.visualstudio.com/"
    fi
else
    pass "VS Code"
fi

# WebStorm
if ! command -v webstorm >/dev/null 2>&1 && [[ ! -d "/snap/webstorm" ]]; then
    if [[ "$HAS_SNAP" == "1" ]]; then
        sudo snap install webstorm --classic >/dev/null 2>&1 && pass "WebStorm (snap)" || info "WebStorm snap install failed — install manually from jetbrains.com"
    else
        info "snap not available — install WebStorm manually from https://www.jetbrains.com/webstorm/"
    fi
else
    pass "WebStorm"
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

# Git identity
GIT_NAME=$(git config --global user.name 2>/dev/null || echo "")
if [[ -z "$GIT_NAME" ]]; then
    if [[ -n "$GIT_NAME_ARG" ]]; then
        GIT_NAME="$GIT_NAME_ARG"; GIT_EMAIL="$GIT_EMAIL_ARG"
    elif [[ "$QUIET" == "1" ]]; then
        GIT_NAME="$(whoami)"; GIT_EMAIL="$(whoami)@$(hostname -s).local"
        info "Quiet mode — placeholder git identity (override via 'git config --global')"
    else
        read -p "  Full name (for git commits): " GIT_NAME
        read -p "  Email (for git commits): " GIT_EMAIL
    fi
    git config --global user.name "$GIT_NAME"
    git config --global user.email "$GIT_EMAIL"
    pass "Git config: $GIT_NAME <$GIT_EMAIL>"
else
    pass "Git config: $GIT_NAME"
fi

# SSH key
if [[ ! -f "$HOME/.ssh/id_ed25519" ]]; then
    GIT_EMAIL_USE=$(git config --global user.email)
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
    ssh-keygen -t ed25519 -C "$GIT_EMAIL_USE" -f "$HOME/.ssh/id_ed25519" -N "" >/dev/null
    eval "$(ssh-agent -s)" >/dev/null
    ssh-add "$HOME/.ssh/id_ed25519" 2>/dev/null
    pass "SSH key generated"
else
    pass "SSH key exists"
fi

# GitHub auth
if ! gh auth status >/dev/null 2>&1; then
    info "Logging into GitHub (browser will open)..."
    gh auth login -p ssh -w
    pass "GitHub authenticated"
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

# =============================================================================
# PHASE 4: Clone Repositories
# =============================================================================
step "4" "Clone Repositories"

clone_repo() {
    local repo="$1"
    local dir="$REPOS_DIR/$repo"
    if [[ ! -d "$dir" ]]; then
        git clone "git@github.com:databayt/$repo.git" "$dir" 2>/dev/null && pass "$repo" || {
            git clone "https://github.com/databayt/$repo.git" "$dir" 2>/dev/null && pass "$repo (HTTPS)" || fail "$repo clone failed"
        }
    else
        pass "$repo (exists)"
    fi
}
symlink_home() {
    local repo="$1"
    [[ "$REPOS_DIR" == "$HOME" ]] && return
    [[ -d "$REPOS_DIR/$repo" && ! -e "$HOME/$repo" ]] && \
        ln -sf "$REPOS_DIR/$repo" "$HOME/$repo" && info "~/$repo → $REPOS_DIR/$repo"
}

# Every machine clones the full org — any machine can be any task.
clone_repo "kun"; symlink_home "kun"
clone_repo "hogwarts"; symlink_home "hogwarts"
clone_repo "codebase"; symlink_home "codebase"
if [[ "$ALL_REPOS" == "1" ]]; then
    for repo in shadcn radix souq mkan shifa swift-app distributed-computer marketing; do
        clone_repo "$repo"; symlink_home "$repo"
    done
fi

# =============================================================================
# PHASE 5: Claude Ecosystem (no Desktop on Linux)
# =============================================================================
step "5" "Claude — Code CLI + OpenCode (no Desktop on Linux)"

# Claude Code CLI
if ! command -v claude >/dev/null 2>&1; then
    info "Installing Claude Code CLI..."
    curl -fsSL https://claude.ai/install.sh | sh >/dev/null 2>&1
    export PATH="$HOME/.local/bin:$PATH"
    if ! grep -q ".local/bin" "$HOME/.bashrc" 2>/dev/null; then
        printf '\n# Claude Code\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.bashrc"
    fi
    pass "Claude Code CLI"
else
    pass "Claude Code CLI"
fi

# OpenCode (OSS alternative)
if ! command -v opencode >/dev/null 2>&1; then
    info "Installing OpenCode..."
    curl -fsSL https://opencode.ai/install | bash >/dev/null 2>&1 || true
    export PATH="$HOME/.opencode/bin:$PATH"
    if ! grep -q ".opencode/bin" "$HOME/.bashrc" 2>/dev/null; then
        printf '\n# OpenCode\nexport PATH="$HOME/.opencode/bin:$PATH"\n' >> "$HOME/.bashrc"
    fi
    command -v opencode >/dev/null 2>&1 && pass "OpenCode" || info "OpenCode install needs manual verify"
else
    pass "OpenCode"
fi

# `c` / `o` functions in shell rc (bash + zsh if present)
for RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
    [[ ! -f "$RC" ]] && continue
    if ! grep -q "function c " "$RC" 2>/dev/null; then
        cat >> "$RC" <<'CFUNC'

# Claude Code
function c  { claude --dangerously-skip-permissions "$@"; }
function cc { claude "$@"; }
# OpenCode (OSS alternative — auto-approves by default)
function o  { opencode "$@"; }
[ -f "$HOME/.claude/.env" ] && set -a && . "$HOME/.claude/.env" && set +a
CFUNC
    fi
    # Backfill `o` for machines provisioned before the OpenCode launcher existed
    if grep -q "function c " "$RC" 2>/dev/null && ! grep -q "function o " "$RC" 2>/dev/null; then
        printf '\n# OpenCode (OSS alternative — auto-approves by default)\nfunction o  { opencode "$@"; }\n' >> "$RC"
    fi
done
pass "Shell helpers (c, cc, o)"


# OpenCode global config — auto-approve everywhere (parity with `c`)
OC_CFG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
if [[ ! -f "$OC_CFG_DIR/opencode.json" ]]; then
    mkdir -p "$OC_CFG_DIR"
    cat > "$OC_CFG_DIR/opencode.json" <<'OCJSON'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/big-pickle",
  "default_agent": "build",
  "permission": { "edit": "allow", "bash": "allow", "webfetch": "allow" }
}
OCJSON
    pass "OpenCode global config (auto-approve)"
fi
# OpenCode TUI config — match terminal theme (closest to Claude Code's look)
if [[ ! -f "$OC_CFG_DIR/tui.json" ]]; then
    mkdir -p "$OC_CFG_DIR"
    cat > "$OC_CFG_DIR/tui.json" <<'OCTUI'
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "system"
}
OCTUI
    pass "OpenCode TUI config (theme: system)"
fi

# AGENTS.md symlink for OpenCode
if [[ -f "$HOME/kun/CLAUDE.md" && ! -e "$HOME/kun/AGENTS.md" ]]; then
    ln -sf "$HOME/kun/CLAUDE.md" "$HOME/kun/AGENTS.md"
    pass "AGENTS.md → CLAUDE.md symlink"
fi

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
command -v opencode >/dev/null 2>&1 && pass "opencode" || info "opencode (optional)"

[[ -f "$HOME/.ssh/id_ed25519" ]]    && pass "SSH key"     || fail "SSH key"
gh auth status >/dev/null 2>&1      && pass "GitHub auth" || fail "GitHub auth"

[[ -d "$REPOS_DIR/kun" ]]                && pass "kun repo"    || fail "kun"
[[ -d "$REPOS_DIR/hogwarts" ]]           && pass "hogwarts"     || fail "hogwarts"
[[ -d "$REPOS_DIR/codebase" ]]           && pass "codebase"     || fail "codebase"

[[ -f "$HOME/.claude/CLAUDE.md" ]]   && pass "Kun CLAUDE.md"  || fail "Kun CLAUDE.md"
[[ -f "$HOME/.claude/settings.json" ]] && pass "settings.json" || fail "settings.json"
[[ -f "$HOME/.claude/mcp.json" ]]    && pass "mcp.json"        || fail "mcp.json"

# =============================================================================
# PHASE 9 (OPTIONAL): Tailscale
# =============================================================================
if [[ "$WITH_TAILSCALE" == "1" ]]; then
    echo ""
    echo -e "${BD}[+]${NC} ${B}Tailscale — remote SSH (optional)${NC}"
    if ! command -v tailscale >/dev/null 2>&1; then
        info "Installing Tailscale..."
        curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 && pass "Tailscale installed" || info "Tailscale install skipped"
    else
        pass "Tailscale"
    fi
    if command -v tailscale >/dev/null 2>&1; then
        if [[ "$QUIET" == "1" ]]; then
            info "Run 'sudo tailscale up --ssh' after this completes (needs auth URL)"
        else
            sudo tailscale up --ssh 2>/dev/null && pass "Tailscale up" || info "Run 'sudo tailscale up --ssh' to enable"
        fi
    fi
fi

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
if command -v opencode >/dev/null 2>&1; then
    echo "  3. (Optional) Configure OpenCode: run 'o' (or 'opencode') → /connect → paste API key"
fi
if [[ -z "$GIST_ID" ]]; then
    echo "  4. Load secrets later: bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>"
fi

echo ""
echo -e "${BD}Claude Desktop note:${NC}"
echo "  Not available on Linux. Use:"
echo "  • CLI: 'claude' / 'c' / 'opencode' / 'o'"
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

if [[ "$WITH_TAILSCALE" != "1" ]]; then
    echo ""
    echo -e "${BD}Remote SSH (optional):${NC}"
    echo "  Re-run with --with-tailscale to enable Tailscale SSH"
fi

echo ""
echo -e "${D}Re-run: bash ~/kun/.claude/scripts/onboarding-linux.sh $ROLE${NC}"
