#!/usr/bin/env bash
# migrate-commands-to-skills.sh — Migrate .claude/commands/<n>.md → .claude/skills/<n>/SKILL.md
# Story 20.1 in docs/EPICS-V4.md.
#
# Idempotent. Mac-bash-3 compatible.
#
# Usage:
#   bash scripts/migrate-commands-to-skills.sh                     # all commands
#   bash scripts/migrate-commands-to-skills.sh weekly dispatch     # only named
#   bash scripts/migrate-commands-to-skills.sh --force             # overwrite

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMANDS="${REPO_ROOT}/.claude/commands"
SKILLS="${REPO_ROOT}/.claude/skills"

[ -d "$COMMANDS" ] || { echo "fatal: $COMMANDS not found" >&2; exit 1; }
mkdir -p "$SKILLS"

force=0
filter=""
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    --help|-h) sed -n '2,12p' "$0"; exit 0 ;;
    *) filter="${filter} ${arg}" ;;
  esac
done

# Lookup functions (Bash 3 compatible — no associative arrays) -------------

paths_for() {
  case "$1" in
    nextjs)        echo '["src/**/*.{ts,tsx}","src/app/**","next.config.{ts,js,mjs}"]' ;;
    react)         echo '["src/**/*.{tsx,jsx}","src/components/**"]' ;;
    typescript)    echo '["src/**/*.{ts,tsx}","tsconfig.json"]' ;;
    tailwind)      echo '["src/**/*.{tsx,jsx,css}","tailwind.config.{ts,js}"]' ;;
    shadcn)        echo '["src/components/**","components.json"]' ;;
    prisma)        echo '["prisma/**","src/**/queries.ts","src/**/actions.ts","src/lib/db.ts"]' ;;
    authjs)        echo '["src/**/auth/**","src/**/*auth*","src/middleware.ts"]' ;;
    accessibility) echo '["src/**/*.{tsx,jsx}","src/components/**"]' ;;
    barrel)        echo '["src/**/index.ts","src/**/index.tsx"]' ;;
    waterfall)     echo '["src/**/page.tsx","src/**/layout.tsx","src/**/queries.ts"]' ;;
    skeleton)      echo '["src/app/**/loading.tsx","src/app/**/page.tsx"]' ;;
    structure)     echo '["src/**"]' ;;
    guard)         echo '["src/**/auth*","src/**/actions.ts","src/middleware.ts","prisma/**"]' ;;
    translate)     echo '["src/**/*.{tsx,jsx}","src/dictionary/**","src/i18n/**"]' ;;
    *)             echo '' ;;
  esac
}

is_fork() {
  case "$1" in
    weekly|dispatch|monitor|costs|health|captain) return 0 ;;
    *) return 1 ;;
  esac
}

is_disable_model_invocation() {
  case "$1" in
    deploy|ship) return 0 ;;
    *) return 1 ;;
  esac
}

# Migrate one --------------------------------------------------------------

migrate_one() {
  local name="$1"
  local src="${COMMANDS}/${name}.md"
  local dst_dir="${SKILLS}/${name}"
  local dst="${dst_dir}/SKILL.md"

  if [ ! -f "$src" ]; then
    echo "skip: $src not found"
    return
  fi

  if [ -f "$dst" ] && [ "$force" -eq 0 ]; then
    echo "skip: $dst exists (use --force)"
    return
  fi

  mkdir -p "$dst_dir"

  # Build additions
  local paths_val
  paths_val=$(paths_for "$name")
  local additions=""
  [ -n "$paths_val" ] && additions+="paths: ${paths_val}
"
  if is_fork "$name"; then
    additions+="context: fork
agent: general-purpose
"
  fi
  if is_disable_model_invocation "$name"; then
    additions+="disable-model-invocation: true
"
  fi

  # Detect existing frontmatter
  local has_fm=0
  if head -1 "$src" 2>/dev/null | grep -q '^---$'; then
    has_fm=1
  fi

  if [ "$has_fm" -eq 1 ]; then
    # Existing frontmatter — keep it, only append additions to YAML block
    # Pure-bash line-by-line to avoid awk multi-line var bugs on Mac.
    {
      in_fm=0
      printed_add=0
      while IFS= read -r line; do
        if [ "$line" = "---" ]; then
          if [ "$in_fm" = "0" ]; then
            in_fm=1
            printf '%s\n' "$line"
            continue
          elif [ "$printed_add" = "0" ]; then
            [ -n "$additions" ] && printf '%s' "$additions"
            printed_add=1
            printf '%s\n' "$line"
            continue
          fi
        fi
        printf '%s\n' "$line"
      done < "$src"
    } > "$dst"
  else
    # No frontmatter — synthesize
    local description
    description=$(head -1 "$src" 2>/dev/null | sed 's/^# *//')
    [ -z "$description" ] && description="${name} skill"
    {
      echo '---'
      echo "name: ${name}"
      echo "description: ${description}"
      [ -n "$additions" ] && printf "%s" "$additions"
      echo '---'
      echo
      cat "$src"
    } > "$dst"
  fi

  echo "wrote: $dst"
}

# Main ---------------------------------------------------------------------

if [ -z "$filter" ]; then
  for f in "$COMMANDS"/*.md; do
    name=$(basename "$f" .md)
    case "$name" in _*) continue ;; esac
    migrate_one "$name"
  done
else
  for name in $filter; do
    migrate_one "$name"
  done
fi

echo
echo "Migration done. Run 'bash scripts/inventory.sh' to refresh counts."
exit 0
