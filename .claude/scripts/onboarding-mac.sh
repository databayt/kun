#!/bin/bash
# =============================================================================
# Computer Onboarding — macOS
# =============================================================================
# Fresh Mac to fully working dev environment in one command.
#
# Usage:
#   bash onboarding-mac.sh <role> [gist_id] [flags]
#
# Flags:
#   --agents=all|code,desktop,agy,opencode,openclaw   which agents to install (default all)
#   --detect-only                                     print the scan table and exit
#   --dry-run                                         print what would install and exit
#   --quiet --repos-dir <p> --essentials-only --hogwarts-dev --name --email
#
# Examples:
#   bash onboarding-mac.sh engineer abc123              # Full dev + secrets
#   bash onboarding-mac.sh --detect-only                # Scan, change nothing
#   bash onboarding-mac.sh --dry-run --agents=opencode,openclaw
#   bash onboarding-mac.sh engineer --agents=code,desktop
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
AGENTS_SEL="all" DETECT_ONLY=0 DRY_RUN=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --quiet)            QUIET=1; shift ;;
        --name)             GIT_NAME_ARG="$2"; shift 2 ;;
        --email)             GIT_EMAIL_ARG="$2"; shift 2 ;;
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

# Agent fleet library — detection, alias block, opencode bypass config
# shellcheck disable=SC1090
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/agents.sh"

echo ""
echo -e "${BD}Computer Onboarding — macOS${NC}"
echo -e "Role: ${G}$ROLE${NC} · Agents: ${G}$AGENTS_SEL${NC}"

# =============================================================================
# PHASE 0: Scan — detect first, install only the delta
# =============================================================================
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
    echo -e "${D}Plus the standard idempotent phases: system tools, apps, GitHub auth, repo clones, kun engine, health.${NC}"
    exit 0
fi

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

# Symlink helper — keeps ~/kun, ~/hogwarts etc working when REPOS_DIR is elsewhere
symlink_home() {
    local repo="$1"
    [[ "$REPOS_DIR" == "$HOME" ]] && return
    [[ -d "$REPOS_DIR/$repo" && ! -e "$HOME/$repo" ]] && \
        ln -sf "$REPOS_DIR/$repo" "$HOME/$repo" && info "~/$repo → $REPOS_DIR/$repo"
}

# clone_parallel — clone every repo concurrently in bounded batches, then report +
# symlink sequentially in canonical order. Fixed-size batches (not `wait -n`) keep this
# working on stock macOS /bin/bash 3.2. pass/fail/ERRORS run only in this parent shell.
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
# PHASE 5: Agents — Claude Code + Desktop, Antigravity, opencode, OpenClaw
# =============================================================================
step "5" "Agents — the c/a/o/claw fleet (selected: $AGENTS_SEL)"

# Claude Code CLI — native installer (auto-updates in background, per
# code.claude.com/docs/en/setup). curl install.sh is idempotent: re-runs detect
# existing install and just refresh.
if agents_selected_contains "$AGENTS_SEL" code; then
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
else
    info "Claude Code skipped (not in --agents)"
fi

# Antigravity CLI — secondary agent (`agy`). Fallback when Claude Code is
# unavailable + handles easy/cheap tasks (Gemini Flash). Native installer is
# idempotent and lands in ~/.local/bin (already on PATH from the step above).
if agents_selected_contains "$AGENTS_SEL" agy; then
    if ! command -v agy >/dev/null 2>&1; then
        info "Installing Antigravity CLI (secondary agent)..."
        curl -fsSL https://antigravity.google/cli/install.sh | bash
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

# opencode — tertiary agent. Its permission bypass is CONFIG-LEVEL (no
# --dangerously-skip-permissions flag exists): we write "permission": "allow"
# into ~/.config/opencode/opencode.json (merged, never clobbering other keys).
if agents_selected_contains "$AGENTS_SEL" opencode; then
    if ! command -v opencode >/dev/null 2>&1; then
        info "Installing opencode (tertiary agent)..."
        curl -fsSL https://opencode.ai/install | bash || info "opencode installer failed — optional lane, continuing"
        export PATH="$HOME/.opencode/bin:$PATH"
    fi
    if command -v opencode >/dev/null 2>&1; then
        agents_configure_opencode
        pass "opencode ($(opencode --version 2>/dev/null | head -1)) · bypass = permission:allow in ~/.config/opencode/opencode.json"
    fi
fi

# OpenClaw — OPTIONAL assistant gateway (WhatsApp/Telegram/Slack channels), not
# a coding CLI. npm install only; the daemon onboarding is interactive by design
# and never runs in quiet mode — finish later with: openclaw onboard --install-daemon
if agents_selected_contains "$AGENTS_SEL" openclaw; then
    if ! command -v openclaw >/dev/null 2>&1; then
        npm_global_smart openclaw
        info "OpenClaw daemon not started — interactive by design. Later: openclaw onboard --install-daemon"
    else
        pass "OpenClaw ($(openclaw --version 2>/dev/null | head -1))"
    fi
fi

# Claude Desktop — install/upgrade/skip via brew_smart
if agents_selected_contains "$AGENTS_SEL" desktop; then
    brew_smart claude --cask
fi

# Launchers — one managed block in the shell rc (c / a / o / claw per selection).
# Migrates the legacy function/alias lines; idempotent across re-runs.
for RC in "$HOME/.zshrc" "$HOME/.bashrc"; do
    [[ ! -f "$RC" ]] && continue
    grep -q "function cc " "$RC" 2>/dev/null && sed -i '' '/function cc /d' "$RC"
done
agents_write_alias_block "$AGENTS_SEL"
pass "Shell launchers (managed block: c, a, o, claw per selection)"

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
command -v agy &>/dev/null         && pass "agy (secondary)" || info "agy (secondary)"
command -v opencode &>/dev/null    && pass "opencode (tertiary)" || info "opencode (tertiary)"
command -v openclaw &>/dev/null    && pass "openclaw (gateway)"  || info "openclaw (gateway, optional)"

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
echo "     Launchers: 'c' = Claude Code · 'a' = Antigravity · 'o' = opencode · 'claw' = OpenClaw gateway"
echo "  3. Open Claude Desktop → sign in"
if command -v openclaw &>/dev/null && [[ ! -f "$HOME/.openclaw/openclaw.json" ]]; then
    echo "  •  OpenClaw daemon (optional): openclaw onboard --install-daemon"
fi
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
