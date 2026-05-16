#!/bin/bash
# Kun finish — idempotent re-runner. Forwards to onboarding-mac.sh on macOS.
# (Linux: not yet supported; use the manual fallback.)
# See: https://github.com/databayt/kun/issues/28

DIR="$(dirname "$0")"
if [ -x "$DIR/onboarding-mac.sh" ] || [ -f "$DIR/onboarding-mac.sh" ]; then
    exec bash "$DIR/onboarding-mac.sh" "$@"
fi
echo "finish.sh: no bootstrap equivalent for this platform yet." >&2
echo "Use the manual fallback at https://kun.databayt.org/docs/onboarding" >&2
exit 1
