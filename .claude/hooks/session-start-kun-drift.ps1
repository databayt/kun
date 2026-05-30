# session-start-kun-drift.ps1
#
# Windows variant of session-start-kun-drift.sh — warn at SessionStart when
# ~/kun is behind origin/main. Never auto-pulls.
#
# Distributed via .claude/scripts/setup.ps1 which copies .claude/hooks/* into
# %USERPROFILE%\.claude\hooks\ on every install or update.

$ErrorActionPreference = "SilentlyContinue"

$KunDir = "$env:USERPROFILE\kun"

# Skip if ~/kun isn't a git checkout (e.g. fresh machine before bootstrap)
if (-not (Test-Path "$KunDir\.git")) { exit 0 }

Push-Location $KunDir

# Fetch silently; bail on network failure (laptop on plane)
git fetch origin main --quiet 2>$null
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 0 }

$behind = (git rev-list --count HEAD..origin/main 2>$null)
if (-not $behind) { $behind = 0 }

Pop-Location

if ([int]$behind -gt 0) {
    $plural = if ([int]$behind -gt 1) { "commits" } else { "commit" }
    Write-Host "WARN: ~/kun is $behind $plural behind origin/main - run 'c /update' to refresh engine + repos" -ForegroundColor Yellow
}
