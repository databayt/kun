# Kun finish — idempotent re-runner. Alias for bootstrap.ps1.
# Every step in bootstrap.ps1 is already idempotent, so this shim simply forwards.
# See: https://github.com/databayt/kun/issues/28

& "$PSScriptRoot\bootstrap.ps1" @args
