# Kun Engine Setup — install, update, and verify Claude Code config
# Usage: cd ~/kun; .\.claude\scripts\setup.ps1 -Role <role>
# Roles: engineer, business, content, ops

param(
    [ValidateSet("engineer", "business", "content", "ops")]
    [string]$Role
)

$ErrorActionPreference = "Stop"

if (-not $Role) {
    Write-Host "Kun Engine Setup" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\.claude\scripts\setup.ps1 -Role <role>"
    Write-Host ""
    Write-Host "Roles:"
    Write-Host "  engineer  - full agent fleet, all MCPs, all commands, hooks"
    Write-Host "  business  - Cowork, Stripe, proposals, client workflows"
    Write-Host "  content   - Cowork, translation, content calendar, Figma"
    Write-Host "  ops       - monitoring, costs, incidents, Sentry, Vercel"
    Write-Host ""
    Write-Host "One-liner:"
    Write-Host '  cd ~/kun; .\.claude\scripts\setup.ps1 -Role engineer'
    exit 0
}

$KUN_DIR = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$MODE = if (Test-Path "$CLAUDE_DIR\agents") { "update" } else { "install" }
$ERRORS = 0

function Pass($msg) { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  ✗ $msg" -ForegroundColor Red; $script:ERRORS++ }
function Info($msg) { Write-Host "  · $msg" -ForegroundColor DarkGray }

Write-Host "Kun Engine Setup — $Role ($MODE)" -ForegroundColor Cyan
Write-Host ""

# ── Common config ────────────────────────────────────────────────
Write-Host "Common config" -ForegroundColor Cyan

@("agents", "commands", "rules", "memory", "scripts") | ForEach-Object {
    New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\$_" | Out-Null
}
Info "directories"

Copy-Item "$KUN_DIR\.claude\CLAUDE.md" "$CLAUDE_DIR\CLAUDE.md" -Force
Info "CLAUDE.md"

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

Get-ChildItem "$KUN_DIR\.claude\scripts\*" -EA SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$CLAUDE_DIR\scripts\" -Force
}
Info "scripts"

Write-Host ""

# ── Scoped config ───────────────────────────────────────────────
Write-Host "Scoped config ($Role)" -ForegroundColor Cyan

