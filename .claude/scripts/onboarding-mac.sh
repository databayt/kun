#!/bin/bash
# =============================================================================
# Computer Onboarding — macOS
# =============================================================================
# Fresh Mac to fully working dev environment in one command.
#
# Usage:
#   bash onboarding-mac.sh <role> [gist_id]
#
# Examples:
#   bash onboarding-mac.sh engineer abc123    # Full dev + secrets
#   bash onboarding-mac.sh engineer           # Full dev, secrets later
#   bash onboarding-mac.sh content            # Cowork-focused
#
# Roles:
#   engineer — WebStorm, all repos, Claude Code CLI, hogwarts local dev
#   content  — Claude Desktop, translation, content tools
#   ops      — Monitoring, costs, incident tools
#   business — Proposals, pricing, client workflows
#
# One-liner (copy-paste on a fresh Mac):
#   git clone https://github.com/databayt/kun.git ~/kun && bash ~/kun/.claude/scripts/onboarding-mac.sh engineer
#
# Duration: ~15-20 minutes (mostly downloads)
# =============================================================================

set -e

# Parse args — positional <role> [gist_id] plus optional flags
ROLE="" GIST_ID="" QUIET=0 GIT_NAME_ARG="" GIT_EMAIL_ARG=""
WITH_TAILSCALE=0 ALL_REPOS=1   # all-repos on by default; pass --essentials-only to skip
while [[ $# -gt 0 ]]; do
    case "$1" in
        --quiet)            QUIET=1; shift ;;
        --name)             GIT_NAME_ARG="$2"; shift 2 ;;
        --email)            GIT_EMAIL_ARG="$2"; shift 2 ;;
        --with-tailscale)   WITH_TAILSCALE=1; shift ;;
        --essentials-only)  ALL_REPOS=0; shift ;;
        --*)                echo "Unknown flag: $1" >&2; exit 1 ;;
        *)
            if [[ -z "$ROLE" ]]; then ROLE="$1"
            elif [[ -z "$GIST_ID" ]]; then GIST_ID="$1"
            fi
            shift ;;
    esac
done

# Wrapper-friendly progress marker (parsed by installer.sh for the progress dialog)
if [[ "$QUIET" == "1" ]]; then
    export NONINTERACTIVE=1
    export HOMEBREW_NO_AUTO_UPDATE=1
    export HOMEBREW_NO_ENV_HINTS=1
fi

# Colors
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m'
D='\033[2m' BD='\033[1m' NC='\033[0m'

