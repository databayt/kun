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
function Ask-Role() {
    if ($NoGui) { return Ask-Choice "Pick your role:" "engineer" "business" "content" }
    $roles = @("engineer", "business", "content", "ops")
    $window = New-Object System.Windows.Window
    $window.Title = "Databayt Setup"; $window.Width = 360; $window.Height = 280
    $window.WindowStartupLocation = "CenterScreen"; $window.ResizeMode = "NoResize"
    $stack = New-Object System.Windows.Controls.StackPanel; $stack.Margin = "20"
    $lbl = New-Object System.Windows.Controls.TextBlock; $lbl.Text = "Pick your role:"; $lbl.Margin = "0,0,0,10"; $lbl.FontSize = 13
    $stack.Children.Add($lbl) | Out-Null
    $list = New-Object System.Windows.Controls.ListBox
    foreach ($r in $roles) { $list.Items.Add($r) | Out-Null }
    $list.SelectedIndex = 0; $list.Height = 120
    $stack.Children.Add($list) | Out-Null
    $btn = New-Object System.Windows.Controls.Button
    $btn.Content = "OK"; $btn.Width = 80; $btn.Margin = "0,15,0,0"; $btn.HorizontalAlignment = "Right"
    $script:result = ""
    $btn.Add_Click({ $script:result = $list.SelectedItem; $window.Close() })
    $stack.Children.Add($btn) | Out-Null
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
$welcome = Ask-Choice "Welcome - this sets up a fresh Windows laptop for databayt.`n`nAbout 20 minutes (mostly silent downloads).`n`nReady?" "Start" "Cancel"
if ($welcome -ne "Start") { Notify "Cancelled" "Run again anytime"; exit 0 }

$role = Get-State role
$gistId = Get-State gistId
$gitName = Get-State gitName
$gitEmail = Get-State gitEmail
$withTailscale = Get-State withTailscale
$proMax = Get-State proMax
$reposDir = Get-State reposDir
$hasGithub = Get-State hasGithub
$hasAnthropic = Get-State hasAnthropic

# Account guidance
if (-not $hasGithub) {
    $ans = Ask-Choice "Do you have a GitHub account?" "Yes, I have one" "No, create one" "Skip"
    if ($ans -eq "No, create one") {
        Start-Process "https://github.com/join"
        Ask-Choice "GitHub sign-up opened in browser. Done when you've created the account." "Done" "Skip" | Out-Null
    }
    Set-State hasGithub "1"
}
if (-not $hasAnthropic) {
    $ans = Ask-Choice "Do you have an Anthropic account?`n(For Claude Desktop sign-in + CLI.)" "Yes, I have one" "No, create one" "Skip"
    if ($ans -eq "No, create one") {
        Start-Process "https://claude.ai/login"
        Ask-Choice "Anthropic sign-in opened. Done when you've created the account.`n`nNote: Pro/Max sub unlocks Desktop Chat/Cowork/Code tabs." "Done" "Skip" | Out-Null
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

# Role: auto-detect from existing mcp.json
if (-not $role) {
    $mcp = "$env:USERPROFILE\.claude\mcp.json"
    if (Test-Path $mcp) {
        $content = Get-Content $mcp -Raw
        if ($content -match '"shadcn"') { $role = "engineer" }
        elseif ($content -match '"linear"') { $role = "business" }
        elseif ($content -match '"figma"') { $role = "content" }
        elseif ($content -match '"posthog"') { $role = "ops" }
    }
    if (-not $role) {
        $role = Ask-Role
        if (-not $role) { Notify "Cancelled" "No role"; exit 0 }
    }
    Set-State role $role
}

# Git identity
if (-not $gitName) {
    $existingName = git config --global user.name 2>$null
    if ($existingName) {
        $gitName = $existingName
        $gitEmail = git config --global user.email 2>$null
    } else {
        $gitName = Ask-Text "Your full name (for git commits):"
        if (-not $gitName) { Notify "Cancelled" "No name"; exit 0 }
        $gitEmail = Ask-Text "Your email (for git commits):"
        if (-not $gitEmail) { Notify "Cancelled" "No email"; exit 0 }
    }
    Set-State gitName $gitName
    Set-State gitEmail $gitEmail
}

# Gist ID
if (-not $gistId) {
    $gistId = Ask-Text "Secrets Gist ID (or blank to skip):"
    Set-State gistId $gistId
}

# Pro/Max
if (-not $proMax) {
    $ans = Ask-YesNo "Do you have a Claude Pro or Max subscription?`n`n(Affects Desktop Chat/Cowork/Code tabs.)"
    if ($ans -eq "Yes") { $proMax = "1" } else { $proMax = "0" }
    Set-State proMax $proMax
}

# Tailscale
if (-not $withTailscale) {
    $ans = Ask-YesNo "Enable Tailscale SSH? (Remote control from iPhone/laptop.)"
    if ($ans -eq "Yes") { $withTailscale = "1" } else { $withTailscale = "0" }
    Set-State withTailscale $withTailscale
}

# Hogwarts local dev — opt-in (heavy: pnpm + DB seed + build, ~10 min)
$hogwartsDev = Get-State hogwartsDev
if (-not $hogwartsDev) {
    $ans = Ask-YesNo "Set up hogwarts local dev now? (pnpm + DB seed + build, ~10 min — skip if this machine won't run hogwarts locally)"
    if ($ans -eq "Yes") { $hogwartsDev = "1" } else { $hogwartsDev = "0" }
    Set-State hogwartsDev $hogwartsDev
}

# =============================================================================
# ACT 2 - Silent batch
# =============================================================================
Notify "Installing" "~15-20 min in terminal"

$backendArgs = @("-Role", $role, "-Quiet", "-GitName", $gitName, "-GitEmail", $gitEmail)
if ($gistId) { $backendArgs += @("-GistId", $gistId) }
if ($reposDir -and $reposDir -ne $env:USERPROFILE) { $backendArgs += @("-ReposDir", $reposDir) }
if ($withTailscale -eq "1") { $backendArgs += @("-WithTailscale") }
if ($hogwartsDev -eq "1") { $backendArgs += @("-HogwartsDev") }

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Databayt Setup - Silent Install in Progress"
Write-Host "════════════════════════════════════════════════════"
Write-Host " Role: $role"
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

# 3a. Claude Desktop sign-in (Pro/Max)
$claudeApp = "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe"
$claudeApp2 = "${env:ProgramFiles}\Claude\Claude.exe"
if ($proMax -eq "1" -and ((Test-Path $claudeApp) -or (Test-Path $claudeApp2)) -and (Get-State desktopSignedIn) -ne "1") {
    $ans = Ask-Choice "Sign in to Claude Desktop:`n`n1. Click [Open Claude]`n2. Sign in with your Anthropic account`n3. Click [Done]" "Open Claude" "Done" "Skip"
    if ($ans -eq "Open Claude") {
        if (Test-Path $claudeApp) { Start-Process $claudeApp } else { Start-Process $claudeApp2 }
        $ans = Ask-Choice "Signed in?" "Done" "Skip"
    }
    if ($ans -eq "Done") { Set-State desktopSignedIn "1" }
}

# 3b. Computer-use toggle (Pro/Max)
if ($proMax -eq "1" -and (Get-State computerUse) -ne "1") {
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

# 3d. WebStorm Claude plugin (engineer)
$wsPath = "${env:ProgramFiles}\JetBrains\WebStorm*"
if ($role -eq "engineer" -and (Test-Path $wsPath) -and (Get-State webstormPlugin) -ne "1") {
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

$finalMsg = "Setup complete! Role: $role`n`n"
$finalMsg += "Tools: git, node, pnpm, gh, claude`n"
$finalMsg += "Repos: $env:USERPROFILE\kun"
if ($role -eq "engineer") { $finalMsg += ", \hogwarts, \codebase, +org repos" }
$finalMsg += "`nConfig: $env:USERPROFILE\.claude\ (agents, skills, MCP)`n`n"
$finalMsg += "Next: open a new PowerShell and type 'c' to start Claude Code.`n`n"
$finalMsg += "Mobile: install Claude on iPhone/Android with same Anthropic account."

Ask-Choice $finalMsg "Done" "View Docs" | Out-Null

if ((Ask-YesNo "Open onboarding docs in browser?") -eq "Yes") {
    Start-Process "https://github.com/databayt/kun/blob/main/content/docs/onboarding.mdx"
}

Set-State lastStep "done"
Set-State timestamp (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
Notify "All done" "Open a new terminal to start"
