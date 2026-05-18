# Kun auto-sync — real-time bidirectional git sync for all databayt repos.
# Watches each repo at ~/<name> for local commits (push instantly) and polls
# origin every 60s for new upstream commits (pull --rebase). Per-repo isolation:
# one repo's failure never stops the others.
#
# Usage: auto-sync.ps1 [-PollInterval <sec>] [-Debounce <sec>] [-DryRun] [-Once]
#
# Background install: auto-sync-install.ps1 -Install
# Logs: ~/.claude/logs/auto-sync-<date>.log

[CmdletBinding()]
param(
    [int]$PollInterval = 60,
    [int]$Debounce = 2,
    [switch]$DryRun,
    [switch]$Once,
    [switch]$Verbose
)

$ErrorActionPreference = 'Continue'

$LogDir = "$env:USERPROFILE\.claude\logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
$LogFile = Join-Path $LogDir "auto-sync-$((Get-Date).ToString('yyyy-MM-dd')).log"

function Write-Log {
    param([string]$Repo, [string]$Level, [string]$Message)
    $line = "[{0}] [{1,-5}] [{2,-20}] {3}" -f (Get-Date -Format 'HH:mm:ss'), $Level, $Repo, $Message
    Add-Content -Path $LogFile -Value $line
    if ($Verbose -or $Level -in 'WARN','ERROR','PUSH','PULL') {
        $color = switch ($Level) {
            'PUSH'  { 'Green' }
            'PULL'  { 'Cyan' }
            'WARN'  { 'Yellow' }
            'ERROR' { 'Red' }
            default { 'Gray' }
        }
        Write-Host $line -ForegroundColor $color
    }
}

function Get-RepoList {
    $memory = "$env:USERPROFILE\.claude\memory\repositories.json"
    if (Test-Path $memory) {
        try {
            $data = Get-Content $memory -Raw | ConvertFrom-Json
            if ($data.repos) {
                return $data.repos.PSObject.Properties | ForEach-Object {
                    @{ Name = $_.Name; Path = $ExecutionContext.InvokeCommand.ExpandString($_.Value) }
                }
            }
        } catch { }
    }
    # Fallback to canonical list at user-home root
    @('codebase','kun','shadcn','radix','hogwarts','souq','mkan','shifa','swift-app','distributed-computer','marketing') | ForEach-Object {
        @{ Name = $_; Path = "$env:USERPROFILE\$_" }
    }
}

function Test-RepoCloned {
    param([string]$Path)
    Test-Path (Join-Path $Path '.git\refs\heads')
}

function Invoke-RepoPush {
    param([string]$Name, [string]$Path)
    Push-Location $Path
    try {
        $ahead = (git rev-list --count '@{u}..HEAD' 2>$null | Out-String).Trim()
        if (-not $ahead -or $ahead -eq '0') { return }
        if ($DryRun) {
            Write-Log $Name 'PUSH' "[dry-run] $ahead commit(s) ready to push"
            return
        }
        $result = git push 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            Write-Log $Name 'PUSH' "$ahead commit(s) pushed"
        } else {
            Write-Log $Name 'WARN' "push failed: $($result.Trim())"
        }
    } catch {
        Write-Log $Name 'ERROR' "push exception: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

function Invoke-RepoPull {
    param([string]$Name, [string]$Path)
    Push-Location $Path
    try {
        git fetch --quiet 2>$null
        $upstream = (git rev-parse '@{u}' 2>$null | Out-String).Trim()
        if (-not $upstream) {
            Write-Log $Name 'WARN' 'no upstream — skipping fetch'
            return
        }
        $behind = (git rev-list --count 'HEAD..@{u}' 2>$null | Out-String).Trim()
        if (-not $behind -or $behind -eq '0') { return }
        $dirty = (git status --porcelain 2>$null | Measure-Object).Count
        if ($dirty -gt 0) {
            Write-Log $Name 'WARN' "$behind behind but working tree dirty — skipping pull"
            return
        }
        if ($DryRun) {
            Write-Log $Name 'PULL' "[dry-run] $behind commit(s) ready to pull"
            return
        }
        $result = git pull --rebase --quiet 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            Write-Log $Name 'PULL' "$behind commit(s) rebased"
        } else {
            Write-Log $Name 'ERROR' "pull failed: $($result.Trim())"
            git rebase --abort 2>$null
        }
    } catch {
        Write-Log $Name 'ERROR' "pull exception: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

# ── Setup ──────────────────────────────────────────────────────────
Write-Log '_main_' 'INFO' "auto-sync starting · poll=${PollInterval}s · debounce=${Debounce}s · dry-run=$DryRun"

$repos = Get-RepoList | Where-Object { Test-RepoCloned $_.Path }
if ($repos.Count -eq 0) {
    Write-Log '_main_' 'ERROR' 'no cloned repos found — run sync-repos.ps1 first'
    exit 1
}

Write-Log '_main_' 'INFO' "watching $($repos.Count) repos"
foreach ($r in $repos) { Write-Log $r.Name 'INFO' "tracking $($r.Path)" }

# Per-repo state: last time .git/refs/heads changed
$script:lastEvent = @{}
foreach ($r in $repos) { $script:lastEvent[$r.Name] = [DateTime]::MinValue }

# FileSystemWatcher per repo
$watchers = @()
foreach ($r in $repos) {
    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path = Join-Path $r.Path '.git\refs\heads'
    $watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite, [System.IO.NotifyFilters]::FileName, [System.IO.NotifyFilters]::CreationTime
    $watcher.EnableRaisingEvents = $true
    $watcher.IncludeSubdirectories = $false

    $action = {
        $name = $event.MessageData
        $script:lastEvent[$name] = Get-Date
    }
    Register-ObjectEvent -InputObject $watcher -EventName 'Changed' -Action $action -MessageData $r.Name | Out-Null
    Register-ObjectEvent -InputObject $watcher -EventName 'Created' -Action $action -MessageData $r.Name | Out-Null
    $watchers += $watcher
}

# ── Main loop ──────────────────────────────────────────────────────
$lastPoll = Get-Date
$tick = 0
try {
    while ($true) {
        Start-Sleep -Seconds 1
        $tick++
        $now = Get-Date

        # 1. Debounced push: any repo with event > Debounce seconds ago
        foreach ($r in $repos) {
            $eventTime = $script:lastEvent[$r.Name]
            if ($eventTime -eq [DateTime]::MinValue) { continue }
            $elapsed = ($now - $eventTime).TotalSeconds
            if ($elapsed -ge $Debounce -and $elapsed -lt 600) {
                $script:lastEvent[$r.Name] = [DateTime]::MinValue
                Invoke-RepoPush -Name $r.Name -Path $r.Path
            }
        }

        # 2. Periodic poll: fetch + pull
        if (($now - $lastPoll).TotalSeconds -ge $PollInterval) {
            foreach ($r in $repos) {
                Invoke-RepoPull -Name $r.Name -Path $r.Path
            }
            $lastPoll = $now
            if ($Once) { break }
        }
    }
} finally {
    Write-Log '_main_' 'INFO' 'auto-sync stopping · cleaning up watchers'
    foreach ($w in $watchers) {
        $w.EnableRaisingEvents = $false
        $w.Dispose()
    }
    Get-EventSubscriber | Where-Object SourceObject -is [System.IO.FileSystemWatcher] | Unregister-Event
}
