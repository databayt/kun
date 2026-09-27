#!/usr/bin/env bash
# format-on-write.test.sh — behavioural tests for the prettier PostToolUse hook.
#
#   bash .claude/hooks/format-on-write.test.sh
#
# The hook runs after EVERY Write/Edit in EVERY repo on every machine. The case that
# matters most is the one it used to get wrong: a repo with no prettier config must be
# left alone (mkan, 2026-09-27 — a one-line fix became a 139-line quote rewrite). Each
# case builds a throwaway tree and asserts the decision in dry-run mode, so no file is
# ever formatted and prettier is never downloaded.
#
# Exit 0 = all pass. Exit 1 = at least one case regressed.

set -uo pipefail
HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/format-on-write.sh"
[ -f "$HOOK" ] || { echo "hook not found at $HOOK"; exit 1; }

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
T=$(cd "$T" && pwd -P)

pass=0; fail=0
check() { # <expected-prefix> <label> <file-path>
  local want="$1" label="$2" file="$3" got
  got=$(jq -n --arg p "$file" '{tool_input:{file_path:$p}}' | FORMAT_ON_WRITE_DRY=1 bash "$HOOK")
  if [ "${got#"$want"}" != "$got" ]; then printf '  ✓ %s\n' "$label"; pass=$((pass+1))
  else printf '  ✗ FAIL got="%s" want="%s…" | %s\n' "$got" "$want" "$label"; fail=$((fail+1)); fi
}

mkdir -p "$T/configured/src" "$T/bare/src" "$T/pkgkey/src" "$T/pkgnokey/src" "$T/nested/app/src"
echo '{}' > "$T/configured/.prettierrc"
echo '{"name":"x","prettier":{"singleQuote":true}}' > "$T/pkgkey/package.json"
echo '{"name":"y"}' > "$T/pkgnokey/package.json"
echo 'export default {}' > "$T/nested/prettier.config.mjs"
echo '{"name":"app"}' > "$T/nested/app/package.json"
for d in configured bare pkgkey pkgnokey nested/app; do echo "const a = 'x'" > "$T/$d/src/a.ts"; done
echo "x = 1" > "$T/configured/src/a.py"

echo "── formats (the repo opted in) ──"
check "format $T/configured" ".prettierrc at the repo root" "$T/configured/src/a.ts"
check "format $T/pkgkey" "\"prettier\" key in package.json" "$T/pkgkey/src/a.ts"
check "format $T/nested" "config two levels up, past a package.json without the key" "$T/nested/app/src/a.ts"

echo "── leaves alone (never impose a style the repo did not choose) ──"
check "skip no-config" "no prettier config anywhere up the tree" "$T/bare/src/a.ts"
check "skip no-config" "package.json without a prettier key" "$T/pkgnokey/src/a.ts"
check "skip extension" "unsupported extension (.py)" "$T/configured/src/a.py"
check "skip no-file" "path that does not exist" "$T/configured/src/missing.ts"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
