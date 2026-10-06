#!/usr/bin/env bash
# HyperFrames CLI through the installed plugin's pinned launcher (never `npx hyperframes`).
# Run from the composition's project directory:
#   hf.sh check | hf.sh snapshot --at 1,3 | hf.sh preview --background | hf.sh render
set -euo pipefail
. "$(dirname "$0")/lib.sh"

root="$(hf_plugin_root)"
[ -n "$root" ] || { echo "hyperframes plugin missing — run setup.sh" >&2; exit 2; }
[ "${1:-}" = render ] && disk_guard
exec node "$root/skills/hyperframes/scripts/plugin-cli.mjs" "$@"
