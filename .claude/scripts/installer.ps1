# =============================================================================
# Quiet Wizard - Windows Installer
# =============================================================================
# 2 dialogs (identity, hogwarts) -> silent batch with 1 unavoidable click
# (GitHub Authorize on auto-opened device-flow page) -> done panel.
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
Add-Type -AssemblyName Microsoft.VisualBasic

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
    $window = New-Object System.Windows.Window
    $window.Title = "Databayt Setup"
    $window.Width = 520; $window.SizeToContent = "Height"
    $window.WindowStartupLocation = "CenterScreen"; $window.ResizeMode = "NoResize"
    $stack = New-Object System.Windows.Controls.StackPanel; $stack.Margin = "20"
    $tb = New-Object System.Windows.Controls.TextBlock
    $tb.Text = $prompt; $tb.TextWrapping = "Wrap"; $tb.Margin = "0,0,0,20"; $tb.FontSize = 13
    $stack.Children.Add($tb) | Out-Null
    $row = New-Object System.Windows.Controls.StackPanel; $row.Orientation = "Horizontal"; $row.HorizontalAlignment = "Right"
    $script:result = ""
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
function Ask-Identity($defaultName, $defaultEmail, $defaultRole) {
    # Single WPF window: name + email + role. Returns [name, email, role] or @() on cancel.
    if ($NoGui) {
        $n = Ask-Text "Identity 1/3 - full name (for git commits):" $defaultName
        if (-not $n) { return @() }
        $e = Ask-Text "Identity 2/3 - email (for git commits):" $defaultEmail
        if (-not $e) { return @() }
        $r = Ask-Choice "Identity 3/3 - role:" "engineer" "business" "content"
        if (-not $r) { $r = if ($defaultRole) { $defaultRole } else { "engineer" } }
        return @($n, $e, $r)
    }
    $window = New-Object System.Windows.Window
    $window.Title = "Databayt Setup - Identity"
    $window.Width = 460; $window.SizeToContent = "Height"
    $window.WindowStartupLocation = "CenterScreen"; $window.ResizeMode = "NoResize"
    $stack = New-Object System.Windows.Controls.StackPanel; $stack.Margin = "20"

    $heading = New-Object System.Windows.Controls.TextBlock
    $heading.Text = "Identity card - confirm your git identity and role."
    $heading.Margin = "0,0,0,15"; $heading.FontSize = 13; $heading.TextWrapping = "Wrap"
    $stack.Children.Add($heading) | Out-Null

    $lblName = New-Object System.Windows.Controls.TextBlock; $lblName.Text = "Full name"; $lblName.Margin = "0,0,0,4"
    $stack.Children.Add($lblName) | Out-Null
    $txtName = New-Object System.Windows.Controls.TextBox; $txtName.Text = $defaultName; $txtName.Margin = "0,0,0,12"; $txtName.Padding = "5"
    $stack.Children.Add($txtName) | Out-Null

    $lblEmail = New-Object System.Windows.Controls.TextBlock; $lblEmail.Text = "Email"; $lblEmail.Margin = "0,0,0,4"
    $stack.Children.Add($lblEmail) | Out-Null
    $txtEmail = New-Object System.Windows.Controls.TextBox; $txtEmail.Text = $defaultEmail; $txtEmail.Margin = "0,0,0,12"; $txtEmail.Padding = "5"
    $stack.Children.Add($txtEmail) | Out-Null

    $lblRole = New-Object System.Windows.Controls.TextBlock; $lblRole.Text = "Role"; $lblRole.Margin = "0,0,0,4"
    $stack.Children.Add($lblRole) | Out-Null
    $cmbRole = New-Object System.Windows.Controls.ComboBox; $cmbRole.Margin = "0,0,0,18"; $cmbRole.Padding = "5"
    foreach ($r in @("engineer", "business", "content", "ops")) { $cmbRole.Items.Add($r) | Out-Null }
    $cmbRole.SelectedItem = if ($defaultRole) { $defaultRole } else { "engineer" }
    $stack.Children.Add($cmbRole) | Out-Null

    $row = New-Object System.Windows.Controls.StackPanel
    $row.Orientation = "Horizontal"; $row.HorizontalAlignment = "Right"
    $script:identityResult = @()
    $btnCancel = New-Object System.Windows.Controls.Button
    $btnCancel.Content = "Cancel"; $btnCancel.Width = 90; $btnCancel.Margin = "0,0,10,0"; $btnCancel.Padding = "5"
    $btnCancel.Add_Click({ $script:identityResult = @(); $window.Close() })
    $btnOk = New-Object System.Windows.Controls.Button
    $btnOk.Content = "Continue"; $btnOk.Width = 90; $btnOk.Padding = "5"; $btnOk.IsDefault = $true
    $btnOk.Add_Click({
        $script:identityResult = @($txtName.Text.Trim(), $txtEmail.Text.Trim(), $cmbRole.SelectedItem.ToString())
        $window.Close()
    })
    $row.Children.Add($btnCancel) | Out-Null
    $row.Children.Add($btnOk) | Out-Null
    $stack.Children.Add($row) | Out-Null

    $window.Content = $stack
    $window.ShowDialog() | Out-Null
    return $script:identityResult
}
function Notify($title, $body) {
    if ($NoGui) { Write-Host "[$title] $body" -ForegroundColor Cyan; return }
    $bal = New-Object System.Windows.Forms.NotifyIcon
    $bal.Icon = [System.Drawing.SystemIcons]::Information
    $bal.BalloonTipTitle = $title; $bal.BalloonTipText = $body
    $bal.Visible = $true; $bal.ShowBalloonTip(3000)
    Start-Sleep -Milliseconds 100
    $bal.Dispose()
}

