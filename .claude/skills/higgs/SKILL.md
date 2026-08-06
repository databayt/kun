---
name: higgs
description: Generate and edit photos and videos for databayt org marketing, ads, and prompts — Google (Nano Banana / Veo / Omni) direct, or Higgsfield
when_to_use: "Use when generating or editing marketing media — image, photo, video, ad, hero shot, product shot, promo reel, story, avatar ad — or when a reference video/image URL needs downloading and tweaking. Owns BOTH raster renderers: Google direct (Nano Banana, Nano Banana Pro, Veo, Omni Flash — pay per image, no credit ceiling) and Higgsfield (credits). This is the TEXT-FREE lane: og images, banners, social cards, infographics, testimonials, split comparisons and anything carrying copy render on /carousel's template lane instead (the Portrait Gallery spells route by taxonomy lane). Triggers on: /higgs, generate video, generate image, generate photo, make an ad, promo video, hero image, product shot, mockup, lifestyle scene, moodboard, showroom asset, brand kit, edit video from url, download and tweak video, higgs, nano banana, veo, omni, gemini image, صورة تسويقية, وسائط."
argument-hint: "[recipe|prompt] [--url <ref>] [--count N] [--premium] [--ratio 16:9]"
---

# Higgs — the raster media lane for databayt

One-command marketing media. Every decision below is pre-made — do NOT ask Abdout about
model, style, aspect ratio, renderer, or output location. Pick the recipe, run it, deliver
the file.

Two renderers reach the **same** frontier models — Higgsfield resells Google's Nano Banana
(`nano_banana_pro` there IS `gemini-3-pro-image` here), so the choice is purely commercial:

| Renderer                    | Surface                          | Pays with                   | Status                    |
| --------------------------- | -------------------------------- | --------------------------- | ------------------------- |
| **Google direct** (default) | `node scripts/gemini-media.mjs`  | `GEMINI_API_KEY`, per image | needs key — see below     |
| Higgsfield (alternate)      | `higgsfield` CLI (`higgs`, `hf`) | credits, OAuth on disk      | **0.7 credits — drained** |

Read the renderer ladder before spending anything.

## Zero-question doctrine

1. **Never ask model/style/ratio/renderer** — the tables below decide. Only stop for: budget
   insufficient for the asked job, or a truly ambiguous deliverable.
2. **No text inside generated visuals** (AI typography breaks, Arabic doubly so). Generate
   text-free; overlay copy in post. Exceptions: `dtc-ads` — its backend does typography; and
   see the Arabic-typography test under the Gemini lane, which is **unsettled, not adopted**.
3. **Estimate free, then spend**: `gemini-media.mjs cost …` and its dry-run gate (a generate
   without `--yes` only prints the estimate) · `generate cost <model> --prompt "..."`,
   `--cost-only` (dtc-ads), `--enhance-only` (product-photoshoot). Report spend after each run.
4. **Batch in one command** — `--count 1-10` (photoshoot), `--batch-size 1-20` (dtc-ads) —
   never N separate invocations.
5. **Always parse the JSON last line** — `.file` (gemini) or `.[].result_url` (higgsfield);
   download to `~/Downloads/{gemini,higgs}/`, deliver via SendUserFile. Job page fallback:
   https://higgsfield.ai/create/image
6. Video costs 8–40× an image on either renderer — iterate composition as a cheap image
   first, then animate the winning frame (`--start-image` on both).
7. **Register every keeper** (below) so the showroom files it and the next job can reuse it.

## Renderer ladder — pick before you spend

Same models, two tills. Walk down; stop at the first line that can pay.

| #   | Situation                                  | Do this                                                               |
| --- | ------------------------------------------ | --------------------------------------------------------------------- |
| 0   | **Do we already own this shot?**           | `node scripts/higgs-library.mjs lookup …` — a hit costs 0             |
| 1   | `GEMINI_API_KEY` is set                    | **Google direct** — `scripts/gemini-media.mjs`, per-image, no ceiling |
| 2   | No key, Higgsfield has credits for the job | Higgsfield CLI (tables further down)                                  |
| 3   | Neither                                    | Say so, propose the template lane (`/carousel`) or ask to fund a key  |

