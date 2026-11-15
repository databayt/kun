#!/bin/bash
# Stop — delegate nudge ("Opus plans, lanes build").
# If the main loop (Opus) itself made 4+ Edit/Write/NotebookEdit calls across 2+ distinct
# code/config files this turn and never called the Agent tool, nudge ONCE: build work that
# touches 2+ files goes to a sonnet build agent with a written brief (rule: delegation.md).
# Non-blocking: a systemMessage to Abdout, never {"decision":"block"} — a forced extra Opus turn
# would spend the tokens the nudge exists to save. Only the current turn (after the last real
# user message) and only main-loop entries (isSidechain true is skipped) are counted; .md/.mdx
# docs, ~/.claude/plans/ and memory dirs don't count.
# Skips: KUN_HEADLESS set, KUN_DELEGATE_NUDGE=0, stop_hook_active, jq missing, any parse error.
# Thresholds: DELEGATE_NUDGE_EDITS (default 4), DELEGATE_NUDGE_FILES (default 2).
# Installed at ~/.claude/hooks/delegate-nudge.sh; canonical copy in kun. Always exits 0.

[ -n "${KUN_HEADLESS:-}" ] && exit 0
[ "${KUN_DELEGATE_NUDGE:-}" = "0" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

INPUT="$(cat)"
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0
T="$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)"
[ -n "$T" ] && [ -f "$T" ] || exit 0

RES="$(tail -n 4000 "$T" 2>/dev/null | jq -R 'fromjson? // empty' 2>/dev/null | jq -s -r '
  def blocks: (.message.content // []) | if type == "array" then . else [] end;
  def real_user: .type == "user" and (.isSidechain != true) and (.isMeta != true)
    and ((.message.content | type) == "string"
         or ([blocks[] | select(.type == "text")] | length) > 0);
  . as $all
  | ([range(0; $all | length) | select($all[.] | real_user)] | last // -1) as $i
  | [$all[($i + 1):][] | select(.type == "assistant" and .isSidechain != true) | blocks[] | select(.type == "tool_use")] as $tu
  | [$tu[] | select(.name == "Edit" or .name == "Write" or .name == "NotebookEdit")
      | (.input.file_path // .input.notebook_path // "")
      | select(. != "")
      | select(test("\\.mdx?$") | not)
      | select(test("/\\.claude/plans/|/memory/") | not)] as $e
  | "\($e | length) \($e | unique | length) \([$tu[] | select(.name == "Agent")] | length)"
' 2>/dev/null)" || exit 0

read -r EDITS FILES AGENTS <<<"$RES"
case "$EDITS$FILES$AGENTS" in ''|*[!0-9]*) exit 0 ;; esac

if [ "$EDITS" -ge "${DELEGATE_NUDGE_EDITS:-4}" ] && [ "$FILES" -ge "${DELEGATE_NUDGE_FILES:-2}" ] && [ "$AGENTS" -eq 0 ]; then
  jq -n --arg r "delegate-nudge: $EDITS edits across $FILES files ran on the main loop (Opus) — build work goes to a sonnet build agent with a written brief (rule: delegation.md)" \
    '{systemMessage: $r}'
fi
exit 0