pass() { echo -e "  ${G}✓${NC} $1"; }
fail() { echo -e "  ${R}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
info() { echo -e "  ${D}·${NC} $1"; }
step() {
    echo ""
    echo -e "${BD}[$1/8]${NC} ${B}$2${NC}"
    # Machine-parseable progress line for wrapper UIs (stderr so it doesn't pollute stdout)
    echo "PROGRESS:$1/8:$2" >&2
}

# ── Validate ────────────────────────────────────────────────────
if [[ -z "$ROLE" ]]; then
    echo -e "${BD}Computer Onboarding — macOS${NC}"
    echo ""
    echo "Usage: bash onboarding-mac.sh <role> [gist_id] [--quiet] [--name <n>] [--email <e>]"
    echo ""
    echo "Roles:"
    echo "  engineer  — WebStorm, all repos, full Claude Code, hogwarts local dev"
    echo "  content   — Claude Desktop, translation, content tools"
    echo "  ops       — Monitoring, costs, incident tools"
    echo "  business  — Proposals, pricing, client workflows"
    echo ""
    echo "Flags:"
    echo "  --quiet            Skip all terminal prompts (for wrapper/CI use)"
    echo "  --name <name>      Pre-supply git identity (skips prompt)"
    echo "  --email <email>    Pre-supply git email (skips prompt)"
    echo "  --essentials-only  Clone only kun/hogwarts/codebase (default: all org repos)"
    echo "  --with-tailscale   Install Tailscale + 'tailscale up --ssh' for remote/mobile"
    echo ""
    echo "One-liner:"
    echo "  git clone https://github.com/databayt/kun.git ~/kun && bash ~/kun/.claude/scripts/onboarding-mac.sh engineer"
    exit 0
fi

if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${R}This script is for macOS. Use onboarding-windows.ps1 for Windows.${NC}"
    exit 1
fi

if [[ "$ROLE" != "engineer" && "$ROLE" != "business" && "$ROLE" != "content" && "$ROLE" != "ops" ]]; then
    echo -e "${R}Invalid role: $ROLE${NC}"
    echo "Valid: engineer, business, content, ops"
    exit 1
fi

ERRORS=0

echo ""
echo -e "${BD}Computer Onboarding — macOS${NC}"
echo -e "Role: ${G}$ROLE${NC}"
echo ""

# =============================================================================
# PHASE 1: System Foundation
# =============================================================================
step "1" "System Foundation — Xcode CLT, Homebrew, Git, Node.js, pnpm"

# Xcode Command Line Tools
if ! xcode-select -p &>/dev/null; then
    info "Installing Xcode Command Line Tools..."
    if [[ "$QUIET" == "1" ]]; then
        # Headless install — auto-accept license
        touch /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress 2>/dev/null || true
        PROD=$(softwareupdate -l 2>/dev/null | grep -E 'Command Line Tools' | awk -F'*' '{print $2}' | sed -e 's/^ *//' | head -1)
        [[ -n "$PROD" ]] && softwareupdate -i "$PROD" --verbose 2>/dev/null || true
        rm -f /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress
    else
        xcode-select --install 2>/dev/null || true
        echo -e "  ${Y}Xcode installer opened. Accept the license and wait for install.${NC}"
        read -p "  Press Enter when done..."
    fi
else
    pass "Xcode CLT"
fi

# Homebrew
if ! command -v brew &>/dev/null; then
    info "Installing Homebrew..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
    fi
    pass "Homebrew installed"
else
    pass "Homebrew"
fi

# Git
if ! command -v git &>/dev/null; then
    brew install git
    pass "Git installed"
else
    pass "Git ($(git --version | cut -d' ' -f3))"
fi

# GitHub CLI
if ! command -v gh &>/dev/null; then
    brew install gh
    pass "GitHub CLI installed"
else
    pass "GitHub CLI"
fi

# Node.js
if ! command -v node &>/dev/null; then
    brew install node
    pass "Node.js installed ($(node --version))"
else
    pass "Node.js ($(node --version))"
fi

# pnpm
if ! command -v pnpm &>/dev/null; then
    npm install -g pnpm
    pass "pnpm installed"
else
    pass "pnpm ($(pnpm --version))"
fi

# =============================================================================
# PHASE 2: Applications
# =============================================================================
step "2" "Applications"

if [[ "$ROLE" == "engineer" ]]; then
    # WebStorm
    if [[ ! -d "/Applications/WebStorm.app" ]]; then
        info "Installing WebStorm..."
        brew install --cask webstorm
        pass "WebStorm installed"
    else
        pass "WebStorm"
    fi

    # VS Code
    if [[ ! -d "/Applications/Visual Studio Code.app" ]]; then
        info "Installing VS Code..."
        brew install --cask visual-studio-code
        pass "VS Code installed"
    else
        pass "VS Code"
    fi
fi

# Chrome
if [[ ! -d "/Applications/Google Chrome.app" ]]; then
    info "Installing Chrome..."
    brew install --cask google-chrome
    pass "Chrome installed"
else
    pass "Chrome"
fi

# =============================================================================
# PHASE 3: GitHub
# =============================================================================
step "3" "GitHub — SSH key, authentication, git config"

# Git identity — wrapper can pre-supply via --name/--email; quiet mode uses defaults if missing
GIT_NAME=$(git config --global user.name 2>/dev/null || echo "")
if [[ -z "$GIT_NAME" ]]; then
    if [[ -n "$GIT_NAME_ARG" ]]; then
        GIT_NAME="$GIT_NAME_ARG"; GIT_EMAIL="$GIT_EMAIL_ARG"
    elif [[ "$QUIET" == "1" ]]; then
        GIT_NAME="$(whoami)"; GIT_EMAIL="$(whoami)@$(hostname -s).local"
        info "Quiet mode — using placeholder git identity (override later via 'git config --global')"
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
    GIT_EMAIL=$(git config --global user.email)
    info "Generating SSH key..."
    mkdir -p "$HOME/.ssh"
    ssh-keygen -t ed25519 -C "$GIT_EMAIL" -f "$HOME/.ssh/id_ed25519" -N ""
    eval "$(ssh-agent -s)" &>/dev/null
    ssh-add "$HOME/.ssh/id_ed25519" 2>/dev/null
    # macOS: add to ssh config for Keychain persistence
    if [[ ! -f "$HOME/.ssh/config" ]] || ! grep -q "AddKeysToAgent" "$HOME/.ssh/config" 2>/dev/null; then
        cat >> "$HOME/.ssh/config" << 'SSHCFG'
Host *
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
SSHCFG
    fi
    pass "SSH key generated"
else
    pass "SSH key exists"
fi

# GitHub auth
if ! gh auth status &>/dev/null 2>&1; then
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
    HOSTNAME=$(scutil --get ComputerName 2>/dev/null || hostname)
    gh ssh-key add "$HOME/.ssh/id_ed25519.pub" --title "databayt-$HOSTNAME" 2>/dev/null && \
        pass "SSH key added to GitHub" || info "SSH key may already exist on GitHub"
else
    pass "SSH key on GitHub"
fi

# =============================================================================
# PHASE 4: Clone Repositories
# =============================================================================
step "4" "Clone Repositories"

clone_repo() {
    local repo="$1" dir="$HOME/$repo"
    if [[ ! -d "$dir" ]]; then
        info "Cloning $repo..."
        git clone "git@github.com:databayt/$repo.git" "$dir" 2>/dev/null && \
            pass "$repo" || {
            git clone "https://github.com/databayt/$repo.git" "$dir" 2>/dev/null && \
                pass "$repo (HTTPS)" || fail "$repo clone failed"
        }
    else
        pass "$repo (exists)"
    fi
}

clone_repo "kun"
if [[ "$ROLE" == "engineer" ]]; then
    clone_repo "hogwarts"
    clone_repo "codebase"

    # Sync remaining databayt org repos via sync-repos.sh (idempotent — skips clones we already have)
    if [[ "$ALL_REPOS" == "1" && -f "$HOME/kun/.claude/scripts/sync-repos.sh" ]]; then
        info "Syncing remaining databayt org repos..."
        for repo in shadcn radix souq mkan shifa swift-app distributed-computer marketing; do
            bash "$HOME/kun/.claude/scripts/sync-repos.sh" "$repo" >/dev/null 2>&1 && pass "$repo" || info "$repo skipped"
        done
    fi
fi

# =============================================================================
# PHASE 5: Claude Ecosystem + OpenCode
# =============================================================================
step "5" "Claude — CLI + Desktop + OpenCode (OSS alternative)"

# Claude Code CLI
if ! command -v claude &>/dev/null; then
    info "Installing Claude Code CLI..."
    curl -fsSL https://claude.ai/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    if ! grep -q ".local/bin" "$HOME/.zshrc" 2>/dev/null; then
        echo '' >> "$HOME/.zshrc"
        echo '# Claude Code' >> "$HOME/.zshrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
    fi
    pass "Claude Code CLI"
else
    pass "Claude Code CLI"
fi

# Claude Desktop
if [[ ! -d "/Applications/Claude.app" ]]; then
    info "Installing Claude Desktop..."
    brew install --cask claude
    pass "Claude Desktop"
else
    pass "Claude Desktop"
fi

# OpenCode — OSS alternative CLI (works with Anthropic API key or other providers)
if ! command -v opencode &>/dev/null; then
    info "Installing OpenCode (OSS alternative)..."
    curl -fsSL https://opencode.ai/install | bash 2>&1 | tail -3 || true
    # OpenCode installs to ~/.opencode/bin by default
    export PATH="$HOME/.opencode/bin:$PATH"
    if ! grep -q ".opencode/bin" "$HOME/.zshrc" 2>/dev/null; then
        echo '' >> "$HOME/.zshrc"
        echo '# OpenCode' >> "$HOME/.zshrc"
        echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> "$HOME/.zshrc"
    fi
    command -v opencode &>/dev/null && pass "OpenCode" || info "OpenCode install needs manual verify"
else
    pass "OpenCode"
fi

# Symlink AGENTS.md in kun repo so OpenCode reads the same doctrine as Claude Code
if [[ -f "$HOME/kun/CLAUDE.md" && ! -e "$HOME/kun/AGENTS.md" ]]; then
    ln -sf "$HOME/kun/CLAUDE.md" "$HOME/kun/AGENTS.md"
    pass "AGENTS.md → CLAUDE.md symlink"
fi

# Wire Claude Desktop MCP config to the same servers Claude Code uses
# So Desktop's Chat/Cowork/Code tabs see the kun MCP fleet (shadcn, neon, github, etc.)
DESKTOP_CFG_DIR="$HOME/Library/Application Support/Claude"
DESKTOP_CFG="$DESKTOP_CFG_DIR/claude_desktop_config.json"
if [[ -d "/Applications/Claude.app" && -f "$HOME/.claude/mcp.json" ]]; then
    mkdir -p "$DESKTOP_CFG_DIR"
    if [[ ! -e "$DESKTOP_CFG" ]]; then
        ln -sf "$HOME/.claude/mcp.json" "$DESKTOP_CFG"
        pass "Claude Desktop MCP config → ~/.claude/mcp.json"
    elif [[ -L "$DESKTOP_CFG" ]]; then
        pass "Claude Desktop MCP config (already symlinked)"
    else
        info "Claude Desktop config exists — leaving in place (delete to re-link to kun)"
    fi
fi

# Ensure Apple Notes "Dispatch" folder exists so dispatch.sh has somewhere to write
if [[ -d "/Applications/Notes.app" ]]; then
    osascript -e 'tell application "Notes" to if not (exists folder "Dispatch") then make new folder with properties {name:"Dispatch"}' 2>/dev/null && \
        pass "Apple Notes Dispatch folder" || info "Apple Notes Dispatch folder skipped"
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

HOGWARTS_DIR="$HOME/hogwarts"

if [[ "$ROLE" == "engineer" && -d "$HOGWARTS_DIR" ]]; then
    cd "$HOGWARTS_DIR"

    # .env
    if [[ ! -f ".env" ]]; then
        if [[ -f "$HOME/.claude/.env" ]]; then
            cp "$HOME/.claude/.env" ".env"
            pass ".env from secrets"
        else
            info ".env missing — need gist ID for secrets"
        fi
    else
        pass ".env exists"
    fi

    # Dependencies
    info "Installing dependencies..."
    pnpm install 2>&1 | tail -1
    pass "pnpm install"

    # Prisma
    info "Generating Prisma client..."
    npx prisma generate 2>&1 | tail -1
    pass "Prisma client"

    # Database (only if .env has DATABASE_URL)
    if grep -q "DATABASE_URL" ".env" 2>/dev/null; then
        info "Pushing schema to database..."
        npx prisma db push --skip-generate 2>&1 | tail -3
        pass "Database schema"

        info "Seeding database..."
        pnpm db:seed 2>&1 | tail -3 || info "Seed may need manual run"
    else
        info "Database setup skipped — no DATABASE_URL"
    fi

    # Build test
    info "Testing build..."
    if pnpm build 2>&1 | tail -3; then
        pass "Build passes"
    else
        info "Build issues — run 'pnpm build' for details"
    fi

    cd "$HOME"
else
    if [[ "$ROLE" == "engineer" ]]; then
        info "Hogwarts not cloned — skipped"
    else
        info "Hogwarts skipped (role: $ROLE)"
    fi
fi

# =============================================================================
# PHASE 8: Health Check
# =============================================================================
step "8" "Health Check"

ERRORS=0

# Tools
command -v brew &>/dev/null       && pass "brew"       || fail "brew"
command -v git &>/dev/null        && pass "git"        || fail "git"
command -v node &>/dev/null       && pass "node"       || fail "node"
command -v pnpm &>/dev/null       && pass "pnpm"       || fail "pnpm"
command -v gh &>/dev/null         && pass "gh"         || fail "gh"
command -v claude &>/dev/null     && pass "claude"     || fail "claude"
command -v opencode &>/dev/null   && pass "opencode"   || info "opencode (optional)"

# Auth
[[ -f "$HOME/.ssh/id_ed25519" ]]  && pass "SSH key"    || fail "SSH key"
gh auth status &>/dev/null 2>&1   && pass "GitHub auth" || fail "GitHub auth"

# Apps
[[ -d "/Applications/Google Chrome.app" ]] && pass "Chrome"         || info "Chrome"
[[ -d "/Applications/Claude.app" ]]        && pass "Claude Desktop" || info "Claude Desktop"

if [[ "$ROLE" == "engineer" ]]; then
    [[ -d "/Applications/WebStorm.app" ]]  && pass "WebStorm"       || info "WebStorm"
    [[ -d "$HOME/hogwarts" ]]              && pass "hogwarts repo"   || fail "hogwarts"
    [[ -d "$HOME/codebase" ]]              && pass "codebase repo"   || fail "codebase"
    [[ -f "$HOME/hogwarts/.env" ]]         && pass "hogwarts .env"   || info "hogwarts .env (need gist)"
    [[ -d "$HOME/hogwarts/node_modules" ]] && pass "hogwarts deps"   || info "hogwarts deps"
fi

[[ -d "$HOME/kun" ]]                       && pass "kun repo"        || fail "kun"
[[ -f "$HOME/.claude/CLAUDE.md" ]]         && pass "Kun CLAUDE.md"   || fail "Kun CLAUDE.md"
[[ -f "$HOME/.claude/settings.json" ]]     && pass "settings.json"   || fail "settings.json"
[[ -f "$HOME/.claude/mcp.json" ]]          && pass "mcp.json"        || fail "mcp.json"

# =============================================================================
# PHASE 9 (OPTIONAL): Tailscale — remote SSH for the iPhone / web Code lane
# =============================================================================
if [[ "$WITH_TAILSCALE" == "1" ]]; then
    echo ""
    echo -e "${BD}[+]${NC} ${B}Tailscale — remote SSH (optional)${NC}"
    if ! command -v tailscale &>/dev/null; then
        info "Installing Tailscale..."
        brew install --cask tailscale 2>/dev/null && pass "Tailscale installed" || info "Tailscale install skipped"
    else
        pass "Tailscale"
    fi
    # tailscale up needs auth; in quiet mode print the auth URL and continue
    if command -v tailscale &>/dev/null; then
        if [[ "$QUIET" == "1" ]]; then
            info "Run 'sudo tailscale up --ssh' after this completes (needs admin + auth URL)"
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
    echo -e "${G}${BD}macOS onboarding complete!${NC} Role: $ROLE"
else
    echo -e "${Y}${BD}Onboarding complete with $ERRORS issue(s)${NC}"
fi
echo -e "${BD}════════════════════════════════════════════${NC}"
echo ""
echo -e "${BD}Next steps:${NC}"
echo "  1. Restart terminal (or: . ~/.zshrc)"
echo "  2. Run 'claude' → log in with Anthropic account"
echo "  3. Open Claude Desktop → sign in"
if command -v opencode &>/dev/null; then
    echo "  4. (Optional) Configure OpenCode: 'opencode' → /connect → paste API key"
fi
if [[ -z "$GIST_ID" ]]; then
    echo "  5. Load secrets when you have the gist ID:"
    echo "     bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>"
fi
if [[ "$ROLE" == "engineer" ]]; then
    echo ""
    echo -e "${BD}IDE plugins (manual install from Marketplace):${NC}"
    echo "  • WebStorm: Settings → Plugins → search 'Claude Code' → Install"
    echo "  • VS Code: Extensions → search 'Claude Code' → Install"
    echo ""
    echo -e "${BD}Run hogwarts:${NC}"
    echo "  cd ~/hogwarts && pnpm dev"
    echo "  http://localhost:3000"
    echo "  Admin: admin@kingfahad.edu / 1234"
fi

echo ""
echo -e "${BD}Mobile (Claude on iPhone/Android):${NC}"
echo "  iOS:     https://apps.apple.com/app/claude-by-anthropic/id6473753684"
echo "  Android: https://play.google.com/store/apps/details?id=com.anthropic.claude"
echo "  Sign in with the same Anthropic account → same projects everywhere"

if [[ "$WITH_TAILSCALE" != "1" ]]; then
    echo ""
    echo -e "${BD}Remote SSH (optional):${NC}"
    echo "  Re-run with --with-tailscale to enable Tailscale SSH for mobile/remote control"
fi

echo ""
echo -e "${D}Re-run: bash ~/kun/.claude/scripts/onboarding-mac.sh $ROLE${NC}"
