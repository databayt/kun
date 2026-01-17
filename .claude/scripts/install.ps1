# Claude Code Team Configuration Installer (Windows PowerShell)
# Usage: irm https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$BACKUP_DIR = "$env:USERPROFILE\.claude-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "=== Claude Code Team Configuration Installer ===" -ForegroundColor Cyan
Write-Host ""

# Check if Claude Code is installed
$claudePath = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudePath) {
    Write-Host "Installing Claude Code CLI..."
    irm https://claude.ai/install.ps1 | iex
}

# Backup existing config
if (Test-Path $CLAUDE_DIR) {
    Write-Host "Backing up existing config to $BACKUP_DIR..."
    Move-Item $CLAUDE_DIR $BACKUP_DIR
}

# Create directory structure
Write-Host "Creating directory structure..."
New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\agents" | Out-Null
New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\commands" | Out-Null
New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\memory" | Out-Null
New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$CLAUDE_DIR\bmad" | Out-Null

# Download config files from GitHub
Write-Host "Downloading team configuration..."
$BASE_URL = "https://raw.githubusercontent.com/databayt/kun/main/.claude"

Invoke-WebRequest -Uri "$BASE_URL/CLAUDE.md" -OutFile "$CLAUDE_DIR\CLAUDE.md"
Invoke-WebRequest -Uri "$BASE_URL/settings-windows.json" -OutFile "$CLAUDE_DIR\settings.json"
Invoke-WebRequest -Uri "$BASE_URL/mcp.json" -OutFile "$CLAUDE_DIR\mcp.json"

# Download agents
Write-Host "Downloading agents..."
$agents = @("architecture", "atom", "block", "build", "deploy", "git-github", "i18n", "middleware", "nextjs", "pattern", "performance", "prisma", "react", "report", "shadcn", "structure", "tailwind", "template", "test", "typescript")
foreach ($agent in $agents) {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/agents/$agent.md" -OutFile "$CLAUDE_DIR\agents\$agent.md" -ErrorAction SilentlyContinue
    } catch {}
}

# Download commands
Write-Host "Downloading commands..."
$commands = @("dev", "build", "deploy", "block", "codebase", "saas", "docs", "test", "security", "performance")
foreach ($cmd in $commands) {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/commands/$cmd.md" -OutFile "$CLAUDE_DIR\commands\$cmd.md" -ErrorAction SilentlyContinue
    } catch {}
}

# Create local overrides file
New-Item -ItemType File -Force -Path "$CLAUDE_DIR\CLAUDE.local.md" | Out-Null

# Add to PATH via environment variable
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$claudeBinPath = "$CLAUDE_DIR\bin"
if ($currentPath -notlike "*$claudeBinPath*") {
    Write-Host "Adding Claude to PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$claudeBinPath", "User")
}

# Create PowerShell alias
$profilePath = $PROFILE.CurrentUserAllHosts
if (-not (Test-Path $profilePath)) {
    New-Item -ItemType File -Force -Path $profilePath | Out-Null
}
$aliasLine = "Set-Alias -Name c -Value claude"
if (-not (Select-String -Path $profilePath -Pattern "Set-Alias.*claude" -Quiet -ErrorAction SilentlyContinue)) {
    Add-Content -Path $profilePath -Value "`n# Claude Code`n$aliasLine"
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart PowerShell"
Write-Host "  2. Set environment variables (ask team lead for values):"
Write-Host '     $env:GITHUB_PERSONAL_ACCESS_TOKEN = "..."'
Write-Host '     $env:NEON_API_KEY = "..."'
Write-Host "  3. Run 'claude' or 'c' to start"
Write-Host ""
Write-Host "Config location: $CLAUDE_DIR"
Write-Host "Backup location: $BACKUP_DIR"
