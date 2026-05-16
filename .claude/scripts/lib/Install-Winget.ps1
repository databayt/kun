# Idempotent winget install wrapper. Skips packages already present.

function Test-WingetPackage {
    param([Parameter(Mandatory)][string]$Id)
    $output = winget list --id $Id --exact 2>$null | Out-String
    # winget prints column headers + a row if installed, or "No installed package found" if not
    $output -notmatch 'No installed package' -and $output -match $Id
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory)][string]$Id,
        [string]$Source = 'winget',
        [int]$Retries = 1
    )
    if (Test-WingetPackage -Id $Id) {
        return @{ Installed = $true; Skipped = $true }
    }

    for ($attempt = 0; $attempt -le $Retries; $attempt++) {
        $args = @('install', '--id', $Id, '--exact', '--source', $Source,
                  '--accept-package-agreements', '--accept-source-agreements',
                  '--silent', '--disable-interactivity')
        winget @args 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0 -or (Test-WingetPackage -Id $Id)) {
            return @{ Installed = $true; Skipped = $false }
        }
        Start-Sleep -Seconds 5
    }
    @{ Installed = $false; Skipped = $false; ExitCode = $LASTEXITCODE }
}
