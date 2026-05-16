# Refresh $env:Path in the current process from Machine + User registry entries.
# Needed after winget installs because they update the persistent PATH only.

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = ($machine, $user | Where-Object { $_ }) -join ';'
}
