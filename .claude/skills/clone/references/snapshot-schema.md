# Snapshot schema — `.clone/<slug>/`

The contract between `clone-capture.mjs` (producer) and the `clone` agent (consumer).
Read this so you can consume a snapshot without re-deriving its shape. The capture
spends **zero model tokens** — by the time you read these files the tedious work is done.

```
.clone/<slug>/
├─ manifest.json     run metadata + token summary + fidelity flag
├─ dom.html          outerHTML of the chosen section, pretty-printed (structure source of truth)
├─ styles.json       per-node EXACT computed styles, diffed against UA defaults (your working set)
├─ tokens.json       ranked palette/fonts/spacing/radii/shadows + breakpointBehavior
├─ sections.json     (full-page mode only) index of top-level sections, for naming a target
├─ shots/            375.png · 768.png · 1440.png — RENDERED GROUND TRUTH; trust over everything
└─ assets/
   ├─ index.json     [{ originalUrl, kind, role, localPath, bytes }]  (kind: img|svg-inline|background)
   ├─ fonts.json     [{ family, weight, src }]  — cataloged, NOT downloaded (licensing)
   └─ <files>        downloaded images/svgs (asset-N.<ext>, icon-N.svg)
```

## manifest.json

```jsonc
{
  "url": "...", "section": "hero|picked|full-page", "rootSelector": "section:nth-of-type(1) | null",
  "capturedAt": "ISO", "breakpoints": [375,768,1440], "deviceScaleFactor": 2,
  "fidelity": "pixel-exact",            // ALWAYS honor this — no token-snapping
  "nodeCount": 42, "capped": false,      // capped=true → section exceeded --node-cap; dom.html may be truncated deep
  "tokenSummary": { "colors": [...], "dominantFont": "...", "fontSizeScale": [...], "spacingScale": [...] }
}
```

## styles.json — the working set

```jsonc
{
  "rootSelector": "... | null",
  "nodes": [
    {
      "path": "section:nth-of-type(1) > div:nth-of-type(1) > h1:nth-of-type(1)", // matches dom.html order
      "tag": "h1",
      "classes": "...", // source classes (hints only — do NOT copy their framework)
      "role": "...",
      "ariaLabel": "...",
      "href": "...",
      "alt": "...",
      "text": "Build with Claude", // direct text content (trimmed, ≤300 chars)
      "styles": {
        // ONLY properties that differ from the tag's UA baseline — EXACT values
        "font-size": "39px",
        "font-weight": "590",
        "line-height": "41px",
        "letter-spacing": "-0.39px",
        "color": "rgb(20, 20, 19)",
        "margin-bottom": "16px",
      },
    },
  ],
}
```

- **`styles` is already distilled**: ~10–25 meaningful props/node, not the ~350 of raw `getComputedStyle`. Margin/padding/border/radius are longhands (per-side corners). `__srcset` may appear on `<img>` carrying the raw `srcset`.
- **`path` aligns with `dom.html`** sibling order, so you can walk both together.

## tokens.json — reference + responsive

```jsonc
{
  "colors":   [{ "value": "rgb(20,20,19)", "count": 31 }, ...],   // frequency-ranked
  "fontFamilies": [...], "fontSizes": [...], "lineHeights": [...], "letterSpacings": [...],
  "spacings": [...], "radii": [...], "shadows": [...],
  "breakpointBehavior": {                                          // only nodes that CHANGE vs 1440
    "375": { "0/1/0": { "display": "block", "flex-direction": "column", "font-size": "28px" } },
    "768": { "0/1":   { "grid-template-columns": "1fr 1fr" } }
  }
}
```

- Under **pixel-exact** fidelity, `tokens.json` is **reference only** — use it to _author responsive variants_ (`breakpointBehavior` → `md:`/`lg:` classes) and to _optionally note_ "this color ≈ your `--primary`". Do **not** snap exact values to the nearest token.
- `breakpointBehavior` keys are ordinal walk paths (`parent/childIndex/...`) and are best-effort; **`shots/` are the real ground truth** for how each breakpoint looks.

## sections.json — only in full-page mode (no `--section`/`--pick`)

```jsonc
[
  {
    "index": 0,
    "tag": "section",
    "heading": "Pricing",
    "sampleText": "...",
    "rect": { "y": 1240, "height": 720 },
  },
]
```

Present this list so the user can name a section; then re-capture with `--section "<heading>"` to get a focused snapshot.
