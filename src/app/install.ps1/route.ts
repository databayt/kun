// Serves the Windows bootstrap shim at https://kun.databayt.org/install.ps1
//   iwr https://kun.databayt.org/install.ps1 | iex
// Canonical copy also lives at web/install.ps1 for reference.

const SHIM = `# Databayt - Windows installer dispatcher
# https://kun.databayt.org/install.ps1
$ErrorActionPreference = "Stop"

$installerUrl = "https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/installer.ps1"

Write-Host "Detected Windows - launching installer..." -ForegroundColor Cyan

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Invoke-WebRequest -UseBasicParsing -Uri $installerUrl | Invoke-Expression
`;

export function GET() {
  return new Response(SHIM, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
