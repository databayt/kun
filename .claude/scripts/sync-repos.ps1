# Repository Sync Script (Windows PowerShell)
# Syncs all databayt organization repositories locally
# Usage: & "$env:USERPROFILE\.claude\scripts\sync-repos.ps1" [repo-name]

param(
    [Parameter(Position=0)]
    [string]$RepoName = "all"
)

$ErrorActionPreference = "Stop"

$OssDir = "$env:USERPROFILE\oss"
$MemoryFile = "$env:USERPROFILE\.claude\memory\repositories.json"

Write-Host "=== databayt Repository Sync ===" -ForegroundColor Cyan
Write-Host ""

# Ensure OSS directory exists
if (-not (Test-Path $OssDir)) {
    New-Item -ItemType Directory -Path $OssDir -Force | Out-Null
}

# Repository definitions
$Repos = @{
    "codebase" = "$env:USERPROFILE\codebase"
    "shadcn" = "$OssDir\shadcn"
    "radix" = "$OssDir\radix"
    "kun" = "$env:USERPROFILE\kun"
    "hogwarts" = "$OssDir\hogwarts"
    "souq" = "$OssDir\souq"
    "mkan" = "$OssDir\mkan"
    "shifa" = "$OssDir\shifa"
    "swift-app" = "$OssDir\swift-app"
    "distributed-computer" = "$OssDir\distributed-computer"
    "marketing" = "$OssDir\marketing"
}

function Sync-Repo {
    param([string]$Name)

    $Path = $Repos[$Name]
    $Url = "https://github.com/databayt/$Name.git"

    Write-Host "[$Name]" -ForegroundColor Yellow

    if (Test-Path $Path) {
        Write-Host "  Path: $Path"
        Write-Host "  Status: " -NoNewline
        Write-Host "exists" -ForegroundColor Green
        Write-Host "  Action: pulling latest..."

        Push-Location $Path

        # Check for uncommitted changes
        $status = git status --porcelain
        if ($status) {
            Write-Host "  Warning: Uncommitted changes detected" -ForegroundColor Red
            Write-Host "  Stashing changes..."
            git stash
        }

        # Pull latest
        git fetch origin
        try {
            git pull origin main --rebase 2>$null
        } catch {
            try {
                git pull origin master --rebase 2>$null
            } catch {}
        }

        # Get current commit
        $commit = git rev-parse --short HEAD
        Write-Host "  Current: " -NoNewline
        Write-Host "$commit" -ForegroundColor Green

        Pop-Location
    } else {
        Write-Host "  Path: $Path"
        Write-Host "  Status: " -NoNewline
        Write-Host "not found" -ForegroundColor Red
        Write-Host "  Action: cloning..."

        git clone $Url $Path
        Write-Host "  Cloned successfully" -ForegroundColor Green
    }

    Write-Host ""
}

function Get-RepoStatus {
    param([string]$Name)

    $Path = $Repos[$Name]

    if (Test-Path $Path) {
        Push-Location $Path
        $commit = git rev-parse --short HEAD 2>$null
        $branch = git branch --show-current 2>$null
        $changes = (git status --porcelain 2>$null | Measure-Object).Count

        Write-Host "$Name" -ForegroundColor Yellow
        Write-Host "  Path: $Path"
        Write-Host "  Branch: $branch"
        Write-Host "  Commit: $commit"
        if ($changes -gt 0) {
            Write-Host "  Changes: " -NoNewline
            Write-Host "$changes uncommitted" -ForegroundColor Red
        } else {
            Write-Host "  Changes: " -NoNewline
            Write-Host "clean" -ForegroundColor Green
        }

        Pop-Location
    } else {
        Write-Host "$Name" -ForegroundColor Yellow
        Write-Host "  Status: " -NoNewline
        Write-Host "not cloned" -ForegroundColor Red
    }
    Write-Host ""
}

function Watch-Upstream {
    Write-Host "=== Checking Upstream Dependencies ===" -ForegroundColor Cyan
    Write-Host ""

    # Check shadcn/ui upstream
    Write-Host "shadcn-ui/ui" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/shadcn-ui/ui/releases/latest"
        Write-Host "  Latest release: " -NoNewline
        Write-Host "$($response.tag_name)" -ForegroundColor Green
    } catch {
        Write-Host "  Could not fetch" -ForegroundColor Red
    }
    Write-Host ""

    # Check Next.js
    Write-Host "vercel/next.js" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/vercel/next.js/releases/latest"
        Write-Host "  Latest release: " -NoNewline
        Write-Host "$($response.tag_name)" -ForegroundColor Green
    } catch {
        Write-Host "  Could not fetch" -ForegroundColor Red
    }
    Write-Host ""

    # Check Prisma
    Write-Host "prisma/prisma" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/prisma/prisma/releases/latest"
        Write-Host "  Latest release: " -NoNewline
        Write-Host "$($response.tag_name)" -ForegroundColor Green
    } catch {
        Write-Host "  Could not fetch" -ForegroundColor Red
    }
    Write-Host ""
}

function Update-Memory {
    if (Test-Path $MemoryFile) {
        $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        $memory = Get-Content $MemoryFile | ConvertFrom-Json
        $memory.sync.lastFullSync = $timestamp
        $memory | ConvertTo-Json -Depth 10 | Set-Content $MemoryFile
        Write-Host "Memory file updated" -ForegroundColor Green
    }
}

# Main
switch ($RepoName) {
    { $_ -in "status", "--status", "-s" } {
        Write-Host "=== Repository Status ===" -ForegroundColor Cyan
        Write-Host ""
        foreach ($repo in $Repos.Keys) {
            Get-RepoStatus $repo
        }
    }
    { $_ -in "watch", "--watch", "-w" } {
        Watch-Upstream
    }
    { $_ -in "all", "--all", "-a" } {
        foreach ($repo in $Repos.Keys) {
            Sync-Repo $repo
        }
        Update-Memory
        Write-Host "=== Sync Complete ===" -ForegroundColor Green
    }
    default {
        if ($Repos.ContainsKey($RepoName)) {
            Sync-Repo $RepoName
            Write-Host "=== Sync Complete ===" -ForegroundColor Green
        } else {
            Write-Host "Unknown repository: $RepoName" -ForegroundColor Red
            Write-Host ""
            Write-Host "Available repositories:"
            foreach ($repo in $Repos.Keys) {
                Write-Host "  - $repo"
            }
            exit 1
        }
    }
}
