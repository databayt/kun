---
name: carousel
description: Multi-slide bilingual brand carousels — Claude writes the deck, kun renders Anthropic-styled slides at exact platform sizes, a human approves, channels receive
when_to_use: "Use when a databayt brand needs a multi-slide social post — an Instagram/Facebook carousel, a LinkedIn PDF carousel, a story-sized slide set, or a slide album to DM a client on Telegram/WhatsApp. Triggers on: carousel, multi-slide post, swipe post, slides for instagram, carousel for <brand|block>, كاروسيل, سلايدات, منشور متعدد الشرائح."
argument-hint: "[brand|block] [topic] [--slides 8] [--sizes 1080x1350] [--dm <chat>] [--publish]"
---

# Carousel — multi-slide brand storytelling, Anthropic-styled, AR-first

One deck JSON → rendered slides in both languages at exact platform sizes → PDF +
per-channel captions → **human gate** → feed channels and client DMs.

```
TOPIC ─► COPY (AR-first) ─► DECK (zod JSON) ─► RENDER (route + Playwright)
  ─► VISUAL VERIFY ─► [Figma / Claude Design art-direction] ─► STAGE (STOP)
  ─► PUBLISH (IG/FB export · LinkedIn PDF · Telegram album DM) ─► LOG
```

## Doctrine (inherits /social)

- **Claude writes the copy** — never the gateway LLM. Arabic is **crafted first**, English
  mirrors it; never literal translation in either direction.
- **Human gate**: no approval → no publish, no DM. Staging = deliver files + captions, STOP.
- **Text lives in HTML** — that is the point of this lane. The `/social` "no text inside
  visuals" rule binds AI-generated raster art (`/higgs`), not these deterministic renders.
- **Anthropic illustration style only** — never Anthropic/Claude logomarks or wordmarks
  inside slides (no implied endorsement).
- UTM on every link (`utm_source=<channel>&utm_medium=social&utm_campaign=<slug>`) → PostHog.

## Copy framework (the high-end bar)

- **Cover hook ≤ 12 words** — pain or promise, never a description. The brand line beats a
  feature list.
- **One idea per slide.** If a slide needs two sentences of body, it is two slides.
- **Open loops**: each slide's last beat pulls into the next (problem → "there is one
  room…" → the answer).
- **Concrete nouns** over abstractions: "admission, attendance, invoices" — not "workflows".
- **CTA last**, one verb («اطلب عرضًا تجريبيًا» / "Book a demo").
- Budgets: eyebrow ≤ 24 chars · headline ≤ 48 (AR) / 56 (EN) · body ≤ 140 · step ≤ 60 ·
  caption ≤ 1024 (Telegram cap).
- Arabic typography: **Thmanyah** (خط ثمانية) is the Arabic voice — Serif Display **Black
  900 + `font-feature-settings: "ss01"`** for headlines (the site's signature recipe; never
  synthetic-bold a display face), Sans for body/eyebrows; wired as
  `--font-thmanyah-*` in `src/components/atom/fonts.ts`, files fetched from the official
  host by `scripts/fetch-thmanyah.mjs` (license forbids redistribution — never commit the
  woff2 files or rehost them on the CDN). No letter-spacing ever (connected script); Latin
  digits in copy (Gulf marketing norm).
- Voice per brand: `content/docs/brand.mdx` + `content/docs/social/<brand>.mdx`. hogwarts =
  calm, benefit-led, HP flavor **light** ("every spell", "غرفة الاحتياج") — never lore-deep.

## The pieces

| Piece                | Path                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deck schema (zod v4) | `src/components/root/carousel/schema.ts`                                                                                                                      |
| Decks                | the brand repo's `carousels/<slug>.json` (`BRANDS[brand].deckDir`, e.g. `~/hogwarts/carousels/`); kun `content/carousels/<brand>/` is the fallback for repo-less brands                                                                                                                       |
| Render route         | `/[lang]/carousel/[brand]/[slug]?slide=N&size=1080x1350` (no `slide` → review sheet)                                                                          |
| Slide archetypes     | `cover · point · stat · quote · steps · cta` × themes `ivory · dark · clay · oat`                                                                             |
| Palette              | Anthropic catalog (`root/anthropic/data.ts` COLORS) — Clay/Ivory/Ink/Oat                                                                                      |
| Brand mark           | `BRANDS[brand].logo` (`public/brands/*.png`) at the bottom start — replaces the footer (no domain/counter strips); monochrome ink, auto-inverted on dark/clay |
| Art                  | `public/carousel-art/*.svg` (vendored) → fallback `cdn.databayt.org/anthropic/<file>`                                                                         |
| Renderer CLI         | `pnpm carousel:render <brand>/<slug>` → `~/Downloads/carousels/<brand>/<slug>/`                                                                               |
| DM / album           | `node scripts/post-to-telegram.mjs --media <dir> --caption-file <txt> [--chat <id>]`                                                                          |

