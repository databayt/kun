# =============================================================================
# Quiet Wizard - Windows Installer
# =============================================================================
# Three-act guided installer for Windows. Uses WPF dialogs (PresentationFramework
# ships with .NET on Win10/11). Wraps onboarding-windows.ps1 -Quiet.
#
# Bootstrap:
#   iwr https://kun.databayt.org/install.ps1 | iex
# Direct:
#   iwr https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/installer.ps1 | iex
#
# State file: $env:APPDATA\Databayt\installer-state.json (auto-resume)
# =============================================================================

param(
    [switch]$NoGui   # force terminal mode (CI / headless)
)

$ErrorActionPreference = "Continue"

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName System.Windows.Forms

# ── State file ──────────────────────────────────────────────────
$stateDir = "$env:APPDATA\Databayt"
$stateFile = "$stateDir\installer-state.json"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

function Get-State($key) {
    if (-not (Test-Path $stateFile)) { return "" }
    try {
        $d = Get-Content $stateFile -Raw | ConvertFrom-Json
        return $d.$key
    } catch { return "" }
}
function Set-State($key, $value) {
    $d = if (Test-Path $stateFile) {
        try { Get-Content $stateFile -Raw | ConvertFrom-Json } catch { @{} }
    } else { @{} }
    # PSCustomObject -> Hashtable so we can add properties
    $h = @{}
    if ($d) { $d.PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value } }
    $h[$key] = $value
    $h | ConvertTo-Json | Set-Content $stateFile -Encoding UTF8
}

# ── Dialog helpers ──────────────────────────────────────────────
function Ask-YesNo($prompt) {
    if ($NoGui) {
        Write-Host "$prompt [y/N] " -NoNewline -ForegroundColor Cyan
        $a = Read-Host
        if ($a -match '^[Yy]') { return "Yes" } else { return "No" }
    }
    $r = [System.Windows.MessageBox]::Show($prompt, "Databayt Setup", "YesNo", "Question")
    if ($r -eq "Yes") { return "Yes" } else { return "No" }
}
function Ask-Text($prompt, $default = "") {
    if ($NoGui) {
        Write-Host "$prompt " -NoNewline -ForegroundColor Cyan
        if ($default) { Write-Host "[$default] " -NoNewline }
        $a = Read-Host
        if ([string]::IsNullOrEmpty($a)) { return $default } else { return $a }
    }
    # WinForms InputBox - simplest reliable text input on Win10+
    return [Microsoft.VisualBasic.Interaction]::InputBox($prompt, "Databayt Setup", $default)
}
function Ask-Choice($prompt, $opt1, $opt2, $opt3 = $null) {
    if ($NoGui) {
        Write-Host "`n$prompt" -ForegroundColor Cyan
        Write-Host "  1) $opt1"
        Write-Host "  2) $opt2"
        if ($opt3) { Write-Host "  3) $opt3" }
        Write-Host "  > " -NoNewline
        $n = Read-Host
        switch ($n) { "1" { return $opt1 } "2" { return $opt2 } "3" { return $opt3 } default { return "" } }
    }
    # WPF custom dialog for 2-3 button choice
    $window = New-Object System.Windows.Window
    $window.Title = "Databayt Setup"
    $window.Width = 480; $window.Height = 220
    $window.WindowStartupLocation = "CenterScreen"; $window.ResizeMode = "NoResize"
    $stack = New-Object System.Windows.Controls.StackPanel; $stack.Margin = "20"
    $tb = New-Object System.Windows.Controls.TextBlock
    $tb.Text = $prompt; $tb.TextWrapping = "Wrap"; $tb.Margin = "0,0,0,20"; $tb.FontSize = 13
    $stack.Children.Add($tb) | Out-Null
    $row = New-Object System.Windows.Controls.StackPanel; $row.Orientation = "Horizontal"; $row.HorizontalAlignment = "Right"
    $result = ""
    $buttons = @($opt1, $opt2); if ($opt3) { $buttons += $opt3 }
    foreach ($b in $buttons) {
        $btn = New-Object System.Windows.Controls.Button
        $btn.Content = $b; $btn.Width = 100; $btn.Margin = "10,0,0,0"; $btn.Padding = "5"
        $btn.Add_Click({ $script:result = $this.Content; $window.Close() }.GetNewClosure())
        $row.Children.Add($btn) | Out-Null
    }
    $stack.Children.Add($row) | Out-Null
    $window.Content = $stack
    $window.ShowDialog() | Out-Null
    return $script:result
}
function Notify($title, $body) {
    if ($NoGui) { Write-Host "[$title] $body" -ForegroundColor Cyan; return }
    # BalloonTip via NotifyIcon — fire and forget
    $bal = New-Object System.Windows.Forms.NotifyIcon
    $bal.Icon = [System.Drawing.SystemIcons]::Information
    $bal.BalloonTipTitle = $title; $bal.BalloonTipText = $body
    $bal.Visible = $true; $bal.ShowBalloonTip(3000)
    Start-Sleep -Milliseconds 100
    $bal.Dispose()
}
Add-Type -AssemblyName Microsoft.VisualBasic   # for InputBox

