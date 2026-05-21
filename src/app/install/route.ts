// Serves the OS-detect bootstrap shim at https://kun.databayt.org/install
//   curl -fsSL https://kun.databayt.org/install | bash
// Canonical copy also lives at web/install.sh for reference.

const SHIM = `#!/usr/bin/env bash
# Databayt — OS-detect installer dispatcher
# https://kun.databayt.org/install
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
        echo "  iwr https://kun.databayt.org/install.ps1 | iex" >&2
        exit 1
        ;;
    *)
        echo "Unsupported OS: $(uname -s)" >&2
        echo "Supported: macOS, Linux. For Windows, use install.ps1." >&2
        exit 1
        ;;
esac

curl -fsSL "$URL" | bash -s -- "$@"
`;

export function GET() {
  return new Response(SHIM, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
