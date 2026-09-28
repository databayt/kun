#!/usr/bin/env bash
# format-on-write.sh — PostToolUse(Write|Edit): run prettier on the file Claude just wrote,
# but ONLY inside a project that opts in with a prettier config.
#
# WHY THIS EXISTS
#
# The hook used to run `npx prettier --write` on every written file in every repo.
# setup.sh merges it into ~/.claude/settings.json, so it fired fleet-wide — and in a
# repo with no prettier config it formatted with prettier's DEFAULTS. On 2026-09-27 a
# one-line CSP fix in mkan (single-quote style, no config) came back as a 139-line
# diff: every quote in src/proxy.ts rewritten. A formatter that imposes a style the
# repo never chose is noise in every diff, and it hides the real change.
#
# So: walk up from the file to the nearest prettier config — the same files prettier
# itself resolves — and do nothing when there is none. A repo that wants formatting
# says so with a config (kun ships `.prettierrc` = `{}`, i.e. the defaults it always had).
#
# Prettier runs from the directory that holds the config, so the repo's own local
# prettier (node_modules/.bin) and its .prettierignore both apply.
#
# FORMAT_ON_WRITE_DRY=1 prints the decision ("format <root>" / "skip <reason>") instead
# of running prettier — format-on-write.test.sh uses it.

p=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$p" ] && p="${FILE_PATH:-}"

decide() { [ "${FORMAT_ON_WRITE_DRY:-}" = 1 ] && echo "$1"; }

[ -n "$p" ] && [ -f "$p" ] || { decide "skip no-file"; exit 0; }
case "$p" in
  *.ts | *.tsx | *.js | *.jsx | *.json | *.css | *.md) ;;
  *) decide "skip extension"; exit 0 ;;
esac

root=""
dir=$(cd "$(dirname "$p")" 2>/dev/null && pwd -P) || { decide "skip no-dir"; exit 0; }
while [ -n "$dir" ]; do
  for c in .prettierrc .prettierrc.json .prettierrc.yaml .prettierrc.yml .prettierrc.json5 \
    .prettierrc.toml .prettierrc.js .prettierrc.cjs .prettierrc.mjs .prettierrc.ts \
    .prettierrc.cts .prettierrc.mts prettier.config.js prettier.config.cjs \
    prettier.config.mjs prettier.config.ts prettier.config.cts prettier.config.mts; do
    [ -f "$dir/$c" ] && { root=$dir; break 2; }
  done
  if [ -f "$dir/package.json" ] && jq -e 'has("prettier")' "$dir/package.json" >/dev/null 2>&1; then
    root=$dir
    break
  fi
  [ "$dir" = "/" ] && break
  dir=$(dirname "$dir")
done

[ -n "$root" ] || { decide "skip no-config"; exit 0; }
if [ "${FORMAT_ON_WRITE_DRY:-}" = 1 ]; then
  echo "format $root"
  exit 0
fi
# This runs after EVERY Write/Edit, so its latency is paid on every edit. Call the
# repo's own prettier directly when it has one: `npx` spends ~0.3 s just resolving a
# local install, and 1–4 s where there is none because it checks the registry each
# time (measured 2026-09-28). --prefer-offline keeps that fallback off the network
# whenever the npx cache already holds prettier.
if [ -x "$root/node_modules/.bin/prettier" ]; then
  (cd "$root" && ./node_modules/.bin/prettier --write "$p" >/dev/null 2>&1)
else
  (cd "$root" && npx --prefer-offline prettier --write "$p" >/dev/null 2>&1)
fi
exit 0
