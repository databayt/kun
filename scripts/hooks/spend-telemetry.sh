#!/usr/bin/env bash
# Stop hook — append per-session token counts to spend.jsonl.
# Story 28.1 in docs/EPICS-V4.md.
#
# Stdin: { "session_id":"...", "transcript_path":"...", "hook_event_name":"Stop", ... }
# Reads transcript JSONL to extract token usage from message metadata.
# Output: stdout consumed by Claude Code (no decision return needed).

trap 'exit 0' ERR

mem_dir="${HOME}/.claude/projects/-Users-abdout-kun/memory"
mkdir -p "$mem_dir" 2>/dev/null
out="${mem_dir}/spend.jsonl"

# Read stdin
input=$(cat)

session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)
transcript=$(echo "$input" | jq -r '.transcript_path // empty' 2>/dev/null)
ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Default zero values; populate if transcript is parseable.
input_tokens=0
output_tokens=0
cache_read_tokens=0
cache_creation_tokens=0
model="unknown"

if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  # Transcript is JSONL; each line is a message. Look for usage metadata.
  # Anthropic transcripts include input_tokens / output_tokens / cache_*_tokens / model per message.
  if command -v jq >/dev/null 2>&1; then
    input_tokens=$(jq -s '
      [.[] | .usage?.input_tokens // 0] | add // 0
    ' "$transcript" 2>/dev/null || echo 0)
    output_tokens=$(jq -s '
      [.[] | .usage?.output_tokens // 0] | add // 0
    ' "$transcript" 2>/dev/null || echo 0)
    cache_read_tokens=$(jq -s '
      [.[] | .usage?.cache_read_input_tokens // 0] | add // 0
    ' "$transcript" 2>/dev/null || echo 0)
    cache_creation_tokens=$(jq -s '
      [.[] | .usage?.cache_creation_input_tokens // 0] | add // 0
    ' "$transcript" 2>/dev/null || echo 0)
    model=$(jq -s -r '
      [.[] | .model // empty] | last // "unknown"
    ' "$transcript" 2>/dev/null || echo "unknown")
  fi
fi

# Compute approximate cost in USD
# Pricing (per MTok input / output as of 2026-04):
#   opus-4.7   $5.00 / $25.00
#   sonnet-4.6 $3.00 / $15.00
#   haiku-4.5  $1.00 / $5.00
# Cached read: same as input but discounted 90%
case "$model" in
  *opus*)    in_rate=5.0; out_rate=25.0 ;;
  *sonnet*)  in_rate=3.0; out_rate=15.0 ;;
  *haiku*)   in_rate=1.0; out_rate=5.0 ;;
  *)         in_rate=3.0; out_rate=15.0 ;;  # default to sonnet
esac

# total_usd = (input + cache_creation) × in_rate + cache_read × in_rate × 0.1 + output × out_rate, all per million
if command -v bc >/dev/null 2>&1; then
  total_usd=$(echo "scale=6; (($input_tokens + $cache_creation_tokens) * $in_rate + $cache_read_tokens * $in_rate * 0.1 + $output_tokens * $out_rate) / 1000000" | bc -l 2>/dev/null || echo 0)
else
  total_usd=0
fi

# Append the record
if command -v jq >/dev/null 2>&1; then
  jq -c -n \
    --arg ts "$ts" \
    --arg sid "$session_id" \
    --arg model "$model" \
    --argjson input "$input_tokens" \
    --argjson output "$output_tokens" \
    --argjson cache_read "$cache_read_tokens" \
    --argjson cache_creation "$cache_creation_tokens" \
    --argjson cost "$total_usd" \
    '{
      ts: $ts,
      session_id: $sid,
      model: $model,
      tokens: {
        input: $input,
        output: $output,
        cache_read: $cache_read,
        cache_creation: $cache_creation
      },
      total_usd: $cost
    }' >> "$out" 2>/dev/null
fi

# Also keep the existing session log line for backward compat
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session ended (tokens: in=$input_tokens out=$output_tokens, ~\$$total_usd)" >> ~/.claude/session-log.txt 2>/dev/null

exit 0