Sizes: `1080x1350` (4:5 feed, default) · `1080x1080` (square) · `1080x1920` (story).
Slides per deck: 3–10 (10 = Telegram album cap; IG allows 20 but 10 keeps decks portable).

## Steps

1. **Resolve** — brand (or hogwarts block: read the block's README/ISSUE/docs first, set
   `block` in the deck) + topic + angle. Check the brand's Figma file (`BRANDS[brand].figma`) before
   inventing new layouts (figma-first memory, 2026-02-01).
2. **Copy** — write the deck AR-first against the framework above; every text field carries
   `{ar, en}`.
3. **Deck** — `<deckDir>/<slug>.json` in the brand repo (commit it there, main-only); validate:
   `pnpm carousel:render <brand>/<slug> --validate` (needs `pnpm dev` on port 3000).
4. **Render** — `pnpm carousel:render <brand>/<slug>` → PNGs (2160×2700 @2x) + PDF +
   `caption-<lang>-<channel>.txt` + `manifest.json`.
5. **Visual verify** — browser MCP on the review sheet (`/ar/...` and `/en/...`, no `slide`
   param): Arabic wraps, diacritic clearance, art placement, brand mark on all four themes.
6. **Art-direct (optional)** — see "Design round-trip" below. `/higgs product-photoshoot
--mode social_carousel` only when the Anthropic library lacks a subject; label AI media.
7. **Stage — STOP** — SendUserFile the cover PNGs + PDF + captions; set deck `status:
"staged"`. Wait for explicit approval.
8. **Publish / DM (post-approval only)** — Telegram album: `--media` (client DM via
   `--chat`); Instagram/Facebook: upload the exported PNGs + matching caption file (no API
   wired today); LinkedIn: the PDF as a document post; WhatsApp: manual send (no organic
   API). Set `status: "published"`.
9. **Log** — content calendar (`/content-calendar`), UTM shows up in PostHog.

## Design round-trip (the doctrine that holds on the free tier)

- **PNG/PDF is the source of truth.** Iterate in code + renders — free, fast, exact.
- **Figma holds a flat PNG snapshot**, hand-refreshed (drag the 16 renders in via the
  desktop app, or Cowork's computer-use does it — zero quota). Name it honestly, e.g.
  `hogwarts-intro — PNG snapshot <date> (flat, not editable)`, 8×2 grid: row 1 AR 01→08,
  row 2 EN 01→08. **Snapshots REPLACE, never stack.**
- **Editable Figma frames are a deliberate quota spend.** When someone genuinely needs to
  edit in Figma: ONE `generate_figma_design` capture of `?view=board` (renders BOTH
  languages, every slide a standalone full-size `[data-frame]`, row AR + row EN, zero
  chrome) into `BRANDS[brand].figma` ({ fileKey, carouselsNodeId } in `brands.ts`); one
  Ungroup leaves 16 standalone frames. Fire `captureForDesign` WITHOUT awaiting its promise
  (it can hang), wait ~20s, then poll with the captureId.
- **Starter-plan reality (verified 2026-07-13)**: the docs' "exempt" list is soft — once
  the account trips the monthly cap, EVERY hosted tool 429s, including
  `generate_figma_design` and `use_figma`. **The Figma desktop MCP server is NOT a bypass:
  it is paywalled on Starter** ("No access to the Dev Mode MCP server") — the desktop
  toggle and a paid seat are the same purchase. When rate-limited: finish the code side,
  refresh the flat snapshot by hand, wait for the monthly reset; upgrading is a `/decide`
  spend.
- **Figma → Code** (hosted reads are 6/month — scarce): window screenshots of the Figma app
  are the everyday read lane; hosted `get_design_context`/`get_screenshot` only on an
  explicit "pull from figma". Translate pulled refinements into `slides.tsx`/`frame.tsx` by
  hand.
- **Never assume the carousels page is all ours** — inventory before any delete (Abdout's
  own layers, e.g. `logo 2`, live there too).
- **Claude Design** (Max-covered; one-time `/design-login`): `create_project`
  "carousel-templates-<brand>" → `write_files` a self-contained HTML/CSS mirror of the six
  archetypes → `render_preview` → iterate on the claude.ai/design canvas → `read_file` and
  hand-translate back. The mirror lives only in the design project — git carries the TSX
  truth. Skip gracefully when unauthenticated.

## Batch lane (per-block carousels)

`.claude/workflows/carousel.js` — fan out over a product's `blocks.json`, draft one deck per
block, adversarial copy QA, render, stage. Always ends staged; never publishes.

## Reality notes

- Renderer needs the dev server on port 3000 (house rule) and system Chrome; it never
  auto-spawns either.
- Turbopack occasionally misses edits to the carousel route in a running dev server —
  restart `pnpm dev` if a change doesn't show.
- Instagram/Facebook/WhatsApp/LinkedIn have no wired publish API in the engine today — the
  renderer's exports + captions are upload-ready by design. Telegram is the automated lane.
