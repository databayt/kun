# Audit shell: $PROFILE has c function, ~/.claude/bin on PATH.

. "$PSScriptRoot\Common.ps1"

function Test-Shell {
    $r = @()
    $profilePath = $PROFILE.CurrentUserAllHosts

    # $PROFILE exists?
    if (-not (Test-Path $profilePath)) {
        $r += New-CheckResult -Category 'SHELL' -Name '$PROFILE' -Status fail `
            -Detail 'missing — run doctor -Fix' -Fix 'create-profile'
        return $r
    }

    # c function defined?
    $content = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($content -match 'function\s+c\s*\{[^}]*claude\s+--dangerously-skip-permissions') {
        $r += New-CheckResult -Category 'SHELL' -Name 'c function' -Status pass -Detail 'defined in $PROFILE'
    } else {
        $r += New-CheckResult -Category 'SHELL' -Name 'c function' -Status fail `
            -Detail 'missing — run doctor -Fix' -Fix 'append-c-function'
    }

    # ~/.claude/bin on PATH?
    $binDir = "$script:ClaudeDir\bin"
    if ($env:Path -split ';' -contains $binDir) {
        $r += New-CheckResult -Category 'SHELL' -Name '~/.claude/bin' -Status pass -Detail 'on PATH'
    } elseif ($content -match [regex]::Escape($binDir)) {
        $r += New-CheckResult -Category 'SHELL' -Name '~/.claude/bin' -Status warn `
            -Detail 'in $PROFILE but not current PATH — restart shell'
    } else {
        $r += New-CheckResult -Category 'SHELL' -Name '~/.claude/bin' -Status warn `
            -Detail 'not on PATH' -Fix 'prepend-bin-path'
    }

    $r
}
