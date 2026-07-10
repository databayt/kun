# Kun Engine Setup — install, update, and verify Claude Code config (Windows)
# Usage: cd ~/kun; .\.claude\scripts\setup.ps1 -Role <role> [-Quiet]
# Roles: engineer, business, content, ops
# The role persists to %USERPROFILE%\.claude\.kun-role, so refresh runs (and
# the daily maintain heartbeat) can omit it: .\setup.ps1 -Quiet
# Mirrors setup.sh — keep the two in lockstep.

param(
    [string]$Role,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$KUN_DIR = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$CLAUDE_DIR = "$env:USERPROFILE\.claude"

function Pass($msg) { if (-not $Quiet) { Write-Host "  ✓ $msg" -ForegroundColor Green } }
function Fail($msg) { Write-Host "  ✗ $msg" -ForegroundColor Red; $script:ERRORS++ }
function Info($msg) { if (-not $Quiet) { Write-Host "  · $msg" -ForegroundColor DarkGray } }
function Say($msg, $color) {
    if ($Quiet) { return }
    if ($color) { Write-Host $msg -ForegroundColor $color } else { Write-Host $msg }
}

# ── Role validation ──────────────────────────────────────────────
# Fall back to the persisted role so unattended refreshes need no args.
if (-not $Role -and (Test-Path "$CLAUDE_DIR\.kun-role")) {
    $Role = (Get-Content "$CLAUDE_DIR\.kun-role" -Raw).Trim()
}

if (-not $Role) {
    Write-Host "Kun Engine Setup" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\.claude\scripts\setup.ps1 -Role <role> [-Quiet]"
    Write-Host ""
    Write-Host "Roles:"
    Write-Host "  engineer  - full agent fleet, all MCPs, all skills, hooks"
    Write-Host "  business  - Cowork, Stripe, proposals, client workflows"
    Write-Host "  content   - Cowork, translation, content calendar, Figma"
    Write-Host "  ops       - monitoring, costs, incidents, Sentry, Vercel"
    Write-Host ""
    Write-Host "One-liner:"
    Write-Host '  cd ~/kun; .\.claude\scripts\setup.ps1 -Role engineer'
    exit 0
}

if ($Role -notin @("engineer", "business", "content", "ops")) {
    Write-Host "Invalid role: $Role" -ForegroundColor Red
    Write-Host "Valid: engineer, business, content, ops"
    exit 1
}

$MODE = if (Test-Path "$CLAUDE_DIR\agents") { "update" } else { "install" }
$ERRORS = 0

Say "Kun Engine Setup — $Role ($MODE)" Cyan
Say ""

# ── Common config (all roles) ────────────────────────────────────
Say "Common config" Cyan

@("agents", "commands", "rules", "memory", "scripts", "skills") | ForEach-Object {
    New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\$_" | Out-Null
}
Set-Content -Path "$CLAUDE_DIR\.kun-role" -Value $Role
Info "directories"

# User-global CLAUDE.md — install from the TEMPLATE only if missing. Never
# clobber: %USERPROFILE%\.claude\CLAUDE.md is the teammate's personal global
# config; the kun PROJECT CLAUDE.md loads separately inside the repo and must
# not overwrite it.
if (-not (Test-Path "$CLAUDE_DIR\CLAUDE.md")) {
    if (Test-Path "$KUN_DIR\.claude\templates\user-CLAUDE.md") {
        Copy-Item "$KUN_DIR\.claude\templates\user-CLAUDE.md" "$CLAUDE_DIR\CLAUDE.md"
        Info "CLAUDE.md (installed from template)"
    } else {
        Copy-Item "$KUN_DIR\.claude\CLAUDE.md" "$CLAUDE_DIR\CLAUDE.md"
        Info "CLAUDE.md (template missing — used project copy)"
    }
} else {
    Info "CLAUDE.md (existing — left untouched)"
}

Get-ChildItem "$KUN_DIR\.claude\agents\*.md" -EA SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$CLAUDE_DIR\agents\" -Force
}
$agentCount = (Get-ChildItem "$CLAUDE_DIR\agents\*.md" -EA SilentlyContinue).Count
Info "agents ($agentCount)"

