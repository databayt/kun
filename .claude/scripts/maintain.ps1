# Kun maintain — daily heartbeat. Composes sync-repos + self-update + doctor + notify.
# Spec: https://github.com/databayt/kun/issues/27
# Usage: maintain [-Install] [-Uninstall] [-Status] [-Run] [-DryRun] [-Silent] [-Schedule <HH:mm>]

[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Run,
    [switch]$DryRun,
    [switch]$Silent,
    [string]$Schedule = '09:00'
)

$ErrorActionPreference = 'Continue'
$ScriptsDir = "$env:USERPROFILE\.claude\scripts"
$LogsDir    = "$env:USERPROFILE\.claude\logs"
$TaskName   = 'kun-maintain'

# Load notification helpers
$notifyLib = Join-Path $PSScriptRoot 'lib\Notify.ps1'
if (Test-Path $notifyLib) { . $notifyLib }

# ── Logging ──────────────────────────────────────────────────────
if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null }
$today = (Get-Date).ToString('yyyy-MM-dd')
$logFile = Join-Path $LogsDir "maintain-$today.log"

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $stamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $line = "[$stamp] [$Level] $Message"
    Add-Content -Path $logFile -Value $line
    if (-not $Silent) {
        $color = switch ($Level) { 'OK' {'Green'} 'WARN' {'Yellow'} 'ERROR' {'Red'} default {'Gray'} }
        Write-Host $line -ForegroundColor $color
    }
}

function Invoke-LogRotation {
    Get-ChildItem $LogsDir -Filter 'maintain-*.log' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

# ── Subcommands: -Install / -Uninstall / -Status ─────────────────
if ($Install) {
    $scriptPath = Join-Path $ScriptsDir 'maintain.ps1'
    $action = "powershell -ExecutionPolicy Bypass -File `"$scriptPath`" -Silent"

    # Parse -Schedule into time
    try { $time = [datetime]::ParseExact($Schedule, 'HH:mm', $null) } catch {
        Write-Host "Invalid -Schedule format (use HH:mm)" -ForegroundColor Red; exit 1
    }

    if ($DryRun) {
        Write-Host "DRY RUN — would run: schtasks /Create /SC DAILY /ST $Schedule /TN $TaskName"
        exit 0
    }

    schtasks /Create /SC DAILY /ST $Schedule /TN $TaskName /TR $action /F /RL HIGHEST | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Scheduled task '$TaskName' armed for daily $Schedule" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "❌ Failed to create scheduled task (need admin?)" -ForegroundColor Red
        Write-Host "   Run as Administrator, or use the manual command:" -ForegroundColor Yellow
        Write-Host "   schtasks /Create /SC DAILY /ST $Schedule /TN $TaskName /TR `"$action`" /F" -ForegroundColor Gray
        exit 5
    }
}

if ($Uninstall) {
    schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
    Write-Host "✅ Removed scheduled task '$TaskName' (idempotent — no-op if absent)" -ForegroundColor Green
    exit 0
}

if ($Status) {
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        $info = $task | Get-ScheduledTaskInfo
        Write-Host ''
        Write-Host "kun-maintain status" -ForegroundColor Cyan
        Write-Host "  State:      $($task.State)"
        if ($info.NextRunTime) { Write-Host "  Next run:   $($info.NextRunTime.ToString('yyyy-MM-dd HH:mm'))" }
        if ($info.LastRunTime -and $info.LastRunTime.Year -gt 1900) {
            Write-Host "  Last run:   $($info.LastRunTime.ToString('yyyy-MM-dd HH:mm')) (exit $($info.LastTaskResult))"
        }
        Write-Host "  Log dir:    $LogsDir"
        $latestLog = Get-ChildItem $LogsDir -Filter 'maintain-*.log' -ErrorAction SilentlyContinue |
                     Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestLog) { Write-Host "  Latest log: $($latestLog.FullName)" }
    } catch {
        Write-Host "Task '$TaskName' is not armed. Run: maintain -Install" -ForegroundColor Yellow
    }
    exit 0
}

# ── Default action: -Run ─────────────────────────────────────────
$started = Get-Date
Invoke-LogRotation
Write-Log "start ($($env:COMPUTERNAME))"

