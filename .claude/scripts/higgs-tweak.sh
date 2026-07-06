#!/bin/bash
# Download a reference video from a URL and restyle it through Higgsfield.
# Only the seedance family accepts --video-references; default is the mini tier
# (12.5 cr) — pass --premium for seedance_2_0 (22.5 cr, 1080p/4k, audio).

set -eo pipefail

show_help() {
  echo "Usage: higgs-tweak.sh --url <video_url> --prompt <tweak_prompt> [options]"
  echo ""
  echo "Options:"
  echo "  --url <url>      Direct URL to the reference video to download"
  echo "  --prompt <text>  Restyle / tweak instruction"
  echo "  --model <name>   Higgsfield model (default: seedance_2_0_mini)"
  echo "  --premium        Shortcut for --model seedance_2_0"
  echo "  --duration <s>   Clip duration seconds (default: 5)"
  echo "  --resolution <r> 480p|720p (mini) / up to 4k (premium) (default: 720p)"
  echo "  --output <path>  Output file (default: ~/Downloads/higgs/<date>-tweak.mp4)"
  echo "  --estimate       Print the credit cost and exit without generating"
  echo "  --help           Show this help menu"
}

MODEL="seedance_2_0_mini"
PROMPT=""
URL=""
DURATION="5"
RESOLUTION="720p"
OUTPUT_PATH=""
ESTIMATE_ONLY=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --url)        URL="$2"; shift 2 ;;
    --prompt)     PROMPT="$2"; shift 2 ;;
    --model)      MODEL="$2"; shift 2 ;;
    --premium)    MODEL="seedance_2_0"; shift ;;
    --duration)   DURATION="$2"; shift 2 ;;
    --resolution) RESOLUTION="$2"; shift 2 ;;
    --output)     OUTPUT_PATH="$2"; shift 2 ;;
    --estimate)   ESTIMATE_ONLY="1"; shift ;;
    -h|--help)    show_help; exit 0 ;;
    *) echo "Unknown option: $1"; show_help; exit 1 ;;
  esac
done

if [[ -z "$URL" ]] || [[ -z "$PROMPT" ]]; then
  echo "Error: Both --url and --prompt are required."
  show_help
  exit 1
fi

command -v jq >/dev/null || { echo "Error: jq is required (brew install jq)."; exit 1; }

# Preflight: authed + workspace selected, and show the balance we're spending from
if ! STATUS=$(higgsfield account status 2>&1); then
  echo "Higgsfield not ready: $STATUS"
  echo "Fix: higgsfield auth login && higgsfield workspace set <workspace_id>"
  exit 1
fi
echo "Account: $STATUS"

if [[ -z "$OUTPUT_PATH" ]]; then
  mkdir -p "$HOME/Downloads/higgs"
  OUTPUT_PATH="$HOME/Downloads/higgs/$(date +%F)-tweak-$$.mp4"
fi

TEMP_DIR=$(mktemp -d -t higgsfield-XXXXXX)
trap 'rm -rf "$TEMP_DIR"' EXIT
TEMP_FILE="${TEMP_DIR}/input_video.mp4"

echo "Downloading reference: $URL"
curl -L -f -o "$TEMP_FILE" "$URL"

echo "Estimated cost:"
higgsfield generate cost "$MODEL" --prompt "$PROMPT" --duration "$DURATION" --resolution "$RESOLUTION" || true
[[ -n "$ESTIMATE_ONLY" ]] && exit 0

echo "Generating with $MODEL (${DURATION}s, ${RESOLUTION})..."
RESULT_JSON=$(higgsfield generate create "$MODEL" \
  --video "$TEMP_FILE" \
  --prompt "$PROMPT" \
  --duration "$DURATION" \
  --resolution "$RESOLUTION" \
  --wait --wait-timeout 25m --json)

# Jobs come back as an array; completed jobs carry result_url (full-res) + min_result_url
RESULT_URL=$(echo "$RESULT_JSON" | jq -r '(if type=="array" then .[0] else . end) | .result_url // empty')

if [[ -z "$RESULT_URL" ]]; then
  echo "Error: no result_url in job response. Raw response:"
  echo "$RESULT_JSON" | jq . 2>/dev/null || echo "$RESULT_JSON"
  exit 1
fi

echo "Downloading result -> $OUTPUT_PATH"
curl -L -f -o "$OUTPUT_PATH" "$RESULT_URL"
echo "Success: $OUTPUT_PATH"
higgsfield account status 2>/dev/null | tail -1 || true
