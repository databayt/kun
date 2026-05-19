# Apply -Fix repairs to shell-related issues: $PROFILE creation, c function, PATH prepend.
# Each function is idempotent.

. "$PSScriptRoot\Common.ps1"

$script:ProfileBlock = @'

# Claude Code (Kun Engine) — added by doctor -Fix
function c  { claude --dangerously-skip-permissions $args }
function cc { claude $args }
if (Test-Path "$env:USERPROFILE\.claude\.env") {
    Get-Content "$env:USERPROFILE\.claude\.env" | ForEach-Object {
        if ($_ -and -not $_.StartsWith("#")) {
            $parts = $_ -split "=", 2
            if ($parts.Length -eq 2) {
                [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
            }
        }
    }
}
$env:Path = "$env:USERPROFILE\.claude\bin;" + $env:Path
'@

function Repair-Profile {
    $profilePath = $PROFILE.CurrentUserAllHosts

    # Ensure file exists
    if (-not (Test-Path $profilePath)) {
        $dir = Split-Path $profilePath -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        New-Item -ItemType File -Force -Path $profilePath | Out-Null
        Write-Host "  Created $profilePath" -ForegroundColor Green
    }

    # Append block only if not present
    $content = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($content -match 'function\s+c\s*\{[^}]*claude\s+--dangerously-skip-permissions') {
        Write-Host "  c function already present — no change" -ForegroundColor Gray
        return $false
    }

    Add-Content -Path $profilePath -Value $script:ProfileBlock
    Write-Host "  Appended c/cc block to $profilePath" -ForegroundColor Green
    Write-Host "  Open a new PowerShell or run: . `$PROFILE.CurrentUserAllHosts" -ForegroundColor Yellow
    $true
}
