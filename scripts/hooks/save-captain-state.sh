#!/usr/bin/env bash
# PreCompact hook — snapshot captain state before context compaction so nothing
# strategic is lost. Story 22.7 in docs/EPICS-V4.md.
#
# Stdin: { "session_id":"...", "hook_event_name":"PreCompact", "trigger":"manual|auto" }

trap 'exit 0' ERR

mem_dir="${HOME}/.claude/projects/-Users-abdout-kun/memory"
mkdir -p "$mem_dir" 2>/dev/null
project_mem="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/memory"

if [ -f "${project_mem}/captain-state.json" ]; then
  cp "${project_mem}/captain-state.json" "${mem_dir}/captain-state-pre-compact.json" 2>/dev/null
fi

if [ -f "${HOME}/.claude/projects/-Users-abdout-kun/memory/captain_journal.md" ]; then
  ts=$(date -u '+%Y-%m-%dT%H-%M-%SZ')
  cp "${HOME}/.claude/projects/-Users-abdout-kun/memory/captain_journal.md" \
     "${mem_dir}/captain_journal-pre-compact-${ts}.md" 2>/dev/null
fi

exit 0
