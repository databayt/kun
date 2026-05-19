# Audit WebStorm + Claude Code [Beta] plugin presence.

. "$PSScriptRoot\Common.ps1"

function Test-IDE {
    $r = @()
    $appdata = $env:APPDATA
    if (-not $appdata) {
        $r += New-CheckResult -Category 'IDE' -Name 'WebStorm' -Status warn -Detail '$env:APPDATA not set'
        return $r
    }

    $configDirs = Get-ChildItem "$appdata\JetBrains" -Directory -Filter 'WebStorm*' -ErrorAction SilentlyContinue
    if (-not $configDirs) {
        $r += New-CheckResult -Category 'IDE' -Name 'WebStorm' -Status paused `
            -Detail 'not installed (optional — install via bootstrap.ps1)'
        return $r
    }

    $latest = $configDirs | Sort-Object Name -Descending | Select-Object -First 1
    $version = ($latest.Name -replace 'WebStorm','').Trim()
    $r += New-CheckResult -Category 'IDE' -Name 'WebStorm' -Status pass -Detail "$version detected"

    # Plugin
    $pluginsDir = Join-Path $latest.FullName 'plugins'
    if (Test-Path $pluginsDir) {
        $plugin = Get-ChildItem $pluginsDir -Directory -ErrorAction SilentlyContinue |
                  Where-Object { $_.Name -match 'Claude' } |
                  Select-Object -First 1
        if ($plugin) {
            $r += New-CheckResult -Category 'IDE' -Name 'Claude Code [Beta]' -Status pass -Detail $plugin.Name
        } else {
            $r += New-CheckResult -Category 'IDE' -Name 'Claude Code [Beta]' -Status warn `
                -Detail 'not loaded — install from Marketplace or bootstrap.ps1'
        }
    } else {
        $r += New-CheckResult -Category 'IDE' -Name 'Claude Code [Beta]' -Status warn -Detail "plugins dir missing"
    }

    $r
}
