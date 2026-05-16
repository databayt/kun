# Download the Claude Code [Beta] JetBrains plugin and drop it into WebStorm's
# plugins/ directory so it's loaded on first IDE launch. Skips if already present.
#
# Marketplace plugin: https://plugins.jetbrains.com/plugin/27310-claude-code-beta-
# API endpoints (verified 2026-05-16):
#   - latest: https://plugins.jetbrains.com/api/plugins/27310/updates?channel=&size=1
#   - file:   https://plugins.jetbrains.com/files/{file from API}

$script:PluginId = 27310
$script:PluginNameMatch = 'claude'

function Get-LatestPluginInfo {
    try {
        $u = "https://plugins.jetbrains.com/api/plugins/$($script:PluginId)/updates?channel=&size=1"
        $r = Invoke-RestMethod -Uri $u -TimeoutSec 10 -ErrorAction Stop
        if ($r.Count -eq 0) { return $null }
        [pscustomobject]@{
            UpdateId = $r[0].id
            Version  = $r[0].version
            FilePath = $r[0].file  # already a path like "27310/907737/claude-code-jetbrains-plugin-0.1.14-beta.zip"
        }
    } catch { $null }
}

function Get-WebStormConfigDirs {
    $appdata = $env:APPDATA
    if (-not $appdata) { return @() }
    Get-ChildItem "$appdata\JetBrains" -Directory -Filter 'WebStorm*' -ErrorAction SilentlyContinue
}

function Install-ClaudeCodePlugin {
    [CmdletBinding()]
    param([switch]$Force)

    $configDirs = Get-WebStormConfigDirs
    if (-not $configDirs) {
        return @{ Status = 'skip'; Reason = 'WebStorm config dir not found — install IDE first' }
    }

    $info = Get-LatestPluginInfo
    if (-not $info) {
        return @{ Status = 'fail'; Reason = 'could not query Marketplace API' }
    }

    # Pick the newest WebStorm config dir
    $targetConfig = $configDirs | Sort-Object Name -Descending | Select-Object -First 1
    $pluginsDir = Join-Path $targetConfig.FullName 'plugins'
    if (-not (Test-Path $pluginsDir)) { New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null }

    # Skip if already loaded (unless -Force)
    $existing = Get-ChildItem $pluginsDir -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match $script:PluginNameMatch } |
                Select-Object -First 1
    if ($existing -and -not $Force) {
        return @{ Status = 'skip'; Reason = "already present: $($existing.Name)" }
    }

    # Download to temp + extract into plugins/
    $zipPath = Join-Path $env:TEMP "claude-code-plugin-$($info.UpdateId).zip"
    try {
        $dlUrl = "https://plugins.jetbrains.com/files/$($info.FilePath)"
        Invoke-WebRequest -Uri $dlUrl -OutFile $zipPath -UseBasicParsing -ErrorAction Stop

        # Remove old version if any (only when -Force)
        if ($existing -and $Force) { Remove-Item $existing.FullName -Recurse -Force }

        Expand-Archive -Path $zipPath -DestinationPath $pluginsDir -Force
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

        return @{ Status = 'ok'; Reason = "v$($info.Version) extracted to $pluginsDir" }
    } catch {
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force -ErrorAction SilentlyContinue }
        return @{ Status = 'fail'; Reason = $_.Exception.Message }
    }
}
