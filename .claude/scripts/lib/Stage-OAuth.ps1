# OAuth batch: walk through 3 sign-ins in sequence with beep + toast on each.

. "$PSScriptRoot\Bootstrap-Common.ps1"

function Wait-EnterKey {
    param([string]$Prompt = 'Press Enter to continue...')
    Write-Host ''
    Write-Host $Prompt -ForegroundColor Yellow -NoNewline
    Read-Host | Out-Null
}

function Invoke-OAuthBatch {
    param([switch]$Skip)
    if ($Skip) {
        Write-Host '  -SkipOAuth set — leaving sign-ins to the user' -ForegroundColor Gray
        return $true
    }

    Invoke-AttentionBell
    # Try to bring window forward
    try {
        Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue
    } catch { }

    Write-Host ''
    Write-Host '── OAuth batch: 3 sign-ins, ~5 minutes ─────────────────' -ForegroundColor Magenta
    Write-Host '   Browser tabs open one at a time. Press Enter between each.'
    Wait-EnterKey -Prompt 'Press Enter to begin OAuth...'

    # 1. GitHub via gh
    Write-Host ''
    Write-Host '   [1/3] GitHub' -ForegroundColor Cyan
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) {
        Write-Host '         gh CLI missing — skipping GitHub auth' -ForegroundColor Red
    } else {
        $authStatus = gh auth status 2>&1 | Out-String
        if ($authStatus -match 'Logged in') {
            Write-Host '         ✅ already logged in — skipping' -ForegroundColor Green
        } else {
            Write-Host '         Running: gh auth login --web --git-protocol https'
            gh auth login --web --git-protocol https --hostname github.com
            if ($LASTEXITCODE -eq 0) {
                Write-Host '         ✅ GitHub authenticated' -ForegroundColor Green
            } else {
                Write-Host '         ⚠️  gh auth incomplete — finish manually after bootstrap' -ForegroundColor Yellow
            }
        }
    }

    # 2. Claude CLI
    Write-Host ''
    Write-Host '   [2/3] Claude' -ForegroundColor Cyan
    $claude = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claude) {
        Write-Host '         claude CLI missing — skipping' -ForegroundColor Red
    } else {
        $credFile = "$env:USERPROFILE\.claude\.credentials.json"
        if (Test-Path $credFile) {
            Write-Host '         ✅ already signed in — skipping' -ForegroundColor Green
        } else {
            Write-Host '         Open a new PowerShell and run: claude'
            Write-Host '         Browser will open for sign-in.'
            Wait-EnterKey -Prompt 'Press Enter after you see "Logged in" in the claude prompt...'
        }
    }

    # 3. JetBrains via WebStorm first launch
    Write-Host ''
    Write-Host '   [3/3] JetBrains' -ForegroundColor Cyan
    $webstorm = Get-Command webstorm64 -ErrorAction SilentlyContinue
    if (-not $webstorm) {
        Write-Host '         WebStorm not installed — skipping JetBrains sign-in' -ForegroundColor Gray
        Write-Host '         (sign in manually on first launch)' -ForegroundColor Gray
    } else {
        Write-Host '         Open WebStorm and sign in (or click Start trial).'
        Wait-EnterKey -Prompt 'Press Enter after WebStorm shows the project window...'
    }

    Write-Host ''
    Write-Host '   All 3 sign-ins complete. Continuing bootstrap.' -ForegroundColor Green
    $true
}
