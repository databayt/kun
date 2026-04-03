# Crawl Anthropic Assets

Re-crawl all Anthropic web properties and update the asset catalog at `src/components/root/anthropic/data.ts`.

## Steps

1. **Crawl all pages** — Use WebFetch on each URL in the URL_INDEX from `data.ts`, extract all image/SVG/asset URLs
2. **Compare** — Diff against existing assets array, identify new/removed/changed assets
3. **Update data.ts** — Add new assets, remove dead links, update LAST_CRAWLED date
4. **Build check** — Run `pnpm build` to verify no regressions

## Key URLs to check for new content

- https://www.anthropic.com/news (new blog posts = new illustrations)
- https://www.anthropic.com/engineering (new engineering articles = new SVGs)
- https://www.anthropic.com/research (new papers = new images)
- https://www.anthropic.com/claude/opus (model updates = new wordmarks)
- https://www.anthropic.com/claude/sonnet (model updates)
- https://www.anthropic.com/events (new events = new logos)

## CDN Pattern Reference

- Sanity CMS: `cdn.sanity.io/images/4zrzovbb/website/{hash}-{width}x{height}.{format}`
- Anthropic CDN: `www-cdn.anthropic.com/images/4zrzovbb/website/{hash}-{width}x{height}.{format}`
- Webflow: `cdn.prod.website-files.com/{siteId}/{fileId}_{name}.{format}`
- Assets: `assets.anthropic.com/m/{id}/original/{name}.{format}`
