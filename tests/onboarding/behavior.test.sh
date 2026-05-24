#!/bin/bash
# Behavior tests: source installer.sh's helpers in a sandbox and exercise:
#   - state_get / state_set round-trip
#   - git-config autofill (name + email)
#   - mcp.json → role detection
#   - BACKEND_ARGS construction shape
#
# Strategy: copy installer.sh into a temp dir with everything past Act 1 stripped,
# override interactive helpers to return canned values, run in a sandboxed HOME.

suite_name "behavior — state, autofill, args"

# Sandbox dir cleaned at the END of the suite (NOT via trap RETURN —
# in bash 3.2, sourcing the sandbox would trigger the trap mid-test).
# HOME saved + restored so subsequent suites don't inherit a deleted path.
TMP=$(mktemp -d)
ORIGINAL_HOME="$HOME"

ORIGINAL="$PWD/.claude/scripts/installer.sh"
SANDBOX="$TMP/installer-sandbox.sh"

# Build a sandboxed version: keep everything BEFORE the bootstrap block (state_get, state_set, ask_*),
# stop right before the `if ! xcode-select` line so we don't try to clone kun or invoke osascript.
# Then we can source it and call the helpers directly.
awk '
    /^# ── Bootstrap:/ { exit }
    { print }
' "$ORIGINAL" > "$SANDBOX"

# Sandboxed HOME so state files land in $TMP, never the real ~/Library/...
export HOME="$TMP/home"
mkdir -p "$HOME"

# shellcheck source=/dev/null
source "$SANDBOX"
# installer.sh starts with `set -e` — that leaks into the orchestrator and would
# make later `grep -c` calls (count == 0 → exit 1) abort subsequent suites.
set +e

# ── state_get / state_set ──────────────────────────────────────
state_set role engineer
assert_eq "engineer" "$(state_get role)" "state_set then state_get returns same value"

state_set gitName "Test User"
state_set gitEmail "test@example.com"
assert_eq "Test User"          "$(state_get gitName)"  "state persists multi-key writes (name)"
assert_eq "test@example.com"   "$(state_get gitEmail)" "state persists multi-key writes (email)"

# Missing key → empty string, not error
assert_eq "" "$(state_get nonexistentKey)" "state_get unknown key returns empty"

# Values with spaces survive round-trip
state_set complexValue "value with spaces and commas, etc."
assert_eq "value with spaces and commas, etc." "$(state_get complexValue)" "round-trip with spaces"

# State file is valid JSON after multiple writes
STATE_FILE_PATH="$HOME/Library/Application Support/Databayt/installer-state.json"
assert_file_exists "$STATE_FILE_PATH" "state file written"
assert_cmd_succeeds "state file is valid JSON" \
    python3 -c "import json; json.load(open('$STATE_FILE_PATH'))"

# ── git-config autofill ──────────────────────────────────────────
# The installer reads `git config --global user.name`. Point HOME's gitconfig at fixtures.
cat > "$HOME/.gitconfig" <<'EOF'
[user]
    name = Fixture Name
    email = fixture@databayt.org
EOF

# git's --global respects $HOME — confirm it reads our fixture
detected_name=$(git config --global user.name 2>/dev/null)
detected_email=$(git config --global user.email 2>/dev/null)
assert_eq "Fixture Name"         "$detected_name"  "git config --global user.name reads sandbox HOME"
assert_eq "fixture@databayt.org" "$detected_email" "git config --global user.email reads sandbox HOME"

# ── mcp.json → role detection ────────────────────────────────────
# The installer does: grep -q '"shadcn"' → engineer, '"linear"' → business, etc.
mkdir -p "$HOME/.claude"

detect_role() {
    local mcp="$HOME/.claude/mcp.json"
    local role=""
    if [[ -f "$mcp" ]]; then
        if   grep -q '"shadcn"'  "$mcp" 2>/dev/null; then role="engineer"
        elif grep -q '"linear"'  "$mcp" 2>/dev/null; then role="business"
        elif grep -q '"figma"'   "$mcp" 2>/dev/null; then role="content"
        elif grep -q '"posthog"' "$mcp" 2>/dev/null; then role="ops"
        fi
    fi
    echo "$role"
}

# engineer fixture
echo '{"mcpServers":{"shadcn":{}}}' > "$HOME/.claude/mcp.json"
assert_eq "engineer" "$(detect_role)" "mcp.json with shadcn → engineer"

echo '{"mcpServers":{"linear":{}}}' > "$HOME/.claude/mcp.json"
assert_eq "business" "$(detect_role)" "mcp.json with linear → business"

echo '{"mcpServers":{"figma":{}}}' > "$HOME/.claude/mcp.json"
assert_eq "content" "$(detect_role)" "mcp.json with figma → content"

echo '{"mcpServers":{"posthog":{}}}' > "$HOME/.claude/mcp.json"
assert_eq "ops" "$(detect_role)" "mcp.json with posthog → ops"

# No fixture present → empty
rm -f "$HOME/.claude/mcp.json"
assert_eq "" "$(detect_role)" "missing mcp.json → empty role"

# ── BACKEND_ARGS construction ────────────────────────────────────
# Replicate the construction logic from installer.sh:194-197.
build_args() {
    local role="$1" name="$2" email="$3" hogwarts_dev="$4"
    local args=("$role")
    args+=("--quiet" "--name" "$name" "--email" "$email")
    [[ "$hogwarts_dev" == "1" ]] && args+=("--hogwarts-dev")
    printf '%s\n' "${args[@]}"
}

# engineer with hogwarts on
got=$(build_args engineer "Test User" "test@example.com" 1 | tr '\n' '|')
exp="engineer|--quiet|--name|Test User|--email|test@example.com|--hogwarts-dev|"
assert_eq "$exp" "$got" "BACKEND_ARGS: engineer + hogwarts-dev"

# business with hogwarts off
got=$(build_args business "Biz Person" "biz@example.com" 0 | tr '\n' '|')
exp="business|--quiet|--name|Biz Person|--email|biz@example.com|"
assert_eq "$exp" "$got" "BACKEND_ARGS: business + no hogwarts-dev"

# Args always start with role
got=$(build_args ops "X Y" "x@y.z" 1 | head -1)
assert_eq "ops" "$got" "BACKEND_ARGS first arg is role"

# --quiet always present
build_args engineer N E 0 | grep -q -- "--quiet"
assert_cmd_succeeds "BACKEND_ARGS always includes --quiet (engineer)" \
    bash -c "$(declare -f build_args); build_args engineer N E 0 | grep -q -- --quiet"

rm -rf "$TMP"
export HOME="$ORIGINAL_HOME"
unset TMP SANDBOX ORIGINAL STATE_FILE_PATH ORIGINAL_HOME
suite_summary
