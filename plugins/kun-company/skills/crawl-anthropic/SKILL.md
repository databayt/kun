---
name: crawl-anthropic
description: Crawl and snapshot Anthropic docs/assets
when_to_use: "Use when snapshotting Anthropic docs or assets into the local mirror — crawling code.claude.com and platform.claude.com pages for offline reference and rule harvesting. Triggers on: crawl anthropic, snapshot the docs, refresh the anthropic mirror."
argument-hint: "[url] [--section S]"
---

# Crawl Anthropic Assets

Re-crawl all Anthropic web properties and update the asset catalog at `src/components/root/anthropic/data.ts`.

## Steps

1. **Crawl all pages** — Use WebFetch on each URL in the URL_INDEX from `data.ts`, extract all image/SVG/asset URLs **with their alt text, nearest heading/caption, and section context** (needed for clean naming, below).
2. **Apply harvest rules** — Drop anything that fails the keep test in [Harvest rules](#harvest-rules) BEFORE it enters the catalog. Never fetch or list junk.
3. **Clean-name each asset** — Derive a clean, short `key`/`name` from context per [Clean naming](#clean-naming). Never persist a CMS hash or a `-WxH` dimension suffix.
4. **Compare** — Diff against the existing `assets` array; identify new/removed/changed assets.
5. **Update data.ts** — Add new assets, remove dead links, update `LAST_CRAWLED`.
6. **Build check** — Run `pnpm build` to verify no regressions.

## Harvest rules

Canonical source of truth: **`databayt/codebase → scripts/cdn/harvest-rules.ts`** (`classifyExcluded` / `isWantedAsset`). The same module gates the `/icons` showroom manifest and the S3 sync, so the crawler, the bucket, and the showroom always agree. Mirror its logic here.

**KEEP** — real artwork + functional assets. By `AssetCategory`:
`illustrations`, `engineering`, `research`, `values`, `ui-icons`, `maps`, `benchmarks`, `events`, `animations`, `team`, `mars`, `fonts`, `documents`.

**DROP** — brand/site chrome and third-party logos:

| Drop | What | Why |
| --- | --- | --- |
| `partners` category | every partner/customer/company logo (`partner-*`) | other companies' brands — not Anthropic's |
| `social` category | x / linkedin / youtube / instagram glyphs | generic social chrome |
| chrome (in `brand`) | favicons, `apple-touch-icon`, `webclip`, `safari-pinned-tab`, `mstile`, `android-chrome` | browser/OS furniture |
| letter / logomarks (in `brand`) | `*-a-large`, `*-a-small`, `*-logomark`, `*-symbol` | sub-logo fragments |
| sub-brand / model / section marks (in `brand`) | `opus-icon`, `opus-wordmark`, `sonnet-*`, `haiku-*`, `news-icon`, `research-icon` | model/section marks, not artwork |

**KEEP-ALLOWLIST** — the brand's own canonical identity, even though it lives in `brand`:
`wordmark.svg`, `anthropic-wordmark.svg`, `claude-wordmark.svg`, `anthropic.svg`, `claude.svg`, `starburst.svg`.

Rule of thumb: **if it is a logo, favicon, partner mark, or social glyph → drop; if it is an illustration, diagram, concept graphic, or functional UI icon → keep.** Keep exactly one canonical wordmark + the starburst per brand.

## Clean naming

`key` and `name` come from **crawl context**, never from the source CDN filename:

1. Prefer the asset's **alt text**; else the nearest **heading / figure caption**; else the **section + a short descriptor**.
2. Kebab-case, lowercase, short (2–4 words). Strip CMS hashes and `-1000x1000` dimension suffixes.
3. Keep the extension; the `key` is `anthropic/<clean-name>.<ext>` (flat vendor mirror — no sub-folders).
4. On collision, suffix a meaningful qualifier (or `-2`), never a hash.

Examples:
- `6903d22d0099…-1000x1000.svg` → alt "Advanced tool use" → `anthropic/advanced-tool-use.svg`
- `www-cdn.anthropic.com/images/4zrzovbb/website/abc123-2400x1600.webp` → heading "Building effective agents" → `anthropic/building-effective-agents.webp`

`width`/`height` still go in the `Asset` record (from the source `-WxH`), just never in the name.

## Key URLs to check for new content

- https://www.anthropic.com/news (new blog posts = new illustrations)
- https://www.anthropic.com/engineering (new engineering articles = new SVGs)
- https://www.anthropic.com/research (new papers = new images)
- https://www.anthropic.com/claude/opus (model updates — keep illustrations, NOT the opus wordmark/icon)
- https://www.anthropic.com/claude/sonnet (model updates)
- https://www.anthropic.com/events (new events — keep event art, DROP partner logos)

## CDN Pattern Reference

- Sanity CMS: `cdn.sanity.io/images/4zrzovbb/website/{hash}-{width}x{height}.{format}`
- Anthropic CDN: `www-cdn.anthropic.com/images/4zrzovbb/website/{hash}-{width}x{height}.{format}`
- Webflow: `cdn.prod.website-files.com/{siteId}/{fileId}_{name}.{format}`
- Assets: `assets.anthropic.com/m/{id}/original/{name}.{format}`

> The same harvest + clean-naming rules generalise to other vendor brands (airbnb, apple, clickview). When that lands this becomes `/crawl-brand <brand>` reading a per-brand URL index — the rules above stay identical.
