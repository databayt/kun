# Kun auto-sync installer — registers auto-sync.ps1 as a logon-triggered
# scheduled task that restarts on failure. Runs hidden in the background.
#
# Usage:
#   auto-sync-install.ps1 -Install     # arm the task (no admin needed; user-scoped)
#   auto-sync-install.ps1 -Uninstall   # remove the task
#   auto-sync-install.ps1 -Status      # show task state
#   auto-sync-install.ps1 -Run         # start the task right now

[CmdletBinding(DefaultParameterSetName='Status')]
param(
    [Parameter(ParameterSetName='Install')]   [switch]$Install,
    [Parameter(ParameterSetName='Uninstall')] [switch]$Uninstall,
    [Parameter(ParameterSetName='Status')]    [switch]$Status,
    [Parameter(ParameterSetName='Run')]       [switch]$Run
)

$TaskName    = 'kun-auto-sync'
$ScriptPath  = "$env:USERPROFILE\.claude\scripts\auto-sync.ps1"

function Show-Status {
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        $info = $task | Get-ScheduledTaskInfo
        Write-Host "kun-auto-sync" -ForegroundColor Cyan
        Write-Host "  State:    $($task.State)"
        Write-Host "  Trigger:  At logon"
        Write-Host "  Last run: $(if ($info.LastRunTime.Year -gt 1900) { $info.LastRunTime } else { 'never' })"
        Write-Host "  Last exit: $($info.LastTaskResult)"
        Write-Host "  Script:   $ScriptPath"
    } catch {
        Write-Host "kun-auto-sync: not installed" -ForegroundColor Yellow
        Write-Host "  Install with: auto-sync-install.ps1 -Install"
    }
}

if ($Status -or (-not $Install -and -not $Uninstall -and -not $Run)) {
    Show-Status
    return
}

if ($Uninstall) {
    try {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host "✅ Unregistered kun-auto-sync" -ForegroundColor Green
    } catch {
        Write-Host "kun-auto-sync was not installed" -ForegroundColor Yellow
    }
    return
}

if ($Run) {
    try {
        Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        Write-Host "✅ Started kun-auto-sync" -ForegroundColor Green
    } catch {
        Write-Host "❌ Task not installed — run with -Install first" -ForegroundColor Red
        exit 1
    }
    return
}

# ── Install ────────────────────────────────────────────────────────
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ Script not found: $ScriptPath" -ForegroundColor Red
    Write-Host "   Run install.ps1 first to deploy ~/.claude/scripts/" -ForegroundColor Yellow
    exit 1
}

# Action: invoke auto-sync.ps1 hidden, with execution policy bypass
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

# Trigger: at user logon
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Settings: restart on failure, allow on battery, no time limit
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval ([TimeSpan]::FromMinutes(1))

# Principal: current user, run only when logged in (no admin needed)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description 'Real-time bidirectional git sync for databayt repos at ~/<repo>' `
        -Force `
        -ErrorAction Stop | Out-Null

    Write-Host "✅ Installed kun-auto-sync" -ForegroundColor Green
    Write-Host ""
    Write-Host "Trigger: starts at every logon (current user only)"
    Write-Host "Script:  $ScriptPath"
    Write-Host "Logs:    ~/.claude/logs/auto-sync-<date>.log"
    Write-Host ""
    Write-Host "Start now without logging out: auto-sync-install.ps1 -Run"
    Write-Host "Check state any time:           auto-sync-install.ps1 -Status"
    Write-Host "Stop and remove:                auto-sync-install.ps1 -Uninstall"
} catch {
    Write-Host "❌ Install failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
