# Kun Maintain — the machine supervises itself (Windows).
# Daily heartbeat: pull ~/kun → refresh %USERPROFILE%\.claude (setup.ps1) →
# health check → state file → weekly/on-RED report to the dashboard issue.
#
# Usage: .\maintain.ps1 [-Run|-Install|-Uninstall|-Status] [-Quiet]
#   -Run        execute one heartbeat (default)
#   -Install    arm the scheduler (Scheduled Task "kun-maintain"), idempotent
#   -Uninstall  disarm the scheduler
#   -Status     print last state + scheduler status
#
# The run path never dies halfway: every step records its outcome into
# .kun-maintain.json and the script always exits 0 — the state file carries
# the verdict. Bash mirror: maintain.sh — keep the two in lockstep.
# (No self-reexec needed: PowerShell parses the whole file before running,
# so setup.ps1 overwriting this file mid-run is safe.)

param(
    [switch]$Run,
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Quiet
)

$ErrorActionPreference = "SilentlyContinue"

$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$KUN_DIR = "$env:USERPROFILE\kun"
$STATE_FILE = "$CLAUDE_DIR\.kun-maintain.json"
$LOCK_DIR = "$CLAUDE_DIR\.kun-maintain.lock"
$LOG_DIR = "$CLAUDE_DIR\logs"
$TASK_NAME = "kun-maintain"

function Log($msg) {
    New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path "$LOG_DIR\maintain-$(Get-Date -Format 'yyyy-MM-dd').log" -Value "[$stamp] $msg"
    if (-not $Quiet) { Write-Host $msg }
}

function Rotate-Logs {
    Get-ChildItem "$LOG_DIR\maintain-*.log" -EA SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
        Remove-Item -Force -EA SilentlyContinue
}

function Have-Net {
    try {
        Invoke-WebRequest -Method Head -UseBasicParsing -TimeoutSec 8 -Uri "https://github.com" | Out-Null
        return $true
    } catch { return $false }
}

# ── Scheduler: install / uninstall ───────────────────────────────

$taskArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$CLAUDE_DIR\scripts\maintain.ps1`" -Run -Quiet"

function Do-Install {
    $existing = Get-ScheduledTask -TaskName $TASK_NAME -EA SilentlyContinue
    if ($existing) {
        $action = $existing.Actions | Select-Object -First 1
        if ($action -and $action.Arguments -eq $taskArgs) {
            Log "maintain heartbeat already armed (Scheduled Task, daily 09:17)"
            return
        }
    }
    $act = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArgs
    $trig = New-ScheduledTaskTrigger -Daily -At 9:17am
    $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    Register-ScheduledTask -TaskName $TASK_NAME -Action $act -Trigger $trig -Settings $set -Force | Out-Null
    Log "maintain heartbeat armed (Scheduled Task, daily 09:17)"
}

function Do-Uninstall {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -EA SilentlyContinue
    Log "maintain heartbeat disarmed (Scheduled Task)"
}

function Do-Status {
    if (Test-Path $STATE_FILE) {
        Get-Content $STATE_FILE
    } else {
        Write-Host "no state — maintain has not run yet"
    }
    if (Get-ScheduledTask -TaskName $TASK_NAME -EA SilentlyContinue) {
        Write-Host "scheduler: Scheduled Task armed ($TASK_NAME, daily 09:17)"
    } else {
        Write-Host "scheduler: not armed — run: .\maintain.ps1 -Install"
    }
}

# ── The heartbeat ────────────────────────────────────────────────

$script:PULLED = "skipped"
$script:HEAD_REV = ""
$script:SETUP_STATUS = "skipped"
$script:VERDICT = "GREEN"
$script:HEALTH_LINE = ""
$script:DISK_FREE_GB = 0
$script:REPORT_STATUS = "not-due"
$script:LAST_REPORT_TS = ""

function Step-Pull {
    if (-not (Test-Path "$KUN_DIR\.git")) {
        $script:PULLED = "no-repo"
    } elseif ((Test-Path "$KUN_DIR\.git\rebase-merge") -or (Test-Path "$KUN_DIR\.git\rebase-apply") -or (Test-Path "$KUN_DIR\.git\MERGE_HEAD")) {
        # A human is mid-rebase/merge — never touch the tree under them.
        $script:PULLED = "skipped-mid-operation"
    } elseif ((git -C $KUN_DIR symbolic-ref --short HEAD 2>$null) -ne "main") {
        $script:PULLED = "skipped-branch"
    } elseif (-not (Have-Net)) {
        $script:PULLED = "offline"
    } else {
        $before = git -C $KUN_DIR rev-parse HEAD 2>$null
        git -C $KUN_DIR pull --rebase --autostash --quiet origin main 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $after = git -C $KUN_DIR rev-parse HEAD 2>$null
            $script:PULLED = if ($before -eq $after) { "current" } else { "updated" }
        } else {
            git -C $KUN_DIR rebase --abort 2>$null | Out-Null
            $script:PULLED = "error"
        }
    }
    $script:HEAD_REV = git -C $KUN_DIR rev-parse --short HEAD 2>$null
    Log "pull: $($script:PULLED) ($($script:HEAD_REV))"
}

function Step-Setup {
    if (-not (Test-Path "$KUN_DIR\.claude\scripts\setup.ps1")) {
        $script:SETUP_STATUS = "no-setup"
    } elseif (-not (Test-Path "$CLAUDE_DIR\.kun-role")) {
        # setup.ps1 with no role prints usage — don't mistake that for a refresh
        $script:SETUP_STATUS = "no-role"
    } else {
        try {
            & powershell -NoProfile -ExecutionPolicy Bypass -File "$KUN_DIR\.claude\scripts\setup.ps1" -Quiet 2>$null | Out-Null
            $script:SETUP_STATUS = if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) { "ok" } else { "error" }
        } catch { $script:SETUP_STATUS = "error" }
    }
    Log "setup: $($script:SETUP_STATUS)"
}

function Step-Health {
    $healthScript = "$CLAUDE_DIR\scripts\health.ps1"
    if (-not (Test-Path $healthScript)) { $healthScript = "$KUN_DIR\.claude\scripts\health.ps1" }
    if (Test-Path $healthScript) {
        # Child process so Write-Host output is capturable; word-match the
        # status line (encoding-immune, unlike the emoji icons).
        $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $healthScript 2>$null
        $script:HEALTH_LINE = ($out | Select-Object -First 1)
        if ($script:HEALTH_LINE -match "healthy") { $script:VERDICT = "GREEN" }
        elseif ($script:HEALTH_LINE -match "warning") { $script:VERDICT = "YELLOW" }
        elseif ($script:HEALTH_LINE -match "error") { $script:VERDICT = "RED" }
        else { $script:VERDICT = "YELLOW" }
    } else {
        $script:VERDICT = "YELLOW"
        $script:HEALTH_LINE = "health.ps1 missing"
    }
    Log "health: $($script:VERDICT) ($($script:HEALTH_LINE))"
}

function Step-Disk {
    $drive = (Get-Item $env:USERPROFILE).PSDrive
    $script:DISK_FREE_GB = [int]($drive.Free / 1GB)
    if ($script:DISK_FREE_GB -lt 5 -and $script:VERDICT -eq "GREEN") {
        $script:VERDICT = "YELLOW"
        Log "disk: $($script:DISK_FREE_GB)GB free — low, verdict floored to YELLOW"
    } else {
        Log "disk: $($script:DISK_FREE_GB)GB free"
    }
}

function Load-PrevState {
    # Carry last_report_ts across runs BEFORE the provisional write clobbers it.
    if (Test-Path $STATE_FILE) {
        try { $script:LAST_REPORT_TS = (Get-Content $STATE_FILE -Raw | ConvertFrom-Json).last_report_ts } catch { }
    }
}

function Step-Report {
    # Due weekly (state-based) or immediately on RED. Needs gh + auth + net.
    $due = $false
    if ($script:VERDICT -eq "RED" -or -not $script:LAST_REPORT_TS) {
        $due = $true
    } else {
        try {
            $last = [datetime]::ParseExact($script:LAST_REPORT_TS, "yyyy-MM-ddTHH:mm:ssZ",
                [System.Globalization.CultureInfo]::InvariantCulture,
                [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
            if (((Get-Date).ToUniversalTime() - $last).TotalDays -ge 6) { $due = $true }
        } catch { $due = $true }
    }
    if (-not $due) {
        $script:REPORT_STATUS = "not-due"
    } elseif ($script:PULLED -eq "offline" -or -not (Get-Command gh -EA SilentlyContinue)) {
        $script:REPORT_STATUS = "skipped-unauth-or-offline"
    } else {
        gh auth status 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $script:REPORT_STATUS = "skipped-unauth-or-offline"
        } else {
            $healthScript = "$CLAUDE_DIR\scripts\health.ps1"
            if (-not (Test-Path $healthScript)) { $healthScript = "$KUN_DIR\.claude\scripts\health.ps1" }
            & powershell -NoProfile -ExecutionPolicy Bypass -File $healthScript -Report 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
                $script:REPORT_STATUS = "posted"
                $script:LAST_REPORT_TS = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            } else {
                $script:REPORT_STATUS = "error"
            }
        }
    }
    Log "report: $($script:REPORT_STATUS)"
}

function Write-State {
    $state = [ordered]@{
        schema         = 1
        ts             = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        host           = $env:COMPUTERNAME
        verdict        = $script:VERDICT
        pulled         = $script:PULLED
        head           = "$($script:HEAD_REV)"
        setup          = $script:SETUP_STATUS
        disk_free_gb   = $script:DISK_FREE_GB
        report         = $script:REPORT_STATUS
        last_report_ts = "$($script:LAST_REPORT_TS)"
    }
    $tmp = "$STATE_FILE.tmp"
    $state | ConvertTo-Json | Set-Content -Path $tmp
    Move-Item -Path $tmp -Destination $STATE_FILE -Force
    Log "state: $STATE_FILE ($($script:VERDICT))"
}

function Do-Run {
    New-Item -ItemType Directory -Force -Path $CLAUDE_DIR, $LOG_DIR | Out-Null
    Rotate-Logs

    # One heartbeat at a time (atomic directory create); reclaim locks >2h old.
    $locked = $false
    try {
        New-Item -ItemType Directory -Path $LOCK_DIR -EA Stop | Out-Null
        $locked = $true
    } catch {
        $lockAge = ((Get-Date) - (Get-Item $LOCK_DIR -EA SilentlyContinue).LastWriteTime).TotalSeconds
        if ($lockAge -gt 7200) {
            Log "stale lock ($([int]$lockAge)s old) — reclaiming"
            Remove-Item $LOCK_DIR -Recurse -Force -EA SilentlyContinue
            try { New-Item -ItemType Directory -Path $LOCK_DIR -EA Stop | Out-Null; $locked = $true }
            catch { Log "lock contention — exiting"; exit 0 }
        } else {
            Log "another maintain run is in progress — exiting"
            exit 0
        }
    }

    try {
        Log "maintain run start (host: $env:COMPUTERNAME)"
        Load-PrevState
        # Provisional stamp so health.ps1's heartbeat check doesn't warn on
        # the very first run (the check reads this state file mid-run).
        $script:VERDICT = "RUNNING"; Write-State; $script:VERDICT = "GREEN"
        Step-Pull
        Step-Setup
        Step-Health
        Step-Disk
        Step-Report
        Write-State
        Log "maintain run done — verdict: $($script:VERDICT)"
    } finally {
        if ($locked) { Remove-Item $LOCK_DIR -Recurse -Force -EA SilentlyContinue }
    }
    exit 0
}

# ── Dispatch (default: -Run) ─────────────────────────────────────
if ($Install) { Do-Install }
elseif ($Uninstall) { Do-Uninstall }
elseif ($Status) { Do-Status }
else { Do-Run }
