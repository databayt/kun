# Notification helpers for maintain.ps1: Windows toast, Slack webhook, GitHub issue comment.

function Send-Toast {
    param(
        [Parameter(Mandatory)][string]$Title,
        [string]$Body = '',
        [string]$RunArguments = ''
    )
    try {
        if (-not (Get-Module -ListAvailable -Name BurntToast)) {
            Install-Module -Name BurntToast -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
        }
        Import-Module BurntToast -ErrorAction Stop

        $text = @($Title)
        if ($Body) { $text += $Body }

        if ($RunArguments) {
            $btn = New-BTButton -Content 'Run' -Arguments "powershell -NoExit -Command `"$RunArguments`""
            New-BurntToastNotification -Text $text -Button $btn -ErrorAction Stop
        } else {
            New-BurntToastNotification -Text $text -ErrorAction Stop
        }
        $true
    } catch {
        Write-Verbose "Toast failed: $_"
        $false
    }
}

function Send-Slack {
    param(
        [Parameter(Mandatory)][string]$WebhookUrl,
        [Parameter(Mandatory)][string]$Title,
        [string[]]$Bullets = @(),
        [string]$Footer = ''
    )
    if (-not $WebhookUrl) { return $false }
    try {
        $text = "*$Title*"
        if ($Bullets.Count -gt 0) {
            $text += "`n" + (($Bullets | ForEach-Object { "• $_" }) -join "`n")
        }
        if ($Footer) { $text += "`n`n$Footer" }
        $payload = @{
            blocks = @(
                @{ type = 'section'; text = @{ type = 'mrkdwn'; text = $text } }
            )
        } | ConvertTo-Json -Depth 4 -Compress
        Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 5 | Out-Null
        $true
    } catch {
        Write-Verbose "Slack failed: $_"
        $false
    }
}

function Get-EnvVar {
    param([string]$Name)
    $envFile = "$env:USERPROFILE\.claude\.env"
    if (-not (Test-Path $envFile)) { return $null }
    $line = Get-Content $envFile | Where-Object { $_ -match "^$Name\s*=" } | Select-Object -First 1
    if ($line) { ($line -split '=', 2)[1].Trim() } else { $null }
}
