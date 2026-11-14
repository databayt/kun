#!/usr/bin/env bash
# mandate-guard.test.sh — the guard blocks what the mandate keeps for the owner, lets ordinary
# build work through, and does nothing at all in an attended session.
#
#   bash .claude/hooks/mandate-guard.test.sh        exit 0 = all pass
set -uo pipefail
GUARD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/mandate-guard.sh"
export KUN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fail=0
run() { printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")" | KUN_MANDATE="$2" bash "$GUARD" >/dev/null 2>&1; echo $?; }
expect() { # <block|allow> <mandate 1|0> <command>
  local code; code=$(run "$3" "$2")
  local want=0; [ "$1" = block ] && want=2
  if [ "$code" = "$want" ]; then echo "ok   $1  $3"; else echo "FAIL want $1 got exit $code: $3"; fail=1; fi
}
expect block 1 'npx wrangler deploy'
expect block 1 'bash scripts/deploy-cloudflare.sh ~/.cache/cf-build/kun.env all'
expect block 1 'vercel deploy --prod'
expect block 1 'pnpm publish --access public'
expect block 1 'bash .claude/skills/edit/scripts/media.sh publish out.mp4'
expect block 1 'hermes send --to C123 "hello"'
expect block 1 'pnpm prisma migrate deploy'
expect block 1 'rm -rf src/components'
expect block 1 'git push --force origin main'
expect block 1 'claude mcp add foo -- bar'
expect block 1 'launchctl bootstrap gui/501 ~/Library/LaunchAgents/x.plist'
expect allow 1 'pnpm build && pnpm tsc --noEmit'
expect allow 1 'git add src/a.ts && git commit -m "fix: x" -- src/a.ts && git push origin main'
expect allow 1 'bash scripts/deploy-cloudflare.sh ~/.cache/cf-build/kun.env build'
expect allow 1 'gh issue comment 12 --repo databayt/kun --body done'
expect allow 1 'node .claude/scripts/resolve.mjs --test'
expect allow 0 'npx wrangler deploy'
expect allow 0 'rm -rf src/components'
# no engine.json → an unattended run is stopped, an attended one is not
code=$(printf '{"tool_input":{"command":"ls"}}' | KUN_MANDATE=1 KUN_DIR=/nonexistent bash "$GUARD" >/dev/null 2>&1; echo $?)
[ "$code" = 2 ] && echo "ok   fails closed without engine.json" || { echo "FAIL: should fail closed without engine.json (exit $code)"; fail=1; }
exit $fail
