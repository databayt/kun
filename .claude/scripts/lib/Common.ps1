# Shared helpers for doctor.ps1 check modules.
# Each Check-*.ps1 dot-sources this and returns @(New-CheckResult ...) arrays.

$script:ClaudeDir = "$env:USERPROFILE\.claude"

function New-CheckResult {
    param(
        [Parameter(Mandatory)][string]$Category,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][ValidateSet('pass','warn','fail','update','paused')]$Status,
        [Parameter(Mandatory)][string]$Detail,
        [string]$Fix = ''
    )
    [pscustomobject]@{
        Category = $Category
        Name     = $Name
        Status   = $Status
        Detail   = $Detail
        Fix      = $Fix
    }
}

function Get-StatusIcon {
    param([string]$Status)
    switch ($Status) {
        'pass'   { '✅' }
        'warn'   { '⚠️ ' }
        'fail'   { '❌' }
        'update' { '🔄' }
        'paused' { '⏸ ' }
        default  { '? ' }
    }
}

function Get-Role {
    $mcpPath = "$script:ClaudeDir\mcp.json"
    if (-not (Test-Path $mcpPath)) { return 'unknown' }
    $mcp = Get-Content $mcpPath -Raw -ErrorAction SilentlyContinue
    if ($mcp -match '"shadcn"')  { return 'engineer' }
    if ($mcp -match '"linear"')  { return 'business' }
    if ($mcp -match '"figma"')   { return 'content' }
    if ($mcp -match '"posthog"') { return 'ops' }
    'unknown'
}

function Test-FileFreshness {
    param([string]$Path, [int]$MaxDays = 7)
    if (-not (Test-Path $Path)) { return [int]::MaxValue }
    ((Get-Date) - (Get-Item $Path).LastWriteTime).Days
}
