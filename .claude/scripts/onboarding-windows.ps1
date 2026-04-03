# =============================================================================
# Computer Onboarding — Windows
# =============================================================================
# Fresh Windows to fully working dev environment in one command.
#
# Usage (run PowerShell as Administrator):
#   .\onboarding-windows.ps1 -Role engineer [-GistId abc123]
#
# Roles:
#   engineer — WebStorm, all repos, Claude Code CLI, hogwarts local dev
#   content  — Claude Desktop, translation, content tools
#   ops      — Monitoring, costs, incident tools
#   business — Proposals, pricing, client workflows
#
# One-liner (PowerShell as Admin):
#   git clone https://github.com/databayt/kun.git $HOME\kun; & $HOME\kun\.claude\scripts\onboarding-windows.ps1 -Role engineer
#
# Duration: ~15-20 minutes (mostly downloads)
# =============================================================================

param(
    [ValidateSet("engineer", "business", "content", "ops")]
    [string]$Role,
    [string]$GistId
)

$ErrorActionPreference = "Stop"

if (-not $Role) {
    Write-Host "Computer Onboarding — Windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\onboarding-windows.ps1 -Role <role> [-GistId <id>]"
    Write-Host ""
    Write-Host "Roles:"
    Write-Host "  engineer  — WebStorm, all repos, Claude Code CLI, hogwarts local dev"
    Write-Host "  content   — Claude Desktop, translation, content tools"
    Write-Host "  ops       — Monitoring, costs, incident tools"
    Write-Host "  business  — Proposals, pricing, client workflows"
    Write-Host ""
    Write-Host "One-liner:"
    Write-Host '  git clone https://github.com/databayt/kun.git $HOME\kun; & $HOME\kun\.claude\scripts\onboarding-windows.ps1 -Role engineer'
    exit 0
}

$ERRORS = 0
$HOME_DIR = $env:USERPROFILE
$CLAUDE_DIR = "$HOME_DIR\.claude"
$KUN_DIR = "$HOME_DIR\kun"

function Pass($msg) { Write-Host "  + $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  x $msg" -ForegroundColor Red; $script:ERRORS++ }
function Info($msg) { Write-Host "  . $msg" -ForegroundColor DarkGray }
function Step($num, $msg) { Write-Host ""; Write-Host "[$num/8] $msg" -ForegroundColor Cyan }
function Pause-For($msg) {
    Write-Host "  ! $msg" -ForegroundColor Yellow
    Read-Host "  Press Enter when done"
}

Write-Host ""
Write-Host "Computer Onboarding — Windows" -ForegroundColor Cyan
Write-Host "Role: $Role" -ForegroundColor Green
Write-Host ""

# =============================================================================
# PHASE 1: System Foundation
# =============================================================================
Step "1" "System Foundation — winget, Git, Node.js, pnpm"

# winget (ships with Windows 11, Windows 10 may need App Installer from Store)
$hasWinget = Get-Command winget -EA SilentlyContinue
if (-not $hasWinget) {
    Write-Host "  winget not found. Install 'App Installer' from Microsoft Store." -ForegroundColor Yellow
    Pause-For "Install 'App Installer' from Microsoft Store, then press Enter"
}

# Git
$hasGit = Get-Command git -EA SilentlyContinue
if (-not $hasGit) {
    Info "Installing Git..."
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Pass "Git installed"
} else {
    Pass "Git ($(git --version))"
}

# GitHub CLI
$hasGh = Get-Command gh -EA SilentlyContinue
if (-not $hasGh) {
    Info "Installing GitHub CLI..."
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Pass "GitHub CLI installed"
} else {
    Pass "GitHub CLI"
}

# Node.js
$hasNode = Get-Command node -EA SilentlyContinue
if (-not $hasNode) {
    Info "Installing Node.js..."
    winget install --id OpenJS.NodeJS -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Pass "Node.js installed"
} else {
    Pass "Node.js ($(node --version))"
}