# ── Bootstrap: ensure git, then clone kun ───────────────────────
if (-not (Get-Command git -EA SilentlyContinue)) {
    if (Get-Command winget -EA SilentlyContinue) {
        Notify "Installing" "git (prerequisite for clone)"
        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
}
if (-not (Get-Command git -EA SilentlyContinue)) {
    [System.Windows.MessageBox]::Show("git is required but could not be installed automatically.`n`nInstall Git for Windows (https://git-scm.com/download/win), then re-run:`n`niwr https://kun.databayt.org/install.ps1 | iex", "Setup needs git", "OK", "Error") | Out-Null
    exit 1
}

if (-not (Test-Path "$env:USERPROFILE\kun")) {
    Notify "Cloning" "kun repo"
    $cloneOut = git clone https://github.com/databayt/kun.git "$env:USERPROFILE\kun" 2>&1
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine(($cloneOut -join "`n"))
        [System.Windows.MessageBox]::Show("Could not clone databayt/kun. See the terminal window for the exact git error.`n`nIf github.com is blocked on your network (proxy/VPN/firewall), that is the likely cause - the raw CDN can stay reachable while github.com is blocked.", "Setup failed", "OK", "Error") | Out-Null
        exit 1
    }
}

$Backend = "$env:USERPROFILE\kun\.claude\scripts\onboarding-windows.ps1"
if (-not (Test-Path $Backend)) {
    [System.Windows.MessageBox]::Show("Backend missing: $Backend", "Setup failed", "OK", "Error") | Out-Null
    exit 1
}

# =============================================================================
# ACT 1 - Two dialogs (or fewer, after autofill)
# =============================================================================
Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Databayt Setup - ~20 min · 2 dialogs · 1 click"
Write-Host "════════════════════════════════════════════════════"
Write-Host " Press Ctrl+C any time to abort. State auto-saves."
Write-Host "════════════════════════════════════════════════════"
Write-Host ""

$role = Get-State role
$gitName = Get-State gitName
$gitEmail = Get-State gitEmail
$hogwartsDev = Get-State hogwartsDev

# Autofill from git config + mcp.json
if (-not $gitName)  { $gitName  = git config --global user.name  2>$null }
if (-not $gitEmail) { $gitEmail = git config --global user.email 2>$null }
if (-not $role) {
    $mcp = "$env:USERPROFILE\.claude\mcp.json"
    if (Test-Path $mcp) {
        $content = Get-Content $mcp -Raw
        if ($content -match '"shadcn"') { $role = "engineer" }
        elseif ($content -match '"linear"')  { $role = "business" }
        elseif ($content -match '"figma"')   { $role = "content" }
        elseif ($content -match '"posthog"') { $role = "ops" }
    }
}

