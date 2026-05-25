# vercel-pull.ps1 — pull per-project .env files from Vercel for each cloned databayt repo.
#
# Runs after Phase 6 (secrets) in the Windows onboarding pipeline. Vercel is
# the source of truth for app env vars; ~/.claude/.env (from the Gist) holds
# MCP keys + cross-cutting tokens. This script bridges Vercel → per-repo .env.
#
# Behavior mirrors vercel-pull.sh: warn-and-continue on per-project failure.

param(
    [string]$ReposDir = $env:USERPROFILE
)

function Pass([string]$msg) { Write-Host "  [v] $msg" -ForegroundColor Green }
function Info([string]$msg) { Write-Host "  .  $msg" -ForegroundColor DarkGray }
function Warn([string]$msg) { Write-Host "  !  $msg" -ForegroundColor Yellow }

# repo-dir -> Vercel project slug under team `databayt`
$projects = @(
    @{ Repo = "kun";        Project = "kun" }
    @{ Repo = "hogwarts";   Project = "hogwarts" }
    @{ Repo = "codebase";   Project = "codebase" }
    @{ Repo = "souq";       Project = "souq" }
    @{ Repo = "mkan";       Project = "mkan" }
    @{ Repo = "shifa";      Project = "shifa" }
    @{ Repo = "marketing";  Project = "marketing" }
)

Write-Host ""
Write-Host "Vercel env pull - per-product .env from team databayt" -ForegroundColor Cyan

if (-not (Get-Command vercel -EA SilentlyContinue)) {
    Warn "Vercel CLI not installed (npm install -g vercel) - per-product .env files will be missing"
    exit 0
}

vercel whoami 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Warn "Not logged into Vercel - run: vercel login   then re-run this script"
    exit 0
}

foreach ($p in $projects) {
    $repoDir = Join-Path $ReposDir $p.Repo
    if (-not (Test-Path $repoDir)) {
        Info "Skip $($p.Repo) (not cloned)"
        continue
    }

    Push-Location $repoDir
    try {
        vercel link --yes --project=$($p.Project) --scope=databayt 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            vercel env pull .env --environment=development --yes 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Pass "$($p.Repo) -> .env populated"
            } else {
                Warn "$($p.Repo): vercel env pull failed"
            }
        } else {
            Warn "$($p.Repo): vercel link failed (project may not exist or you lack team access)"
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "If any repo above warned, verify Vercel team access at https://vercel.com/teams/databayt/" -ForegroundColor DarkGray
