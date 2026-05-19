# Audit updates: claude CLI latest, ~/.claude and ~/codebase git ahead/behind.

. "$PSScriptRoot\Common.ps1"

function Compare-Semver {
    param([string]$Current, [string]$Latest)
    # Strip leading 'v' if present
    $c = ($Current -replace '^v','').Split('.')
    $l = ($Latest  -replace '^v','').Split('.')
    for ($i = 0; $i -lt [Math]::Max($c.Length, $l.Length); $i++) {
        $cv = if ($i -lt $c.Length) { [int]($c[$i] -replace '\D','') } else { 0 }
        $lv = if ($i -lt $l.Length) { [int]($l[$i] -replace '\D','') } else { 0 }
        if ($lv -gt $cv) { return 1 }
        if ($lv -lt $cv) { return -1 }
    }
    0
}

function Get-LatestClaudeRelease {
    try {
        $r = Invoke-RestMethod -Uri 'https://api.github.com/repos/anthropics/claude-code/releases/latest' -TimeoutSec 5
        $r.tag_name
    } catch {
        $null
    }
}

function Test-Updates {
    $r = @()

    # claude CLI version
    $claude = Get-Command claude -ErrorAction SilentlyContinue
    if ($claude) {
        $current = (claude --version 2>$null | Select-Object -First 1).Trim() -replace '^.*?(\d[\d\.]*).*$','$1'
        $latest  = Get-LatestClaudeRelease
        if ($latest) {
            $cmp = Compare-Semver -Current $current -Latest $latest
            if ($cmp -gt 0) {
                $r += New-CheckResult -Category 'UPDATES' -Name 'claude CLI' -Status update `
                    -Detail "$latest available (current $current) — winget upgrade Anthropic.ClaudeCode"
            } else {
                $r += New-CheckResult -Category 'UPDATES' -Name 'claude CLI' -Status pass -Detail "up to date · $current"
            }
        } else {
            $r += New-CheckResult -Category 'UPDATES' -Name 'claude CLI' -Status warn -Detail "$current · can't reach GitHub releases"
        }
    }

    # Repos to check for upstream updates
    $repos = @(
        @{ Name = '~/kun';      Path = "$env:USERPROFILE\kun" },
        @{ Name = '~/codebase'; Path = "$env:USERPROFILE\codebase" }
    )

    foreach ($repo in $repos) {
        if (-not (Test-Path $repo.Path)) { continue }
        Push-Location $repo.Path
        try {
            git fetch --quiet 2>$null
            $local  = (git rev-parse '@'        2>$null).Trim()
            $remote = (git rev-parse '@{u}'     2>$null).Trim()
            if (-not $remote) {
                $r += New-CheckResult -Category 'UPDATES' -Name $repo.Name -Status warn -Detail 'no upstream'
            } elseif ($local -eq $remote) {
                $r += New-CheckResult -Category 'UPDATES' -Name $repo.Name -Status pass -Detail 'up to date'
            } else {
                $ahead  = (git rev-list --count "$remote..$local"  2>$null).Trim()
                $behind = (git rev-list --count "$local..$remote"  2>$null).Trim()
                if ($behind -gt 0) {
                    $r += New-CheckResult -Category 'UPDATES' -Name $repo.Name -Status update `
                        -Detail "$behind commits behind — git pull"
                } else {
                    $r += New-CheckResult -Category 'UPDATES' -Name $repo.Name -Status pass -Detail "ahead $ahead"
                }
            }
        } catch {
            $r += New-CheckResult -Category 'UPDATES' -Name $repo.Name -Status warn -Detail 'fetch failed'
        } finally {
            Pop-Location
        }
    }

    $r
}
