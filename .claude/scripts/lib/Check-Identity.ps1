# Audit identity: gh auth status, claude CLI signed in.

. "$PSScriptRoot\Common.ps1"

function Test-Identity {
    $r = @()

    # gh
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) {
        $r += New-CheckResult -Category 'IDENTITY' -Name 'gh' -Status fail -Detail 'CLI not installed'
    } else {
        $status = gh auth status 2>&1 | Out-String
        if ($status -match 'Logged in to github\.com\s+account\s+(\S+)') {
            $r += New-CheckResult -Category 'IDENTITY' -Name 'gh' -Status pass -Detail "logged in as @$($Matches[1])"
        } elseif ($status -match 'not logged') {
            $r += New-CheckResult -Category 'IDENTITY' -Name 'gh' -Status fail -Detail 'not authenticated — run gh auth login'
        } else {
            $r += New-CheckResult -Category 'IDENTITY' -Name 'gh' -Status warn -Detail 'status unclear'
        }
    }

    # claude CLI
    $claude = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claude) {
        $r += New-CheckResult -Category 'IDENTITY' -Name 'claude' -Status fail -Detail 'CLI not installed'
    } else {
        $version = (claude --version 2>$null | Select-Object -First 1).Trim()
        # Heuristic: presence of ~/.claude/.credentials.json or session state
        $credPaths = @(
            "$env:USERPROFILE\.claude\.credentials.json",
            "$env:USERPROFILE\.claude\session.json"
        )
        $signedIn = $credPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($signedIn) {
            $r += New-CheckResult -Category 'IDENTITY' -Name 'claude' -Status pass -Detail "signed in · $version"
        } else {
            $r += New-CheckResult -Category 'IDENTITY' -Name 'claude' -Status warn `
                -Detail "$version · sign-in state unverified — run 'claude' to confirm"
        }
    }

    $r
}
