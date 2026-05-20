#!/usr/bin/env bash
# =============================================================================
# Databayt — OS-detect installer dispatcher
# =============================================================================
# Hosted at https://kun.databayt.com/install
# Detects uname and curl-pipes the right platform installer.
#
# Bootstrap (Mac / Linux):
#   curl -fsSL https://kun.databayt.com/install | bash
#
# For Windows, use:
#   iwr https://kun.databayt.com/install.ps1 | iex
# =============================================================================

set -e

REPO_RAW="https://raw.githubusercontent.com/databayt/kun/main"

case "$(uname -s)" in
    Darwin)
        URL="$REPO_RAW/.claude/scripts/installer.sh"
        echo "Detected macOS — launching installer..."
        ;;
    Linux)
        URL="$REPO_RAW/.claude/scripts/installer-linux.sh"
        echo "Detected Linux — launching installer..."
        ;;
    MINGW*|CYGWIN*|MSYS*)
        echo "Detected Windows shell environment." >&2
        echo "Please run from PowerShell instead:" >&2
        echo "  iwr https://kun.databayt.com/install.ps1 | iex" >&2
        exit 1
        ;;
    *)
        echo "Unsupported OS: $(uname -s)" >&2
        echo "Supported: macOS, Linux. For Windows, use install.ps1." >&2
        exit 1
        ;;
esac

# Stream the platform installer through bash. Pass any extra args via $@.
curl -fsSL "$URL" | bash -s -- "$@"
