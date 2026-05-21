# =============================================================================
# Databayt - Windows installer dispatcher
# =============================================================================
# Hosted at https://kun.databayt.org/install.ps1
# Downloads and runs the WPF installer wrapper.
#
# Bootstrap:
#   iwr https://kun.databayt.org/install.ps1 | iex
# =============================================================================

$ErrorActionPreference = "Stop"

$installerUrl = "https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts/installer.ps1"

Write-Host "Detected Windows - launching installer..." -ForegroundColor Cyan

# Bypass execution policy for this session only (safer than persistent change)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Download + execute. Using iex on raw script keeps the bootstrap one-line.
Invoke-WebRequest -UseBasicParsing -Uri $installerUrl | Invoke-Expression
