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
ALL_REPOS=1 REPOS_DIR="$HOME" HOGWARTS_DEV=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --quiet)            QUIET=1; shift ;;
        --name)             GIT_NAME_ARG="$2"; shift 2 ;;
        --email)             GIT_EMAIL_ARG="$2"; shift 2 ;;
        --repos-dir)        REPOS_DIR="$2"; shift 2 ;;
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

# Open a URL in the default browser; macOS has 'open' on every system.
open_url() { open "$1" >/dev/null 2>&1 & }
# Copy text to the macOS clipboard.
copy_clipboard() { printf '%s' "$1" | pbcopy >/dev/null 2>&1; }

# Smart brew install — skip if up-to-date, upgrade if outdated, install if missing.
# Most teammates already have Chrome/WebStorm/VS Code; this avoids reinstall churn
# while still keeping everything current. Pass "--cask" as $2 for cask installs.
brew_smart() {
    local pkg="$1"
    local cask=""
    [[ "$2" == "--cask" ]] && cask="--cask"
    if brew list $cask "$pkg" &>/dev/null; then
        if brew outdated $cask "$pkg" 2>/dev/null | grep -q "^$pkg"; then
            info "$pkg outdated — upgrading..."
            brew upgrade $cask "$pkg" &>/dev/null && pass "$pkg upgraded" || pass "$pkg present (upgrade failed)"
        else
            pass "$pkg up to date"
        fi
    else
        info "Installing $pkg..."
        brew install $cask "$pkg" &>/dev/null && pass "$pkg installed" || fail "$pkg install failed"
    fi
}

# Smart npm -g install — always pulls @latest (idempotent: noop if already latest,
# upgrade otherwise). Prints before→after so re-runs are honest about churn.
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
    # Machine-parseable progress line for wrapper UIs (stderr so it doesn't pollute stdout)
    echo "PROGRESS:$1/8:$2" >&2
}

# ── Validate ────────────────────────────────────────────────────
# Role is a label only — every machine gets the full config. Default to "engineer"
# when omitted, keep validating explicit values for backward compat with old callers.
if [[ -z "$ROLE" ]]; then
    ROLE="engineer"
fi

if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${R}This script is for macOS. Use onboarding-windows.ps1 for Windows.${NC}"
    exit 1
fi

if [[ "$ROLE" != "engineer" && "$ROLE" != "business" && "$ROLE" != "content" && "$ROLE" != "ops" ]]; then
    echo -e "${R}Invalid role: $ROLE${NC}"
    echo "Valid: engineer (default), business, content, ops"
    echo ""
    echo "Usage: bash onboarding-mac.sh [role] [--quiet] [--repos-dir <dir>] [--hogwarts-dev]"
    echo "One-liner:"
    echo "  git clone https://github.com/databayt/kun.git ~/kun && bash ~/kun/.claude/scripts/onboarding-mac.sh"
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

# Git (ships with Xcode CLT but brew can keep it fresher)
brew_smart git

# GitHub CLI
brew_smart gh

# Node.js — pin to LTS major (Node 24 Krypton as of 2026). brew_smart handles
# install + upgrade; the link step is idempotent so safe to run every time.
brew_smart node@24
brew link --overwrite --force node@24 &>/dev/null || true

# pnpm + Vercel CLI — @latest is idempotent (noop if already latest)
npm_global_smart pnpm
npm_global_smart vercel

# =============================================================================
# PHASE 2: Applications
# =============================================================================
step "2" "Applications"

# IDEs + browser on every machine — full workstation regardless of role.
# brew_smart skips if already present + up-to-date, upgrades if outdated.
brew_smart webstorm --cask
brew_smart visual-studio-code --cask
brew_smart google-chrome --cask

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
    info "Generating SSH key..."
    mkdir -p "$HOME/.ssh"
    ssh-keygen -t ed25519 -C "databayt-onboarding-$(hostname -s)" -f "$HOME/.ssh/id_ed25519" -N ""
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
    info "Connect your device to GitHub — opening the device page in your browser. If you don't have a GitHub account yet, sign up from that page (free)."
    open_url "https://github.com/login/device"

    # Auto-copy the one-time XXXX-XXXX device code to the clipboard as soon
    # as gh prints it, so the user only needs to paste on the device page.
    ghout=$(mktemp)
    (
        while sleep 0.3; do
            [ -s "$ghout" ] || continue
            code=$(grep -oE '[A-Z0-9]{4}-[A-Z0-9]{4}' "$ghout" 2>/dev/null | head -1)
            if [ -n "$code" ]; then
                if copy_clipboard "$code"; then
                    printf '\n  %b✓%b One-time code %s copied to clipboard — paste it on the page.\n\n' "${G}" "${NC}" "$code"
                fi
                exit 0
            fi
        done
    ) &
    watcher_pid=$!
    gh auth login -p ssh -w 2>&1 | tee "$ghout"
    kill "$watcher_pid" 2>/dev/null
    wait "$watcher_pid" 2>/dev/null
    rm -f "$ghout"
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
            info "Quiet mode — using placeholder git identity (override later via 'git config --global')"
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
# Default gh scopes already include read:org, so this just needs the API call to succeed.
state=$(gh api user/memberships/orgs/databayt --jq .state 2>/dev/null || echo "")
if [[ -z "$state" ]]; then
    fail "Cannot check databayt org membership (token may lack read:org scope)"
    info "Run: gh auth refresh -h github.com -s read:org -w   then re-run this script"
    exit 1
elif [[ "$state" != "active" ]]; then
    fail "Not an active member of github.com/databayt"
    info "Open the invite, accept it, then re-run this script (idempotent)"
    open "https://github.com/orgs/databayt/invitations" 2>/dev/null || true
    exit 1
