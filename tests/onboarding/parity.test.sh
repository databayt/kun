#!/bin/bash
# Parity tests: all three installers (mac, linux, windows) must expose the
# same surface — same flags, same state-file keys, same final-panel bullets.

suite_name "parity — cross-OS consistency"

SH="$PWD/.claude/scripts/installer.sh"
LX="$PWD/.claude/scripts/installer-linux.sh"
PS="$PWD/.claude/scripts/installer.ps1"

# ── Backend flag parity ──────────────────────────────────────────
# The shell wrappers pass --quiet --name --email; PowerShell uses pascal-cased equivalents.
for flag in "--quiet" "--name" "--email"; do
    assert_contains "$flag" "$SH" "installer.sh forwards $flag"
    assert_contains "$flag" "$LX" "installer-linux.sh forwards $flag"
done
for flag in "-Quiet" "-GitName" "-GitEmail"; do
    assert_contains "$flag" "$PS" "installer.ps1 forwards $flag"
done

# Hogwarts flag — same shape across OSes
assert_contains "--hogwarts-dev" "$SH" "installer.sh forwards --hogwarts-dev"
assert_contains "--hogwarts-dev" "$LX" "installer-linux.sh forwards --hogwarts-dev"
assert_contains "-HogwartsDev"   "$PS" "installer.ps1 forwards -HogwartsDev"

# ── State-file key parity ────────────────────────────────────────
# After the simplification, all three should persist the same keys:
# gitName, gitEmail, role, hogwartsDev, silentBatch.
for key in gitName gitEmail role hogwartsDev silentBatch; do
    assert_contains "$key" "$SH" "installer.sh persists state key '$key'"
    assert_contains "$key" "$LX" "installer-linux.sh persists state key '$key'"
    assert_contains "$key" "$PS" "installer.ps1 persists state key '$key'"
done

# ── Cut state keys must NOT appear in any installer ──────────────
# These were removed when we collapsed the wizard from 11 questions to 2.
for cut_key in withTailscale gistId proMax reposDir hasGithub hasAnthropic; do
    if grep -q "$cut_key" "$SH"; then
        fail "installer.sh still references removed key '$cut_key'"
    else
        pass "installer.sh: removed key '$cut_key' is gone"
    fi
    if grep -q "$cut_key" "$LX"; then
        fail "installer-linux.sh still references removed key '$cut_key'"
    else
        pass "installer-linux.sh: removed key '$cut_key' is gone"
    fi
    if grep -q "$cut_key" "$PS"; then
        fail "installer.ps1 still references removed key '$cut_key'"
    else
        pass "installer.ps1: removed key '$cut_key' is gone"
    fi
done

# ── Cut Act 3 dialog keys ────────────────────────────────────────
# desktopSignedIn, computerUse, webstormPlugin — these dialogs were cut.
for cut_dialog in desktopSignedIn computerUse webstormPlugin; do
    assert_not_contains "$cut_dialog" "$SH" "installer.sh: Act 3 dialog '$cut_dialog' cut"
    assert_not_contains "$cut_dialog" "$LX" "installer-linux.sh: Act 3 dialog '$cut_dialog' cut"
    assert_not_contains "$cut_dialog" "$PS" "installer.ps1: Act 3 dialog '$cut_dialog' cut"
done

# ── Final panel parity ───────────────────────────────────────────
# All three final panels should mention secrets-from-gist + mobile.
for installer_file in "$SH" "$LX" "$PS"; do
    assert_contains "secrets" "$installer_file"  "$(basename "$installer_file"): final panel mentions secrets"
    assert_contains "claude.ai/code" "$installer_file" "$(basename "$installer_file"): final panel mentions claude.ai/code"
done

# ── Docs URL parity ──────────────────────────────────────────────
# All three should point users at the same docs URL.
DOCS_URL="kun.databayt.org/docs/onboarding"
assert_contains "$DOCS_URL" "$SH" "installer.sh points to canonical docs URL"
assert_contains "$DOCS_URL" "$LX" "installer-linux.sh points to canonical docs URL"
assert_contains "$DOCS_URL" "$PS" "installer.ps1 points to canonical docs URL"

# ── Bootstrap consistency ────────────────────────────────────────
# All three clone kun from the same canonical URL.
KUN_REPO="github.com/databayt/kun.git"
assert_contains "$KUN_REPO" "$SH" "installer.sh clones from $KUN_REPO"
assert_contains "$KUN_REPO" "$LX" "installer-linux.sh clones from $KUN_REPO"
assert_contains "$KUN_REPO" "$PS" "installer.ps1 clones from $KUN_REPO"

# ── State-file location format ───────────────────────────────────
assert_contains "Application Support/Databayt" "$SH" "installer.sh uses macOS state dir"
assert_contains "databayt" "$LX"                    "installer-linux.sh uses XDG state dir"
assert_contains "APPDATA\\Databayt" "$PS"           "installer.ps1 uses Windows state dir"

# ── Wizard-steps.json describes both removed-from-v1 lists ───────
STEPS_JSON="$PWD/.claude/scripts/lib/wizard-steps.json"
assert_cmd_succeeds "wizard-steps.json has preflightCut entries" \
    python3 -c "import json; d=json.load(open('$STEPS_JSON')); assert len(d['removedFromV1']['preflightCut']) >= 5"
assert_cmd_succeeds "wizard-steps.json has act3DialogsCut entries" \
    python3 -c "import json; d=json.load(open('$STEPS_JSON')); assert len(d['removedFromV1']['act3DialogsCut']) >= 3"

# ── Step manifest version bumped ─────────────────────────────────
assert_cmd_succeeds "wizard-steps.json version is 2 (post-simplification)" \
    python3 -c "import json; d=json.load(open('$STEPS_JSON')); assert d['version'] == 2"

suite_summary
