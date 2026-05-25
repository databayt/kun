#!/usr/bin/env bash
# vercel-pull.sh — pull per-project .env files from Vercel for each cloned databayt repo.
#
# Runs after Phase 6 (secrets) in the onboarding pipeline. Vercel is the source
# of truth for app env vars; `~/.claude/.env` (from the Gist) holds MCP keys and
# cross-cutting tokens. This script bridges Vercel → per-repo `.env`.
#
# Usage:
#   bash vercel-pull.sh [REPOS_DIR]
#
# Env-var override: REPOS_DIR. Default: $HOME.
#
# Behavior:
#   - Skip silently if vercel CLI is missing (warn once).
#   - Skip silently if not logged in (warn once with the login hint).
#   - For each known databayt Vercel project: cd into cloned repo, vercel link,
#     vercel env pull .env (development environment).
#   - Warn-and-continue on per-project failure — never abort.

set +e  # never abort on a single project failure

REPOS_DIR="${1:-${REPOS_DIR:-$HOME}}"

G='\033[0;32m' Y='\033[1;33m' D='\033[2m' BD='\033[1m' NC='\033[0m'
pass() { echo -e "  ${G}✓${NC} $1"; }
info() { echo -e "  ${D}·${NC} $1"; }
warn() { echo -e "  ${Y}!${NC} $1"; }

# repo-dir → Vercel project slug under team `databayt`
# Update this list when a new product gets a Vercel project.
PROJECTS=(
    "kun:kun"
    "hogwarts:hogwarts"
    "codebase:codebase"
    "souq:souq"
    "mkan:mkan"
    "shifa:shifa"
    "marketing:marketing"
)

echo ""
echo -e "${BD}Vercel env pull — per-product .env from team databayt${NC}"

if ! command -v vercel >/dev/null 2>&1; then
    warn "Vercel CLI not installed (npm install -g vercel) — per-product .env files will be missing"
    exit 0
fi

if ! vercel whoami >/dev/null 2>&1; then
    warn "Not logged into Vercel — run: vercel login   then re-run this script"
    exit 0
fi

for entry in "${PROJECTS[@]}"; do
    repo="${entry%%:*}"
    project="${entry##*:}"
    repo_dir="$REPOS_DIR/$repo"

    if [[ ! -d "$repo_dir" ]]; then
        info "Skip $repo (not cloned)"
        continue
    fi

    if (cd "$repo_dir" && vercel link --yes --project="$project" --scope=databayt >/dev/null 2>&1); then
        if (cd "$repo_dir" && vercel env pull .env --environment=development --yes >/dev/null 2>&1); then
            pass "$repo → .env populated"
        else
            warn "$repo: vercel env pull failed (project exists but env unreadable?)"
        fi
    else
        warn "$repo: vercel link failed (project '$project' may not exist or you lack team access)"
    fi
done

echo ""
echo -e "${D}If any repo above warned, verify Vercel team access at https://vercel.com/teams/databayt/${NC}"
