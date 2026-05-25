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
    [string]$GistId,
    [switch]$Quiet,
    [string]$GitName,
    [string]$GitEmail,
    [switch]$EssentialsOnly,    # default: clone all org repos
    [switch]$HogwartsDev,        # optional: set up hogwarts local dev
    [string]$ReposDir = $env:USERPROFILE
)

$ErrorActionPreference = "Stop"

# Role is a label only - every machine gets the full config. Default to "engineer"
# when omitted, keep ValidateSet above for backward compat with explicit callers.
if (-not $Role) { $Role = "engineer" }

$ERRORS = 0
$HOME_DIR = $env:USERPROFILE
$CLAUDE_DIR = "$HOME_DIR\.claude"
$KUN_DIR = "$HOME_DIR\kun"

function Pass($msg) { Write-Host "  + $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  x $msg" -ForegroundColor Red; $script:ERRORS++ }
function Info($msg) { Write-Host "  . $msg" -ForegroundColor DarkGray }

# Open a URL in the user's default browser; silent on failure.
function Open-Url($url) {
    try { Start-Process $url -ErrorAction Stop | Out-Null } catch { }
}
# Copy text to the Windows clipboard.
function Copy-Clipboard($text) {
    try { Set-Clipboard -Value $text -ErrorAction Stop; return $true } catch { return $false }
}

function Step($num, $msg) {
    Write-Host ""
    Write-Host "[$num/8] $msg" -ForegroundColor Cyan
    # Machine-parseable progress line for wrapper UIs (stderr)
    [Console]::Error.WriteLine("PROGRESS:${num}/8:${msg}")
}
function Pause-For($msg) {
    if ($Quiet) { Info "$msg (quiet mode — skipped)"; return }
    Write-Host "  ! $msg" -ForegroundColor Yellow
    Read-Host "  Press Enter when done"
}
# Common winget flags; --silent + --disable-interactivity for unattended mode in -Quiet
$WingetFlags = @("-e", "--accept-source-agreements", "--accept-package-agreements")
if ($Quiet) { $WingetFlags += @("--silent", "--disable-interactivity") }

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
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
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

# Vercel CLI - needed for `vercel env pull` per-product .env (Phase 6)
$hasVercel = Get-Command vercel -EA SilentlyContinue
if (-not $hasVercel) {
    Info "Installing Vercel CLI..."
    npm install -g vercel
    Pass "Vercel CLI installed"
} else {
    Pass "Vercel CLI"
}

# =============================================================================
# PHASE 2: Applications
# =============================================================================
Step "2" "Applications"

# IDEs on every machine — full workstation regardless of role
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

# Remember if git identity is already set; we'll backfill from gh api user later
# (after auth) if it isn't. Placing this after auth lets the universal wizard skip
# asking for name/email up front.
$ExistingGitName = git config --global user.name 2>$null

