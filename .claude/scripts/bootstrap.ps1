# Kun bootstrap — single-paste cold start.
# Paste: irm https://kun.databayt.org/install | iex
# Spec: https://github.com/databayt/kun/issues/28

[CmdletBinding()]
param(
    [ValidateSet('engineer','business','content','ops')]
    [string]$Role = 'engineer',
    [string]$GistId = '68453b25fa9d28c94426c55c179b3838',
    [switch]$Track,
    [switch]$DryRun,
    [switch]$SkipOAuth,
    [switch]$SkipWebStorm,
    [switch]$SkipCowork
)

$ErrorActionPreference = 'Continue'
$started = Get-Date

# ── Load helpers ─────────────────────────────────────────────────
# When fetched via `irm | iex` the lib/ folder isn't beside us yet. Fetch it from
# the kun repo if missing, then source the helpers.
$libDir = Join-Path $PSScriptRoot 'lib'
if (-not (Test-Path $libDir) -or -not (Get-ChildItem $libDir -ErrorAction SilentlyContinue)) {
    # We're running from `irm | iex`; download lib/ files into a temp dir
    $libDir = Join-Path $env:TEMP "kun-bootstrap-$(Get-Date -Format 'yyyyMMddHHmmss')\lib"
    New-Item -ItemType Directory -Force -Path $libDir | Out-Null
    $libUrls = @(
        'Bootstrap-Common', 'Confirm-Admin', 'Install-Winget',
        'Update-Path', 'Stage-OAuth', 'Fix-Shell', 'Drop-Plugin', 'Track-Issue'
    )
    foreach ($name in $libUrls) {
        $url = "https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/lib/$name.ps1"
        try {
            Invoke-WebRequest -Uri $url -OutFile (Join-Path $libDir "$name.ps1") -ErrorAction Stop
        } catch {
            Write-Host "Failed to fetch $name.ps1 — bootstrap can't continue: $_" -ForegroundColor Red
            exit 1
        }
    }
}

foreach ($mod in 'Bootstrap-Common','Confirm-Admin','Install-Winget','Update-Path','Stage-OAuth','Fix-Shell','Drop-Plugin','Track-Issue') {
    $p = Join-Path $libDir "$mod.ps1"
    if (Test-Path $p) { . $p }
}

# ── Banner ───────────────────────────────────────────────────────
Write-Host ''
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host '  KUN BOOTSTRAP — single-paste cold start'                    -ForegroundColor Cyan
Write-Host "  Role: $Role · $(if ($DryRun) { 'DRY RUN' } else { 'live' })" -ForegroundColor Cyan
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host ''

$logFile = Initialize-BootstrapLog
Write-Host "Log: $logFile" -ForegroundColor Gray
Write-Host ''

# ── [0] ExecutionPolicy ──────────────────────────────────────────
Write-Step 0 'Set ExecutionPolicy CurrentUser RemoteSigned' 'start'
if (-not $DryRun) {
    try {
        Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
        Write-Step 0 'ExecutionPolicy set' 'ok'
    } catch {
        Write-Step 0 'ExecutionPolicy failed' 'fail' $_.Exception.Message
        exit 1
    }
} else {
    Write-Step 0 '[dry-run] would set RemoteSigned' 'skip'
}

# ── [1] Self-elevation check ─────────────────────────────────────
Write-Step 1 'Admin check' 'start'
if (Test-IsAdmin) {
    Write-Step 1 'Running elevated' 'ok'
} elseif ($DryRun) {
    Write-Step 1 '[dry-run] would prompt for elevation' 'skip'
} else {
    Write-Step 1 'Not elevated — re-launching with UAC' 'warn'
    $cmd = "irm https://kun.databayt.org/install | iex"
    Start-Process powershell -Verb RunAs -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-Command',$cmd)
    exit 0
}

