#!/usr/bin/env bash
# setup-routines.sh — Print the steps to register kun's Anthropic Routines.
# Story 17.2-17.5, 18.3, 23.3, 23.4 in docs/EPICS-V4.md.
#
# Routines must be created manually at https://claude.ai/code/routines
# (or via /schedule from the CLI). This script prints the exact prompts +
# config to use for each.
#
# Usage: bash scripts/setup-routines.sh [--list | --show <id>]

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${REPO_ROOT}/.claude/routines/manifest.json"

[ -f "$MANIFEST" ] || { echo "fatal: $MANIFEST not found" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "fatal: jq required" >&2; exit 1; }

cmd="${1:-list}"

case "$cmd" in
  --list|list)
    echo "Routines defined in $MANIFEST:"
    echo
    jq -r '.routines[] |
      "  \(.id) — \(.name)" +
      "    Schedule: \(.schedule.cadence // "github trigger") @ \(.schedule.at // "—") \(.schedule.timezone // "")" +
      "    Repos:    \(.repos | join(", "))" +
      "    Model:    \(.model)" +
      "    Status:   \(.status)" +
      ""' "$MANIFEST"
    echo
    echo "Total routines: $(jq -r '.routines | length' "$MANIFEST")"
    echo "Estimated monthly cost: \$$(jq -r '.totals.estimatedMonthlyCost' "$MANIFEST")"
    echo
    echo "To see the prompt for a routine: bash $0 --show <id>"
    echo "To register: open https://claude.ai/code/routines or run /schedule in CLI"
    ;;

  --show)
    id="${2:-}"
    [ -z "$id" ] && { echo "usage: $0 --show <routine-id>"; exit 1; }
    prompt_file=$(jq -r --arg id "$id" '.routines[] | select(.id == $id) | .promptFile' "$MANIFEST")
    if [ -z "$prompt_file" ] || [ "$prompt_file" = "null" ]; then
      echo "Unknown routine: $id"
      bash "$0" --list
      exit 1
    fi
    echo "=== Routine: $id ==="
    echo
    jq --arg id "$id" '.routines[] | select(.id == $id)' "$MANIFEST"
    echo
    echo "=== Prompt (copy/paste into claude.ai/code/routines) ==="
    echo
    cat "${REPO_ROOT}/${prompt_file}"
    ;;

  --register-all-via-cli)
    echo "Note: /schedule CLI only supports schedule triggers, not GitHub events."
    echo "GitHub-triggered routines must be registered at claude.ai/code/routines."
    echo
    echo "For each schedule routine, run in claude CLI:"
    jq -r '.routines[] | select(.schedule != null) |
      "  /schedule \(.schedule.cadence) at \(.schedule.at) \(.schedule.timezone) — see " + .promptFile' \
      "$MANIFEST"
    ;;

  *)
    echo "Usage: $0 [--list | --show <id> | --register-all-via-cli]"
    exit 1
    ;;
esac

exit 0
