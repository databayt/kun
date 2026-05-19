# DEPRECATED — back-compat shim. Forwards to doctor.ps1.
# Will be removed in a follow-up PR after a two-week co-existence window.
# See: https://github.com/databayt/kun/issues/26

& "$PSScriptRoot\doctor.ps1" @args
