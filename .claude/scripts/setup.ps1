# Kun Engine Setup — install, update, and verify Claude Code config (Windows)
# Usage: cd ~/kun; .\.claude\scripts\setup.ps1 -Role <role> [-Quiet]
# Roles: engineer, business, content, ops
# The role persists to %USERPROFILE%\.claude\.kun-role, so refresh runs (and
# the daily maintain heartbeat) can omit it: .\setup.ps1 -Quiet
# Mirrors setup.sh — keep the two in lockstep.
# Machine mode (a teammate's laptop, desktop app only): .\setup.ps1 -Machine <login> [-MsiPath <file> | -MsiUrl <url>]

param(
    [string]$Role,
    [switch]$Quiet,
    [string]$Machine,
    [string]$MsiPath,
    [string]$MsiUrl
)

$ErrorActionPreference = "Stop"

# ── Machine mode ─────────────────────────────────────────────────
# `-Machine <login>` provisions a teammate's laptop for the machine desktop app only:
# Git, Claude Code (they sign in themselves), the machine .msi, a kun clone, and the
# machine settings for that login. It does NOT run the engine install below — no hooks,
# rules or the full skill set; the app's catalog installs the profile's own items.
# Usage: .\setup.ps1 -Machine moed [-MsiPath C:\path\Kun.msi | -MsiUrl https://...]
# Idempotent: every step checks first; re-run anytime.
if ($Machine) {
    # Native tools (git, winget) write progress to stderr; every step below checks its own result.
    $ErrorActionPreference = "Continue"
    # Console text is English then Arabic. Arabic is stored as \uXXXX escapes because Windows
    # PowerShell 5.1 reads a BOM-less script as ANSI and would garble literal Arabic.
    function MsgAr($ar) { [regex]::Unescape($ar) }
    function MOk($en, $ar) { Write-Host "  [ok] $en" -ForegroundColor Green; Write-Host ("       " + (MsgAr $ar)) -ForegroundColor DarkGreen }
    function MInfo($en, $ar) { Write-Host "  [..] $en" -ForegroundColor DarkGray; Write-Host ("       " + (MsgAr $ar)) -ForegroundColor DarkGray }
    function MWarn($en, $ar) { Write-Host "  [!]  $en" -ForegroundColor Yellow; Write-Host ("       " + (MsgAr $ar)) -ForegroundColor Yellow }
    function MDie($en, $ar) { Write-Host "  [x]  $en" -ForegroundColor Red; Write-Host ("       " + (MsgAr $ar)) -ForegroundColor Red; exit 1 }
    function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") }
    function ReadJson($p) { Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json }

    $login = $Machine.Trim().ToLower()
    if ($login -notmatch '^[a-z][a-z0-9_-]{0,31}$') { MDie "Invalid login: $Machine" '\u0627\u0633\u0645 \u062f\u062e\u0648\u0644 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d' }

    Write-Host ""
    Write-Host "Kun machine setup - $login" -ForegroundColor Cyan
    Write-Host ("  " + (MsgAr '\u062a\u062b\u0628\u064a\u062a \u0643\u0646 (\u0627\u0644\u0622\u0644\u0629)')) -ForegroundColor Cyan
    Write-Host ""

    # 1. Windows 11 (build 22000+). A warning only: Windows 10 can run machine, it is just untested.
    $build = [Environment]::OSVersion.Version.Build
    if ($build -ge 22000) { MOk "Windows 11 (build $build)" '\u0646\u0638\u0627\u0645 \u0648\u064a\u0646\u062f\u0648\u0632 11' }
    else { MWarn "This is not Windows 11 (build $build) - continuing" '\u0647\u0630\u0627 \u0644\u064a\u0633 \u0648\u064a\u0646\u062f\u0648\u0632 11 \u2014 \u0633\u0646\u0643\u0645\u0644 \u0644\u0643\u0646 \u0642\u062f \u0644\u0627 \u064a\u0639\u0645\u0644 \u0643\u0644 \u0634\u064a\u0621' }

    # 2. Git
    if (-not (Get-Command git -EA SilentlyContinue)) {
        MInfo "Installing Git with winget..." '\u062a\u062b\u0628\u064a\u062a \u062c\u0650\u062a \u0639\u0628\u0631 winget...'
        if (Get-Command winget -EA SilentlyContinue) {
            winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements | Out-Null
            RefreshPath
        }
    }
    if (-not (Get-Command git -EA SilentlyContinue)) { MDie "Git is missing and could not be installed. Install it from https://git-scm.com then re-run." '\u062a\u0639\u0630\u0651\u0631 \u062a\u062b\u0628\u064a\u062a \u062c\u0650\u062a \u2014 \u062b\u0628\u0651\u062a\u0647 \u0645\u0646 git-scm.com \u062b\u0645 \u0623\u0639\u062f \u0627\u0644\u062a\u0634\u063a\u064a\u0644' }
    MOk "Git" '\u062c\u0650\u062a \u0645\u0648\u062c\u0648\u062f'

    # 3. WebView2 (preinstalled on Windows 11; machine's own installer bootstraps it if absent)
    $wvKeys = @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
    )
    $wv = $wvKeys | Where-Object { (Get-ItemProperty $_ -Name pv -EA SilentlyContinue).pv } | Select-Object -First 1
    if ($wv) { MOk "WebView2 runtime" 'WebView2 \u0645\u0648\u062c\u0648\u062f' } else { MWarn "WebView2 not found - the machine installer will download it" 'WebView2 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f \u2014 \u0633\u064a\u062d\u0645\u0651\u0644\u0647 \u0645\u062b\u0628\u0651\u062a \u0627\u0644\u0622\u0644\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627' }

    # 4. Claude Code (official installer). The teammate signs in with THEIR OWN account.
    $claudeBin = "$env:USERPROFILE\.local\bin\claude.exe"
    if (-not (Get-Command claude -EA SilentlyContinue) -and -not (Test-Path $claudeBin)) {
        MInfo "Installing Claude Code..." '\u062a\u062b\u0628\u064a\u062a \u0643\u0644\u0648\u062f \u0643\u0648\u062f...'
        try { irm https://claude.ai/install.ps1 | iex } catch { }
        RefreshPath
    }
    if ((Get-Command claude -EA SilentlyContinue) -or (Test-Path $claudeBin)) { MOk "Claude Code" '\u0643\u0644\u0648\u062f \u0643\u0648\u062f \u0645\u0648\u062c\u0648\u062f' }
    else { MDie "Claude Code could not be installed. See https://code.claude.com/docs then re-run." '\u062a\u0639\u0630\u0651\u0631 \u062a\u062b\u0628\u064a\u062a \u0643\u0644\u0648\u062f \u0643\u0648\u062f \u2014 \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0644\u0627\u062d\u0642\u064b\u0627' }

    # 5. kun clone - machine reads machines\ and departments\ from it.
    $kunHome = "$env:USERPROFILE\kun"
    if (-not (Test-Path "$kunHome\.git")) {
        MInfo "Cloning kun into $kunHome ..." '\u0646\u0633\u062e \u0645\u0633\u062a\u0648\u062f\u0639 \u0643\u0646 \u0625\u0644\u0649'
        git clone https://github.com/databayt/kun.git $kunHome 2>$null
    } else {
        git -C $kunHome pull --ff-only --quiet 2>$null
    }
    if (-not (Test-Path "$kunHome\departments\team.json")) { MDie "Could not clone databayt/kun (is GitHub access set up for this account?)." '\u062a\u0639\u0630\u0651\u0631 \u0646\u0633\u062e \u0645\u0633\u062a\u0648\u062f\u0639 \u0643\u0646 \u2014 \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0648\u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 GitHub' }
    MOk "kun repo at $kunHome" '\u0645\u0633\u062a\u0648\u062f\u0639 \u0643\u0646 \u062c\u0627\u0647\u0632'

    # 6. Profile -> %USERPROFILE%\.kun\machine\settings.json (keys match machine's Settings:
    #    person, department, driver; `login` is extra and ignored by the app).
    $name = $null; $dept = $null; $drv = $null
    $profileFile = "$kunHome\machines\$login.json"
    if (Test-Path $profileFile) {
        $prof = ReadJson $profileFile
        $name = if ($prof.name) { $prof.name } else { $prof.person }
        $dept = if ($prof.department) { $prof.department } elseif ($prof.departments) { @($prof.departments)[0] } else { $null }
        $drv = $prof.driver
    }
    if (-not $name -or -not $dept) {
        $team = ReadJson "$kunHome\departments\team.json"
        $who = @($team.people) | Where-Object { $_.login -eq $login } | Select-Object -First 1
        if ($who) {
            if (-not $name) { $name = $who.name }
            if (-not $dept) { $dept = @($who.departments)[0] }
        }
    }
    if (-not $name -or -not $dept) { MDie "No profile for '$login' in machines\ or departments\team.json." '\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0644\u0641 \u062a\u0639\u0631\u064a\u0641 \u0644\u0647\u0630\u0627 \u0627\u0644\u062f\u062e\u0648\u0644' }
    if (-not $drv -and (Test-Path "$kunHome\departments\$dept\pack.json")) { $drv = (ReadJson "$kunHome\departments\$dept\pack.json").defaultDriver }
    if ($drv -notin @("claude", "codex", "opencode")) { $drv = "claude" }

    $machineDir = "$env:USERPROFILE\.kun\machine"
    New-Item -ItemType Directory -Force -Path $machineDir | Out-Null
    $settings = [ordered]@{}
    if (Test-Path "$machineDir\settings.json") {
        try { (ReadJson "$machineDir\settings.json").PSObject.Properties | ForEach-Object { $settings[$_.Name] = $_.Value } } catch { }
    }
    $settings["login"] = $login
    $settings["person"] = $name
    $settings["department"] = $dept
    $settings["driver"] = $drv
    # UTF-8 WITHOUT a BOM: Set-Content -Encoding UTF8 adds one on 5.1 and serde_json rejects it.
    [IO.File]::WriteAllText("$machineDir\settings.json", ($settings | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    MOk "settings: $name / $dept / $drv" '\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a'

    # 7. The machine .msi (-MsiPath, or -MsiUrl to download). No release URL is baked in.
    $installed = @("HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*") |
        ForEach-Object { Get-ItemProperty $_ -EA SilentlyContinue } | Where-Object { $_.DisplayName -eq "Kun" } | Select-Object -First 1
    $msi = $null
    if ($MsiPath) {
        if (-not (Test-Path -LiteralPath $MsiPath)) { MDie "MsiPath not found: $MsiPath" '\u0641\u0634\u0644 \u062a\u062b\u0628\u064a\u062a \u0645\u0644\u0641 msi' }
        $msi = (Resolve-Path -LiteralPath $MsiPath).Path
    } elseif ($MsiUrl) {
        $msi = Join-Path $env:TEMP "kun-machine.msi"
        MInfo "Downloading the installer..." '\u062c\u0627\u0631\u064d \u062a\u0646\u0632\u064a\u0644 \u0645\u0644\u0641 \u0627\u0644\u062a\u062b\u0628\u064a\u062a...'
        Invoke-WebRequest -Uri $MsiUrl -OutFile $msi -UseBasicParsing
    }
    if ($msi) {
        $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive /norestart" -Wait -PassThru
        if ($p.ExitCode -in @(0, 3010)) { MOk "machine installed" '\u062a\u0645 \u062a\u062b\u0628\u064a\u062a \u0627\u0644\u0622\u0644\u0629' } else { MDie "msiexec failed with exit code $($p.ExitCode)" '\u0641\u0634\u0644 \u062a\u062b\u0628\u064a\u062a \u0645\u0644\u0641 msi' }
    } elseif ($installed) {
        MOk "machine already installed (pass -MsiPath or -MsiUrl to update)" '\u0627\u0644\u0622\u0644\u0629 \u0645\u062b\u0628\u0651\u062a\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 (\u0645\u0631\u0651\u0631 -MsiPath \u0623\u0648 -MsiUrl \u0644\u0644\u062a\u062d\u062f\u064a\u062b)'
    } else {
        MWarn "No installer given - pass -MsiPath <file> or -MsiUrl <url> (the .msi artifact of the Machine workflow)" '\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0644\u0641 \u062a\u062b\u0628\u064a\u062a \u2014 \u0645\u0631\u0651\u0631 -MsiPath \u0623\u0648 -MsiUrl'
    }

    Write-Host ""
    Write-Host "Done. Next:" -ForegroundColor Cyan
    Write-Host "  1. Open PowerShell and run:  claude   - sign in with YOUR OWN account, once." -ForegroundColor White
    Write-Host ("     " + (MsgAr '\u0634\u063a\u0651\u0644 \u0627\u0644\u0623\u0645\u0631 claude \u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u0648\u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u062d\u0633\u0627\u0628\u0643 \u0623\u0646\u062a')) -ForegroundColor White
    Write-Host "  2. Open Kun from the Start menu (first launch: SmartScreen > More info > Run anyway)." -ForegroundColor White
    Write-Host ("  " + (MsgAr '\u0627\u0643\u062a\u0645\u0644 \u0627\u0644\u0625\u0639\u062f\u0627\u062f')) -ForegroundColor Green
    exit 0
}

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

@("agents", "commands", "rules", "memory", "scripts", "skills", "hooks") | ForEach-Object {
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

# User-global hooks (session-maintain-status.ps1 runs in EVERY project, so it
# must live under ~/.claude/hooks, not only inside the kun repo)
if (Test-Path "$KUN_DIR\.claude\hooks") {
    Get-ChildItem "$KUN_DIR\.claude\hooks\*.ps1" -EA SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$CLAUDE_DIR\hooks\" -Force
    }
    Info "hooks"
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