# Single identity dialog (or skip if everything autofilled)
if (-not $gitName -or -not $gitEmail -or -not $role) {
    $identity = Ask-Identity $gitName $gitEmail $role
    if ($identity.Count -eq 0) { Notify "Cancelled" "Identity not provided"; exit 0 }
    $gitName  = $identity[0]
    $gitEmail = $identity[1]
    $role     = $identity[2]
    if (-not $gitName)  { Notify "Cancelled" "No name";  exit 0 }
    if (-not $gitEmail) { Notify "Cancelled" "No email"; exit 0 }
    if (-not $role) { $role = "engineer" }
}
Set-State gitName  $gitName
Set-State gitEmail $gitEmail
Set-State role     $role

# Hogwarts local dev - engineer-only
if ($role -eq "engineer" -and -not $hogwartsDev) {
    $ans = Ask-YesNo "Set up hogwarts local dev now? (pnpm + DB seed + build, ~10 min - skip if this machine won't run hogwarts locally)"
    if ($ans -eq "Yes") { $hogwartsDev = "1" } else { $hogwartsDev = "0" }
    Set-State hogwartsDev $hogwartsDev
}

# =============================================================================
# ACT 2 - Silent batch (1 unavoidable Authorize click during Phase 3)
# =============================================================================
Notify "Installing" "1 GitHub Authorize click around minute 2"

$backendArgs = @("-Role", $role, "-Quiet", "-GitName", $gitName, "-GitEmail", $gitEmail)
if ($hogwartsDev -eq "1") { $backendArgs += @("-HogwartsDev") }

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Installing - minimize this window and walk away"
Write-Host " (one Authorize click in the browser ~2 min in)"
Write-Host "════════════════════════════════════════════════════"
Write-Host " Role: $role"
Write-Host "════════════════════════════════════════════════════"
Write-Host ""

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Backend`" $($backendArgs -join ' ')"
$psi.RedirectStandardError = $true; $psi.RedirectStandardOutput = $false
$psi.UseShellExecute = $false; $psi.CreateNoWindow = $false
$proc = [System.Diagnostics.Process]::Start($psi)
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
# ACT 3 - Done. No dialogs; auto-install what we can; list the rest.
# =============================================================================
Notify "Almost done" "Wrapping up"

# Silent: VS Code Claude extension
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

# Final panel: one-shot summary + optional follow-ups
$claudeApp  = "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe"
$claudeApp2 = "${env:ProgramFiles}\Claude\Claude.exe"
$hasDesktop = (Test-Path $claudeApp) -or (Test-Path $claudeApp2)
$wsPath = "${env:ProgramFiles}\JetBrains\WebStorm*"
$hasWebstorm = Test-Path $wsPath

$finalMsg = "Setup complete · Role: $role`n`n"
$finalMsg += "Next: open a new PowerShell and type 'c' to start Claude Code.`n`n"
$finalMsg += "Optional follow-ups (do later, in any order):`n"
if ($hasDesktop) { $finalMsg += "  • Sign in to Claude Desktop (Start-Process Claude.exe)`n" }
if ($role -eq "engineer" -and $hasWebstorm) {
    $finalMsg += "  • WebStorm plugin: Settings -> Plugins -> 'Claude Code'`n"
}
$finalMsg += "  • Secrets from Gist: & ~\kun\.claude\scripts\secrets.ps1 -GistId <ID>`n"
$finalMsg += "  • Mobile / remote: install Claude on iOS/Android, or open claude.ai/code in any browser`n`n"
$finalMsg += "Docs: https://kun.databayt.org/docs/onboarding"

$result = Ask-Choice $finalMsg "Done" "Open Docs"
if ($result -eq "Open Docs") {
    Start-Process "https://kun.databayt.org/docs/onboarding"
}

Set-State lastStep "done"
Set-State timestamp (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
Notify "All done" "Open a new terminal to start"
