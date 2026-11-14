#!/bin/bash
# UserPromptSubmit — kun's router: names in a prompt → repos and blocks.
# Since 2026-11-01 the work is done by .claude/scripts/resolve.mjs, one node process over
# a prebuilt index (~/.claude/kun-index.json) instead of ~150 jq/grep calls per prompt:
#   - a block of THIS repo (its .claude/blocks.json) → the block protocol below, byte for byte;
#     a repo on the light protocol (blocks.json → protocol: "light") gets one <kun-route> line,
#     and only for a block that already has records
#   - another repo by name (hogwarts, mkan, balqalam…) or a block whose class is `unique`
#     (computed when the index is built; engine.json → resolver.always_bare promotes a plain
#     word) → a one-line <kun-route> pointer
# Without node or the index, the original bash logic below still runs. Always exits 0.
# Installed at ~/.claude/hooks/block-context.sh; canonical copy in kun.

[ -n "${KUN_HEADLESS:-}" ] && exit 0   # headless `claude -p` (kun-claude.sh): context hooks stay silent — nobody reads them, every token is paid
input=$(cat)
RESOLVE="${KUN_DIR:-$HOME/kun}/.claude/scripts/resolve.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$RESOLVE" ] && [ -f "$HOME/.claude/kun-index.json" ]; then
  printf '%s' "$input" | node "$RESOLVE" --hook 2>/dev/null
  exit 0
fi
# ── fallback: the original block protocol (no node / no index) ─────────────
proj="${CLAUDE_PROJECT_DIR:-$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)}"
reg="$proj/.claude/blocks.json"
[ -f "$reg" ] || exit 0
[ "$(jq -r '.protocol // "full"' "$reg" 2>/dev/null)" = "light" ] && exit 0   # light repos get their one-liners from resolve.mjs only

prompt=$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null | tr '[:upper:]' '[:lower:]')
[ -n "$prompt" ] || exit 0

# Match registered block keywords (word-boundary, optional plural, hyphen or
# space form: "parent-portal" matches "parent portal"). Longest keys first,
# capped at 3 so generic words can't flood the context.
matched=""
count=0
for key in $(jq -r '.blocks | keys[]' "$reg" | awk '{ print length, $0 }' | sort -rn | cut -d' ' -f2-); do
  [ "$count" -ge 3 ] && break
  spaced="${key//-/ }"
  if printf '%s' "$prompt" | grep -qiE "\b(${key}|${spaced})s?\b"; then
    matched="$matched $key"
    count=$((count + 1))
  fi
done
[ -n "$matched" ] || exit 0

for key in $matched; do
  path=$(jq -r ".blocks[\"$key\"].path" "$reg")
  context=$(jq -r ".blocks[\"$key\"].context | join(\", \")" "$reg")
  docs=$(jq -r ".blocks[\"$key\"].docs | join(\" + \")" "$reg")
  echo "<block-protocol block=\"$key\" path=\"$path\">"
  echo "This prompt touches the registered block '$key'. Unless this is a quick small task (typo-level, single-line, pure question):"
  echo "BEFORE starting:"
  if [ -n "$context" ]; then
    echo "1. Read the block records: $(for f in $(jq -r ".blocks[\"$key\"].context[]" "$reg"); do printf '%s/%s ' "$path" "$f"; done)"
  else
    echo "1. Block has no records yet (no README.md/ISSUE.md/CLAUDE.md in $path) — plan to create README.md when finishing substantial work."
  fi
  echo "2. Check related GitHub issues: gh issue list --search \"$key\" --state open"
  echo "AFTER the work is done:"
  echo "1. Update the block records ($path/{README.md,ISSUE.md,CLAUDE.md}) to reflect what changed — status, decisions, known issues."
  if [ -n "$docs" ]; then
    echo "2. Update the block docs: $docs"
  else
    echo "2. No <block>.mdx docs page exists — create one under the repo's docs content dir if the change is user-facing."
  fi
  echo "3. Comment the outcome on the related GitHub issue (close it if resolved)."
  echo "</block-protocol>"
done
exit 0
