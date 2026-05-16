# Audit Windows scheduled task: kun-maintain armed and reachable.

. "$PSScriptRoot\Common.ps1"

function Test-Scheduled {
    $r = @()
    try {
        $task = Get-ScheduledTask -TaskName 'kun-maintain' -ErrorAction Stop
        $info = $task | Get-ScheduledTaskInfo
        $next = if ($info.NextRunTime) { $info.NextRunTime.ToString('yyyy-MM-dd HH:mm') } else { 'no schedule' }
        $last = if ($info.LastRunTime -and $info.LastRunTime.Year -gt 1900) {
            "last run $($info.LastRunTime.ToString('MM-dd HH:mm')) (exit $($info.LastTaskResult))"
        } else { 'never run' }
        $r += New-CheckResult -Category 'SCHEDULED' -Name 'kun-maintain' -Status pass `
            -Detail "next $next · $last"
    } catch {
        $r += New-CheckResult -Category 'SCHEDULED' -Name 'kun-maintain' -Status paused `
            -Detail 'not armed — install via maintain -Install or bootstrap.ps1'
    }
    $r
}
