#!/bin/bash
# Repository Sync Script
# Syncs all databayt organization repositories locally
# Usage: ~/.claude/scripts/sync-repos.sh [repo-name]

set -e

OSS_DIR="$HOME/oss"
MEMORY_FILE="$HOME/.claude/memory/repositories.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== databayt Repository Sync ===${NC}"
echo ""

# Ensure OSS directory exists
mkdir -p "$OSS_DIR"

# Repository definitions
declare -A REPOS=(
    ["codebase"]="$HOME/codebase"
    ["shadcn"]="$OSS_DIR/shadcn"
    ["radix"]="$OSS_DIR/radix"
    ["kun"]="$HOME/kun"
    ["hogwarts"]="$OSS_DIR/hogwarts"
    ["souq"]="$OSS_DIR/souq"
    ["mkan"]="$OSS_DIR/mkan"
    ["shifa"]="$OSS_DIR/shifa"
    ["swift-app"]="$OSS_DIR/swift-app"
    ["distributed-computer"]="$OSS_DIR/distributed-computer"
    ["marketing"]="$OSS_DIR/marketing"
)

sync_repo() {
    local name=$1
    local path=${REPOS[$name]}
    local url="https://github.com/databayt/$name.git"

    echo -e "${YELLOW}[$name]${NC}"

    if [ -d "$path" ]; then
        echo -e "  Path: $path"
        echo -e "  Status: ${GREEN}exists${NC}"
        echo -e "  Action: pulling latest..."

        cd "$path"

        # Check for uncommitted changes
        if [ -n "$(git status --porcelain)" ]; then
            echo -e "  ${RED}Warning: Uncommitted changes detected${NC}"
            echo -e "  Stashing changes..."
            git stash
        fi

        # Pull latest
        git fetch origin
        git pull origin main --rebase 2>/dev/null || git pull origin master --rebase 2>/dev/null || true

        # Get current commit
        local commit=$(git rev-parse --short HEAD)
        echo -e "  Current: ${GREEN}$commit${NC}"
    else
        echo -e "  Path: $path"
        echo -e "  Status: ${RED}not found${NC}"
        echo -e "  Action: cloning..."

        git clone "$url" "$path"
        echo -e "  ${GREEN}Cloned successfully${NC}"
    fi

    echo ""
}

check_status() {
    local name=$1
    local path=${REPOS[$name]}

    if [ -d "$path" ]; then
        cd "$path"
        local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
        local changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

        echo -e "${YELLOW}$name${NC}"
        echo -e "  Path: $path"
        echo -e "  Branch: $branch"
        echo -e "  Commit: $commit"
        if [ "$changes" -gt 0 ]; then
            echo -e "  Changes: ${RED}$changes uncommitted${NC}"
        else
            echo -e "  Changes: ${GREEN}clean${NC}"
        fi
    else
        echo -e "${YELLOW}$name${NC}"
        echo -e "  Status: ${RED}not cloned${NC}"
    fi
    echo ""
}

watch_upstream() {
    echo -e "${BLUE}=== Checking Upstream Dependencies ===${NC}"
    echo ""

    # Check shadcn/ui upstream
    echo -e "${YELLOW}shadcn-ui/ui${NC}"
    echo -e "  Latest: checking..."
    local shadcn_latest=$(curl -s "https://api.github.com/repos/shadcn-ui/ui/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)
    echo -e "  Latest release: ${GREEN}$shadcn_latest${NC}"
    echo ""

    # Check radix-ui/primitives upstream
    echo -e "${YELLOW}radix-ui/primitives${NC}"
    echo -e "  Latest: checking..."
    local radix_latest=$(curl -s "https://api.github.com/repos/radix-ui/primitives/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)
    echo -e "  Latest release: ${GREEN}$radix_latest${NC}"
    echo ""

    # Check Next.js
    echo -e "${YELLOW}vercel/next.js${NC}"
    echo -e "  Latest: checking..."
    local nextjs_latest=$(curl -s "https://api.github.com/repos/vercel/next.js/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)
    echo -e "  Latest release: ${GREEN}$nextjs_latest${NC}"
    echo ""

    # Check Prisma
    echo -e "${YELLOW}prisma/prisma${NC}"
    echo -e "  Latest: checking..."
    local prisma_latest=$(curl -s "https://api.github.com/repos/prisma/prisma/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)
    echo -e "  Latest release: ${GREEN}$prisma_latest${NC}"
    echo ""
}

update_memory() {
    if [ -f "$MEMORY_FILE" ]; then
        local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        # Update lastFullSync in memory file
        if command -v jq &> /dev/null; then
            jq --arg ts "$timestamp" '.sync.lastFullSync = $ts' "$MEMORY_FILE" > "${MEMORY_FILE}.tmp" && mv "${MEMORY_FILE}.tmp" "$MEMORY_FILE"
            echo -e "${GREEN}Memory file updated${NC}"
        fi
    fi
}

# Main
case "${1:-all}" in
    "status"|"--status"|"-s")
        echo -e "${BLUE}=== Repository Status ===${NC}"
        echo ""
        for repo in "${!REPOS[@]}"; do
            check_status "$repo"
        done
        ;;
    "watch"|"--watch"|"-w")
        watch_upstream
        ;;
    "all"|"--all"|"-a")
        for repo in "${!REPOS[@]}"; do
            sync_repo "$repo"
        done
        update_memory
        echo -e "${GREEN}=== Sync Complete ===${NC}"
        ;;
    *)
        if [[ -v "REPOS[$1]" ]]; then
            sync_repo "$1"
            echo -e "${GREEN}=== Sync Complete ===${NC}"
        else
            echo -e "${RED}Unknown repository: $1${NC}"
            echo ""
            echo "Available repositories:"
            for repo in "${!REPOS[@]}"; do
                echo "  - $repo"
            done
            exit 1
        fi
        ;;
esac