if (Test-Path "$KUN_DIR\.claude\rules") {
    Get-ChildItem "$KUN_DIR\.claude\rules\*.md" -EA SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$CLAUDE_DIR\rules\" -Force
    }
}
$ruleCount = (Get-ChildItem "$CLAUDE_DIR\rules\*.md" -EA SilentlyContinue).Count
Info "rules ($ruleCount)"

Get-ChildItem "$KUN_DIR\.claude\memory\*.json" -EA SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$CLAUDE_DIR\memory\" -Force
}
Info "memory"

Get-ChildItem "$KUN_DIR\.claude\scripts\*" -File -EA SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$CLAUDE_DIR\scripts\" -Force
}
Info "scripts"

# Shared script libs (health.ps1/health.sh source lib helpers — keep the
# installed copy self-contained)
if (Test-Path "$KUN_DIR\.claude\scripts\lib") {
    New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\scripts\lib" | Out-Null
    Get-ChildItem "$KUN_DIR\.claude\scripts\lib\*" -File -EA SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$CLAUDE_DIR\scripts\lib\" -Force
    }
    Info "scripts/lib"
}

Say ""

# ── Full config (universal — every machine is a full autonomous worker) ──
# Role no longer scopes capability; it's only a label + secrets-trust tier.
# Secrets stay scoped via which Gist you're handed — MCP servers without a
# key simply don't connect, so a full mcp.json is safe everywhere.
Say "Full config" Cyan

# Commands are retired — kun verbs are skills now (a same-named skill shadows
# a command anyway). Prune stale commands copies of migrated names.
$prunedCmds = 0
Get-ChildItem "$CLAUDE_DIR\commands\*.md" -EA SilentlyContinue | ForEach-Object {
    $base = $_.BaseName
    if (Test-Path "$KUN_DIR\.claude\skills\$base\SKILL.md") {
        Remove-Item $_.FullName -Force
        $prunedCmds++
    }
}
if ($prunedCmds -gt 0) { Info "pruned $prunedCmds shadowed command(s)" }

# All workflows (saved multi-agent scripts — resolved by Workflow({ name }))
if (Test-Path "$KUN_DIR\.claude\workflows") {
    New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\workflows" | Out-Null
    Get-ChildItem "$KUN_DIR\.claude\workflows\*.js" -EA SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$CLAUDE_DIR\workflows\" -Force
    }
    $wfCount = (Get-ChildItem "$CLAUDE_DIR\workflows\*.js" -EA SilentlyContinue).Count
    Info "workflows ($wfCount)"
}

# All kun-authored skills (each is a dir: SKILL.md + optional scripts/ + references/)
if (Test-Path "$KUN_DIR\.claude\skills") {
    Copy-Item "$KUN_DIR\.claude\skills\*" "$CLAUDE_DIR\skills\" -Recurse -Force
    $skillCount = (Get-ChildItem "$CLAUDE_DIR\skills" -Directory -EA SilentlyContinue).Count
    Info "skills ($skillCount)"
}

# ── Manifest prune ───────────────────────────────────────────────
# The manifest records what THIS installer shipped; a manifest-listed item
# that has since left the kun source gets pruned. Personal (non-manifest)
# items are never touched; first run (no manifest yet) prunes nothing.
$manifestPath = "$CLAUDE_DIR\.kun-manifest.json"

function Get-SourceNames($path, $kind) {
    if (-not (Test-Path $path)) { return @() }
    if ($kind -eq "dir") {
        return @(Get-ChildItem $path -Directory | ForEach-Object { $_.Name } | Sort-Object)
    }
    return @(Get-ChildItem "$path\*$kind" -File -EA SilentlyContinue | ForEach-Object { $_.Name } | Sort-Object)
}

$srcNames = @{
    skills    = Get-SourceNames "$KUN_DIR\.claude\skills" "dir"
    agents    = Get-SourceNames "$KUN_DIR\.claude\agents" ".md"
    workflows = Get-SourceNames "$KUN_DIR\.claude\workflows" ".js"
    rules     = Get-SourceNames "$KUN_DIR\.claude\rules" ".md"
}

