# Optional GitHub tracking issue for bootstrap progress. Requires pre-existing gh auth.
# When -Track is on, bootstrap creates an issue at step 3 and edits its body
# (checkbox list) after each successful step. On final success, closes the issue.
# On final failure, leaves it open with a log dump comment for forensics.

$script:TrackRepo  = 'databayt/kun'
$script:TrackLabel = 'bootstrap-run'

$script:StepNames = @(
    '[0]  ExecutionPolicy → RemoteSigned'
    '[1]  Self-elevation (UAC)'
    '[2]  OS + PowerShell version check'
    '[3]  Logs directory + log file'
    '[4]  winget bundle (Git, Node, gh, pwsh, Claude CLI, Claude Desktop)'
    '[5]  PATH refresh'
    '[6]  pnpm via npm'
    '[7]  WebStorm install'
    '[8]  Claude Code [Beta] plugin pre-drop'
    '[9]  install.ps1 (kun config)'
    '[10] settings.json'
    '[11] $PROFILE c/cc block'
    '[12] OAuth batch (gh + claude + JetBrains)'
    '[13] secrets.ps1 (.env from Gist)'
    '[14] sync-repos.ps1'
    '[15] maintain -Install'
    '[16] doctor verify'
)

function Test-GhAvailable {
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) { return $false }
    $status = gh auth status 2>&1 | Out-String
    $status -match 'Logged in'
}

function New-TrackingIssue {
    if (-not (Test-GhAvailable)) {
        return $null  # -Track requested but gh unauthed; caller logs and continues
    }
    $title = "bootstrap: $($env:COMPUTERNAME) — $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $body  = (@('Bootstrap run in progress. Checkboxes update live.', '') +
              ($script:StepNames | ForEach-Object { "- [ ] $_" })) -join "`n"

    $num = gh issue create --repo $script:TrackRepo `
        --title $title --body $body `
        --label $script:TrackLabel 2>$null |
        ForEach-Object { if ($_ -match '/issues/(\d+)') { $Matches[1] } }

    if ($num) {
        Write-Host "  Tracking: https://github.com/$($script:TrackRepo)/issues/$num" -ForegroundColor Cyan
    }
    $num
}

function Update-TrackingIssue {
    param(
        [Parameter(Mandatory)][string]$IssueNumber,
        [Parameter(Mandatory)][int]$StepIndex
    )
    if (-not $IssueNumber) { return }
    try {
        # Pull current body, flip the matching checkbox, write back
        $current = gh issue view $IssueNumber --repo $script:TrackRepo --json body -q .body 2>$null
        if (-not $current) { return }
        $marker = $script:StepNames[$StepIndex]
        if (-not $marker) { return }
        $updated = $current -replace ([regex]::Escape("- [ ] $marker")), "- [x] $marker"
        if ($updated -eq $current) { return }  # no change
        $updated | gh issue edit $IssueNumber --repo $script:TrackRepo --body-file - 2>$null | Out-Null
    } catch {
        # Tracking failures are silent — we don't want to abort bootstrap over a 5xx from GitHub
    }
}

function Close-TrackingIssue {
    param(
        [Parameter(Mandatory)][string]$IssueNumber,
        [Parameter(Mandatory)][ValidateSet('success','failure')]$Outcome,
        [string]$LogPath = ''
    )
    if (-not $IssueNumber) { return }
    try {
        if ($Outcome -eq 'success') {
            gh issue close $IssueNumber --repo $script:TrackRepo --comment '✅ Bootstrap completed successfully.' 2>$null | Out-Null
        } else {
            $msg = "❌ Bootstrap exited with errors."
            if ($LogPath -and (Test-Path $LogPath)) {
                $tail = Get-Content $LogPath -Tail 40 -ErrorAction SilentlyContinue | Out-String
                $msg += "`n`n<details><summary>Last 40 log lines</summary>`n`n```$tail````n</details>"
            }
            gh issue comment $IssueNumber --repo $script:TrackRepo --body $msg 2>$null | Out-Null
        }
    } catch { }
}