# ── [2] OS + PS version check ────────────────────────────────────
Write-Step 2 'Verify Windows 11 + PowerShell 5.1+' 'start'
$os = [Environment]::OSVersion.Version
$psVer = $PSVersionTable.PSVersion
if ($os.Major -lt 10) {
    Write-Step 2 "Unsupported OS: $($os.ToString())" 'fail'
    exit 1
}
if ($psVer.Major -lt 5) {
    Write-Step 2 "PowerShell $psVer too old (need 5.1+)" 'fail'
    exit 1
}
Write-Step 2 "Windows $($os.ToString()) · PowerShell $psVer" 'ok'

# ── [3] Log dir (already created above) ──────────────────────────
Write-Step 3 'Logs directory ready' 'ok' (Split-Path $logFile -Parent)

# ── -Track: create GitHub tracking issue ─────────────────────────
$trackingIssue = $null
if ($Track -and -not $DryRun) {
    $trackingIssue = New-TrackingIssue
    if (-not $trackingIssue) {
        Write-Host '  -Track requested but gh not authed yet — continuing without tracking issue' -ForegroundColor Yellow
        Write-Host '  (you can re-run with -Track after gh auth login)' -ForegroundColor Gray
    } else {
        # Steps 0-3 are already complete; flip their checkboxes now
        foreach ($i in 0..3) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex $i }
    }
}

# ── [4] winget bundle ────────────────────────────────────────────
Write-Step 4 'Installing CLI tools via winget' 'start'
$packages = @(
    @{ Id = 'Git.Git';                Name = 'Git' }
    @{ Id = 'OpenJS.NodeJS.LTS';      Name = 'Node.js LTS' }
    @{ Id = 'GitHub.cli';             Name = 'gh' }
    @{ Id = 'Microsoft.PowerShell';   Name = 'PowerShell 7' }
    @{ Id = 'Anthropic.ClaudeCode';   Name = 'Claude Code CLI' }
)
if (-not $SkipCowork) {
    # TODO: verify exact winget package ID for Claude Desktop before merge
    $packages += @{ Id = 'Anthropic.Claude'; Name = 'Claude Desktop' }
}

foreach ($pkg in $packages) {
    if ($DryRun) {
        Write-Step 4 "  $($pkg.Name)" 'skip' '[dry-run]'
        continue
    }
    $result = Install-WingetPackage -Id $pkg.Id
    if ($result.Skipped) {
        Write-Step 4 "  $($pkg.Name)" 'skip' 'already installed'
    } elseif ($result.Installed) {
        Write-Step 4 "  $($pkg.Name)" 'ok' 'installed'
    } else {
        Write-Step 4 "  $($pkg.Name)" 'warn' "winget exit $($result.ExitCode)"
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 4 }

# ── [5] PATH refresh ─────────────────────────────────────────────
Write-Step 5 'Refreshing PATH from registry' 'start'
if (-not $DryRun) { Update-SessionPath }
Write-Step 5 'PATH refreshed' 'ok'
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 5 }

# ── [6] pnpm via npm ─────────────────────────────────────────────
Write-Step 6 'Installing pnpm globally' 'start'
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Step 6 'pnpm already on PATH' 'skip'
} elseif ($DryRun) {
    Write-Step 6 '[dry-run] would npm install -g pnpm' 'skip'
} else {
    npm install -g pnpm 2>&1 | Out-Null
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        Write-Step 6 'pnpm installed' 'ok'
    } else {
        Write-Step 6 'pnpm install failed (try again later)' 'warn'
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 6 }

# ── [7] WebStorm ─────────────────────────────────────────────────
if (-not $SkipWebStorm) {
    Write-Step 7 'Installing WebStorm' 'start'
    if ($DryRun) {
        Write-Step 7 '[dry-run] would winget install JetBrains.WebStorm' 'skip'
    } else {
        $result = Install-WingetPackage -Id 'JetBrains.WebStorm'
        if ($result.Skipped) {
            Write-Step 7 'WebStorm already installed' 'skip'
        } elseif ($result.Installed) {
            Write-Step 7 'WebStorm installed' 'ok'
            # TODO: verify JBR present; fall back to JetBrains Toolbox if not
        } else {
            Write-Step 7 'WebStorm install failed' 'warn' 'install JetBrains Toolbox manually'
        }
    }
} else {
    Write-Step 7 'WebStorm — skipped via flag' 'skip'
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 7 }

