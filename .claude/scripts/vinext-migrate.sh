#!/usr/bin/env bash
# Move one Next app onto Cloudflare Workers via vinext, containerless and $0.
#   vinext-migrate.sh <repo-dir> <hostname> [check|init|build|deploy|domain]
# Every paid option is off: no Workers Cache (it bills the otherwise-free
# static asset requests), no KV data cache, no Cloudflare Images.
set -euo pipefail
DIR=$1; HOST=$2; STEP=${3:-all}
NAME=$(basename "$DIR")
cd "$DIR"

do_check() { npx -y vinext check 2>&1 | tail -18; }

do_init() {
  npx -y vinext init --platform=cloudflare --cdn-cache=none --data-cache=none \
      --image-optimization=none --yes 2>&1 | tail -12
  python3 - <<'PY'
import json, collections
d=json.load(open('package.json'), object_pairs_hook=collections.OrderedDict)
pn=d.setdefault('pnpm', collections.OrderedDict())
ob=set(pn.get('onlyBuiltDependencies', [])) | {'esbuild','workerd'}
pn['onlyBuiltDependencies']=sorted(ob)
open('package.json','w').write(json.dumps(d, indent=2)+'\n')
PY
  pnpm install --no-frozen-lockfile 2>&1 | tail -3
  pnpm rebuild esbuild workerd 2>&1 | tail -3
}

do_route() {
  python3 - "$HOST" <<'PY'
import sys, json
host=sys.argv[1]; p='wrangler.jsonc'
s=open(p).read()
if '"routes"' in s: print('routes already present'); raise SystemExit
s=s.rstrip().rstrip('}').rstrip().rstrip(',')
s+=''',
  // %s — the Project card on databayt.org. custom_domain lets Cloudflare
  // own the hostname's DNS record (it was a dead CNAME to Vercel).
  "routes": [
    { "pattern": "%s", "custom_domain": true }
  ]
}
''' % (host, host)
open(p,'w').write(s)
print('route added:', host)
PY
}

do_build()  { pnpm run build:vinext 2>&1 | tail -6; }
do_deploy() { pnpm exec wrangler deploy 2>&1 | tail -6; }

do_domain() {
  local ACC=ce9a5376d149c808a0b97072421ba12f
  local ZONE=1e859289c28a83ff03c124170ae93cda
  curl -s -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/domains" \
    -d "{\"environment\":\"production\",\"hostname\":\"$HOST\",\"service\":\"$NAME\",\"zone_id\":\"$ZONE\"}" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print('domain:', d['result']['hostname'],'->',d['result']['service']) if d.get('success') else print('FAIL', json.dumps(d.get('errors'))[:200])"
}

case "$STEP" in
  check) do_check ;;
  init) do_init ;;
  build) do_build ;;
  route) do_route ;;
  deploy) do_deploy ;;
  domain) do_domain ;;
  all) do_init; do_route; do_build; do_deploy; do_domain ;;
esac
