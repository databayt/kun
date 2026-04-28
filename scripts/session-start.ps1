#!/usr/bin/env pwsh
# session-start.ps1 — Bootstrap a Claude Code session with org context (Windows variant).
# Wired via SessionStart hook in .claude/settings-windows.json (Story 15.5).
#
# Mirror of scripts/session-start.sh for Windows / PowerShell.
# Reads stdin JSON from Claude Code, writes hookSpecificOutput JSON to stdout.

$ErrorActionPreference = 'SilentlyContinue'

$contextParts = @()

function Emit($s) {
  $script:contextParts += $s
}

# 1) Bridge — Cowork ↔ Code handoff
$bridgePath = Join-Path $env:USERPROFILE '.claude\bridge.md'
if (Test-Path $bridgePath) {
  $pending = (Select-String -Path $bridgePath -Pattern '^- \[ \]' -AllMatches).Matches.Count
  if ($pending -gt 0) {
    Emit "## Bridge ($pending pending)"
    Get-Content $bridgePath | Select-String -Pattern '^- \[ \]' | Select-Object -First 5 | ForEach-Object { $_.Line }
  }
}

# 2) Sticky Notes / fallback dispatch (Windows equivalent of Apple Notes Inbox)
# Story 19.2 — fallback uses GitHub issue stream `databayt/kun#dispatch`
$dispatchIssue = $null
if (Get-Command gh -ErrorAction SilentlyContinue) {
  try {
    $dispatchIssue = gh issue list --repo databayt/kun --label captain --state open --json number,title 2>$null | ConvertFrom-Json
  } catch { }
  if ($dispatchIssue -and $dispatchIssue.Count -gt 0) {
    Emit "## Captain decisions pending: $($dispatchIssue.Count)"
    $dispatchIssue | Select-Object -First 3 | ForEach-Object { "- #$($_.number) $($_.title)" }
  }
}

# 3) Open report issues across active databayt repos
if (Get-Command gh -ErrorAction SilentlyContinue) {
  foreach ($repo in @('databayt/kun', 'databayt/hogwarts')) {
    try {
      $issues = gh issue list --repo $repo --label report --state open --json number,title 2>$null | ConvertFrom-Json
      if ($issues -and $issues.Count -gt 0) {
        Emit "## $repo report issues: $($issues.Count) open"
        $issues | Select-Object -First 5 | ForEach-Object { "- #$($_.number) $($_.title)" }
      }
    } catch { }
  }
}

# 4) Runway snapshot
$projectDir = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { Get-Location }
$runwayFile = Join-Path $projectDir '.claude\memory\runway.json'
if (Test-Path $runwayFile) {
  try {
    $runway = Get-Content $runwayFile -Raw | ConvertFrom-Json
    if ($runway.weeksRemaining -and $runway.burn.monthly) {
      Emit "## Runway: $($runway.weeksRemaining) weeks @ `$$($runway.burn.monthly)/mo burn"
    }
  } catch { }
}

# 5) Active sprint
$stateFile = Join-Path $projectDir '.claude\memory\captain-state.json'
if (Test-Path $stateFile) {
  try {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
    if ($state.sprint.current) {
      Emit "## Active sprint: $($state.sprint.current) — $($state.sprint.focus)"
    }
  } catch { }
}

# Compose
if ($contextParts.Count -eq 0) {
  exit 0
}

$context = $contextParts -join "`n"

@{
  hookSpecificOutput = @{
    hookEventName = 'SessionStart'
    additionalContext = $context
  }
} | ConvertTo-Json -Depth 5 -Compress

exit 0
