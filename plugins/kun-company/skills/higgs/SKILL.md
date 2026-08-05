---
name: higgs
description: Generate and edit photos and videos for databayt org marketing, ads, and prompts using Higgsfield AI
when_to_use: "Use when generating or editing marketing media — image, photo, video, ad, banner, og image, social card, hero shot, product shot, promo reel, story, avatar ad — or when a reference video/image URL needs downloading and tweaking through Higgsfield. This is the TEXT-FREE lane: og images, infographics, testimonials, split comparisons and anything carrying copy render on /carousel's template lane instead (the Portrait Gallery spells route by taxonomy lane). Triggers on: /higgs, generate video, generate image, generate photo, make an ad, promo video, og image, social card, hero image, product shot, mockup, lifestyle scene, moodboard, showroom asset, brand kit, edit video from url, download and tweak video, higgs, صورة تسويقية, وسائط."
argument-hint: "[recipe|prompt] [--url <ref>] [--count N] [--premium] [--ratio 16:9]"
---

# Higgs — Higgsfield media generation for databayt

One-command marketing media. Every decision below is pre-made — do NOT ask Abdout about
model, style, aspect ratio, or output location. Pick the recipe, run it, deliver the file.
CLI: `higgsfield` (aliases `higgs`, `hf`), authed via `auth login` (OAuth token on disk).

## Zero-question doctrine

1. **Never ask model/style/ratio** — the tables below decide. Only stop for: credits
   insufficient for the asked job, or a truly ambiguous deliverable.
2. **No text inside generated visuals** (AI typography breaks, Arabic doubly so). Generate
   text-free; overlay copy in post. Exception: `dtc-ads` — its backend does typography.
3. **Estimate free, then spend**: `generate cost <model> --prompt "..."`, `--cost-only`
   (dtc-ads), `--enhance-only` (product-photoshoot). Report spend + balance after every run.
4. **Batch in one command** — `--count 1-10` (photoshoot), `--batch-size 1-20` (dtc-ads) —
   never N separate invocations.
5. **Always `--json`**, parse `.[].result_url`, download to `~/Downloads/higgs/`,
   deliver via SendUserFile. Job page fallback: https://higgsfield.ai/create/image
6. Video is expensive (7.5–22.5 cr) — iterate composition as a cheap image first
   (`z_image`, 0.15 cr), then animate the winning frame via `--start-image`.

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

## Model defaults (costs re-verified 2026-07-27 via `generate cost`)

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

## Recipes (copy-paste; swap prompt subject)

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