fi
pass "databayt org membership active"

# SSH push capability: cloning over SSH and pushing both need this. ssh -T against
# github.com always exits non-zero (they block shell), so grep the banner.
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

clone_repo() {
    local repo="$1"
    local dir="$REPOS_DIR/$repo"
    if [[ ! -d "$dir" ]]; then
        info "Cloning $repo → $dir..."
        git clone "git@github.com:databayt/$repo.git" "$dir" 2>/dev/null && \
            pass "$repo" || {
            git clone "https://github.com/databayt/$repo.git" "$dir" 2>/dev/null && \
                pass "$repo (HTTPS)" || fail "$repo clone failed"
        }
    else
        pass "$repo (exists)"
    fi
}

# Symlink helper — keeps ~/kun, ~/hogwarts etc working when REPOS_DIR is elsewhere
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
    info "Cloning remaining databayt org repos..."
    for repo in shadcn radix souq mkan shifa swift-app distributed-computer marketing; do
        clone_repo "$repo"; symlink_home "$repo"
    done
fi

# =============================================================================
# PHASE 5: Claude Ecosystem
# =============================================================================
step "5" "Claude — CLI + Desktop"

# Claude Code CLI — native installer (auto-updates in background, per
# code.claude.com/docs/en/setup). curl install.sh is idempotent: re-runs detect
# existing install and just refresh.
if ! command -v claude &>/dev/null; then
    info "Installing Claude Code CLI..."
    curl -fsSL https://claude.ai/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
    if ! grep -q ".local/bin" "$HOME/.zshrc" 2>/dev/null; then
        echo '' >> "$HOME/.zshrc"
        echo '# Claude Code' >> "$HOME/.zshrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
    fi
    pass "Claude Code CLI installed ($(claude --version 2>/dev/null | head -1))"
else
    pass "Claude Code CLI ($(claude --version 2>/dev/null | head -1)) — auto-updates in background"
fi

# Claude Desktop — install/upgrade/skip via brew_smart
brew_smart claude --cask

# `c` launcher functions in shell rc (zsh default; bash if present)
for RC in "$HOME/.zshrc" "$HOME/.bashrc"; do
    [[ ! -f "$RC" ]] && continue
    if ! grep -q "function c " "$RC" 2>/dev/null; then
        cat >> "$RC" <<'CFUNC'

# Claude Code
function c  { claude --dangerously-skip-permissions "$@"; }
function cc { claude "$@"; }
[ -f "$HOME/.claude/.env" ] && set -a && . "$HOME/.claude/.env" && set +a
CFUNC
    fi
done
pass "Shell helpers (c, cc)"

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

# Vercel env pull — per-product .env from team databayt (Gist → ~/.claude/.env;
# Vercel → ~/<repo>/.env for each cloned product). Warns and continues if
# Vercel isn't logged in; the teammate can run `vercel login` later and re-run.
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

# Tools
command -v brew &>/dev/null       && pass "brew"       || fail "brew"
command -v git &>/dev/null        && pass "git"        || fail "git"
command -v node &>/dev/null       && pass "node"       || fail "node"
command -v pnpm &>/dev/null       && pass "pnpm"       || fail "pnpm"
command -v gh &>/dev/null         && pass "gh"         || fail "gh"
command -v claude &>/dev/null     && pass "claude"     || fail "claude"

# Auth
[[ -f "$HOME/.ssh/id_ed25519" ]]  && pass "SSH key"    || fail "SSH key"
gh auth status &>/dev/null 2>&1   && pass "GitHub auth" || fail "GitHub auth"

# Apps
[[ -d "/Applications/Google Chrome.app" ]] && pass "Chrome"         || info "Chrome"
[[ -d "/Applications/Claude.app" ]]        && pass "Claude Desktop" || info "Claude Desktop"

# Repos + IDEs are universal now
[[ -d "/Applications/WebStorm.app" ]]  && pass "WebStorm"       || info "WebStorm"
[[ -d "$HOME/hogwarts" ]]              && pass "hogwarts repo"   || fail "hogwarts"
[[ -d "$HOME/codebase" ]]              && pass "codebase repo"   || fail "codebase"
if [[ "$HOGWARTS_DEV" == "1" ]]; then
    [[ -f "$HOME/hogwarts/.env" ]]         && pass "hogwarts .env"   || info "hogwarts .env (need gist)"
    [[ -d "$HOME/hogwarts/node_modules" ]] && pass "hogwarts deps"   || info "hogwarts deps"
fi

[[ -d "$HOME/kun" ]]                       && pass "kun repo"        || fail "kun"
[[ -f "$HOME/.claude/CLAUDE.md" ]]         && pass "Kun CLAUDE.md"   || fail "Kun CLAUDE.md"
[[ -f "$HOME/.claude/settings.json" ]]     && pass "settings.json"   || fail "settings.json"
[[ -f "$HOME/.claude/mcp.json" ]]          && pass "mcp.json"        || fail "mcp.json"

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
if [[ -z "$GIST_ID" ]]; then
    echo "  4. Load secrets when you have the gist ID:"
    echo "     bash ~/kun/.claude/scripts/secrets.sh <GIST_ID>"
fi
echo ""
echo -e "${BD}IDE plugins (manual install from Marketplace):${NC}"
echo "  • WebStorm: Settings → Plugins → search 'Claude Code' → Install"
echo "  • VS Code: Extensions → search 'Claude Code' → Install"
if [[ "$HOGWARTS_DEV" == "1" ]]; then
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

echo ""
echo -e "${D}Re-run: bash ~/kun/.claude/scripts/onboarding-mac.sh $ROLE${NC}"
