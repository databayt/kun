#!/usr/bin/env bash
# build-plugins.sh — Populate plugins/<name>/ directories from .claude/.
# Story 25 in docs/EPICS-V4.md. Mac-bash-3 compatible.
#
# Idempotent — overwrites the bundled subset on each run.
#
# Usage:
#   bash scripts/build-plugins.sh                    # build all
#   bash scripts/build-plugins.sh kun-core           # build one
#   bash scripts/build-plugins.sh --clean            # remove built content (keeps manifests)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE="${REPO_ROOT}/.claude"
PLUGINS="${REPO_ROOT}/plugins"

[ -d "$CLAUDE" ] || { echo "fatal: $CLAUDE not found" >&2; exit 1; }
[ -d "$PLUGINS" ] || { echo "fatal: $PLUGINS not found" >&2; exit 1; }

clean=0
target=""
for arg in "$@"; do
  case "$arg" in
    --clean) clean=1 ;;
    --help|-h) sed -n '2,11p' "$0"; exit 0 ;;
    *) target="$arg" ;;
  esac
done

# Plugin specs ------------------------------------------------------------

# Skills bundled in kun-core (technical surface, no captain ceremonies)
kun_core_skills() {
  cat <<EOF
nextjs react typescript tailwind shadcn prisma authjs
accessibility barrel waterfall skeleton structure guard translate
react-best-practices
atom template block figma motion
dev build deploy test package clone
docs idea spec schema code wire check
saas pattern repos codebase screenshot
report security performance feature analyze learn profile
crawl-anthropic credentials issue coverage
EOF
}

# Agents bundled in kun-core (specialists, not leadership)
kun_core_agents() {
  cat <<EOF
nextjs react typescript tailwind prisma shadcn authjs
atom template block figma structure architecture pattern
build deploy test package
git github
middleware internationalization sse semantic
optimize performance comment
learn analyze
hogwarts mkan shifa souq
orchestration report quality-engineer
EOF
}

# Skills bundled in kun-captain
kun_captain_skills() {
  cat <<EOF
captain weekly dispatch monitor costs health incident
sprint-plan standup sprint-review refine
proposal pricing content-calendar
EOF
}

# Agents bundled in kun-captain
kun_captain_agents() {
  cat <<EOF
captain revenue growth support product analyst tech-lead ops guardian
EOF
}

# Build helpers -----------------------------------------------------------

build_kun_core() {
  local dst="${PLUGINS}/kun-core"
  echo "Building kun-core → $dst"
  if [ "$clean" -eq 1 ]; then
    rm -rf "$dst/agents" "$dst/skills" "$dst/hooks" "$dst/rules" "$dst/memory" 2>/dev/null
    return
  fi

  # Skills
  mkdir -p "$dst/skills"
  for s in $(kun_core_skills); do
    if [ -d "$CLAUDE/skills/$s" ]; then
      mkdir -p "$dst/skills/$s"
      cp "$CLAUDE/skills/$s/SKILL.md" "$dst/skills/$s/SKILL.md" 2>/dev/null
    fi
  done

  # Agents
  mkdir -p "$dst/agents"
  for a in $(kun_core_agents); do
    [ -f "$CLAUDE/agents/$a.md" ] && cp "$CLAUDE/agents/$a.md" "$dst/agents/$a.md"
  done

  # Rules — all 12 (path-scoped, so they auto-load)
  mkdir -p "$dst/rules"
  cp "$CLAUDE/rules/"*.md "$dst/rules/" 2>/dev/null

  # Hooks — only the 3 critical ones
  mkdir -p "$dst/hooks"
  if command -v jq >/dev/null 2>&1; then
    jq '{
      hooks: {
        SessionStart: .hooks.SessionStart,
        PostToolUse: [.hooks.PostToolUse[] | select(.matcher == "Write|Edit")],
        Stop: .hooks.Stop
      }
    }' "$CLAUDE/settings.json" > "$dst/hooks/hooks.json"
  fi

  # Memory — non-captain files
  mkdir -p "$dst/memory"
  for m in atom.json template.json block.json report.json preferences.json repositories.json figma_projects.json team.json; do
    [ -f "$CLAUDE/memory/$m" ] && cp "$CLAUDE/memory/$m" "$dst/memory/$m"
  done

  echo "  done: kun-core ($(ls $dst/skills | wc -l | tr -d ' ') skills, $(ls $dst/agents | wc -l | tr -d ' ') agents, $(ls $dst/rules | wc -l | tr -d ' ') rules)"
}

build_kun_captain() {
  local dst="${PLUGINS}/kun-captain"
  echo "Building kun-captain → $dst"
  if [ "$clean" -eq 1 ]; then
    rm -rf "$dst/agents" "$dst/skills" "$dst/hooks" "$dst/captain" "$dst/memory" 2>/dev/null
    return
  fi

  mkdir -p "$dst/skills" "$dst/agents" "$dst/captain" "$dst/memory" "$dst/hooks"

  for s in $(kun_captain_skills); do
    if [ -d "$CLAUDE/skills/$s" ]; then
      mkdir -p "$dst/skills/$s"
      cp "$CLAUDE/skills/$s/SKILL.md" "$dst/skills/$s/SKILL.md" 2>/dev/null
    fi
  done

  for a in $(kun_captain_agents); do
    [ -f "$CLAUDE/agents/$a.md" ] && cp "$CLAUDE/agents/$a.md" "$dst/agents/$a.md"
  done

  cp "$CLAUDE/captain/decision-matrix.yaml" "$dst/captain/decision-matrix.yaml" 2>/dev/null

  for m in captain-state.json runway.json revenue.json capacity.json pilot-king-fahad.json captain_journal.md bridge.template.md; do
    [ -f "$CLAUDE/memory/$m" ] && cp "$CLAUDE/memory/$m" "$dst/memory/$m"
  done

  if command -v jq >/dev/null 2>&1; then
    jq '{
      hooks: {
        SessionStart: .hooks.SessionStart,
        PreCompact: .hooks.PreCompact,
        TeammateIdle: .hooks.TeammateIdle,
        FileChanged: .hooks.FileChanged
      }
    }' "$CLAUDE/settings.json" > "$dst/hooks/hooks.json"
  fi

  echo "  done: kun-captain ($(ls $dst/skills | wc -l | tr -d ' ') skills, $(ls $dst/agents | wc -l | tr -d ' ') agents)"
}

build_role_profile() {
  local name="$1"
  echo "Building role profile $name (manifest + settings only)"
  # Role profiles don't bundle content — just a manifest + settings.json that
  # apply to whatever kun-core / kun-captain provide. Already shipped in repo.
}

# Main --------------------------------------------------------------------

if [ -z "$target" ] || [ "$target" = "all" ]; then
  build_kun_core
  build_kun_captain
  build_role_profile kun-engineer
  build_role_profile kun-business
  build_role_profile kun-content
  build_role_profile kun-ops
  build_role_profile kun-accessible
elif [ "$target" = "kun-core" ]; then
  build_kun_core
elif [ "$target" = "kun-captain" ]; then
  build_kun_captain
elif [ "$target" = "kun-engineer" ] || [ "$target" = "kun-business" ] || [ "$target" = "kun-content" ] || [ "$target" = "kun-ops" ] || [ "$target" = "kun-accessible" ]; then
  build_role_profile "$target"
else
  echo "Unknown target: $target"
  echo "Valid: kun-core, kun-captain, kun-engineer, kun-business, kun-content, kun-ops, kun-accessible, all"
  exit 1
fi

echo
echo "Plugin builds complete. Test with:"
echo "  claude --plugin-dir ./plugins/kun-core"
exit 0
