#!/usr/bin/env bash
# delegate-nudge.test.sh — the nudge fires on 4+ main-loop code edits across 2+ files with no
# Agent call, and stays silent otherwise.
#
#   bash .claude/hooks/delegate-nudge.test.sh        exit 0 = all pass
set -uo pipefail
HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/delegate-nudge.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fail=0

user()  { echo '{"type":"user","message":{"role":"user","content":"do the thing"}}'; }
result(){ echo '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"x","content":"ok"}]}}'; }
tool()  { # <name> <file_path> [sidechain]
  jq -nc --arg n "$1" --arg p "$2" --argjson s "${3:-false}" \
    '{type:"assistant",isSidechain:$s,message:{role:"assistant",content:[{type:"tool_use",name:$n,input:{file_path:$p}}]}}'; }
agent() { echo '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Agent","input":{"subagent_type":"general-purpose","model":"sonnet"}}]}}'; }
edits() { for f in a.ts b.ts c.ts a.ts b.ts; do tool Edit "/r/$f"; result; done; }

check() { # <name> <want fire|quiet> <transcript> [env...]
  local name="$1" want="$2" t="$3"; shift 3
  local out; out=$(printf '{"transcript_path":"%s","stop_hook_active":%s}' "$t" "${SHA:-false}" | env "$@" bash "$HOOK" 2>/dev/null); local rc=$?
  local got=quiet; [[ "$out" == *"delegate-nudge: 5 edits across 3 files"* ]] && got=fire
  if [ "$rc" = 0 ] && [ "$got" = "$want" ]; then echo "ok   $name"; else echo "FAIL $name (want $want got $got rc=$rc) $out"; fail=1; fi
}

{ user; edits; } > "$TMP/fire.jsonl"
{ user; edits; agent; } > "$TMP/agent.jsonl"
{ user; for f in a.md b.mdx c.md a.md b.md; do tool Write "/r/$f"; result; done; } > "$TMP/md.jsonl"
{ user; edits; user; tool Edit /r/a.ts; result; } > "$TMP/newturn.jsonl"
{ user; for f in a.ts b.ts c.ts a.ts b.ts; do tool Edit "/r/$f" true; done; } > "$TMP/side.jsonl"
{ user; for i in 1 2 3 4 5; do tool Edit /r/a.ts; done; } > "$TMP/onefile.jsonl"
echo 'not json{' > "$TMP/junk.jsonl"

check "fires: 5 edits, 3 files, no agent"   fire  "$TMP/fire.jsonl"    X=1
check "quiet: an Agent call exists"         quiet "$TMP/agent.jsonl"   X=1
check "quiet: .md/.mdx-only edits"          quiet "$TMP/md.jsonl"      X=1
check "quiet: headless"                     quiet "$TMP/fire.jsonl"    KUN_HEADLESS=1
check "quiet: disabled by env"              quiet "$TMP/fire.jsonl"    KUN_DELEGATE_NUDGE=0
SHA=true check "quiet: stop_hook_active"    quiet "$TMP/fire.jsonl"    X=1
check "quiet: earlier turn only"            quiet "$TMP/newturn.jsonl" X=1
check "quiet: sidechain edits"              quiet "$TMP/side.jsonl"    X=1
check "quiet: one file only"                quiet "$TMP/onefile.jsonl" X=1
check "quiet: garbage transcript"           quiet "$TMP/junk.jsonl"    X=1
check "quiet: missing transcript"           quiet "$TMP/none.jsonl"    X=1
exit $fail
