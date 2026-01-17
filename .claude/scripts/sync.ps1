# Claude Code Team Configuration Sync (Windows PowerShell)
# Usage: & "$env:USERPROFILE\.claude\scripts\sync.ps1"

$ErrorActionPreference = "Stop"

$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$BASE_URL = "https://raw.githubusercontent.com/databayt/codebase/main/.claude"

Write-Host "=== Syncing Claude Code Configuration ===" -ForegroundColor Cyan
Write-Host ""

if (Test-Path "$CLAUDE_DIR\CLAUDE.local.md") {
    Write-Host "Your local customizations in CLAUDE.local.md will be preserved."
}

# Sync main files
Write-Host "Downloading latest configuration..."
Invoke-WebRequest -Uri "$BASE_URL/CLAUDE.md" -OutFile "$CLAUDE_DIR\CLAUDE.md"
Invoke-WebRequest -Uri "$BASE_URL/mcp.json" -OutFile "$CLAUDE_DIR\mcp.json"

# Sync agents (including product repo agents)
Write-Host "Syncing agents..."
$agents = @("architecture", "atom", "block", "build", "deploy", "git-github", "i18n", "middleware", "nextjs", "pattern", "performance", "prisma", "react", "report", "shadcn", "structure", "tailwind", "template", "test", "typescript", "hogwarts", "souq", "mkan", "shifa", "comment", "optimize", "semantic", "sse", "authjs")
foreach ($agent in $agents) {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/agents/$agent.md" -OutFile "$CLAUDE_DIR\agents\$agent.md" -ErrorAction SilentlyContinue
    } catch {}
}

# Sync commands (including repos command)
Write-Host "Syncing commands..."
$commands = @("dev", "build", "deploy", "block", "codebase", "saas", "docs", "test", "security", "performance", "repos", "atom", "template", "screenshot", "clone", "nextjs", "motion")
foreach ($cmd in $commands) {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/commands/$cmd.md" -OutFile "$CLAUDE_DIR\commands\$cmd.md" -ErrorAction SilentlyContinue
    } catch {}
}

# Sync memory files
Write-Host "Syncing memory files..."
$memoryFiles = @("atom", "template", "block", "report", "repositories")
foreach ($mem in $memoryFiles) {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/memory/$mem.json" -OutFile "$CLAUDE_DIR\memory\$mem.json" -ErrorAction SilentlyContinue
    } catch {}
}

# Sync scripts
Write-Host "Syncing scripts..."
$scripts = @("sync.sh", "sync.ps1", "sync-repos.sh", "sync-repos.ps1")
foreach ($script in $scripts) {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/scripts/$script" -OutFile "$CLAUDE_DIR\scripts\$script" -ErrorAction SilentlyContinue
    } catch {}
}

Write-Host ""
Write-Host "=== Sync Complete ===" -ForegroundColor Green
Write-Host "Run 'claude' to use updated configuration."