$prunedItems = @()
if (Test-Path $manifestPath) {
    try { $oldManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json } catch { $oldManifest = $null }
    if ($oldManifest) {
        $targets = @{
            skills    = @("$CLAUDE_DIR\skills", $true)
            agents    = @("$CLAUDE_DIR\agents", $false)
            workflows = @("$CLAUDE_DIR\workflows", $false)
            rules     = @("$CLAUDE_DIR\rules", $false)
        }
        foreach ($key in $targets.Keys) {
            $base = $targets[$key][0]
            $isDir = $targets[$key][1]
            foreach ($name in @($oldManifest.$key)) {
                if (-not $name) { continue }
                if ($srcNames[$key] -contains $name) { continue }  # still shipped
                $target = Join-Path $base $name
                if ($isDir -and (Test-Path $target -PathType Container)) {
                    Remove-Item $target -Recurse -Force
                    $prunedItems += "$key/$name"
                } elseif (-not $isDir -and (Test-Path $target -PathType Leaf)) {
                    Remove-Item $target -Force
                    $prunedItems += "$key/$name"
                }
            }
        }
    }
}

$newManifest = [ordered]@{
    schema    = 1
    ts        = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    skills    = $srcNames.skills
    agents    = $srcNames.agents
    workflows = $srcNames.workflows
    rules     = $srcNames.rules
}
$tmpManifest = "$manifestPath.tmp"
$newManifest | ConvertTo-Json -Depth 5 | Set-Content -Path $tmpManifest
Move-Item -Path $tmpManifest -Destination $manifestPath -Force

if ($prunedItems.Count -gt 0) {
    Info "pruned $($prunedItems.Count) stale engine item(s): $($prunedItems -join ' ')"
} else {
    Info "manifest current (no stale engine items)"
}

# Full agent index
if (Test-Path "$KUN_DIR\.claude\agents\_index.md") {
    Copy-Item "$KUN_DIR\.claude\agents\_index.md" "$CLAUDE_DIR\agents\_index.md" -Force
    Info "agent index (_index.md)"
}

# Full settings + hooks — engine-defined keys win, but personal top-level
# keys the engine doesn't define (model, effortLevel, voice, …) survive the
# refresh. Anything deeper than top level is engine territory.
$srcSettings = if (Test-Path "$KUN_DIR\.claude\settings-windows.json") {
    "$KUN_DIR\.claude\settings-windows.json"
} else {
    "$KUN_DIR\.claude\settings.json"
}
$mergedSettings = Get-Content $srcSettings -Raw | ConvertFrom-Json
if (Test-Path "$CLAUDE_DIR\settings.json") {
    try {
        $oldSettings = Get-Content "$CLAUDE_DIR\settings.json" -Raw | ConvertFrom-Json
        foreach ($prop in $oldSettings.PSObject.Properties) {
            if (-not ($mergedSettings.PSObject.Properties.Name -contains $prop.Name)) {
                $mergedSettings | Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value
            }
        }
    } catch { }
}
$tmpSettings = "$CLAUDE_DIR\settings.json.tmp"
$mergedSettings | ConvertTo-Json -Depth 10 | Set-Content -Path $tmpSettings
Move-Item -Path $tmpSettings -Destination "$CLAUDE_DIR\settings.json" -Force
Info "settings (engine keys refreshed, personal keys preserved)"

# Full MCP fleet
if (Test-Path "$KUN_DIR\.claude\mcp.json") {
    Copy-Item "$KUN_DIR\.claude\mcp.json" "$CLAUDE_DIR\mcp.json" -Force
    $mcpCount = (Select-String -Path "$CLAUDE_DIR\mcp.json" -Pattern '"description"' -EA SilentlyContinue).Count
    Info "MCP servers ($mcpCount)"
}

# Antigravity doctrine template (the ~/.gemini bridge itself is wired by
# antigravity-sync.sh, which is bash-only — on Windows run it via Git Bash
# or wire ~/.gemini manually; see /docs/antigravity)
if (Test-Path "$KUN_DIR\.claude\antigravity") {
    New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\antigravity" | Out-Null
    Get-ChildItem "$KUN_DIR\.claude\antigravity\*" -File -EA SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$CLAUDE_DIR\antigravity\" -Force
    }
    Info "antigravity doctrine"
}

