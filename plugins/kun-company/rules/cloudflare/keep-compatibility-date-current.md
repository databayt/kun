---
domain: cloudflare
severity: warn
paths: ["**/wrangler.jsonc", "**/wrangler.json", "**/wrangler.toml"]
since: "2026-09-26"
---

# Keep `compatibility_date` current — Node.js APIs ride on it

`compatibility_date` pins which runtime behaviour and bug fixes a Worker gets; an old date silently switches off years of fixes and new APIs. Set it to today's date on a new Worker and bump it deliberately on existing ones. Since **2026-08-04** a date on or after that day enables `nodejs_compat` + `nodejs_compat_v2` by default — an explicit `nodejs_compat` flag is then redundant but harmless (Wrangler ignores it), while a date **before** 2026-08-04 without the flag loses `node:crypto`, `node:buffer`, `node:stream` and fails with cryptic import errors. Before bumping, read the flags whose "Default as of" falls between the old and new date (2026-09-01 → 2026-09-26 adds only `python_workers_314`, a no-op for JS Workers).

## Good

```jsonc
{
  // today on a new Worker; moved on purpose (after a smoke run) on an existing one
  "compatibility_date": "2026-09-26",
  // implied from 2026-08-04 — keep it, it documents intent and costs nothing
  "compatibility_flags": ["nodejs_compat"],
}
```

## Bad

```jsonc
{
  "compatibility_date": "2024-06-01", // two years of runtime fixes switched off
  "compatibility_flags": [], // pre-2026-08-04 date + no flag: no node:* modules at all
}
```

## Fix

Set `compatibility_date` to today, keep `nodejs_compat`, review the compatibility-flags page for the skipped window, then run the repo's smoke (`scripts/deploy-cloudflare.sh … smoke` or `wrangler dev`) before `wrangler deploy`.

> Source: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#keep-your-compatibility-date-current · https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/ · https://developers.cloudflare.com/workers/configuration/compatibility-flags/
