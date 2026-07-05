#!/bin/bash
# helper script for fetching a video from URL and feeding it to Higgsfield CLI

set -eo pipefail

show_help() {
  echo "Usage: higgs-tweak.sh --url <video_url> --prompt <tweak_prompt> [options]"
  echo ""
  echo "Options:"
  echo "  --url <url>      Direct URL to the video file to download/fetch"
  echo "  --prompt <text>  Prompt instruction for style swap / tweaks / reference"
  echo "  --model <name>   Higgsfield model (default: seedance_2_0)"
  echo "  --output <path>  Local path to download the generated video to"
  echo "  --help           Show this help menu"
}

# Defaults
MODEL="seedance_2_0"
PROMPT=""
URL=""
OUTPUT_PATH=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --url)
      URL="$2"
      shift 2
      ;;
    --prompt)
      PROMPT="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

if [[ -z "$URL" ]] || [[ -z "$PROMPT" ]]; then
  echo "Error: Both --url and --prompt are required."
  show_help
  exit 1
fi

TEMP_DIR=$(mktemp -d -t higgsfield-XXXXXX)
trap 'rm -rf "$TEMP_DIR"' EXIT

TEMP_FILE="${TEMP_DIR}/input_video.mp4"

echo "Downloading video from: $URL ..."
curl -L -f -o "$TEMP_FILE" "$URL"

echo "Uploading video and starting Higgsfield generation job set ($MODEL)..."
# Executing CLI command and keeping wait option active
if [[ -n "$OUTPUT_PATH" ]]; then
  # Fetch output link, then download
  JOB_URL=$(higgsfield generate create "$MODEL" --video "$TEMP_FILE" --prompt "$PROMPT" --wait --json | jq -r '.output_url // .url // .media_url // empty')
  if [[ -n "$JOB_URL" ]]; then
    echo "Downloading result to $OUTPUT_PATH from $JOB_URL ..."
    curl -L -f -o "$OUTPUT_PATH" "$JOB_URL"
    echo "Success: Saved generated video to $OUTPUT_PATH"
  else
    echo "Error: Failed to retrieve job result URL."
    exit 1
  fi
else
  # Default terminal display
  higgsfield generate create "$MODEL" --video "$TEMP_FILE" --prompt "$PROMPT" --wait
fi
