# Verify the current PowerShell process is running elevated.
# Does NOT auto-relaunch — too brittle for irm | iex. Caller decides.

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