# pnpm
$hasPnpm = Get-Command pnpm -EA SilentlyContinue
if (-not $hasPnpm) {
    Info "Installing pnpm..."
    npm install -g pnpm
    Pass "pnpm installed"
} else {
    Pass "pnpm ($(pnpm --version))"
}

# =============================================================================
# PHASE 2: Applications
# =============================================================================
Step "2" "Applications"

if ($Role -eq "engineer") {
    # WebStorm
    $wsPath = "${env:ProgramFiles}\JetBrains\WebStorm*"
    $wsLocal = "$HOME_DIR\AppData\Local\JetBrains\Toolbox\apps\WebStorm"
    if (-not (Test-Path $wsPath) -and -not (Test-Path $wsLocal)) {
        Info "Installing WebStorm..."
        winget install --id JetBrains.WebStorm -e --accept-source-agreements --accept-package-agreements 2>$null
        if ($?) { Pass "WebStorm installed" } else { Info "WebStorm — install manually from jetbrains.com" }
    } else {
        Pass "WebStorm"
    }

    # VS Code
    $hasCode = Get-Command code -EA SilentlyContinue
    if (-not $hasCode) {
        Info "Installing VS Code..."
        winget install --id Microsoft.VisualStudioCode -e --accept-source-agreements --accept-package-agreements
        Pass "VS Code installed"
    } else {
        Pass "VS Code"
    }
}

# Chrome
$chromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$chromePath86 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath) -and -not (Test-Path $chromePath86)) {
    Info "Installing Chrome..."
    winget install --id Google.Chrome -e --accept-source-agreements --accept-package-agreements
    Pass "Chrome installed"
} else {
    Pass "Chrome"
}

# =============================================================================
# PHASE 3: GitHub
# =============================================================================
Step "3" "GitHub — SSH key, authentication, git config"

# Git identity
$gitName = git config --global user.name 2>$null
if (-not $gitName) {
    $gitName = Read-Host "  Full name (for git commits)"
    $gitEmail = Read-Host "  Email (for git commits)"
    git config --global user.name $gitName
    git config --global user.email $gitEmail
    Pass "Git config: $gitName <$gitEmail>"
} else {
    Pass "Git config: $gitName"
}

# SSH key
$sshKey = "$HOME_DIR\.ssh\id_ed25519"
if (-not (Test-Path $sshKey)) {
    $gitEmail = git config --global user.email
    Info "Generating SSH key..."
    New-Item -ItemType Directory -Force -Path "$HOME_DIR\.ssh" | Out-Null
    ssh-keygen -t ed25519 -C $gitEmail -f $sshKey -N '""'
    # Start ssh-agent service
    $sshAgent = Get-Service ssh-agent -EA SilentlyContinue
    if ($sshAgent) {
        if ($sshAgent.Status -ne "Running") {
            Set-Service ssh-agent -StartupType Automatic
            Start-Service ssh-agent
        }
        ssh-add $sshKey 2>$null
    }
    Pass "SSH key generated"
} else {
    Pass "SSH key exists"
}

# GitHub auth
$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Info "Logging into GitHub (browser will open)..."
    gh auth login -p ssh -w
    Pass "GitHub authenticated"
} else {
    $ghUser = gh api user --jq '.login' 2>$null
    Pass "GitHub authenticated ($ghUser)"
}

# Push SSH key to GitHub
$keyContent = Get-Content "$sshKey.pub" -EA SilentlyContinue
if ($keyContent) {
    $hostname = $env:COMPUTERNAME
    gh ssh-key add "$sshKey.pub" --title "databayt-$hostname" 2>$null
    if ($?) { Pass "SSH key on GitHub" } else { Info "SSH key may already be on GitHub" }
}

# =============================================================================
# PHASE 4: Clone Repositories
# =============================================================================
Step "4" "Clone Repositories"

