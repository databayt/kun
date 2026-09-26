---
domain: cloudflare
severity: warn
paths: ["**/wrangler.jsonc", "**/wrangler.json", "**/wrangler.toml"]
since: "2026-09-26"
---

# Enable Workers Logs **and** Traces — `observability.enabled` alone gives no traces

A production Worker without observability is a black box: when a cron or a login fails intermittently, only data already being collected can explain it. `observability.enabled` turns on Workers Logs (and is also what surfaces a Container's stdout in the dashboard); **traces need `observability.traces.enabled` as well** — the top-level switch alone does not enable them. Tracing is free during the beta; **from 2026-10-01 every span bills as one observability event** against the same quota as logs (Paid: 20 M/month included, then $0.60 per million; Free: 200 k/day), so sample traces (Cloudflare's example: `0.01`) and raise the rate only while debugging. Log structured JSON with `console.log`, errors with `console.error`, so the Query Builder can filter them.

## Good

```jsonc
"observability": {
  "enabled": true,
  "logs": { "head_sampling_rate": 1 },                         // every log line
  "traces": { "enabled": true, "head_sampling_rate": 0.01 }    // 1% of requests; spans bill from 2026-10-01
}
```

## Bad

```jsonc
"observability": { "enabled": true }   // logs only — no fetch/binding/cron spans to follow
// …or no observability block at all: nothing to query, and Container logs never reach the dashboard
```

## Fix

Add `"traces": { "enabled": true, "head_sampling_rate": 0.01 }` next to `"enabled": true`, deploy, then confirm spans on the Worker's Observability tab.

> Source: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#enable-workers-logs-and-traces · https://developers.cloudflare.com/workers/observability/traces/ · https://developers.cloudflare.com/containers/faq/
