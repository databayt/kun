# Bootstrap-only helpers: numbered step output, log tee, beep.

$script:CurrentStep = 0
$script:TotalSteps  = 16
$script:BootstrapLog = $null

function Initialize-BootstrapLog {
    $logsDir = "$env:USERPROFILE\.claude\logs"
    if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Force -Path $logsDir | Out-Null }
    $ts = (Get-Date).ToString('yyyyMMddTHHmmss')
    $script:BootstrapLog = Join-Path $logsDir "bootstrap-$ts.log"
    "[$([DateTime]::UtcNow.ToString('o'))] [INFO] bootstrap start" | Out-File $script:BootstrapLog -Encoding utf8
    $script:BootstrapLog
}

function Write-Step {
    param(
        [Parameter(Mandatory)][int]$Number,
        [Parameter(Mandatory)][string]$Description,
        [ValidateSet('start','ok','skip','warn','fail')]$Status = 'start',
        [string]$Detail = ''
    )
    $script:CurrentStep = $Number
    $icon = switch ($Status) {
        'start' { '⏳' }
        'ok'    { '✅' }
        'skip'  { '⏭ ' }
        'warn'  { '⚠️ ' }
        'fail'  { '❌' }
    }
    $color = switch ($Status) {
        'start' { 'Cyan' }
        'ok'    { 'Green' }
        'skip'  { 'Gray' }
        'warn'  { 'Yellow' }
        'fail'  { 'Red' }
    }
    $prefix = "[$Number/$script:TotalSteps]".PadRight(6)
    $line = "$prefix $icon $Description"
    if ($Detail) { $line += " · $Detail" }
    Write-Host $line -ForegroundColor $color
    if ($script:BootstrapLog) {
        "[$([DateTime]::UtcNow.ToString('o'))] [$($Status.ToUpper())] step $Number — $Description $(if ($Detail) { "· $Detail" })" |
            Out-File $script:BootstrapLog -Append -Encoding utf8
    }
}

function Write-BootstrapLog {
    param([string]$Message, [string]$Level = 'INFO')
    if (-not $script:BootstrapLog) { return }
    "[$([DateTime]::UtcNow.ToString('o'))] [$Level] $Message" |
        Out-File $script:BootstrapLog -Append -Encoding utf8
}

function Invoke-AttentionBell {
    try { [Console]::Beep(1000, 200) } catch { }
}
