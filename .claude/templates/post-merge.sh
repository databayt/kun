#!/bin/sh
# kun post-merge hook — after a pull, re-compile the agents' native config when the kun source moved.
# Installed by setup.sh into .git/hooks/post-merge (only if none exists). Never fails the pull.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
C="$ROOT/.claude/scripts/compile/index.mjs"
[ -f "$C" ] && command -v node >/dev/null 2>&1 || exit 0
node "$C" --check --all --quiet >/dev/null 2>&1 && exit 0
node "$C" --all --quiet || true
exit 0
