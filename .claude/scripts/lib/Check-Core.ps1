# Audit ~/.claude core config files: CLAUDE.md, settings.json, mcp.json, .env, directory counts.

. "$PSScriptRoot\Common.ps1"

function Test-CoreConfig {
    $r = @()
    $d = $script:ClaudeDir

    # Files exist + valid JSON
    foreach ($f in 'CLAUDE.md','settings.json','mcp.json') {
        $p = Join-Path $d $f
        if (-not (Test-Path $p)) {
            $r += New-CheckResult -Category 'CORE FILES' -Name $f -Status fail -Detail 'missing — run install.ps1'
            continue
        }
        $age = Test-FileFreshness $p
        if ($f -like '*.json') {
            try {
                Get-Content $p -Raw | ConvertFrom-Json -ErrorAction Stop | Out-Null
                $detail = "valid JSON · ${age}d old"
                $status = if ($age -gt 30) { 'warn' } else { 'pass' }
            } catch {
                $r += New-CheckResult -Category 'CORE FILES' -Name $f -Status fail -Detail 'invalid JSON'
                continue
            }
        } else {
            $detail = "exists · ${age}d old"
            $status = if ($age -gt 30) { 'warn' } else { 'pass' }
        }
        $r += New-CheckResult -Category 'CORE FILES' -Name $f -Status $status -Detail $detail
    }

    # .env
    $envPath = Join-Path $d '.env'
    if (-not (Test-Path $envPath)) {
        $r += New-CheckResult -Category 'CORE FILES' -Name '.env' -Status warn `
            -Detail 'missing — run secrets.ps1' -Fix 'rerun-secrets'
    } else {
        $age = Test-FileFreshness $envPath
        if ($age -gt 7) {
            $r += New-CheckResult -Category 'CORE FILES' -Name '.env' -Status warn `
                -Detail "${age}d old — re-run secrets.ps1" -Fix 'rerun-secrets'
        } else {
            $r += New-CheckResult -Category 'CORE FILES' -Name '.env' -Status pass -Detail "${age}d old"
        }
    }

    # Directory counts
    $role = Get-Role
    $expected = switch ($role) {
        'engineer' { @{ agents=20; commands=15 } }
        'business' { @{ agents=10; commands=5 } }
        'content'  { @{ agents=10; commands=5 } }
        'ops'      { @{ agents=10; commands=7 } }
        default    { @{ agents=1;  commands=1 } }
    }
    foreach ($dir in 'agents','commands') {
        $count = (Get-ChildItem "$d\$dir\*.md" -ErrorAction SilentlyContinue).Count
        $min = $expected[$dir]
        if ($count -ge $min) {
            $r += New-CheckResult -Category 'CORE FILES' -Name "${dir}/" -Status pass -Detail "$count files"
        } elseif ($count -gt 0) {
            $r += New-CheckResult -Category 'CORE FILES' -Name "${dir}/" -Status warn -Detail "$count files (expected >=$min)"
        } else {
            $r += New-CheckResult -Category 'CORE FILES' -Name "${dir}/" -Status fail -Detail 'empty'
        }
    }

    $r
}
