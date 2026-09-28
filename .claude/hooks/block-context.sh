#!/bin/bash
# UserPromptSubmit — block protocol context injector.
# When the prompt names a block registered in <project>/.claude/blocks.json,
# inject the pre-work reading list (README/ISSUE/CLAUDE + related GitHub issue)
# and the post-work update obligations (records + <block>.mdx + issue).
# Installed at ~/.claude/hooks/block-context.sh; canonical copy in kun.

input=$(cat)
proj="${CLAUDE_PROJECT_DIR:-$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)}"
reg="$proj/.claude/blocks.json"
[ -f "$reg" ] || exit 0

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
