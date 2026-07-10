# SessionStart hook (user-global, Windows) — surface maintain-heartbeat
# staleness. Reads %USERPROFILE%\.claude\.kun-maintain.json only: no network,
# no git. Installed to ~/.claude/hooks/ by setup.ps1 and wired in
# settings-windows.json so it fires in EVERY project.

$state = "$env:USERPROFILE\.claude\.kun-maintain.json"
if (-not (Test-Path $state)) { exit 0 }

try {
    $j = Get-Content $state -Raw | ConvertFrom-Json
    $ts = [datetime]::ParseExact($j.ts, "yyyy-MM-ddTHH:mm:ssZ",
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
    $age = [int]((Get-Date).ToUniversalTime() - $ts).TotalHours
    if ($age -gt 48) {
        Write-Output "kun-maintain heartbeat stale (${age}h since last run) - run: powershell -File `"$env:USERPROFILE\.claude\scripts\maintain.ps1`" -Run"
    }
    if ($j.verdict -eq "RED") {
        Write-Output "kun engine health RED since $($j.ts) - run: powershell -File `"$env:USERPROFILE\.claude\scripts\health.ps1`""
    }
    if ($j.pulled -eq "error") {
        Write-Output "kun-maintain could not pull ~/kun (rebase aborted) - pull manually: git -C `"$env:USERPROFILE\kun`" pull --rebase --autostash"
    }
} catch { }
exit 0
