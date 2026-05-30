#!/usr/bin/env bash
# session-start-kun-drift.sh
#
# Warn at SessionStart when ~/kun is behind origin/main. Never auto-pulls —
# the teammate decides when to refresh (respects the anti-auto-update rule
# from content/docs/mcp.mdx for MCP versions; same posture for engine config).
#
# Fires from ~/.claude/settings.json SessionStart hook chain. Silent on:
#   - no ~/kun checkout
#   - no network / offline fetch
#   - already up to date
#
# Distributed via .claude/scripts/setup.sh which copies .claude/hooks/* into
# ~/.claude/hooks/ on every install or update.

set +e  # never abort the session start on any failure

# Skip if ~/kun isn't a git checkout (e.g. fresh machine before bootstrap)
[ -d "$HOME/kun/.git" ] || exit 0

cd "$HOME/kun" || exit 0

# Fetch in background-friendly way; silent on network failure (laptop on plane)
git fetch origin main --quiet 2>/dev/null || exit 0

behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")

if [[ "$behind" -gt 0 ]]; then
    # One-line warning surfaced in the Claude Code session header
    plural="commit"
    [[ "$behind" -gt 1 ]] && plural="commits"
    echo "⚠️  ~/kun is $behind $plural behind origin/main — run \`c /update\` to refresh engine + repos"
fi