# ── [8] Plugin pre-drop ──────────────────────────────────────────
Write-Step 8 'Pre-dropping Claude Code [Beta] plugin' 'start'
if ($SkipWebStorm) {
    Write-Step 8 'Plugin — skipped (WebStorm skipped)' 'skip'
} elseif ($DryRun) {
    Write-Step 8 '[dry-run] would download + extract plugin into WebStorm/plugins/' 'skip'
} else {
    $result = Install-ClaudeCodePlugin
    switch ($result.Status) {
        'ok'   { Write-Step 8 'Plugin installed' 'ok' $result.Reason }
        'skip' { Write-Step 8 'Plugin' 'skip' $result.Reason }
        'fail' { Write-Step 8 'Plugin install failed (install from Marketplace inside WebStorm)' 'warn' $result.Reason }
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 8 }

# ── [9] Kun config (install.ps1) ─────────────────────────────────
Write-Step 9 'Installing ~/.claude/ config via install.ps1' 'start'
$installerUrl = 'https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/install.ps1'
if ($DryRun) {
    Write-Step 9 "[dry-run] would fetch $installerUrl" 'skip'
} else {
    try {
        $installer = Invoke-RestMethod -Uri $installerUrl -ErrorAction Stop
        $scriptBlock = [scriptblock]::Create($installer)
        & $scriptBlock -Role $Role
        Write-Step 9 'install.ps1 done' 'ok'
    } catch {
        Write-Step 9 'install.ps1 failed' 'fail' $_.Exception.Message
        if ($trackingIssue) { Close-TrackingIssue -IssueNumber $trackingIssue -Outcome failure -LogPath $logFile }
        exit 1
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 9 }

# ── [10] Auto-accept settings.json (informational — install.ps1 already wrote one) ──
Write-Step 10 'settings.json (handled by install.ps1)' 'ok'
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 10 }

# ── [11] $PROFILE c/cc block ─────────────────────────────────────
Write-Step 11 'Append c/cc functions to $PROFILE' 'start'
if ($DryRun) {
    Write-Step 11 '[dry-run] would append c/cc to $PROFILE' 'skip'
} else {
    $changed = Repair-Profile
    if ($changed) { Write-Step 11 '$PROFILE updated' 'ok' } else { Write-Step 11 '$PROFILE already has c/cc' 'skip' }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 11 }

# ── [12] OAuth batch ─────────────────────────────────────────────
Write-Step 12 'OAuth batch (3 sign-ins)' 'start'
if ($DryRun) {
    Write-Step 12 '[dry-run] would walk through GitHub + Claude + JetBrains' 'skip'
} else {
    Invoke-OAuthBatch -Skip:$SkipOAuth | Out-Null
    Write-Step 12 'OAuth batch complete' 'ok'
}
# Tracking issue may be created retroactively here if -Track was set but gh wasn't
# authed at step 3. Now that step 12 has finished, gh should be authed.
if ($Track -and -not $trackingIssue -and -not $DryRun) {
    $trackingIssue = New-TrackingIssue
    if ($trackingIssue) {
        Write-Host "  Tracking issue created retroactively after OAuth: filling 0-12" -ForegroundColor Cyan
        foreach ($i in 0..12) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex $i }
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 12 }

# ── [13] Secrets ─────────────────────────────────────────────────
Write-Step 13 'Pulling .env via secrets.ps1' 'start'
$secretsScript = "$env:USERPROFILE\.claude\scripts\secrets.ps1"
if (-not (Test-Path $secretsScript)) {
    Write-Step 13 'secrets.ps1 missing — install.ps1 must run first' 'warn'
} elseif ($DryRun) {
    Write-Step 13 '[dry-run] would call secrets.ps1' 'skip'
} else {
    try {
        & $secretsScript -GistId $GistId 2>&1 | Out-Null
        Write-Step 13 '.env pulled from Gist' 'ok'
    } catch {
        Write-Step 13 'secrets.ps1 failed' 'warn' $_.Exception.Message
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 13 }

# ── [14] Repo clone ──────────────────────────────────────────────
Write-Step 14 'Cloning org repos via sync-repos.ps1' 'start'
$syncScript = "$env:USERPROFILE\.claude\scripts\sync-repos.ps1"
if (-not (Test-Path $syncScript)) {
    Write-Step 14 'sync-repos.ps1 missing' 'warn'
} elseif ($DryRun) {
    Write-Step 14 '[dry-run] would call sync-repos.ps1' 'skip'
} else {
    try {
        & $syncScript -RepoName all 2>&1 | Out-Null
        Write-Step 14 'org repos cloned (~/codebase + ~/oss/*)' 'ok'
    } catch {
        Write-Step 14 'sync-repos.ps1 had errors (some repos may need re-clone)' 'warn'
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 14 }

# ── [15] maintain -Install ───────────────────────────────────────
Write-Step 15 'Arming kun-maintain scheduled task' 'start'
$maintainScript = "$env:USERPROFILE\.claude\scripts\maintain.ps1"
if (-not (Test-Path $maintainScript)) {
    Write-Step 15 'maintain.ps1 missing — skipping scheduled task' 'warn'
} elseif ($DryRun) {
    Write-Step 15 '[dry-run] would call maintain -Install' 'skip'
} else {
    try {
        & $maintainScript -Install 2>&1 | Out-Null
        Write-Step 15 'kun-maintain armed for daily 09:00' 'ok'
    } catch {
        Write-Step 15 'scheduled task creation failed' 'warn' $_.Exception.Message
    }
}
if ($trackingIssue) { Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 15 }

# ── [16] Final verify via doctor ─────────────────────────────────
Write-Step 16 'Verifying via doctor.ps1' 'start'
$doctorScript = "$env:USERPROFILE\.claude\scripts\doctor.ps1"
$doctorExit = -1
if (-not (Test-Path $doctorScript)) {
    Write-Step 16 'doctor.ps1 missing' 'fail'
    $doctorExit = 1
} elseif ($DryRun) {
    Write-Step 16 '[dry-run] would run doctor' 'skip'
    $doctorExit = 0
} else {
    & $doctorScript -Quiet 2>&1 | Out-Null
    $doctorExit = $LASTEXITCODE
    switch ($doctorExit) {
        0 { Write-Step 16 'doctor: all green' 'ok' }
        1 { Write-Step 16 "doctor: errors (run 'doctor' to see)" 'fail' }
        2 { Write-Step 16 "doctor: warnings (run 'doctor' to see)" 'warn' }
        3 { Write-Step 16 "doctor: updates available (run 'doctor -Update')" 'ok' }
        default { Write-Step 16 "doctor: exit $doctorExit" 'warn' }
    }
}

# ── Final state table ────────────────────────────────────────────
$elapsed = (Get-Date) - $started
$mins    = [int]$elapsed.TotalMinutes
$secs    = [int]($elapsed.TotalSeconds - $mins * 60)

Write-Host ''
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Cyan
if ($doctorExit -eq 0 -or $doctorExit -eq 3) {
    Write-Host '  ✅ KUN BOOTSTRAP COMPLETE' -ForegroundColor Green
} else {
    Write-Host '  ⚠️  KUN BOOTSTRAP DONE WITH WARNINGS' -ForegroundColor Yellow
}
Write-Host "  Elapsed: ${mins}m ${secs}s · Log: $logFile" -ForegroundColor Gray
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Yellow
Write-Host '  • Open a new PowerShell and type:  c              (starts Claude)'
Write-Host '  • Or open WebStorm in any cloned repo, then Ctrl+Esc'
Write-Host '  • Run `doctor` any time to re-check health'
Write-Host ''

# Close tracking issue with the final outcome
if ($trackingIssue) {
    Update-TrackingIssue -IssueNumber $trackingIssue -StepIndex 16
    $outcome = if ($doctorExit -eq 0 -or $doctorExit -eq 3) { 'success' } else { 'failure' }
    Close-TrackingIssue -IssueNumber $trackingIssue -Outcome $outcome -LogPath $logFile
}

exit $doctorExit
