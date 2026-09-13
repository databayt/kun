#!/usr/bin/env bash
# Move the databayt.org DNS zone from Vercel to Cloudflare, mechanically and verifiably.
# Needs a Cloudflare API token with Account→Zone→Edit and Zone→DNS→Edit (the ambient
# CLOUDFLARE_API_TOKEN is Workers-scoped and cannot), stored in the macOS Keychain:
#   security add-generic-password -a "$USER" -s cloudflare-zones -w "<token>" -U
#
#   scripts/cf-zone.sh create   # add databayt.org to the account (pending until the NS change)
#   scripts/cf-zone.sh import   # load cf/dns/databayt-org-records.json (idempotent by name+type+content)
#   scripts/cf-zone.sh verify   # dig every record at Cloudflare's assigned NS and at Vercel's; print diffs
#   scripts/cf-zone.sh ns       # print the two nameservers to set at Namecheap
#
# The record file is the Vercel zone as listed on 2026-09-13 (vercel dns ls) plus one proxied
# `kun` record for the Worker. Nothing here touches the registrar: the nameserver change at
# Namecheap is the human step, done only after `verify` prints no diffs.
set -euo pipefail
cd "$(dirname "$0")/.."
ZONE=databayt.org
ACCOUNT=ce9a5376d149c808a0b97072421ba12f
RECORDS=cf/dns/databayt-org-records.json
API=https://api.cloudflare.com/client/v4
TOKEN=${CLOUDFLARE_ZONES_TOKEN:-$(security find-generic-password -a "$USER" -s cloudflare-zones -w 2>/dev/null || true)}
[[ -n "$TOKEN" ]] || { echo "no token: store one as Keychain 'cloudflare-zones' (Zone:Edit + DNS:Edit)"; exit 2; }
cf() { curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
zone_id() { cf "$API/zones?name=$ZONE" | python3 -c 'import sys,json;r=json.load(sys.stdin)["result"];print(r[0]["id"] if r else "")'; }

case "${1:-}" in
  create)
    ID=$(zone_id)
    if [[ -n "$ID" ]]; then echo "zone exists: $ID"; else
      cf -X POST "$API/zones" -d "{\"name\":\"$ZONE\",\"account\":{\"id\":\"$ACCOUNT\"},\"type\":\"full\"}" \
        | python3 -c 'import sys,json;d=json.load(sys.stdin);print("created" if d["success"] else d["errors"]);r=d.get("result") or {};print(r.get("id",""),r.get("status",""),r.get("name_servers",""))'
    fi ;;
  import)
    ID=$(zone_id); [[ -n "$ID" ]] || { echo "create the zone first"; exit 1; }
    # Cloudflare's add-site scan may have pre-created records; delete everything it guessed so the
    # file is the single source of truth, then create each record.
    cf "$API/zones/$ID/dns_records?per_page=500" \
      | python3 -c 'import sys,json
for r in json.load(sys.stdin)["result"]: print(r["id"], r["type"], r["name"])' \
      | while read -r rid t n; do
          cf -X DELETE "$API/zones/$ID/dns_records/$rid" >/dev/null && echo "    removed pre-scanned $t $n"
        done
    LINES=$(mktemp -t cf-zone.XXXXXX); trap 'rm -f "$LINES"' EXIT
    python3 -c 'import json,sys
for r in json.load(open(sys.argv[1])): print(json.dumps(r))' "$RECORDS" > "$LINES"
    while read -r line; do
      cf -X POST "$API/zones/$ID/dns_records" -d "$line" \
        | python3 -c 'import sys,json
d=json.load(sys.stdin); r=d.get("result") or {}
print(("    ok   " if d["success"] else "    FAIL ")+r.get("type","?")+" "+r.get("name","?")+("" if d["success"] else " "+str(d["errors"])))'
    done < "$LINES" ;;
  verify)
    ID=$(zone_id); [[ -n "$ID" ]] || { echo "create the zone first"; exit 1; }
    NS=$(cf "$API/zones/$ID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["name_servers"][0])')
    echo "comparing Vercel (ns1.vercel-dns.com) with Cloudflare ($NS) for every name in $RECORDS"
    python3 -c 'import json,sys
for r in json.load(open(sys.argv[1])): print(r["name"], r["type"])' "$RECORDS" | sort -u | while read -r name type; do
      v=$(dig +short "$type" "$name" @ns1.vercel-dns.com | sort | tr '\n' '|')
      c=$(dig +short "$type" "$name" @"$NS" | sort | tr '\n' '|')
      if [[ "$name.$type" == "kun.databayt.org.CNAME" ]]; then printf "  %-45s %-6s cloudflare: %s (new — the Worker)\n" "$name" "$type" "$c"
      elif [[ "$v" == "$c" ]]; then printf "  %-45s %-6s same\n" "$name" "$type"
      else printf "  %-45s %-6s DIFF\n      vercel:     %s\n      cloudflare: %s\n" "$name" "$type" "$v" "$c"; fi
    done ;;
  ns)
    ID=$(zone_id); [[ -n "$ID" ]] || { echo "create the zone first"; exit 1; }
    cf "$API/zones/$ID" | python3 -c 'import sys,json;r=json.load(sys.stdin)["result"];print(r["status"]);print("\n".join(r["name_servers"]))' ;;
  *) echo "usage: scripts/cf-zone.sh create|import|verify|ns"; exit 2 ;;
esac
