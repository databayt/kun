# Kun doctor — one command for health, updates, and self-repair.
# Usage: doctor [-Report] [-Fix] [-Update] [-Json] [-Quiet] [-Verbose] [-Deep]
# Spec: https://github.com/databayt/kun/issues/26

[CmdletBinding()]
param(
    [switch]$Report,
    [switch]$Fix,
    [switch]$Update,
    [switch]$Json,
    [switch]$Quiet,
    [switch]$Deep
)

$ErrorActionPreference = 'Continue'
$libDir = Join-Path $PSScriptRoot 'lib'

# Source all check modules
foreach ($mod in 'Common','Check-Core','Check-Shell','Check-Identity','Check-Repos','Check-Updates','Check-Scheduled','Check-IDE','Fix-Shell') {
    $path = Join-Path $libDir "$mod.ps1"
    if (Test-Path $path) { . $path }
}

# Run all checks
$results = @()
$results += Test-CoreConfig
$results += Test-Shell
$results += Test-Identity
$results += Test-Repos
$results += Test-Updates
$results += Test-Scheduled
$results += Test-IDE

# Aggregate
$errors   = @($results | Where-Object Status -eq 'fail')
$warnings = @($results | Where-Object Status -eq 'warn')
$updates  = @($results | Where-Object Status -eq 'update')
$paused   = @($results | Where-Object Status -eq 'paused')

# JSON mode — print and exit
if ($Json) {
    $results | ConvertTo-Json -Depth 4
    if     ($errors.Count   -gt 0) { exit 1 }
    elseif ($warnings.Count -gt 0) { exit 2 }
    elseif ($updates.Count  -gt 0) { exit 3 }
    else                           { exit 0 }
}

# Header
$role = Get-Role
$hostName = $env:COMPUTERNAME
$ts = (Get-Date).ToString('yyyy-MM-dd HH:mm')
$status =
    if     ($errors.Count   -gt 0) { "❌ $($errors.Count) errors" }
    elseif ($warnings.Count -gt 0) { "⚠️  $($warnings.Count) warnings" }
    elseif ($updates.Count  -gt 0) { "🔄 $($updates.Count) updates available" }
    else                           { '✅ healthy' }

if (-not $Quiet) {
    Write-Host ''
    Write-Host "$status · $role @ $hostName · $ts" -ForegroundColor Cyan
    Write-Host ''
}

# Render table grouped by category
$groups = $results | Group-Object Category
foreach ($g in $groups) {
    $shown = $g.Group
    if ($Quiet) {
        $shown = $shown | Where-Object Status -ne 'pass'
        if (-not $shown) { continue }
    }
    Write-Host $g.Name -ForegroundColor Yellow
    foreach ($c in $shown) {
        $icon = Get-StatusIcon $c.Status
        $line = "  $icon $($c.Name.PadRight(22)) $($c.Detail)"
        $color = switch ($c.Status) {
            'pass'   { 'Green' }
            'warn'   { 'Yellow' }
            'fail'   { 'Red' }
            'update' { 'Cyan' }
            'paused' { 'Gray' }
            default  { 'White' }
        }
        Write-Host $line -ForegroundColor $color
    }
    Write-Host ''
}

# Footer hints
$fixable = @($results | Where-Object { $_.Status -in 'fail','warn' -and $_.Fix })
if ($fixable.Count -gt 0 -and -not $Fix) {
    Write-Host "Run 'doctor -Fix' to repair $($fixable.Count) fixable issue(s)." -ForegroundColor Yellow
}
if ($updates.Count -gt 0 -and -not $Update) {
    Write-Host "Run 'doctor -Update' to apply $($updates.Count) update(s)." -ForegroundColor Cyan
}

# Apply fixes
if ($Fix -and $fixable.Count -gt 0) {
    Write-Host ''
    Write-Host '── Applying fixes ───────────────────────' -ForegroundColor Magenta
    foreach ($c in $fixable) {
        Write-Host "Fix: $($c.Name) — $($c.Fix)"
        switch ($c.Fix) {
            'create-profile'    { Repair-Profile | Out-Null }
            'append-c-function' { Repair-Profile | Out-Null }
            'prepend-bin-path'  { Repair-Profile | Out-Null }
            'rerun-secrets' {
                $secrets = "$env:USERPROFILE\.claude\scripts\secrets.ps1"
                if (Test-Path $secrets) {
                    Write-Host "  Hint: & '$secrets' -GistId <id>  — provide your Gist ID" -ForegroundColor Yellow
                }
            }
            default {
                if ($c.Fix -like 'clone-*') {
                    $name = $c.Fix.Substring(6)
                    Write-Host "  Hint: run sync-repos.ps1 to clone $name" -ForegroundColor Yellow
                }
            }
        }
    }
}

# Apply updates
if ($Update -and $updates.Count -gt 0) {
    Write-Host ''
    Write-Host '── Applying updates ─────────────────────' -ForegroundColor Magenta
    foreach ($u in $updates) {
        switch ($u.Name) {
            'claude CLI' {
                Write-Host "Run manually: winget upgrade Anthropic.ClaudeCode" -ForegroundColor Yellow
                Write-Host "  (auto-update of a CLI under active use is risky — opt-in only)" -ForegroundColor Gray
            }
            '~/kun' {
                Push-Location "$env:USERPROFILE\kun"
                git pull --rebase
                Pop-Location
            }
            '~/codebase' {
                Push-Location "$env:USERPROFILE\codebase"
                git pull --rebase
                Pop-Location
            }
        }
    }
}

# Report to GitHub
if ($Report) {
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) {
        Write-Host "gh CLI not installed — cannot post report" -ForegroundColor Red
    } else {
        $body = @()
        $body += "### $hostName — $role"
        $body += "**Status:** $status"
        $body += "**Time:** $ts"
        $body += ''
        foreach ($g in $groups) {
            $body += "**$($g.Name)**"
            foreach ($c in $g.Group) {
                $icon = Get-StatusIcon $c.Status
                $body += "- $icon $($c.Name) — $($c.Detail)"
            }
            $body += ''
        }
        $body += '---'
        $bodyText = $body -join "`n"

        $issueNum = (gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>$null)
        if (-not $issueNum) {
            gh issue create --repo databayt/kun --title 'Config Health Dashboard' --label 'config-health' --body "Automated health reports.`nLatest comment = latest status." | Out-Null
            $issueNum = (gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>$null)
        }
        if ($issueNum) {
            gh issue comment $issueNum --repo databayt/kun --body $bodyText | Out-Null
            Write-Host "Reported to databayt/kun#$issueNum" -ForegroundColor Green
        }
    }
}

# Exit code (precedence: errors > warnings > updates)
if     ($errors.Count   -gt 0) { exit 1 }
elseif ($warnings.Count -gt 0) { exit 2 }
elseif ($updates.Count  -gt 0) { exit 3 }
else                           { exit 0 }