# SSH key — comment is metadata only; gh auth ties it to the right user later
$sshKey = "$HOME_DIR\.ssh\id_ed25519"
if (-not (Test-Path $sshKey)) {
    Info "Generating SSH key..."
    New-Item -ItemType Directory -Force -Path "$HOME_DIR\.ssh" | Out-Null
    ssh-keygen -t ed25519 -C "databayt-onboarding-$env:COMPUTERNAME" -f $sshKey -N '""'
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
    Info "Connect your device to GitHub — opening the device page in your browser. If you don't have a GitHub account yet, sign up from that page (free)."
    Open-Url "https://github.com/login/device"

    # Capture gh's output via Tee-Object so a background watcher can pluck the
    # XXXX-XXXX one-time code and copy it to the clipboard — saves the user
    # from copying it by hand into the device page.
    $ghOut = [System.IO.Path]::GetTempFileName()
    $watcher = Start-Job -ScriptBlock {
        param($path)
        while ($true) {
            Start-Sleep -Milliseconds 300
            if (Test-Path $path) {
                $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
                if ($content -and ($content -match '([A-Z0-9]{4}-[A-Z0-9]{4})')) {
                    try { Set-Clipboard -Value $matches[1] -ErrorAction Stop } catch { }
                    break
                }
            }
        }
    } -ArgumentList $ghOut

    gh auth login -p ssh -w 2>&1 | Tee-Object -FilePath $ghOut
    Stop-Job $watcher -ErrorAction SilentlyContinue
    Remove-Job $watcher -ErrorAction SilentlyContinue
    Remove-Item $ghOut -ErrorAction SilentlyContinue

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

# Git identity - set only if not already configured. Priority:
#   1. -GitName/-GitEmail installer args (legacy compat)
#   2. existing ~/.gitconfig (idempotent re-runs)
#   3. gh api user (auto-derive from the GitHub account just authed)
#   4. $env:USERNAME fallback (quiet mode + gh unreachable)
if (-not $ExistingGitName) {
    if ($GitName) {
        $gitName = $GitName; $gitEmail = $GitEmail
        Info "Git identity from installer args"
    } else {
        $ghLogin = gh api user --jq '.login' 2>$null
        $ghName = gh api user --jq '.name // .login' 2>$null
        if ($ghLogin) {
            $gitName = $ghName
            $gitEmail = "$ghLogin@users.noreply.github.com"
            Info "Git identity auto-derived from GitHub ($ghLogin)"
        } elseif ($Quiet) {
            $gitName = $env:USERNAME
            $gitEmail = "$env:USERNAME@$env:COMPUTERNAME.local"
            Info "Quiet mode - placeholder git identity (override via 'git config --global')"
        } else {
            $gitName = Read-Host "  Full name (for git commits)"
            $gitEmail = Read-Host "  Email (for git commits)"
        }
    }
    git config --global user.name $gitName
    git config --global user.email $gitEmail
    Pass "Git config: $gitName <$gitEmail>"
} else {
    $gitEmail = git config --global user.email 2>$null
    Pass "Git config: $ExistingGitName <$gitEmail>"
}

# Pre-clone gate: must be an active member of github.com/databayt to clone private repos.
$state = (gh api user/memberships/orgs/databayt --jq .state 2>$null)
if (-not $state) {
    Fail "Cannot check databayt org membership (token may lack read:org scope)"
    Info "Run: gh auth refresh -h github.com -s read:org -w   then re-run this script"
    exit 1
} elseif ($state -ne "active") {
    Fail "Not an active member of github.com/databayt"
    Info "Open the invite, accept it, then re-run this script (idempotent)"
    Start-Process "https://github.com/orgs/databayt/invitations"
    exit 1
}
Pass "databayt org membership active"

# SSH push capability: ssh -T against github.com always exits non-zero, so grep the banner.
$sshOut = (ssh -T -o StrictHostKeyChecking=accept-new -o BatchMode=yes git@github.com 2>&1 | Out-String)
if ($sshOut -match "successfully authenticated") {
    Pass "SSH push to GitHub works"
} else {
    Fail "SSH not authenticated to GitHub (clone+push will fail)"
    Info "Re-run: gh auth login -p ssh -w   to upload your SSH key"
    exit 1
}

# =============================================================================
# PHASE 4: Clone Repositories
# =============================================================================
Step "4" "Clone Repositories"

if (-not (Test-Path $ReposDir)) { New-Item -ItemType Directory -Force -Path $ReposDir | Out-Null }

function Clone-Repo($repo) {
    $dir = "$ReposDir\$repo"
    if (-not (Test-Path $dir)) {
        Info "Cloning $repo -> $dir..."
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
function Symlink-Home($repo) {
    if ($ReposDir -eq $HOME_DIR) { return }
    $target = "$ReposDir\$repo"
    $link = "$HOME_DIR\$repo"
    if ((Test-Path $target) -and -not (Test-Path $link)) {
        try { New-Item -ItemType SymbolicLink -Path $link -Target $target -EA Stop | Out-Null; Info "$link -> $target" } catch {}
    }
}

# Every machine clones the full org — any machine can be any task.
Clone-Repo "kun"; Symlink-Home "kun"
Clone-Repo "hogwarts"; Symlink-Home "hogwarts"
Clone-Repo "codebase"; Symlink-Home "codebase"

if (-not $EssentialsOnly) {
    Info "Cloning remaining databayt org repos..."
    foreach ($repo in @("shadcn", "radix", "souq", "mkan", "shifa", "swift-app", "distributed-computer", "marketing")) {
        Clone-Repo $repo; Symlink-Home $repo
    }
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

# `c` launcher functions in PowerShell $PROFILE
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Force -Path $PROFILE | Out-Null }
$profileText = Get-Content $PROFILE -Raw -EA SilentlyContinue
if ($profileText -notmatch 'function c ') {
    Add-Content $PROFILE @'

# Claude Code
function c  { claude --dangerously-skip-permissions $args }
function cc { claude $args }
'@
    Pass "Shell helpers (c, cc)"
}

# Wire Claude Desktop MCP config to the same servers Claude Code uses
$desktopCfgDir = "$env:APPDATA\Claude"
$desktopCfg = "$desktopCfgDir\claude_desktop_config.json"
$kunMcp = "$CLAUDE_DIR\mcp.json"
if ((Test-Path $kunMcp) -and ((Test-Path "$HOME_DIR\AppData\Local\Programs\claude-desktop\Claude.exe") -or (Test-Path "${env:ProgramFiles}\Claude\Claude.exe"))) {
    New-Item -ItemType Directory -Force -Path $desktopCfgDir | Out-Null
    if (-not (Test-Path $desktopCfg)) {
        try {
            New-Item -ItemType SymbolicLink -Path $desktopCfg -Target $kunMcp -EA Stop | Out-Null
            Pass "Claude Desktop MCP -> ~/.claude/mcp.json"
        } catch {
            Copy-Item $kunMcp $desktopCfg
            Pass "Claude Desktop MCP config copied"
        }
    } else {
        Info "Claude Desktop config exists - leaving in place"
    }
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

# Vercel env pull - per-product .env from team databayt (warns + continues if
# Vercel isn't logged in; teammate can run `vercel login` later and re-run).
$VERCEL_PULL = Join-Path $KUN_DIR ".claude\scripts\vercel-pull.ps1"
if (Test-Path $VERCEL_PULL) {
    & $VERCEL_PULL -ReposDir $ReposDir
}

# =============================================================================
# PHASE 7: Hogwarts Local Dev
# =============================================================================
Step "7" "Hogwarts — dependencies, database, seed"

$HOGWARTS_DIR = "$ReposDir\hogwarts"

# Heavy local-dev setup is opt-in (-HogwartsDev), not role-gated
if ($HogwartsDev -and (Test-Path $HOGWARTS_DIR)) {
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
} elseif ($HogwartsDev) {
    Info "Hogwarts not cloned — skipped"
} else {
    Info "Hogwarts local dev skipped (pass -HogwartsDev to set it up)"
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

# Repos (universal)
if (Test-Path "$KUN_DIR")                    { Pass "kun repo" }     else { Fail "kun" }
if (Test-Path "$HOGWARTS_DIR")               { Pass "hogwarts repo" } else { Fail "hogwarts" }
if (Test-Path "$ReposDir\codebase")          { Pass "codebase repo" } else { Fail "codebase" }
if ($HogwartsDev) {
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
Write-Host "  1. Restart PowerShell (or: . `$PROFILE)"
Write-Host "  2. Run 'claude' -> log in with Anthropic account"
Write-Host "  3. Open Claude Desktop -> sign in"
if (-not $GistId) {
    Write-Host "  4. Load secrets when you have the gist ID:"
    Write-Host "     & ~\kun\.claude\scripts\secrets.ps1 -GistId <ID>"
}
Write-Host ""
Write-Host "IDE plugins (manual install from Marketplace):" -ForegroundColor Cyan
Write-Host "  - WebStorm: Settings -> Plugins -> search 'Claude Code' -> Install"
Write-Host "  - VS Code:  Extensions -> search 'Claude Code' -> Install"
if ($HogwartsDev) {
    Write-Host ""
    Write-Host "Run hogwarts:" -ForegroundColor Cyan
    Write-Host "  cd ~\hogwarts; pnpm dev"
    Write-Host "  http://localhost:3000"
    Write-Host "  Admin: admin@kingfahad.edu / 1234"
}

Write-Host ""
Write-Host "Mobile (Claude on iPhone/Android):" -ForegroundColor Cyan
Write-Host "  iOS:     https://apps.apple.com/app/claude-by-anthropic/id6473753684"
Write-Host "  Android: https://play.google.com/store/apps/details?id=com.anthropic.claude"
Write-Host "  Sign in with the same Anthropic account -> same projects everywhere"

Write-Host ""
Write-Host "Re-run: & ~\kun\.claude\scripts\onboarding-windows.ps1 -Role $Role" -ForegroundColor DarkGray
