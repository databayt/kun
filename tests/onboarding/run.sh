#!/bin/bash
# Orchestrator for the onboarding test suite.
# Discovers tests/onboarding/*.test.sh, runs them in order, prints summary,
# exits non-zero on any failure.
#
# Usage:
#   bash tests/onboarding/run.sh                # run all suites
#   bash tests/onboarding/run.sh lint behavior  # run only matching suites
#
# Suites currently shipped:
#   lint     — static checks (shellcheck, JSON parse, doc structure)
#   behavior — state file + autofill + backend args logic
#   parity   — cross-OS installer consistency
#   links    — /docs/<x> link resolution

set -u  # error on unset vars; do NOT use -e so individual asserts can fail without aborting

cd "$(dirname "$0")/../.." || { echo "could not cd to repo root"; exit 2; }
TESTS_DIR="tests/onboarding"

# shellcheck source=tests/onboarding/lib.sh
# shellcheck disable=SC1091
source "$TESTS_DIR/lib.sh"

filter=("$@")
match_suite() {
    [[ ${#filter[@]} -eq 0 ]] && return 0
    local name="$1"
    for f in "${filter[@]}"; do
        [[ "$name" == *"$f"* ]] && return 0
    done
    return 1
}

start=$(date +%s)

# Discover *.test.sh in stable order (bash 3.2 compatible — no mapfile)
SUITES=()
while IFS= read -r line; do
    SUITES+=("$line")
done < <(find "$TESTS_DIR" -maxdepth 1 -type f -name "*.test.sh" | sort)

if [[ ${#SUITES[@]} -eq 0 ]]; then
    printf '%sNo test suites found in %s%s\n' "$C_RED" "$TESTS_DIR" "$C_RESET"
    exit 2
fi

printf '%sOnboarding test run%s — %d suites discovered (bash %s)\n' "$C_BOLD" "$C_RESET" "${#SUITES[@]}" "${BASH_VERSION%%.*}"

for suite in "${SUITES[@]}"; do
    name=$(basename "$suite" .test.sh)
    if ! match_suite "$name"; then
        printf '%s- skipping %s (filter)%s\n' "$C_DIM" "$name" "$C_RESET"
        continue
    fi
    # shellcheck source=/dev/null
    source "$suite"
done

elapsed=$(($(date +%s) - start))

printf '\n%s═════════════════════════════════════════%s\n' "$C_BOLD" "$C_RESET"
total=$((TOTAL_PASS + TOTAL_FAIL))
if [[ "$TOTAL_FAIL" -eq 0 ]]; then
    printf '%s✓ ALL GREEN — %d/%d assertions passed in %ds%s\n' "$C_GREEN" "$TOTAL_PASS" "$total" "$elapsed" "$C_RESET"
    exit 0
else
    printf '%s✗ FAILURES — %d/%d passed, %d failed in %ds%s\n' "$C_RED" "$TOTAL_PASS" "$total" "$TOTAL_FAIL" "$elapsed" "$C_RESET"
    exit 1
fi
