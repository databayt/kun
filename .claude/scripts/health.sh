#!/bin/bash
# DEPRECATED — back-compat shim. Forwards to doctor.sh.
# Will be removed in a follow-up PR after a two-week co-existence window.
# See: https://github.com/databayt/kun/issues/26

# Translate legacy flag names: --report stays the same; everything else passes through.
exec "$(dirname "$0")/doctor.sh" "$@"