$commonCmds = @("docs", "repos", "screenshot", "codebase")
switch ($Role) {
    "engineer" {
        Get-ChildItem "$KUN_DIR\.claude\commands\*.md" -EA SilentlyContinue | ForEach-Object {
            Copy-Item $_.FullName "$CLAUDE_DIR\commands\" -Force
        }
    }
    "business" {
        ($commonCmds + @("proposal", "pricing", "weekly")) | ForEach-Object {
            $src = "$KUN_DIR\.claude\commands\$_.md"
            if (Test-Path $src) { Copy-Item $src "$CLAUDE_DIR\commands\" -Force }
        }
    }
    "content" {
        ($commonCmds + @("translate", "content-calendar", "weekly")) | ForEach-Object {
            $src = "$KUN_DIR\.claude\commands\$_.md"
            if (Test-Path $src) { Copy-Item $src "$CLAUDE_DIR\commands\" -Force }
        }
    }
    "ops" {
        ($commonCmds + @("monitor", "costs", "incident", "weekly")) | ForEach-Object {
            $src = "$KUN_DIR\.claude\commands\$_.md"
            if (Test-Path $src) { Copy-Item $src "$CLAUDE_DIR\commands\" -Force }
        }
    }
}
$cmdCount = (Get-ChildItem "$CLAUDE_DIR\commands\*.md" -EA SilentlyContinue).Count
Info "commands ($cmdCount)"

# Agent index
$roleIndex = if ($Role -eq "engineer") { "$KUN_DIR\.claude\agents\_index.md" } else { "$KUN_DIR\.claude\agents\_index-$Role.md" }
if (Test-Path $roleIndex) {
    Copy-Item $roleIndex "$CLAUDE_DIR\agents\_index.md" -Force
    Info "agent index (_index.md)"
}

# Settings
if ($Role -eq "engineer") {
    Copy-Item "$KUN_DIR\.claude\settings-windows.json" "$CLAUDE_DIR\settings.json" -Force
    Info "settings (full + hooks)"
} else {
    @'
{
  "env": {
    "DEV_PORT": "3000"
  }
}
'@ | Set-Content "$CLAUDE_DIR\settings.json"
    Info "settings (minimal)"
}

# MCP
$mcpFile = switch ($Role) {
    "engineer" { "$KUN_DIR\.claude\mcp.json" }
    "business" { "$KUN_DIR\.claude\mcp-business.json" }
    "content"  { "$KUN_DIR\.claude\mcp-content.json" }
    "ops"      { "$KUN_DIR\.claude\mcp-ops.json" }
}
if (Test-Path $mcpFile) {
    Copy-Item $mcpFile "$CLAUDE_DIR\mcp.json" -Force
    $mcpCount = (Select-String -Path "$CLAUDE_DIR\mcp.json" -Pattern '"description"' -EA SilentlyContinue).Count
    Info "MCP servers ($mcpCount)"
}

# CLI
$claudePath = Get-Command claude -EA SilentlyContinue
if (-not $claudePath) {
    Write-Host ""
    Write-Host "Installing Claude Code CLI..." -ForegroundColor Yellow
    irm https://claude.ai/install.ps1 | iex
}

Write-Host ""

# ── Health check ─────────────────────────────────────────────────
Write-Host "Health check" -ForegroundColor Cyan

if (Test-Path "$CLAUDE_DIR\CLAUDE.md") { Pass "CLAUDE.md" } else { Fail "CLAUDE.md missing" }
if (Test-Path "$CLAUDE_DIR\settings.json") { Pass "settings.json" } else { Fail "settings.json missing" }
if (Test-Path "$CLAUDE_DIR\mcp.json") { Pass "mcp.json" } else { Fail "mcp.json missing" }

# JSON validity
try { Get-Content "$CLAUDE_DIR\settings.json" | ConvertFrom-Json | Out-Null; Pass "settings.json valid JSON" }
catch { Fail "settings.json invalid JSON" }
try { Get-Content "$CLAUDE_DIR\mcp.json" | ConvertFrom-Json | Out-Null; Pass "mcp.json valid JSON" }
catch { Fail "mcp.json invalid JSON" }

# Directories
if ((Get-ChildItem "$CLAUDE_DIR\agents\*.md" -EA SilentlyContinue).Count -gt 0) { Pass "agents/ ($agentCount files)" } else { Fail "agents/ empty" }
if ((Get-ChildItem "$CLAUDE_DIR\commands\*.md" -EA SilentlyContinue).Count -gt 0) { Pass "commands/ ($cmdCount files)" } else { Fail "commands/ empty" }
if (Test-Path "$CLAUDE_DIR\rules") { Pass "rules/" } else { Fail "rules/ missing" }
if (Test-Path "$CLAUDE_DIR\memory") { Pass "memory/" } else { Fail "memory/ missing" }

if (Test-Path "$CLAUDE_DIR\agents\_index.md") { Pass "agent index" } else { Info "no agent index (using all agents)" }

if (Get-Command claude -EA SilentlyContinue) { Pass "claude CLI installed" } else { Fail "claude CLI not found" }

Write-Host ""

# ── Summary ──────────────────────────────────────────────────────
if ($ERRORS -eq 0) {
    Write-Host "Setup complete — $Role ($MODE)" -ForegroundColor Green
} else {
    Write-Host "Setup complete with $ERRORS issue(s) — $Role ($MODE)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Config: $CLAUDE_DIR" -ForegroundColor DarkGray
Write-Host "Re-run anytime: cd ~/kun; .\.claude\scripts\setup.ps1 -Role $Role" -ForegroundColor DarkGray
