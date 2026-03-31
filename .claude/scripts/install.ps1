# Kun Engine Installer (Windows PowerShell)
# Usage: cd ~/kun; .\\.claude\scripts\install.ps1 [-Role engineer|business|content]
# Roles: engineer (default), business, content

param(
    [ValidateSet("engineer", "business", "content", "ops")]
    [string]$Role = "engineer"
)

$ErrorActionPreference = "Stop"

$KUN_DIR = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$BACKUP_DIR = "$env:USERPROFILE\.claude-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "=== Kun Engine Installer ===" -ForegroundColor Cyan
Write-Host "Role: $Role" -ForegroundColor Green
Write-Host ""

# Check if Claude Code is installed
$claudePath = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudePath) {
    Write-Host "Installing Claude Code CLI..." -ForegroundColor Yellow
    irm https://claude.ai/install.ps1 | iex
}

# Backup existing config
if (Test-Path $CLAUDE_DIR) {
    Write-Host "Backing up existing config to $BACKUP_DIR..." -ForegroundColor Yellow
    Copy-Item -Recurse $CLAUDE_DIR $BACKUP_DIR
}

# Create directory structure
Write-Host "Creating directory structure..."
@("agents", "commands", "rules", "memory", "scripts") | ForEach-Object {
    New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\$_" | Out-Null
}

# Copy CLAUDE.md (all roles)
Write-Host "Installing CLAUDE.md..."
Copy-Item "$KUN_DIR\.claude\CLAUDE.md" "$CLAUDE_DIR\CLAUDE.md" -Force

# Copy agents (all roles)
Write-Host "Installing agents..."
Get-ChildItem "$KUN_DIR\.claude\agents\*.md" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$CLAUDE_DIR\agents\" -Force
}

# Copy role-specific agent index
$roleIndex = "$KUN_DIR\.claude\agents\_index-$Role.md"
if (Test-Path $roleIndex) {
    Copy-Item $roleIndex "$CLAUDE_DIR\agents\_index.md" -Force
}

# Copy commands/skills based on role
Write-Host "Installing skills for $Role..."
if ($Role -eq "engineer") {
    Get-ChildItem "$KUN_DIR\.claude\commands\*.md" -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$CLAUDE_DIR\commands\" -Force
    }
} elseif ($Role -eq "business") {
    @("docs", "repos", "screenshot", "codebase", "proposal", "pricing", "weekly") | ForEach-Object {
        $src = "$KUN_DIR\.claude\commands\$_.md"
        if (Test-Path $src) { Copy-Item $src "$CLAUDE_DIR\commands\" -Force }
    }
} elseif ($Role -eq "content") {
    @("docs", "repos", "screenshot", "codebase", "translate", "content-calendar", "weekly") | ForEach-Object {
        $src = "$KUN_DIR\.claude\commands\$_.md"
        if (Test-Path $src) { Copy-Item $src "$CLAUDE_DIR\commands\" -Force }
    }
} elseif ($Role -eq "ops") {
    @("docs", "repos", "screenshot", "codebase", "monitor", "costs", "incident", "weekly") | ForEach-Object {
        $src = "$KUN_DIR\.claude\commands\$_.md"
        if (Test-Path $src) { Copy-Item $src "$CLAUDE_DIR\commands\" -Force }
    }
}

# Copy rules (all roles)
Write-Host "Installing rules..."
if (Test-Path "$KUN_DIR\.claude\rules") {
    Get-ChildItem "$KUN_DIR\.claude\rules\*.md" -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$CLAUDE_DIR\rules\" -Force
    }
}

# Copy memory files
Write-Host "Installing memory..."
Get-ChildItem "$KUN_DIR\.claude\memory\*.json" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$CLAUDE_DIR\memory\" -Force
}

# Copy scripts
Write-Host "Installing scripts..."
Get-ChildItem "$KUN_DIR\.claude\scripts\*" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$CLAUDE_DIR\scripts\" -Force
}

# Install settings based on role
Write-Host "Installing settings..."
if ($Role -eq "engineer") {
    Copy-Item "$KUN_DIR\.claude\settings-windows.json" "$CLAUDE_DIR\settings.json" -Force
} else {
    @'
{
  "env": {
    "CODEBASE_PATH": "",
    "DEV_PORT": "3000"
  }
}
'@ | Set-Content "$CLAUDE_DIR\settings.json"
}

# Install MCP servers based on role
Write-Host "Installing MCP servers for $Role..."
if ($Role -eq "engineer") {
    Copy-Item "$KUN_DIR\.claude\mcp.json" "$CLAUDE_DIR\mcp.json" -Force
} elseif ($Role -eq "business") {
    Copy-Item "$KUN_DIR\.claude\mcp-business.json" "$CLAUDE_DIR\mcp.json" -Force
} elseif ($Role -eq "content") {
    Copy-Item "$KUN_DIR\.claude\mcp-content.json" "$CLAUDE_DIR\mcp.json" -Force
} elseif ($Role -eq "ops") {
    Copy-Item "$KUN_DIR\.claude\mcp-ops.json" "$CLAUDE_DIR\mcp.json" -Force
}

# Add PowerShell alias
$profilePath = $PROFILE.CurrentUserAllHosts
if (-not (Test-Path $profilePath)) {
    New-Item -ItemType File -Force -Path $profilePath | Out-Null
}
if (-not (Select-String -Path $profilePath -Pattern "claude" -Quiet -ErrorAction SilentlyContinue)) {
    Add-Content -Path $profilePath -Value "`n# Claude Code (Kun Engine)"
}

# Clone codebase reference (engineers only)
if ($Role -eq "engineer") {
    $CODEBASE_DIR = "$env:USERPROFILE\codebase"
    if (-not (Test-Path $CODEBASE_DIR)) {
        Write-Host "Cloning pattern library to $CODEBASE_DIR..." -ForegroundColor Yellow
        try {
            git clone "git@github.com:databayt/codebase.git" $CODEBASE_DIR
        } catch {
            try {
                git clone "https://github.com/databayt/codebase.git" $CODEBASE_DIR
            } catch {
                Write-Host "Could not clone codebase. Clone manually later." -ForegroundColor Yellow
            }
        }
    }
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Role: $Role"
Write-Host "Config: $CLAUDE_DIR"
if (Test-Path $BACKUP_DIR) { Write-Host "Backup: $BACKUP_DIR" }
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
if ($Role -eq "engineer") {
    Write-Host "  1. Restart PowerShell"
    Write-Host "  2. Run: .\$CLAUDE_DIR\scripts\secrets.ps1 -GistId <GIST_ID>"
    Write-Host "  3. Run: claude"
} else {
    Write-Host "  1. Restart PowerShell"
    Write-Host "  2. Open Claude Desktop or claude.ai/code"
}
Write-Host ""
Write-Host "Setup time: ~5 minutes"