function Clone-Repo($repo) {
    $dir = "$HOME_DIR\$repo"
    if (-not (Test-Path $dir)) {
        Info "Cloning $repo..."
        git clone "git@github.com:databayt/$repo.git" $dir 2>$null
        if (-not $?) {
            git clone "https://github.com/databayt/$repo.git" $dir 2>$null
            if ($?) { Pass "$repo (HTTPS)" } else { Fail "$repo clone failed" }
        } else {
            Pass "$repo"
        }
    } else {
        Pass "$repo (exists)"
    }
}

Clone-Repo "kun"
if ($Role -eq "engineer") {
    Clone-Repo "hogwarts"
    Clone-Repo "codebase"
}

# =============================================================================
# PHASE 5: Claude Ecosystem
# =============================================================================
Step "5" "Claude — CLI + Desktop"

# Claude Code CLI
$hasClaude = Get-Command claude -EA SilentlyContinue
if (-not $hasClaude) {
    Info "Installing Claude Code CLI..."
    irm https://claude.ai/install.ps1 | iex
    Pass "Claude Code CLI"
} else {
    Pass "Claude Code CLI"
}

# Claude Desktop
$claudeDesktop = "$HOME_DIR\AppData\Local\Programs\claude-desktop\Claude.exe"
$claudeDesktop2 = "${env:ProgramFiles}\Claude\Claude.exe"
if (-not (Test-Path $claudeDesktop) -and -not (Test-Path $claudeDesktop2)) {
    Info "Installing Claude Desktop..."
    winget install --id Anthropic.Claude -e --accept-source-agreements --accept-package-agreements 2>$null
    if ($?) { Pass "Claude Desktop" } else { Info "Claude Desktop — install from claude.ai/download" }
} else {
    Pass "Claude Desktop"
}

# =============================================================================
# PHASE 6: Kun Engine
# =============================================================================
Step "6" "Kun Engine — agents, skills, MCP, rules"

$setupScript = "$KUN_DIR\.claude\scripts\setup.ps1"
if (Test-Path $setupScript) {
    & $setupScript -Role $Role
    Pass "Kun Engine ($Role)"
} else {
    Fail "Kun repo missing setup.ps1"
}

# Secrets
if ($GistId) {
    $secretsScript = "$KUN_DIR\.claude\scripts\secrets.ps1"
    if (Test-Path $secretsScript) {
        & $secretsScript -GistId $GistId
        Pass "Secrets loaded"
    }
} else {
    Info "Secrets skipped — run later: .\.claude\scripts\secrets.ps1 -GistId <ID>"
}

# =============================================================================
# PHASE 7: Hogwarts Local Dev
# =============================================================================
Step "7" "Hogwarts — dependencies, database, seed"

$HOGWARTS_DIR = "$HOME_DIR\hogwarts"

if ($Role -eq "engineer" -and (Test-Path $HOGWARTS_DIR)) {
    Push-Location $HOGWARTS_DIR

    # .env
    if (-not (Test-Path ".env")) {
        if (Test-Path "$CLAUDE_DIR\.env") {
            Copy-Item "$CLAUDE_DIR\.env" ".env"
            Pass ".env from secrets"
        } else {
            Info ".env missing — need gist ID"
        }
    } else {
        Pass ".env exists"
    }

    # Dependencies
    Info "Installing dependencies..."
    pnpm install 2>&1 | Select-Object -Last 1
    Pass "pnpm install"

    # Prisma
    Info "Generating Prisma client..."
    npx prisma generate 2>&1 | Select-Object -Last 1
    Pass "Prisma client"

    # Database
    if ((Test-Path ".env") -and (Select-String -Path ".env" -Pattern "DATABASE_URL" -Quiet)) {
        Info "Pushing schema to database..."
        npx prisma db push --skip-generate 2>&1 | Select-Object -Last 3
        Pass "Database schema"

        Info "Seeding database..."
        pnpm db:seed 2>&1 | Select-Object -Last 3
        Pass "Database seeded"
    } else {
        Info "Database skipped — no DATABASE_URL"
    }

    # Build
    Info "Testing build..."
    $buildResult = pnpm build 2>&1
    if ($LASTEXITCODE -eq 0) { Pass "Build passes" } else { Info "Build issues — run 'pnpm build'" }

    Pop-Location
} elseif ($Role -eq "engineer") {
    Info "Hogwarts not cloned — skipped"
} else {
    Info "Hogwarts skipped (role: $Role)"
}

