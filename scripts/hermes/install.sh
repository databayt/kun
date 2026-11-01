#!/usr/bin/env bash
# install.sh — put kun's Hermes pieces on this Mac.
#
#   bash scripts/hermes/install.sh
#
# Copies every skill under scripts/hermes/skills/<name>/ to
# ~/.hermes/skills/databayt/<name>/ (Hermes reads skills only from its own home; the
# canonical copy lives here, in kun). The bridge itself, scripts/hermes/claude.sh, is
# called in place by absolute path, so it needs no copy. Hermes picks new skills up on
# a new session: send /new in the Slack DM, or restart with `hermes gateway restart`.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${HERMES_HOME:-$HOME/.hermes}/skills/databayt"
mkdir -p "$DEST"
chmod +x "$HERE/claude.sh"
for dir in "$HERE"/skills/*/; do
  name="$(basename "$dir")"
  mkdir -p "$DEST/$name"
  cp "$dir/SKILL.md" "$DEST/$name/SKILL.md"
  echo "installed Hermes skill $name → $DEST/$name/SKILL.md"
done