# ── Bootstrap: ensure git, then clone kun ───────────────────────
# git is needed to clone the repo that installs git, so the wrapper
# must provide it first. The backend (onboarding-windows.ps1) re-checks
# and no-ops if git is already present. Windows ships no git by default —
# without this, the clone below fails with a misleading "check network".
if (-not (Get-Command git -EA SilentlyContinue)) {
    if (Get-Command winget -EA SilentlyContinue) {
        Notify "Installing" "git (prerequisite for clone)"
        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements --silent
        # Refresh PATH so git resolves in this session (same as backend)
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
}
if (-not (Get-Command git -EA SilentlyContinue)) {
    [System.Windows.MessageBox]::Show("git is required but could not be installed automatically.`n`nInstall Git for Windows (https://git-scm.com/download/win), then re-run:`n`niwr https://kun.databayt.org/install.ps1 | iex", "Setup needs git", "OK", "Error") | Out-Null
    exit 1
}

# ── Clone kun if missing ────────────────────────────────────────
if (-not (Test-Path "$env:USERPROFILE\kun")) {
    Notify "Cloning" "kun repo"
    # Capture output and gate on $LASTEXITCODE — after a pipeline, $? reflects
    # the last element (e.g. Out-Null), not the native command's exit code.
    $cloneOut = git clone https://github.com/databayt/kun.git "$env:USERPROFILE\kun" 2>&1
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine(($cloneOut -join "`n"))
        [System.Windows.MessageBox]::Show("Could not clone databayt/kun. See the terminal window for the exact git error.`n`nIf github.com is blocked on your network (proxy/VPN/firewall), that is the likely cause — the raw CDN can stay reachable while github.com is blocked.", "Setup failed", "OK", "Error") | Out-Null
        exit 1
    }
}

$Backend = "$env:USERPROFILE\kun\.claude\scripts\onboarding-windows.ps1"
if (-not (Test-Path $Backend)) {
    [System.Windows.MessageBox]::Show("Backend missing: $Backend", "Setup failed", "OK", "Error") | Out-Null
    exit 1
}

# =============================================================================
# ACT 1 - Pre-flight
# =============================================================================
# Role is universal — every machine gets the full config, so we never ask.
$role = "engineer"

# Resume from state file (only fields the wizard still surfaces)
$reposDir = Get-State reposDir
$hasGithub = Get-State hasGithub
$hasDatabaytInvite = Get-State hasDatabaytInvite
$hasAnthropic = Get-State hasAnthropic
$hogwartsDev = Get-State hogwartsDev   # set via -HogwartsDev flag only; no dialog

# Account guidance
if (-not $hasGithub) {
    $ans = Ask-Choice "Do you have a GitHub account?" "Yes, I have one" "No, create one" "Skip"
    if ($ans -eq "No, create one") {
        Start-Process "https://github.com/join"
        Ask-Choice "GitHub sign-up opened in browser. Done when you've created the account." "Done" "Skip" | Out-Null
    }
    Set-State hasGithub "1"
}
if (-not $hasDatabaytInvite) {
    $ans = Ask-Choice "Have you accepted the databayt org invite?`n(The installer can't clone private repos without it.)" "Yes" "Open invite page" "Skip - I'll handle later"
    if ($ans -eq "Open invite page") {
        Start-Process "https://github.com/orgs/databayt/invitations"
        Ask-Choice "Accept the invite, then click Done." "Done" "Skip" | Out-Null
    }
    Set-State hasDatabaytInvite "1"
}
if (-not $hasAnthropic) {
    $ans = Ask-Choice "Anthropic - company account (HR shares credentials + sends OTP).`nPing HR now; install proceeds in parallel while you wait." "I have creds" "Open Claude login" "Skip - finish later"
    if ($ans -eq "Open Claude login") {
        Start-Process "https://claude.ai/login"
        Ask-Choice "Claude login opened. Sign in when HR's OTP arrives - no rush, install continues in background." "Done / will finish later" "Skip" | Out-Null
    }
    Set-State hasAnthropic "1"
}

