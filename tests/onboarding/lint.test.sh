#!/bin/bash
# Static checks: shellcheck, JSON validity, doc structure, no stale references.
# Sourced by run.sh — assumes cwd is repo root and lib.sh is already loaded.

suite_name "lint — static checks"

INSTALLER_SH="$PWD/.claude/scripts/installer.sh"
INSTALLER_LINUX="$PWD/.claude/scripts/installer-linux.sh"
INSTALLER_PS1="$PWD/.claude/scripts/installer.ps1"
STEPS_JSON="$PWD/.claude/scripts/lib/wizard-steps.json"
ONBOARDING_MDX="$PWD/content/docs/onboarding.mdx"

# Files exist
assert_file_exists "$INSTALLER_SH"      "installer.sh exists"
assert_file_exists "$INSTALLER_LINUX"   "installer-linux.sh exists"
assert_file_exists "$INSTALLER_PS1"     "installer.ps1 exists"
assert_file_exists "$STEPS_JSON"        "wizard-steps.json exists"
assert_file_exists "$ONBOARDING_MDX"    "onboarding.mdx exists"

# Shellcheck: both bash installers + test runner
if command -v shellcheck >/dev/null 2>&1; then
    assert_cmd_succeeds "shellcheck installer.sh" shellcheck "$INSTALLER_SH"
    assert_cmd_succeeds "shellcheck installer-linux.sh" shellcheck "$INSTALLER_LINUX"
    assert_cmd_succeeds "shellcheck run.sh" shellcheck "$PWD/tests/onboarding/run.sh"
    assert_cmd_succeeds "shellcheck lib.sh"  shellcheck "$PWD/tests/onboarding/lib.sh"
else
    fail "shellcheck not installed" "brew install shellcheck"
fi

# JSON parses
assert_cmd_succeeds "wizard-steps.json parses as JSON" \
    python3 -c "import json,sys; json.load(open('$STEPS_JSON'))"

# Bash installers have correct shebang
first_sh=$(head -1 "$INSTALLER_SH")
first_lx=$(head -1 "$INSTALLER_LINUX")
assert_eq "#!/bin/bash" "$first_sh" "installer.sh starts with #!/bin/bash"
assert_eq "#!/bin/bash" "$first_lx" "installer-linux.sh starts with #!/bin/bash"

# Doc line-count cap (≤300, current target)
lines=$(wc -l < "$ONBOARDING_MDX" | tr -d ' ')
assert_lt "$lines" 300 "onboarding.mdx under 300 lines"

# Doc must have a frontmatter title
head_block=$(head -5 "$ONBOARDING_MDX")
assert_match '^---' "$head_block" "onboarding.mdx starts with frontmatter"
assert_match 'title: Onboarding' "$head_block" "frontmatter has Onboarding title"

# Doc must mention the one-liner URL and the .ps1 variant
assert_contains "kun.databayt.org/install"     "$ONBOARDING_MDX"  "doc mentions install URL"
assert_contains "kun.databayt.org/install.ps1" "$ONBOARDING_MDX"  "doc mentions install.ps1 URL"

# Manual fallback section is present and includes all three OSes
assert_contains "## Manual fallback" "$ONBOARDING_MDX" "Manual fallback section present"
assert_contains "onboarding-mac.sh engineer"        "$ONBOARDING_MDX" "manual: macOS backend invocation"
assert_contains "onboarding-linux.sh engineer"      "$ONBOARDING_MDX" "manual: Linux backend invocation"
assert_contains "onboarding-windows.ps1"            "$ONBOARDING_MDX" "manual: Windows backend invocation"

# Stale references — must be gone post-cleanup
assert_not_contains "Tailscale"   "$ONBOARDING_MDX" "no Tailscale references"
assert_not_contains "Apple Notes" "$ONBOARDING_MDX" "no Apple Notes references"
assert_not_contains "Dispatch fol" "$ONBOARDING_MDX" "no 'Dispatch folder' references"

# Installer final panels also drop those
assert_not_contains "tailscale" "$INSTALLER_SH"    "installer.sh: no tailscale mentions in UI"
assert_not_contains "tailscale" "$INSTALLER_LINUX" "installer-linux.sh: no tailscale mentions in UI"
assert_not_contains "Tailscale" "$INSTALLER_PS1"   "installer.ps1: no Tailscale mentions in UI"

# Pre-flight collapse: 11 → 2 dialogs in Act 1. Count actual dialog calls (not function defs).
sh_calls=$(awk '/^# ACT 1/,/^# ACT 2/' "$INSTALLER_SH" \
    | grep -cE '\$\(ask_(text|choice|yesno|role|identity)\b')
linux_calls=$(awk '/^# ACT 1/,/^# ACT 2/' "$INSTALLER_LINUX" \
    | grep -cE '\$\(ask_(text|choice|yesno|role|identity)\b')
ps1_calls=$(awk '/^# ACT 1/,/^# ACT 2/' "$INSTALLER_PS1" \
    | grep -cE 'Ask-(Text|Choice|YesNo|Role|Identity)\b')

# macOS: up to 3 chained identity prompts + 1 hogwarts = 4 max (autofill skips most)
assert_lt "$sh_calls" 6     "installer.sh Act 1 dialog calls ≤ 5"
# Linux: 1 ask_identity + 1 ask_yesno hogwarts = 2 max
assert_lt "$linux_calls" 4  "installer-linux.sh Act 1 dialog calls ≤ 3"
# Windows: 1 Ask-Identity + 1 Ask-YesNo = 2 max
assert_lt "$ps1_calls" 4    "installer.ps1 Act 1 dialog calls ≤ 3"

# Act 3: 0 round-trip dialogs (final panel ≤ 1 acknowledge-only dialog allowed)
sh_act3=$(awk '/^# ACT 3/,/^$/' "$INSTALLER_SH" \
    | grep -cE '\$\(ask_(text|choice|yesno|role|identity)\b')
linux_act3=$(awk '/^# ACT 3/,/^$/' "$INSTALLER_LINUX" \
    | grep -cE '\$\(ask_(text|choice|yesno|role|identity)\b')
ps1_act3=$(awk '/^# ACT 3/,/^$/' "$INSTALLER_PS1" \
    | grep -cE 'Ask-(Text|Choice|YesNo|Role|Identity)\b')

assert_lt "$sh_act3" 2      "installer.sh Act 3 dialogs ≤ 1 (final panel only)"
assert_lt "$linux_act3" 2   "installer-linux.sh Act 3 dialogs ≤ 1"
assert_lt "$ps1_act3" 2     "installer.ps1 Act 3 dialogs ≤ 1"

suite_summary