# 1. Sync repos
$syncScript = Join-Path $ScriptsDir 'sync-repos.ps1'
if (Test-Path $syncScript) {
    if ($DryRun) {
        Write-Log "[dry-run] would call sync-repos.ps1"
    } else {
        try {
            & $syncScript -RepoName all 2>&1 | Out-Null
            Write-Log "sync-repos: ok" 'OK'
        } catch {
            Write-Log "sync-repos: $_" 'WARN'
        }
    }
} else {
    Write-Log "sync-repos: script missing, skipped" 'WARN'
}

# 2. Self-update (~/kun)
$kunPath = "$env:USERPROFILE\kun"
if (Test-Path $kunPath) {
    if ($DryRun) {
        Write-Log "[dry-run] would git pull ~/kun"
    } else {
        Push-Location $kunPath
        try {
            $before = (git rev-parse HEAD 2>$null).Trim()
            git pull --quiet --rebase 2>$null
            $after = (git rev-parse HEAD 2>$null).Trim()
            if ($before -eq $after) {
                Write-Log "self-update: no changes on ~/kun" 'OK'
            } else {
                $configChanged = git diff --name-only $before $after 2>$null |
                                 Select-String '^\.claude/'
                if ($configChanged) {
                    $installer = Join-Path $kunPath '.claude\scripts\install.ps1'
                    if (Test-Path $installer) { & $installer -Role engineer 2>&1 | Out-Null }
                    Write-Log "self-update: applied $($configChanged.Count) config changes" 'OK'
                } else {
                    Write-Log "self-update: pulled $before..$after (no config changes)" 'OK'
                }
            }
        } catch {
            Write-Log "self-update: $_" 'WARN'
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Log "self-update: ~/kun not cloned, skipped" 'WARN'
}

# 3. Doctor
$doctorScript = Join-Path $ScriptsDir 'doctor.ps1'
$doctorExit = -1
if (Test-Path $doctorScript) {
    if ($DryRun) {
        Write-Log "[dry-run] would run doctor.ps1"
        $doctorExit = 0
    } else {
        & $doctorScript -Quiet 2>&1 | ForEach-Object { Add-Content -Path $logFile -Value "    $_" }
        $doctorExit = $LASTEXITCODE
        Write-Log "doctor: exit $doctorExit"
    }
} else {
    Write-Log "doctor: script missing (run install.ps1)" 'ERROR'
    $doctorExit = 1
}

# 4. Notify based on exit code
$elapsed = (Get-Date) - $started
if (-not $DryRun) {
    switch ($doctorExit) {
        0 {
            Write-Log "notify: silent (all green)" 'OK'
            # Weekly GitHub snapshot on Mondays
            if ((Get-Date).DayOfWeek -eq 'Monday' -and (Get-Command gh -ErrorAction SilentlyContinue)) {
                Write-Log "notify: posting weekly snapshot to databayt/kun#config-health"
                & $doctorScript -Report 2>&1 | Out-Null
            }
        }
        2 {
            Send-Toast -Title "Kun maintenance: warnings" `
                       -Body "Run 'doctor' for details" `
                       -RunArguments "doctor" | Out-Null
            Write-Log "notify: toast (warnings)" 'WARN'
        }
        3 {
            Send-Toast -Title "Kun maintenance: 1 update available" `
                       -Body "Run 'doctor -Update' to apply" `
                       -RunArguments "doctor -Update" | Out-Null
            Write-Log "notify: toast (update available)" 'OK'
        }
        default {  # 1, 4, or anything non-zero non-2/3
            Send-Toast -Title "Kun maintenance: errors" `
                       -Body "Run 'doctor' to investigate" `
                       -RunArguments "doctor" | Out-Null
            $webhook = Get-EnvVar -Name 'SLACK_WEBHOOK_URL'
            if ($webhook) {
                Send-Slack -WebhookUrl $webhook `
                           -Title "❌ kun-maintain @ $($env:COMPUTERNAME) — errors" `
                           -Bullets @("doctor exit code: $doctorExit") `
                           -Footer "Log: $logFile`nRepair: doctor -Fix" | Out-Null
                Write-Log "notify: slack + toast (errors)" 'ERROR'
            } else {
                Write-Log "notify: toast (errors, no SLACK_WEBHOOK_URL)" 'ERROR'
            }
        }
    }
}

Write-Log "end (duration $([int]$elapsed.TotalSeconds)s)"
exit $doctorExit