# Repos dir
if (-not $reposDir) {
    $choice = Ask-Choice "Where do you want databayt org repos saved?`n(Default: home root - C:\Users\<you>\)" "Home root" "%USERPROFILE%\databayt" "Custom..."
    switch ($choice) {
        "Home root"             { $reposDir = $env:USERPROFILE }
        "%USERPROFILE%\databayt" { $reposDir = "$env:USERPROFILE\databayt"; New-Item -ItemType Directory -Force -Path $reposDir | Out-Null }
        "Custom..."             {
            $custom = Ask-Text "Enter absolute path:" "$env:USERPROFILE\projects\databayt"
            if (-not $custom) { $custom = $env:USERPROFILE }
            $reposDir = $custom; New-Item -ItemType Directory -Force -Path $reposDir | Out-Null
        }
        default { $reposDir = $env:USERPROFILE }
    }
    Set-State reposDir $reposDir
}

# =============================================================================
# ACT 2 - Silent batch
# =============================================================================
Notify "Installing" "~15-20 min in terminal"

# Backend gets: -Role (universal), -Quiet, plus opt-in flags. No -GitName/-GitEmail
# passed - backend auto-derives git identity from `gh api user` after Phase 3 auth.
# No -GistId passed - secrets pulled manually later via secrets.ps1.
$backendArgs = @("-Role", $role, "-Quiet")
if ($reposDir -and $reposDir -ne $env:USERPROFILE) { $backendArgs += @("-ReposDir", $reposDir) }
if ($hogwartsDev -eq "1") { $backendArgs += @("-HogwartsDev") }

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Databayt Setup - Silent Install in Progress"
Write-Host "════════════════════════════════════════════════════"
Write-Host " Minimize this window and do other work."
Write-Host "════════════════════════════════════════════════════"
Write-Host ""