# =============================================================================
# PHASE 8: Health Check
# =============================================================================
Step "8" "Health Check"

$ERRORS = 0

# Tools
if (Get-Command git -EA SilentlyContinue)    { Pass "git" }    else { Fail "git" }
if (Get-Command node -EA SilentlyContinue)   { Pass "node" }   else { Fail "node" }
if (Get-Command pnpm -EA SilentlyContinue)   { Pass "pnpm" }   else { Fail "pnpm" }
if (Get-Command gh -EA SilentlyContinue)     { Pass "gh" }     else { Fail "gh" }
if (Get-Command claude -EA SilentlyContinue) { Pass "claude" } else { Fail "claude" }

# Auth
if (Test-Path "$HOME_DIR\.ssh\id_ed25519")   { Pass "SSH key" }    else { Fail "SSH key" }
$ghCheck = gh auth status 2>&1
if ($LASTEXITCODE -eq 0) { Pass "GitHub auth" } else { Fail "GitHub auth" }

# Repos
if (Test-Path "$KUN_DIR")                    { Pass "kun repo" }     else { Fail "kun" }
if ($Role -eq "engineer") {
    if (Test-Path "$HOGWARTS_DIR")            { Pass "hogwarts repo" } else { Fail "hogwarts" }
    if (Test-Path "$HOME_DIR\codebase")       { Pass "codebase repo" } else { Fail "codebase" }
    if (Test-Path "$HOGWARTS_DIR\.env")       { Pass "hogwarts .env" } else { Info "hogwarts .env (need gist)" }
    if (Test-Path "$HOGWARTS_DIR\node_modules") { Pass "hogwarts deps" } else { Info "hogwarts deps" }
}

# Kun Engine
if (Test-Path "$CLAUDE_DIR\CLAUDE.md")       { Pass "Kun CLAUDE.md" }  else { Fail "CLAUDE.md" }
if (Test-Path "$CLAUDE_DIR\settings.json")   { Pass "settings.json" }  else { Fail "settings.json" }
if (Test-Path "$CLAUDE_DIR\mcp.json")        { Pass "mcp.json" }      else { Fail "mcp.json" }

# =============================================================================
# Done
# =============================================================================
Write-Host ""
Write-Host ("=" * 45) -ForegroundColor Cyan
if ($ERRORS -eq 0) {
    Write-Host "Windows onboarding complete! Role: $Role" -ForegroundColor Green
} else {
    Write-Host "Onboarding complete with $ERRORS issue(s)" -ForegroundColor Yellow
}
Write-Host ("=" * 45) -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart PowerShell"
Write-Host "  2. Run 'claude' -> log in with Anthropic account"
Write-Host "  3. Open Claude Desktop -> sign in"
if (-not $GistId) {
    Write-Host "  4. Get secrets gist ID from Abdout:"
    Write-Host "     & ~\kun\.claude\scripts\secrets.ps1 -GistId <ID>"
}
if ($Role -eq "engineer") {
    Write-Host ""
    Write-Host "Run hogwarts:" -ForegroundColor Cyan
    Write-Host "  cd ~\hogwarts; pnpm dev"
    Write-Host "  http://localhost:3000"
    Write-Host "  Admin: admin@kingfahad.edu / 1234"
}
Write-Host ""
Write-Host "Re-run: & ~\kun\.claude\scripts\onboarding-windows.ps1 -Role $Role" -ForegroundColor DarkGray
