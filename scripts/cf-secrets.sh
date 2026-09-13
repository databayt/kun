#!/usr/bin/env bash
# Push the container's SECRETS to the Worker from a production dotenv
# (`vercel env pull <file> --environment=production --scope databayt`).
# Only secret-classified names (see cf/env-split.mjs) are uploaded; the rest is
# baked into the image by scripts/deploy-cloudflare.sh. Values never touch the
# terminal or git. Secrets reach the container at its next start (deploy again).
#
#   scripts/cf-secrets.sh <dotenv-file>
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:?dotenv file}
OUT=$(mktemp -t cf-secrets.XXXXXX.json); trap 'rm -f "$OUT"' EXIT
node cf/env-split.mjs "$SRC" secrets > "$OUT"
# KEYCHAIN OVERRIDES — Vercel refuses env writes, so every value rotated after the
# 2026-09-12 leak lives in the macOS Keychain as cf-kun-<VAR>. Anything stored there
# wins, so re-running this from a stale dotenv cannot regress a fixed secret.
security dump-keychain 2>/dev/null \
  | grep -o '"svce"<blob>="cf-kun-[A-Z0-9_]*"' | sed 's/.*="cf-kun-//; s/"$//' | sort -u \
  | while read -r VAR; do
      V=$(security find-generic-password -a "$USER" -s "cf-kun-$VAR" -w 2>/dev/null || true)
      [[ -n "$V" ]] && OUT="$OUT" VAR="$VAR" V="$V" node -e '
        const fs=require("fs");const p=process.env.OUT;const o=JSON.parse(fs.readFileSync(p,"utf8"));
        o[process.env.VAR]=process.env.V;fs.writeFileSync(p,JSON.stringify(o));
        console.error("    override from Keychain: "+process.env.VAR);'
    done
echo "==> $(node -e 'console.log(Object.keys(require(process.argv[1])).length)' "$OUT") secrets → Worker (names: $(node -e 'console.log(Object.keys(require(process.argv[1])).sort().join(" "))' "$OUT"))"
pnpm exec wrangler secret bulk "$OUT"
