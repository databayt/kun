---
domain: cloudflare
severity: error
paths:
  ["**/wrangler.jsonc", "**/wrangler.json", "**/wrangler.toml", "**/.dev.vars*"]
since: "2026-09-26"
---

# Secrets go through `wrangler secret`, never `vars`

`vars` are plaintext: committed to git, printed by `wrangler deploy`, readable in the dashboard. Anything that authenticates — `DATABASE_URL` with a password, `AUTH_SECRET`, `CRON_SECRET`, API keys, webhook signing keys — is a **secret**: set it with `wrangler secret put`, `wrangler secret bulk <file>` (JSON or `.env`, up to 100 keys per call; a JSON `null` deletes), or ship it with the code via `wrangler deploy --secrets-file`. Declare every secret name under `secrets.required`: deploy then fails when one is missing on the Worker, and `wrangler types` types it. Note that once `secrets.required` exists, local dev loads **only** the listed keys from `.dev.vars` / `.env` — list them all. `.dev.vars*` and `.env*` stay in `.gitignore`. Public, non-authenticating config (`AUTH_URL`, origins, feature flags) is what `vars` is for.

## Good

```jsonc
{
  "vars": { "AUTH_URL": "https://kun.databayt.org" }, // config — safe to commit
  "secrets": { "required": ["AUTH_SECRET", "DATABASE_URL", "CRON_SECRET"] },
}
// values never touch the repo:
//   printf '%s' "$AUTH_SECRET" | npx wrangler secret put AUTH_SECRET
//   npx wrangler secret bulk /tmp/worker-secrets.json      # delete the file afterwards
```

## Bad

```jsonc
{
  "vars": {
    "DATABASE_URL": "postgresql://owner:npg_…@ep-….neon.tech/db", // in git history forever
    "AUTH_SECRET": "…", // shown in dashboard + deploy log
  },
}
```

## Fix

Move the value out of `vars` into `wrangler secret put` / `secret bulk`, add its name to `secrets.required`, and rotate it if it was ever committed or printed.

> Source: https://developers.cloudflare.com/workers/configuration/secrets/ · https://developers.cloudflare.com/workers/wrangler/configuration/#secrets-configuration-property · https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#store-secrets-with-wrangler-secret-not-in-source
