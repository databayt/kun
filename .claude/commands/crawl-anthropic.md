# Crawl Anthropic Assets

Re-crawl all Anthropic web properties, mirror new assets to S3 (`hogwarts-databayt`) → CloudFront, and update the catalog at `src/components/root/anthropic/data.ts`.

## Run

```bash
pnpm crawl:anthropic:dry        # crawl + categorize, no upload, no data.ts edit
pnpm crawl:anthropic             # full run: download → upload → append rows → pnpm build
pnpm crawl:anthropic:upload-only # re-upload from existing manifest (after creds added)
```

## What it covers

- `anthropic.com` — main, products, engineering, features, learn, legal, pricing, customers (depth 1), enterprise, trust, support, news (depth 1), research (depth 1)
- `claude.ai` + `claude.com` — public marketing (auth-walled app routes skipped)
- `docs.claude.com` — Claude Code, Agent SDK, API, MCP, models, prompt-engineering, tool-use, prompt-caching, release-notes
- `support.anthropic.com` — articles (depth 1)
- `github.com/anthropics` — public repos and their social previews

Marketing pages with Lottie/dynamic content (`/pricing`, `/claude/*`, `/product/*`, `/features/*`, all docs) are rendered via headless Playwright Chromium so JS-loaded asset URLs are captured.

## Idempotency

- Existing `assets[]` entries (matched by `sourceUrl`) are skipped — never re-uploaded.
- `state/manifest.json` is the resume log: maps `sourceUrl → { sha256, key }`. Crash-safe.
- Before each upload, `HeadObject` on S3 verifies the object isn't already there with the same `sha256` metadata.
- Keys are immutable: if Anthropic ever replaces an asset behind the same source URL, the new content uploads under a `-vN` suffixed key. No CloudFront invalidation needed.

## AWS credentials

Script reads `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or `AWS_PROFILE`) from env. Without credentials, the script downloads + categorizes locally but skips upload. Run again with `--upload-only` once creds are configured.

## Custom CNAME (`cdn.databayt.org`)

The CDN is currently exposed at `d1dlwtcfl0db67.cloudfront.net`. To add a friendly alias:

```bash
bash scripts/crawl-anthropic/setup-cname.sh
```

The script either uses AWS CLI to provision DNS + ACM + CloudFront alias, or prints the manual console steps if `aws` isn't installed. Adding the alias is **purely additive** — the original `*.cloudfront.net` URL keeps working, so any code in `hogwarts/` that hardcodes the old URL is unaffected. After verify passes, switch `CDN_BASE` in `data.ts` to the new domain.

## Output

- `state/staging/<sha256>.<ext>` — downloaded blobs (gitignored, can purge after upload)
- `state/manifest.json` — resume log
- `state/report.md` — per-run human report (added | skipped | needs-review | dead-links | page-failures)

## Trademark

Anthropic's [trademark guidelines](https://www.anthropic.com/legal/trademark-guidelines) restrict redistribution of brand assets. The `/anthropic` page in this app is an internal showcase; do not present it as a public "download brand assets" CTA.
