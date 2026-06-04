#!/usr/bin/env bash
# block-destructive-bash.sh — PreToolUse(Bash) safety guard for the kun engine.
#
# Reads the hook JSON on stdin, extracts .tool_input.command, and exits 2 — which
# BLOCKS the tool call and surfaces stderr back to Claude — when the command
# matches an irreversible / data-destroying pattern. Exit 0 = allow.
#
# This ENFORCES, as a gate, what the prisma-6 "no destructive migrations" rule and
# the permission deny-list only advise. It is a safety net, not a sandbox: patterns
# are intentionally narrow so routine work (rm -rf node_modules, .next, dist) is
# never blocked — only catastrophic forms (rm -rf / , ~, *, .) and history/data
# destruction are. Tune the PATTERNS array below if a real command is wrongly hit.
#
# Canonical source: .claude/hooks/. Wired into project .claude/settings.json via
# ${CLAUDE_PROJECT_DIR}, and bundled into the kun-company plugin via
# ${CLAUDE_PLUGIN_ROOT} so it travels with installs.

set -uo pipefail

json="$(cat)"
cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && cmd="$json" # fallback when jq is unavailable: scan raw payload

# reason@@extended-regex  (single-quoted so every regex metachar is literal).
# Matched case-insensitively against the command string.
PATTERNS=(
  'rm -rf on / , ~, *, or .  (routine targets like node_modules are allowed)@@rm[[:space:]]+-[a-z]*[rf][a-z]*[[:space:]]+(/|~|\*|\.{1,2})([[:space:]]|$)'
  'prisma migrate reset — drops every table on the connected DB@@prisma[[:space:]]+migrate[[:space:]]+reset'
  'prisma db push --accept-data-loss — silent column/table drops@@--accept-data-loss'
  'git reset --hard — discards uncommitted local work@@git[[:space:]]+reset[[:space:]]+--hard'
  'git clean -f… — deletes untracked files irrecoverably@@git[[:space:]]+clean[[:space:]]+-[a-z]*f'
  'force push — rewrites shared history (use --force-with-lease)@@git[[:space:]]+push[[:space:]].*(--force([[:space:]]|$)|-f([[:space:]]|$))'
  'destructive SQL — DROP/TRUNCATE destroys data@@(drop[[:space:]]+(table|database)|truncate[[:space:]]+table)'
)

for entry in "${PATTERNS[@]}"; do
  reason="${entry%%@@*}"
  regex="${entry##*@@}"
  if printf '%s' "$cmd" | grep -Eiq -e "$regex"; then # -e: patterns may start with --
    {
      echo "⛔ kun safety hook blocked a destructive command."
      echo "   Reason : $reason"
      echo "   Command: $cmd"
      echo "   If this is intentional, run it in a plain terminal or edit .claude/hooks/block-destructive-bash.sh."
    } >&2
    exit 2
  fi
done

exit 0
