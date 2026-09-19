#!/usr/bin/env python3
"""Compare the LIVE Vercel databayt.org zone with the Cloudflare zone, record by record.

Cloudflare's nameservers answer REFUSED for a zone that has not been activated, so a
dig-based check (cf-zone.sh verify) cannot run before the nameserver flip and will report
a misleading "same" for every empty answer. This compares the two APIs instead, which is
the only gate available while the flip is still pending — and the one that matters, since
a missing MX or DKIM row is what turns this migration into an email outage.

  scripts/cf-zone-compare.py            # print the table, exit 1 on an unexpected diff
Expected (intended) differences are declared in EXPECTED below and reported separately.
"""
import json, os, subprocess, sys, urllib.error, urllib.request

ZONE = "databayt.org"
CF_ZONE_ID = "1e859289c28a83ff03c124170ae93cda"
VERCEL_TEAM = "team_BrPSqGS4wSpLors2B9jYAAFs"

# Rows that are meant to differ, keyed by (name, type) -> why.
EXPECTED = {
    (ZONE, "ALIAS"): "apex left Vercel: now a proxied AAAA 100:: served by the marketing Worker",
    (ZONE, "AAAA"): "apex black hole for the marketing Worker (replaces the Vercel ALIAS)",
    ("www." + ZONE, "AAAA"): "www black hole for the marketing Worker (was caught by the * ALIAS)",
    ("*." + ZONE, "ALIAS"): "wildcard ALIAS -> CNAME, same target (Cloudflare has no ALIAS type)",
    ("*." + ZONE, "CNAME"): "wildcard ALIAS -> CNAME, same target (Cloudflare has no ALIAS type)",
}

def vercel_token():
    p = os.path.expanduser("~/Library/Application Support/com.vercel.cli/auth.json")
    return json.load(open(p))["token"]

def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def norm_value(v):
    v = str(v).strip()
    if v.endswith(".") and not v.endswith('".'):
        v = v[:-1]
    if v.startswith('"') and v.endswith('"'):
        v = v[1:-1]
    return v.replace('" "', "")           # Cloudflare splits long TXT into quoted chunks

def vercel_rows():
    tok = vercel_token()
    try:
        d = get(f"https://api.vercel.com/v4/domains/{ZONE}/records?limit=100&teamId={VERCEL_TEAM}", tok)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"The Vercel zone for {ZONE} no longer exists — it was deleted once Cloudflare\n"
                  f"held a verified copy, so that stale nameservers would stop answering.\n"
                  f"There is nothing left to compare: Cloudflare is the only authority.\n"
                  f"Use `scripts/cf-zone.sh verify` (the zone is active) for a dig-level check.")
            raise SystemExit(0)
        raise
    rows = {}
    for r in d.get("records", []):
        name = ZONE if r["name"] in ("", "@") else f"{r['name']}.{ZONE}"
        val = norm_value(r.get("value"))
        if r["type"] == "MX":
            val = f"{r.get('mxPriority')} {val}"
        rows.setdefault((name, r["type"]), set()).add(val)
    return rows

def cf_rows():
    tok = subprocess.run(
        ["security", "find-generic-password", "-a", os.environ["USER"], "-s", "cloudflare-zones", "-w"],
        capture_output=True, text=True, check=True).stdout.strip()
    d = get(f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records?per_page=500", tok)
    rows, proxied = {}, {}
    for r in d["result"]:
        if r["type"] == "CAA":
            data = r.get("data") or {}
            val = f"{data.get('flags', 0)} {data.get('tag')} \"{data.get('value')}\""
        elif r["type"] == "MX":
            val = f"{r.get('priority')} {norm_value(r['content'])}"
        else:
            val = norm_value(r["content"])
        rows.setdefault((r["name"], r["type"]), set()).add(val)
        proxied[(r["name"], r["type"])] = r.get("proxied")
    return rows, proxied

def main():
    v, (c, proxied) = vercel_rows(), cf_rows()
    keys = sorted(set(v) | set(c), key=lambda k: (k[0].split(".")[::-1], k[1]))
    bad = []
    print(f"{'name':<46} {'type':<6} verdict")
    for k in keys:
        name, typ = k
        vv, cv = v.get(k, set()), c.get(k, set())
        if k in EXPECTED:
            verdict = f"EXPECTED DIFF — {EXPECTED[k]}"
        elif vv == cv:
            verdict = f"same ({len(cv)} value{'s' if len(cv) != 1 else ''})"
            if proxied.get(k):
                verdict += "  [proxied]"
        else:
            verdict = "MISMATCH"
            bad.append((k, vv, cv))
        print(f"  {name:<44} {typ:<6} {verdict}")
    for (name, typ), vv, cv in bad:
        print(f"\nMISMATCH {name} {typ}\n  vercel:     {sorted(vv)}\n  cloudflare: {sorted(cv)}")
    print(f"\n{len(keys)} name/type pairs; {len(bad)} unexpected mismatch(es)")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
