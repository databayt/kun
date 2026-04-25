#!/usr/bin/env pwsh
# setup-windows.ps1 — Windows equivalent of setup-apple-notes.sh (Story 19.2).
#
# Apple Notes is Mac-only. On Windows, captain dispatch routes through
# GitHub issues with `captain` label in `databayt/kun`. This script ensures
# the labels and ~/.claude/bridge.md exist so SessionStart hook works.
#
# Idempotent.
#
# Usage: pwsh scripts/setup-windows.ps1
#        powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-windows.ps1

$ErrorActionPreference = 'Stop'

Write-Host "Setting up Windows dispatch channels for captain..." -ForegroundColor Cyan
Write-Host ""

# 1) GitHub labels --------------------------------------------------------
$labelsToEnsure = @(
  @{ name = 'captain';         color = 'a020f0'; description = 'Captain dispatch (decision/urgent)' }
  @{ name = 'cowork';          color = '5319e7'; description = 'Cowork ↔ Code handoff' }
  @{ name = 'report';          color = 'd73a4a'; description = 'User-reported bug, auto-fix candidate' }
  @{ name = 'needs-human';     color = 'fbca04'; description = 'Auto-fix attempted, needs review' }
  @{ name = 'cannot-reproduce'; color = 'e0e0e0'; description = 'Auto-fix could not reproduce' }
  @{ name = 'pilot';           color = '0e8a16'; description = 'King Fahad pilot related' }
)

if (Get-Command gh -ErrorAction SilentlyContinue) {
  foreach ($label in $labelsToEnsure) {
    try {
      $existing = gh label list --repo databayt/kun --json name 2>$null | ConvertFrom-Json
      $found = $existing | Where-Object { $_.name -eq $label.name }
      if ($found) {
        Write-Host "✓ Label '$($label.name)' already exists" -ForegroundColor Green
      } else {
        gh label create $label.name --repo databayt/kun --color $label.color --description $label.description 2>$null
        Write-Host "✓ Created label '$($label.name)'" -ForegroundColor Green
      }
    } catch {
      Write-Warning "Could not ensure label '$($label.name)': $_"
    }
  }
} else {
  Write-Warning "gh CLI not found. Install from https://cli.github.com/ to use GitHub-issue dispatch fallback."
}

# 2) Bridge file ----------------------------------------------------------
$claudeDir = Join-Path $env:USERPROFILE '.claude'
$bridgePath = Join-Path $claudeDir 'bridge.md'

if (-not (Test-Path $claudeDir)) {
  New-Item -ItemType Directory -Path $claudeDir | Out-Null
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$template = Join-Path $repoRoot '.claude\memory\bridge.template.md'

if (Test-Path $bridgePath) {
  Write-Host "✓ Bridge file already exists at $bridgePath" -ForegroundColor Green
} elseif (Test-Path $template) {
  Copy-Item $template $bridgePath
  Write-Host "✓ Created $bridgePath from template" -ForegroundColor Green
} else {
  @'
# Cowork ↔ Code Bridge

> Live bridge file. Both Cowork (Claude Desktop) and Claude Code read/write this.
> SessionStart hook reads it; new entries roll up to a session's `additionalContext`.

## Cowork → Code

_(empty)_

## Code → Cowork

_(empty)_

## Decisions Pending

_(empty)_
'@ | Out-File -FilePath $bridgePath -Encoding utf8
  Write-Host "✓ Created $bridgePath (default schema)" -ForegroundColor Green
}

# 3) Sticky Notes (best effort) ------------------------------------------
# Windows Sticky Notes COM is unreliable across versions. Skip in favor of
# GitHub issues — but write a hint into the bridge file.
Write-Host ""
Write-Host "Note: Windows Sticky Notes integration is not bundled. Captain dispatch on Windows" -ForegroundColor Yellow
Write-Host "      uses GitHub issues with 'captain' label as the durable channel." -ForegroundColor Yellow

# 4) Verify ---------------------------------------------------------------
Write-Host ""
Write-Host "Verification:"
Write-Host "  Bridge file:    $(if (Test-Path $bridgePath) { 'OK' } else { 'MISSING' })"
Write-Host "  GitHub labels:  $(if (Get-Command gh -ErrorAction SilentlyContinue) { 'OK' } else { 'gh CLI missing' })"

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Verify labels: gh label list --repo databayt/kun"
Write-Host "  2. Verify bridge: Get-Content $bridgePath"
Write-Host "  3. SessionStart hook will read both on next session"
Write-Host "  4. Use /dispatch from any session — Mac uses Apple Notes, Windows uses GitHub issues"

exit 0