Today **both rungs are unfunded**: Higgsfield holds 0.7 credits, and the Gemini key is on a
free tier whose image quota is literally zero (see below). The key itself is already wired —
`GEMINI_API_KEY` in kun's central `.env`, new-format (`AQ.Ab…`, 53 chars — _not_ the legacy
`AIza…`), issued to the AI Studio key named `kun`. What's missing is billing on the Google
project, not a credential.

The script trims the value on read: a trailing newline pasted from a dashboard turns the
auth header into an opaque 400 (it cost us kun report-issue / PR #97 once already).

## Account (re-verified 2026-07-27)

| Fact                       | Value                                            |
| -------------------------- | ------------------------------------------------ |
| Account                    | `osmanabdout@hotmail.com` — free plan            |
| **Balance**                | **0.7 credits** — drafts only, see budget ladder |
| Workspace                  | `1d67d842-bc70-40d8-8c03-576cb1b141df` (Private) |
| Brand kit (databayt.org)   | `b0a3f528-0397-41f7-85be-0b44a458a01f`           |
| Web product (databayt.org) | `6933f3b2-5611-4548-b015-2c963d054dc4`           |
| Output dir                 | `~/Downloads/higgs/YYYY-MM-DD-<slug>.<ext>`      |
| Library manifest           | `kun/content/media/library.json`                 |

## Preflight (one call, fix only what fails)

```bash
higgsfield account status || { higgsfield auth login; higgsfield workspace set 1d67d842-bc70-40d8-8c03-576cb1b141df; }
```

`auth login` opens browser OAuth (default browser holds the higgsfield.ai session — completes
hands-free). MCP `https://mcp.higgsfield.ai/mcp` is registered but unauthenticated — the CLI
is the primary lane; don't detour through MCP.

## Higgsfield model defaults (costs re-verified 2026-07-27 via `generate cost`)

**Naming trap**: `nano_banana_flash` = Nano Banana **2**; `nano_banana_pro` = Nano Banana
**Pro**. There is **no `nano_banana_2` job type** — that ID was retired; using it errors.

| Use                         | Model                | Cost | Notes                                                  |
| --------------------------- | -------------------- | ---- | ------------------------------------------------------ |
| Image draft / iteration     | `z_image`            | 0.15 | ratios 1:1,4:3,3:4,16:9,9:16                           |
| **Image final (default)**   | `nano_banana_2_lite` | 1    | cheapest publishable tier — prefer over flash          |
| Image final (alt)           | `seedream_v5_lite`   | 1    | different look; same price                             |
| Image final (rich refs)     | `nano_banana_flash`  | 1.5  | +21:9, 2:3, 4:5…; `--resolution 1k/2k/4k`; image refs  |
| Image hero / 4k / 21:9      | `nano_banana_pro`    | 2    | same params as flash                                   |
| Image hero (alt)            | `seedream_v5_pro`    | 3    | only when Pro's look misses                            |
| Video default               | `kling3_0_turbo`     | 7.5  | 5s 720p 16:9/9:16/1:1; `--start-image`                 |
| Video higher fidelity       | `kling3_0`           | 10   | `kling2_6` also 10                                     |
| Video from reference video  | `seedance_2_0_mini`  | 12.5 | only seedance takes `--video-references`; 480/720p     |
| Video premium (`--premium`) | `seedance_2_0`       | 22.5 | 4k, audio, genre, ≤9 img+3 vid+3 audio refs (12 total) |

`seedance1_5` (Seedance 1.5 Pro) exists but takes **duration 4/8/12 only** — it rejects the
5s default. Pro specialist variants (`nano_banana_2_ai_stylist`, `_skin_enhancer`, `_shots`)
are available at Pro pricing for styling / portrait / multi-shot jobs.

Refresh after Higgsfield ships new models: `higgsfield model list`, params via
`higgsfield model get <job_type>`, price via `higgsfield generate cost <model> --prompt x` (free).

## Brand style blocks (append to every prompt)

- **`minimal`** (default: og, hero, product, docs): `"minimal premium developer-tool
aesthetic, deep charcoal background, generous negative space, soft studio light, subtle
film grain, monochrome with one restrained cyan accent, no text"`
- **`cinematic`** (default: ads, reels, promos): `"high-end glassmorphic panels, deep dark
mode backdrop, electric cyan and warm sunset-orange rim light, shallow depth of field,
slow tracking shot, cinematic studio lighting, photorealistic, no text"`

## Gemini lane — Google direct (default renderer)

Prices are USD per image / per second, standard tier, verified 2026-08-05 against
ai.google.dev. `node scripts/gemini-media.mjs models` prints this table live — read it
there rather than trusting these numbers after Google ships anything.

| Use                        | `--model`  | Google ID                       | Price                       |
| -------------------------- | ---------- | ------------------------------- | --------------------------- |
| **Image final (default)**  | `lite`     | `gemini-3.1-flash-lite-image`   | $0.034 (1K only)            |
| Image w/ refs, 2K/4K       | `flash`    | `gemini-3.1-flash-image`        | $0.045 / .067 / .101 / .151 |
| Image hero, best type      | `pro`      | `gemini-3-pro-image`            | $0.134 (1K–2K) · $0.24 (4K) |
| Image on the free lane     | `legacy`   | `gemini-2.5-flash-image`        | $0.039 — see free-tier note |
| **Video default**          | `veo-lite` | `veo-3.1-lite-generate-preview` | $0.05/s 720p → **$0.40/8s** |
| Video better motion        | `veo-fast` | `veo-3.1-fast-generate-preview` | $0.10/s 720p → $0.80/8s     |
| Video hero                 | `veo`      | `veo-3.1-generate-preview`      | $0.40/s → $3.20/8s          |
| Video, conversational edit | `omni`     | `gemini-omni-flash-preview`     | ≈$0.10/s of 720p            |

Ratios: `1:1 3:2 2:3 3:4 4:3 4:5 5:4 9:16 16:9 21:9` (image, documented for the 3.1 pair —
Pro may narrow it, the API errors clearly if so) · `16:9 9:16` only for video. Sizes take an
**uppercase K** — `1k` is rejected; the script normalises but the raw API does not. Refs:
`lite` 14 object / no character-or-style · `flash` 10 object + 4 character + 3 style ·
`pro` 6 object + 5 character. Veo durations are 4/6/8s, and 1080p/4K are **8s-only**. Every
output carries an invisible SynthID watermark. Veo keeps a render server-side for **2 days**
— the script downloads immediately, so never re-poll an old operation instead of re-running.

```bash
# 0. ALWAYS FIRST — do we already own this shot? A hit costs $0.
node scripts/higgs-library.mjs lookup --prompt "<full prompt>" --model gemini-3.1-flash-lite-image --ratio 16:9

# Estimate without spending (free, no key needed) — or just omit --yes on any generate
node scripts/gemini-media.mjs cost --kind image --model pro --size 4K --count 3
node scripts/gemini-media.mjs image --prompt "<subject>, <minimal>"   # prints estimate, exits

# Social square / story / product — the default publishable tier
node scripts/gemini-media.mjs image --prompt "<subject>, <cinematic>" --ratio 1:1 --yes    # story: 9:16
node scripts/gemini-media.mjs image --prompt "<subject>, <minimal>" --model lite --ratio 4:5 --yes

# OG image / hero banner (final)
node scripts/gemini-media.mjs image --prompt "<subject>, <minimal>" --model pro --ratio 16:9 --size 2K --yes

# Interface mockup — restyle a REAL screenshot (UI text must be a capture, never genAI type)
node scripts/gemini-media.mjs image --prompt "<restyle direction>, <minimal>" --model flash --ref ~/Desktop/capture.png --yes

# Promo clip (8s with native audio) — cheapest publishable video anywhere in the engine
node scripts/gemini-media.mjs video --prompt "<scene>, <cinematic>" --ratio 9:16 --seconds 8 --yes

# Animate a winning image (image → video)
node scripts/gemini-media.mjs video --prompt "<motion direction>" --start-image ~/Downloads/gemini/<img>.png --yes

# Conversational video edit — feed the previous interactionId back to revise the same clip
node scripts/gemini-media.mjs omni --prompt "<scene>" --ratio 16:9 --yes
node scripts/gemini-media.mjs omni --prompt "warmer light, slower push-in" --continue <interactionId> --yes

# Register the keeper so the showroom files it and the next lookup hits
node scripts/higgs-library.mjs add ~/Downloads/gemini/<file> --prompt "<full prompt>" \
  --model gemini-3.1-flash-lite-image --source gemini --type hero --brand databayt
```

**There is no free tier for images. Settled 2026-08-05 by running it.** The key
(`AQ.Ab…_bMQ`, named `kun`, project `gen-lang-client-0243019665`) authenticates, sees all 58
models, and generates **text** fine on the free tier. Image generation returns:

```
429  Quota exceeded for metric: generate_content_free_tier_requests, limit: 0
```

`limit: 0` — not a used-up allowance, a quota that was never greater than zero. Google's own
pricing page was right and the third-party "~500 images/day" trackers are wrong. Nothing on
this lane renders until **billing is enabled** on that project; the AI Studio UI offers a
monthly **spend cap** at the same time, which is the safe way to turn it on. Until then the
raster lane has no funded renderer at all — say so and offer the template lane, do not
burn turns retrying.

**Arabic typography — a live question, not a settled doctrine.** Nano Banana Pro's headline
claim is accurate multilingual text rendering, which is exactly what rule 2 forbids on the
raster lane. Arabic is the hard case (letter joining, ligatures, RTL) and marketing claims
are not evidence. Cheap test before anyone believes it: one `pro` render at $0.134 carrying
a known Arabic string, eyeballed against the same string set in Thmanyah on the template
lane. Until that test runs and passes, **rule 2 stands** — copy goes on the template lane.

## Higgsfield recipes (copy-paste; swap prompt subject)

```bash
# 0. ALWAYS FIRST — do we already own this shot? A hit costs 0 credits.
node ~/kun/scripts/higgs-library.mjs lookup --prompt "<full prompt>" --model <model> --ratio 16:9

# Draft grid — explore 4 compositions for ~0.6 cr
for r in 1:1 16:9 9:16 4:3; do higgsfield generate create z_image --prompt "<subject>, <minimal>" --aspect_ratio $r --wait --json; done

# OG image / hero banner (final)
higgsfield generate create nano_banana_pro --prompt "<subject>, <minimal>" --aspect_ratio 16:9 --resolution 2k --wait --json

# Social square / story
higgsfield generate create nano_banana_2_lite --prompt "<subject>, <cinematic>" --aspect_ratio 1:1 --wait --json   # story: 9:16

# Promo clip (5s, default video)
higgsfield generate create kling3_0_turbo --prompt "<scene>, <cinematic>" --aspect_ratio 16:9 --wait --wait-timeout 20m --json

# Animate a winning image (image → video)
higgsfield generate create kling3_0_turbo --prompt "<motion direction>" --start-image ~/Downloads/higgs/<img>.png --wait --wait-timeout 20m --json

# Tweak a video from URL (helper: download → upload → restyle)
bash ~/.claude/scripts/higgs-tweak.sh --url "<video_url>" --prompt "<restyle>, <cinematic>"   # --premium for seedance_2_0

# Reframe existing video to another ratio (e.g. landscape → reel)
higgsfield generate workflow reframe --video <path> --aspect-ratio 9:16 --resolution 720p --wait --json

# Branded ad set — brand kit does typography/colors (batch up to 20)
higgsfield marketing-studio dtc-ads generate --prompt "<offer/hook>" \
  --format-id 18e9f327-b667-40f1-84d1-f234c67a4929 --brand-kit-id b0a3f528-0397-41f7-85be-0b44a458a01f \
  --batch-size 4 --cost-only   # rerun without --cost-only to spend
# formats: `ms ad-formats list` (Headline, Special Offer, Key Features, Social Proof, …)

# Product photoshoot — backend prompt enhancement, modes:
# restyle, social_carousel, ad_creative_pack, virtual_model_tryout, conceptual_product,
# product_shot, lifestyle_scene, closeup_product_with_person, moodboard_pin, hero_banner
higgsfield product-photoshoot create --mode hero_banner --prompt "<intent>" --image <ref.png> --count 3 --enhance-only   # preview free, drop flag to spend
```

## SMS ad pillars (school-management campaigns)

The category's four proven layouts, mapped to lanes. Only Interface Hero spends higgs
credits — the other three are free template renders (`/carousel`, 1-slide decks fine).
The demo deck `hogwarts/sms-pillars` shows all three template pillars rendered.

| Pillar                                    | Lane             | Recipe                                                                                                                                                                                           |
| ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Interface Hero** — 1:1 dashboard render | higgs `mockup`   | Screenshot the REAL hogwarts dashboard first (UI text must be a capture, never genAI type), then `product-photoshoot create --mode restyle --image <capture.png> --enhance-only` to preview free |
| **Feature Ecosystem** — hub + modules     | template `grid`  | Deck slide: `{type: "grid", headline, hub, cells: [4-6 × {label, art}]}`                                                                                                                         |
| **Efficiency Split** — before/after       | template `split` | Deck slide: `{type: "split", beforeLabel, afterLabel, beforeArt?, afterArt?}`                                                                                                                    |
| **Trust Anchor** — testimonial lockup     | template `quote` | Deck slide: `{type: "quote", text, attribution?}` — REAL quotes only, never invented                                                                                                             |

Register anything generated with `--type` (`hero`, `mockup`, `lifestyle`, …) so the
showroom at `/social/media` files it; the taxonomy is
`src/components/root/social/showroom/taxonomy.ts`.

## Result handling (verified JSON shape)

`generate create --wait --json` returns an **array of jobs**:
`[{"id", "status": "completed", "result_url": "<full-res png/mp4>", "min_result_url": "<preview webp>", ...}]`

```bash
higgsfield generate create <model> --prompt "$P" --wait --json \
  | jq -r '.[].result_url' \
  | while read -r u; do
      f=~/Downloads/higgs/$(date +%F)-<slug>-$RANDOM.${u##*.}
      curl -sL -o "$f" "$u"
      # Register it, or the next identical request pays again.
      node ~/kun/scripts/higgs-library.mjs add "$f" --prompt "$P" --model <model> --brand <brand> --credits <cost>
    done
node ~/kun/scripts/higgs-library.mjs push   # mirror to the CDN origin
```

Async batch (fire many, wait once): capture `.[].id` per create (no `--wait`), then
`higgsfield generate wait <id> --json`. List recent: `higgsfield generate list`.

## Asset library — generate once, reuse forever

`scripts/higgs-library.mjs` fingerprints every paid job by (prompt, model, ratio,
resolution) and mirrors the file to S3, so the same shot is never bought twice and assets
outlive `~/Downloads`. Manifest: `content/media/library.json` (git-tracked).

```bash
node scripts/higgs-library.mjs lookup --prompt "..." --model M --ratio 16:9   # before spending
node scripts/higgs-library.mjs add <file> --prompt "..." --model M --brand hogwarts --credits 1
node scripts/higgs-library.mjs import        # register anything already in ~/Downloads/higgs
node scripts/higgs-library.mjs push          # mirror new assets to the CDN origin
node scripts/higgs-library.mjs stats         # assets, credits spent, credits saved by reuse
```

**Lookup before every paid job.** Prompts are normalized (case, whitespace, punctuation), so
trivial rewording still hits. A different ratio or model is correctly a miss.

**Attach to the draft it was made for.** When the render answers a draft-queue ask (a full
draft is copy AND/OR media), hand the registered `cdnUrl` to the draft after `push`:

```bash
node scripts/social-drafts.mjs attach <askId> --media "<cdnUrl>"   # pending or answered; REPLACES the set
```

The Hub's review queue on `/social/publish` then shows the full draft — copy beside its
media — for the human yes. The showroom's Attach button is the same move from the browser.

Serving origin: `https://hogwarts-databayt.s3.amazonaws.com/media/<brand>/<id>-<file>`.
`cdn.databayt.org` 403s on **every** key in this bucket (pre-existing CloudFront fault, not
caused by the library) — once fixed, `push --base https://cdn.databayt.org` re-links all URLs
in place with no re-upload.

**Re-verified 2026-08-06:** the S3 origin answers **200** and `cdnBase` in `library.json` already
points at it, so the CDN fault is **bypassed, not blocking** — nothing on the publish path waits on
it. Treat it as a caching/branding improvement, not a gate. (`x-cache: Error from cloudfront` with
`server: AmazonS3` on the 403 means the distribution cannot read the bucket — an OAC/bucket-policy
fix in the AWS console, not a code change.)

**Template-lane renders can also live here.** `add` records a `sourceDir`, so an asset registered
from anywhere — `~/Downloads/carousels/<brand>/<slug>/` for a `carousel:render` output — is pushable.
Before 2026-08-06 `push` only looked in `~/Downloads/higgs` and reported such a row `missing`
forever while it sat on disk. Tag it honestly: `--source template --type og --credits 0`, because
the default `--source` is `higgsfield` and would badge a free render as spent credits.

## Budget ladder — **balance is 0.7 cr as of 2026-07-27**

At 0.7 credits only `z_image` drafts (0.15) still run — 4 of them. Every final image (≥1),
hero (2), and all video (≥7.5) is unaffordable. **Check `higgsfield account status` before
promising any paid asset**, and lead with the library, which costs nothing.

- Free-plan credits appear to be a **one-time ~10 cr grant**, not a monthly refill — all 25
  transactions to date are `spend`, no credit-in row in three weeks.
- Spent to date: **9.3 cr over 25 jobs / 24 assets** (~0.39 cr each) — 22 × z_image (3.3) +
  3 × Nano Banana Pro (6.0). No video has ever been generated; that lane is untested.
- If a job costs more than the balance, stop and report: asset plan, per-job cost, balance,
  and that the workspace needs an upgrade (https://higgsfield.ai/pricing) — a billing change,
  so it's Abdout's call (subscription doctrine).
- **Trial economics**: the only free path is a 3-Day Plus Trial = 100 cr, $0 today, **card
  required**, auto-renews to Plus $49/mo unless cancelled. Trial credits are MCP/CLI-only.
  Disciplined play: start → front-load a full batch in 3 days → cancel before day 3 = true $0.
  Blocked on a working card (Mada rejection).
- `higgsfield account transactions --size 100` audits spend.

## Recovery

| Symptom                     | Fix                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `Not authenticated`         | `higgsfield auth login` (browser OAuth, hands-free)                                              |
| `No workspace selected`     | `higgsfield workspace set 1d67d842-bc70-40d8-8c03-576cb1b141df`                                  |
| Unknown model / param error | `higgsfield model list`, `higgsfield model get <job_type>`                                       |
| Job stuck                   | `higgsfield generate get <id> --json`; re-wait with `generate wait <id>`                         |
| Brand kit missing           | `higgsfield ms brand-kits fetch --url https://databayt.org --wait --json` (free), update ID here |
