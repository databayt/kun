#!/bin/bash
# shellcheck disable=SC2034
# (C_YELLOW reserved for future use; no truly-unused-var warning is interesting here.)
#
# Tiny assertion library for the onboarding test suite.
# Source this file at the top of every *.test.sh.
#
# Exposes:
#   pass <msg>                  — record a passing assertion
#   fail <msg>                  — record a failing assertion (with caller line)
#   assert_eq <exp> <got> [msg]
#   assert_ne <unexp> <got> [msg]
#   assert_match <regex> <str> [msg]
#   assert_no_match <regex> <str> [msg]
#   assert_file_exists <path> [msg]
#   assert_file_missing <path> [msg]
#   assert_contains <needle> <file> [msg]
#   assert_not_contains <needle> <file> [msg]
#   assert_lt <n> <max> [msg]
#   assert_cmd_succeeds <cmd…> — runs cmd, asserts exit 0
#   assert_cmd_fails <cmd…>    — runs cmd, asserts non-zero exit
#   suite_name <name>          — call once per test file
#   suite_summary              — call at end; prints suite tallies
#
# Counters are exported so the orchestrator can roll them up.

# Colors (skip if not a TTY)
if [[ -t 1 ]]; then
    C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_YELLOW=$'\033[33m'
    C_DIM=$'\033[2m';   C_BOLD=$'\033[1m'; C_RESET=$'\033[0m'
else
    C_GREEN=""; C_RED=""; C_YELLOW=""; C_DIM=""; C_BOLD=""; C_RESET=""
fi

export TOTAL_PASS=${TOTAL_PASS:-0}
export TOTAL_FAIL=${TOTAL_FAIL:-0}
SUITE_PASS=0
SUITE_FAIL=0
SUITE_NAME=""

suite_name() {
    SUITE_NAME="$1"
    SUITE_PASS=0
    SUITE_FAIL=0
    printf '\n%s── %s ──%s\n' "$C_BOLD" "$SUITE_NAME" "$C_RESET"
}

suite_summary() {
    local total=$((SUITE_PASS + SUITE_FAIL))
    if [[ "$SUITE_FAIL" -eq 0 ]]; then
        printf '%s✓ %s — %d/%d passed%s\n' "$C_GREEN" "$SUITE_NAME" "$SUITE_PASS" "$total" "$C_RESET"
    else
        printf '%s✗ %s — %d/%d passed (%d failed)%s\n' "$C_RED" "$SUITE_NAME" "$SUITE_PASS" "$total" "$SUITE_FAIL" "$C_RESET"
    fi
    TOTAL_PASS=$((TOTAL_PASS + SUITE_PASS))
    TOTAL_FAIL=$((TOTAL_FAIL + SUITE_FAIL))
    export TOTAL_PASS TOTAL_FAIL
}

pass() {
    SUITE_PASS=$((SUITE_PASS + 1))
    printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$1"
}

fail() {
    SUITE_FAIL=$((SUITE_FAIL + 1))
    local where="${BASH_SOURCE[2]:-?}:${BASH_LINENO[1]:-?}"
    printf '  %s✗%s %s %s(%s)%s\n' "$C_RED" "$C_RESET" "$1" "$C_DIM" "$where" "$C_RESET"
    [[ -n "${2:-}" ]] && printf '      %s%s%s\n' "$C_DIM" "$2" "$C_RESET"
}

assert_eq() {
    local exp="$1" got="$2" msg="${3:-equals}"
    if [[ "$exp" == "$got" ]]; then
        pass "$msg"
    else
        fail "$msg" "expected: '$exp'  got: '$got'"
    fi
}

assert_ne() {
    local unexp="$1" got="$2" msg="${3:-not equals}"
    if [[ "$unexp" != "$got" ]]; then
        pass "$msg"
    else
        fail "$msg" "expected NOT: '$unexp'  got: '$got'"
    fi
}

assert_match() {
    local regex="$1" str="$2" msg="${3:-matches regex}"
    if [[ "$str" =~ $regex ]]; then
        pass "$msg"
    else
        fail "$msg" "regex: '$regex'  str: '$str'"
    fi
}

assert_no_match() {
    local regex="$1" str="$2" msg="${3:-no match}"
    if [[ ! "$str" =~ $regex ]]; then
        pass "$msg"
    else
        fail "$msg" "regex: '$regex' MATCHED str: '$str'"
    fi
}

assert_file_exists() {
    local path="$1" msg="${2:-file exists: $1}"
    if [[ -f "$path" ]]; then
        pass "$msg"
    else
        fail "$msg" "missing: $path"
    fi
}

assert_file_missing() {
    local path="$1" msg="${2:-file missing: $1}"
    if [[ ! -e "$path" ]]; then
        pass "$msg"
    else
        fail "$msg" "should not exist: $path"
    fi
}

assert_contains() {
    local needle="$1" file="$2" msg="${3:-file contains needle}"
    if grep -qF -- "$needle" "$file" 2>/dev/null; then
        pass "$msg"
    else
        fail "$msg" "'$needle' not found in $file"
    fi
}

assert_not_contains() {
    local needle="$1" file="$2" msg="${3:-file does not contain needle}"
    if ! grep -qF -- "$needle" "$file" 2>/dev/null; then
        pass "$msg"
    else
        fail "$msg" "'$needle' unexpectedly found in $file"
    fi
}

assert_lt() {
    local n="$1" max="$2" msg="${3:-$1 < $2}"
    if [[ "$n" -lt "$max" ]]; then
        pass "$msg ($n < $max)"
    else
        fail "$msg" "$n is not < $max"
    fi
}

assert_cmd_succeeds() {
    local msg="$1"; shift
    if "$@" >/dev/null 2>&1; then
        pass "$msg"
    else
        fail "$msg" "command failed (exit $?): $*"
    fi
}

assert_cmd_fails() {
    local msg="$1"; shift
    if ! "$@" >/dev/null 2>&1; then
        pass "$msg"
    else
        fail "$msg" "command unexpectedly succeeded: $*"
    fi
}