# Run backend, capture stderr to filter for PROGRESS markers
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Backend`" $($backendArgs -join ' ')"
$psi.RedirectStandardError = $true; $psi.RedirectStandardOutput = $false
$psi.UseShellExecute = $false; $psi.CreateNoWindow = $false
$proc = [System.Diagnostics.Process]::Start($psi)
# Stream stderr — fire notify on PROGRESS markers
while (-not $proc.StandardError.EndOfStream) {
    $line = $proc.StandardError.ReadLine()
    if ($line -match '^PROGRESS:([\d/]+):(.+)$') {
        Notify "Phase $($matches[1])" $matches[2]
    } else {
        [Console]::Error.WriteLine($line)
    }
}
$proc.WaitForExit()
$rc = $proc.ExitCode

if ($rc -ne 0) {
    $retry = Ask-Choice "Install hit an issue (exit $rc). What now?" "Retry" "Skip" "Quit"
    switch ($retry) {
        "Retry" { & $PSCommandPath; exit }
        "Quit"  { exit $rc }
    }
}
Set-State silentBatch "done"

# =============================================================================
# ACT 3 - Manual finishing
# =============================================================================
Notify "Almost done" "Final clicks"

# 3a. Claude Desktop sign-in (only if Desktop installed)
$claudeApp = "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe"
$claudeApp2 = "${env:ProgramFiles}\Claude\Claude.exe"
if (((Test-Path $claudeApp) -or (Test-Path $claudeApp2)) -and (Get-State desktopSignedIn) -ne "1") {
    $ans = Ask-Choice "Sign in to Claude Desktop:`n`nUse the company creds + OTP from HR (same account as Claude Code CLI). No rush - skip if HR hasn't sent the OTP yet, finish later from the app." "Open Claude" "Done" "Skip"
    if ($ans -eq "Open Claude") {
        if (Test-Path $claudeApp) { Start-Process $claudeApp } else { Start-Process $claudeApp2 }
        $ans = Ask-Choice "Signed in?" "Done" "Skip"
    }
    if ($ans -eq "Done") { Set-State desktopSignedIn "1" }
}

# 3b. Computer-use toggle (only if Desktop installed)
if (((Test-Path $claudeApp) -or (Test-Path $claudeApp2)) -and (Get-State computerUse) -ne "1") {
    $ans = Ask-Choice "(Optional) Enable Claude Desktop computer-use:`n`n1. Click [Open Settings]`n2. Claude Desktop -> Settings -> General -> Toggle 'Allow Claude to use your computer'`n3. Click [Done]" "Open Settings" "Done" "Skip"
    if ($ans -eq "Open Settings") {
        if (Test-Path $claudeApp) { Start-Process $claudeApp } elseif (Test-Path $claudeApp2) { Start-Process $claudeApp2 }
        Start-Process "ms-settings:easeofaccess"
        $ans = Ask-Choice "Toggle enabled?" "Done" "Skip"
    }
    if ($ans -eq "Done") { Set-State computerUse "1" }
}

# 3c. VS Code Claude extension - auto-install
$hasCode = Get-Command code -EA SilentlyContinue
if ($hasCode -and (Get-State vsCodeExt) -ne "1") {
    $exts = code --list-extensions 2>$null
    if ($exts -match "anthropic.claude-code") {
        Set-State vsCodeExt "1"
    } else {
        code --install-extension anthropic.claude-code 2>$null
        if ($?) { Set-State vsCodeExt "1" }
    }
}

# 3d. WebStorm Claude plugin (only if WebStorm is installed)
$wsPath = "${env:ProgramFiles}\JetBrains\WebStorm*"
if ((Test-Path $wsPath) -and (Get-State webstormPlugin) -ne "1") {
    $ans = Ask-Choice "(Optional) Install Claude Code plugin in WebStorm:`n`n1. Click [Open WebStorm]`n2. Settings -> Plugins -> Marketplace -> 'Claude Code' -> Install`n3. Click [Done]" "Open WebStorm" "Done" "Skip"
    if ($ans -eq "Open WebStorm") {
        Start-Process (Get-ChildItem "$wsPath\bin\webstorm64.exe" | Select-Object -First 1).FullName 2>$null
        $ans = Ask-Choice "Plugin installed?" "Done" "Skip"
    }
    if ($ans -eq "Done") { Set-State webstormPlugin "1" }
}

# 3e. Final verify
Notify "Verifying" "Health check"
$healthScript = "$env:USERPROFILE\.claude\scripts\health.ps1"
if (Test-Path $healthScript) { & $healthScript 2>&1 | Select-Object -Last 5 | Out-Host }

$finalMsg = "Setup complete!`n`n"
$finalMsg += "Tools: git, node, pnpm, gh, vercel, claude, agy`n"
$finalMsg += "Agents: 'c' = Claude Code (primary) · 'a' = Antigravity (secondary)`n"
$finalMsg += "Repos: $env:USERPROFILE\kun, \hogwarts, \codebase, +org repos`n"
$finalMsg += "Config: $env:USERPROFILE\.claude\ (agents, skills, MCP)`n`n"
$finalMsg += "Next:`n"
$finalMsg += "  1. Open a new PowerShell and type 'c' for Claude Code (or 'a' for Antigravity)`n"
$finalMsg += "  2. If HR's OTP arrived, finish Anthropic sign-in (mobile app + Desktop)`n"
$finalMsg += "  3. Load secrets when you have the Gist ID:`n"
$finalMsg += "     & ~\kun\.claude\scripts\secrets.ps1 -GistId <ID>`n`n"
$finalMsg += "Mobile: install Claude on iPhone/Android with same Anthropic account."

Ask-Choice $finalMsg "Done" "View Docs" | Out-Null

if ((Ask-YesNo "Open onboarding docs in browser?") -eq "Yes") {
    Start-Process "https://github.com/databayt/kun/blob/main/content/docs/onboarding.mdx"
}

Set-State lastStep "done"
Set-State timestamp (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
Notify "All done" "Open a new terminal to start"
