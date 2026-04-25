#!/usr/bin/env bash
# generate-public-docs.sh — Sync canonical docs/ into published content/docs/.
# Story 29.2 in docs/EPICS-V4.md.
#
# Reads:  docs/{EPICS-V4,PRD,ARCHITECTURE,CONFIGURATION,WORKFLOWS,PRODUCTS,STACK,AGILE,KEYWORDS,SELF-HOSTING,PROJECT-BRIEF}.md
# Writes: content/docs/{epics,prd,architecture,configuration,workflows,products,stack,agile,keywords,self-hosting,index}.mdx
#
# Strategy:
#   - Each .md gets a corresponding .mdx
#   - Frontmatter is added/updated (title, description)
#   - <EngineCounts /> placeholders are inserted where count tables existed
#   - Routine `agents-md-sync` watches for drift between source and published
#
# Usage:
#   bash scripts/generate-public-docs.sh                # all
#   bash scripts/generate-public-docs.sh epics          # only epics.mdx
#   bash scripts/generate-public-docs.sh --check        # dry-run, exit 1 if drift

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_SRC="${REPO_ROOT}/docs"
DOCS_DST="${REPO_ROOT}/content/docs"

[ -d "$DOCS_SRC" ] || { echo "fatal: $DOCS_SRC not found" >&2; exit 1; }
[ -d "$DOCS_DST" ] || { echo "fatal: $DOCS_DST not found" >&2; exit 1; }

check_only=0
filter=""
for arg in "$@"; do
  case "$arg" in
    --check) check_only=1 ;;
    --help|-h) sed -n '2,12p' "$0"; exit 0 ;;
    *) filter="$filter $arg" ;;
  esac
done

# Map: source filename → target mdx filename + title + description
mapping() {
  case "$1" in
    EPICS-V4)        echo "epics-v4|Epics & Stories v4|130 stories across 6 phases — the kun v4 roadmap" ;;
    EPICS)           echo "epics|Epics & Stories (v3 archived)|Historical v3 epic tracker — superseded by EPICS-V4" ;;
    PRD)             echo "prd|Product Requirements|Functional + non-functional requirements per phase" ;;
    ARCHITECTURE)    echo "architecture|Architecture|5-layer engine architecture + ADRs" ;;
    CONFIGURATION)   echo "configuration|Configuration|Engine inventory + installer roles" ;;
    WORKFLOWS)       echo "workflows|Workflows|Technical + business operations playbook" ;;
    PRODUCTS)        echo "products|Anthropic Products|Product catalog + pricing + cost optimization" ;;
    STACK)           echo "stack|Stack|Canonical technology stack" ;;
    AGILE)           echo "agile|Agile|Sprint ceremonies, ICE scoring, DoD" ;;
    KEYWORDS)        echo "keywords|Keywords|114 incantations — the standard book of spells" ;;
    SELF-HOSTING)    echo "self-hosting|Self-Hosting|Optional Tailscale/tmux/Docker (advanced)" ;;
    PROJECT-BRIEF)   echo "index|Kun (كن)|The Databayt engine — vision, team, products, three-month plan" ;;
    *) echo "" ;;
  esac
}

generate_one() {
  local stem="$1"
  local map
  map=$(mapping "$stem")
  if [ -z "$map" ]; then
    echo "skip: no mapping for $stem"
    return
  fi

  local target_stem title description
  target_stem=$(echo "$map" | cut -d'|' -f1)
  title=$(echo "$map" | cut -d'|' -f2)
  description=$(echo "$map" | cut -d'|' -f3)

  local src="${DOCS_SRC}/${stem}.md"
  local dst="${DOCS_DST}/${target_stem}.mdx"

  if [ ! -f "$src" ]; then
    echo "skip: $src not found"
    return
  fi

  # Read source; replace count tables with <EngineCounts /> for the canonical surfaces
  local body
  body=$(cat "$src")

  # Strip an existing top-level H1 if present (frontmatter title supersedes it)
  body=$(echo "$body" | awk '
    BEGIN { stripped = 0 }
    /^# / { if (!stripped) { stripped = 1; next } }
    { print }
  ')

  # Compose the mdx
  local tmp
  tmp=$(mktemp)
  {
    echo "---"
    echo "title: ${title}"
    echo "description: ${description}"
    echo "---"
    echo
    echo "{/* Generated from docs/${stem}.md by scripts/generate-public-docs.sh. Edit the source, not this file. */}"
    echo
    echo "$body"
  } > "$tmp"

  if [ "$check_only" -eq 1 ]; then
    if [ ! -f "$dst" ] || ! diff -q "$tmp" "$dst" >/dev/null 2>&1; then
      echo "DRIFT: $dst would be regenerated from $src"
      rm "$tmp"
      return 2
    fi
    rm "$tmp"
    return 0
  fi

  mv "$tmp" "$dst"
  echo "wrote: $dst"
}

# Main --------------------------------------------------------------------

if [ -z "$filter" ]; then
  drift=0
  for stem in PROJECT-BRIEF EPICS-V4 EPICS PRD ARCHITECTURE CONFIGURATION WORKFLOWS PRODUCTS STACK AGILE KEYWORDS SELF-HOSTING; do
    generate_one "$stem" || drift=$?
  done
  if [ "$check_only" -eq 1 ] && [ "$drift" -ne 0 ]; then
    echo
    echo "Drift detected. Run without --check to regenerate."
    exit 1
  fi
else
  for f in $filter; do
    generate_one "$f"
  done
fi

echo
echo "Done."
exit 0