# Codebase clone (every machine)
$codebaseDir = "$env:USERPROFILE\codebase"
if (-not (Test-Path $codebaseDir)) {
    Say ""
    Say "Cloning codebase..." Yellow
    git clone git@github.com:databayt/codebase.git $codebaseDir 2>$null
    if (-not (Test-Path $codebaseDir)) {
        git clone https://github.com/databayt/codebase.git $codebaseDir 2>$null
    }
    if (-not (Test-Path $codebaseDir)) {
        Info "clone failed — run manually: git clone git@github.com:databayt/codebase.git ~/codebase"
    }
}

# Claude CLI (install if missing)
if (-not (Get-Command claude -EA SilentlyContinue)) {
    Say ""
    Say "Installing Claude Code CLI..." Yellow
    irm https://claude.ai/install.ps1 | iex
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# Antigravity CLI — secondary agent (install if missing; non-fatal)
if (-not (Get-Command agy -EA SilentlyContinue)) {
    Say ""
    Say "Installing Antigravity CLI (secondary agent)..." Yellow
    try {
        irm https://antigravity.google/cli/install.ps1 | iex
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } catch {
        Info "Antigravity CLI install incomplete — re-run later"
    }
}

# Arm the daily maintain heartbeat (pull → refresh → health → report)
if (Test-Path "$KUN_DIR\.claude\scripts\maintain.ps1") {
    try {
        & "$KUN_DIR\.claude\scripts\maintain.ps1" -Install -Quiet
        Info "maintain heartbeat armed"
    } catch {
        Info "maintain scheduling failed (non-fatal)"
    }
}

Say ""

# ── Health check ─────────────────────────────────────────────────
Say "Health check" Cyan

if (Test-Path "$CLAUDE_DIR\CLAUDE.md") { Pass "CLAUDE.md" } else { Fail "CLAUDE.md missing" }
if (Test-Path "$CLAUDE_DIR\settings.json") { Pass "settings.json" } else { Fail "settings.json missing" }
if (Test-Path "$CLAUDE_DIR\mcp.json") { Pass "mcp.json" } else { Fail "mcp.json missing" }

# JSON validity
try { Get-Content "$CLAUDE_DIR\settings.json" -Raw | ConvertFrom-Json | Out-Null; Pass "settings.json valid JSON" }
catch { Fail "settings.json invalid JSON" }
try { Get-Content "$CLAUDE_DIR\mcp.json" -Raw | ConvertFrom-Json | Out-Null; Pass "mcp.json valid JSON" }
catch { Fail "mcp.json invalid JSON" }

# Directories
if ((Get-ChildItem "$CLAUDE_DIR\agents\*.md" -EA SilentlyContinue).Count -gt 0) { Pass "agents/ ($agentCount files)" } else { Fail "agents/ empty" }
if ((Get-ChildItem "$CLAUDE_DIR\skills" -Directory -EA SilentlyContinue).Count -gt 0) { Pass "skills/ ($skillCount dirs)" } else { Fail "skills/ empty" }
if (Test-Path "$CLAUDE_DIR\rules") { Pass "rules/" } else { Fail "rules/ missing" }
if (Test-Path "$CLAUDE_DIR\memory") { Pass "memory/" } else { Fail "memory/ missing" }

if (Test-Path "$CLAUDE_DIR\agents\_index.md") { Pass "agent index" } else { Info "no agent index (using all agents)" }

# Manifest
if (Test-Path $manifestPath) { Pass "manifest (.kun-manifest.json)" } else { Fail "manifest missing" }

# CLI
if (Get-Command claude -EA SilentlyContinue) { Pass "claude CLI installed" } else { Fail "claude CLI not found" }
if (Get-Command agy -EA SilentlyContinue) { Pass "agy CLI (secondary)" } else { Info "agy CLI not installed (optional)" }

Say ""

# ── Summary ──────────────────────────────────────────────────────
if ($ERRORS -eq 0) {
    Say "Setup complete — $Role ($MODE)" Green
} else {
    Write-Host "Setup complete with $ERRORS issue(s) — $Role ($MODE)" -ForegroundColor Yellow
}

Say ""
Say "Config: $CLAUDE_DIR" DarkGray
Say "Re-run anytime: cd ~/kun; .\.claude\scripts\setup.ps1 -Role $Role" DarkGray
