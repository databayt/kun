#!/usr/bin/env bash
# build-plugin.sh — regenerate the kun plugin trees from canonical sources.
#
# kun ships TWO plugins in one marketplace (see plugins/.claude-plugin/marketplace.json):
#   • kun-stack   — portable stack fleet (Next.js/React/Prisma/Tailwind/...). OSS, install anywhere.
#   • kun-company — databayt's leadership/pipeline fleet. Reference, not install-and-run.
#
# The plugin dirs are BUILD ARTIFACTS: canonical sources stay in .claude/ (project) and
# ~/.claude/agents (user stack fleet). This script copies them into plugins/ so the repo
# is directly installable via `/plugin marketplace add databayt/kun`. Re-run after editing
# any canonical source. `/health` asserts plugin == source via --check.
#
# Usage: bash .claude/scripts/build-plugin.sh [--check]
#   (no args) regenerate plugins/kun-stack and plugins/kun-company
#   --check   verify plugins are in sync with sources (exit 1 on drift); copies nothing

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
USER_AGENTS="$HOME/.claude/agents"
USER_SKILLS="$HOME/.claude/skills"
CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

# The 27 user stack agents that belong to kun-stack (everything in ~/.claude/agents
# except the _index file). These do NOT overlap the project company fleet.
STACK_AGENTS="architecture atom authjs block build comment deploy git github icon internationalization middleware nextjs optimize orchestration pattern performance prisma react semantic shadcn sse structure tailwind template test typescript"

# Stack skills bundled with kun-stack (cross-cutting build/dev know-how).
STACK_SKILLS="atom block template build deploy dev fix quick saas test docs motion performance security"

say() { printf "  %s\n" "$1"; }

DRIFT=0

# copy_one SRC DST — copy a file (creating parents). In --check mode, diff instead.
copy_one() {
  local src="$1" dst="$2"
  if [ "$CHECK" = 1 ]; then
    if [ ! -f "$dst" ] || ! diff -q "$src" "$dst" >/dev/null 2>&1; then
      echo "DRIFT: $dst out of sync with $src"
      DRIFT=$((DRIFT+1))
    fi
  else
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
}

# ── kun-stack ──────────────────────────────────────────────────────
STACK="$ROOT/plugins/kun-stack"
[ "$CHECK" = 0 ] && { rm -rf "$STACK/agents" "$STACK/skills"; mkdir -p "$STACK/agents" "$STACK/skills"; }
for a in $STACK_AGENTS; do
  [ -f "$USER_AGENTS/$a.md" ] && copy_one "$USER_AGENTS/$a.md" "$STACK/agents/$a.md" || say "skip (missing): agent $a"
done
for s in $STACK_SKILLS; do
  [ -f "$USER_SKILLS/$s/SKILL.md" ] && copy_one "$USER_SKILLS/$s/SKILL.md" "$STACK/skills/$s/SKILL.md" || say "skip (missing): skill $s"
done

# ── kun-company ────────────────────────────────────────────────────
CO="$ROOT/plugins/kun-company"
[ "$CHECK" = 0 ] && { rm -rf "$CO/agents" "$CO/commands" "$CO/patterns" "$CO/rules"; mkdir -p "$CO/agents" "$CO/commands" "$CO/patterns/cards" "$CO/rules"; }
for f in "$ROOT"/.claude/agents/*.md; do
  base="$(basename "$f")"; case "$base" in _index*) continue;; esac
  copy_one "$f" "$CO/agents/$base"
done
for f in "$ROOT"/.claude/commands/*.md; do copy_one "$f" "$CO/commands/$(basename "$f")"; done
for f in "$ROOT"/.claude/patterns/cards/*.md; do copy_one "$f" "$CO/patterns/cards/$(basename "$f")"; done
for f in "$ROOT"/.claude/rules/*.md; do copy_one "$f" "$CO/rules/$(basename "$f")"; done
# Rule corpus — domain subdirs (react-19/, next-16/, ...) with atomic severity-tagged rules
for f in "$ROOT"/.claude/rules/*/*.md; do
  [ -e "$f" ] || continue
  rel="${f#$ROOT/.claude/rules/}"
  copy_one "$f" "$CO/rules/$rel"
done

# ── Secret guard — plugin files must carry placeholders only ────────
if grep -REn 'sk-[A-Za-z0-9]{16}|ghp_[A-Za-z0-9]{16}|AKIA[A-Z0-9]{12}' "$ROOT/plugins" 2>/dev/null | grep -v '\${'; then
  echo "ERROR: literal secret detected in plugins/ — aborting"; exit 1
fi

if [ "$CHECK" = 1 ]; then
  [ "$DRIFT" = 0 ] && { echo "plugins in sync with sources"; exit 0; } || { echo "$DRIFT file(s) drifted — run: bash .claude/scripts/build-plugin.sh"; exit 1; }
fi

echo "built kun-stack ($(ls "$STACK/agents" 2>/dev/null | wc -l | tr -d ' ') agents, $(ls -d "$STACK"/skills/*/ 2>/dev/null | wc -l | tr -d ' ') skills) + kun-company ($(ls "$CO/agents" 2>/dev/null | wc -l | tr -d ' ') agents, $(ls "$CO/commands" 2>/dev/null | wc -l | tr -d ' ') commands)"
