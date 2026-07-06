---
name: higgs
description: Generate and edit photos and videos for databayt org marketing, ads, and prompts using Higgsfield AI
when_to_use: "Use when generating or editing marketing media — image, photo, video, ad, banner, og image, social card, hero shot, product shot, promo reel, story, avatar ad — or when a reference video/image URL needs downloading and tweaking through Higgsfield. Triggers on: /higgs, generate video, generate image, generate photo, make an ad, promo video, og image, social card, hero image, product shot, brand kit, edit video from url, download and tweak video, higgs."
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

## Account (verified 2026-07-06)

| Fact                       | Value                                            |
| -------------------------- | ------------------------------------------------ |
| Account                    | `osmanabdout@hotmail.com` — free plan            |
| Workspace                  | `1d67d842-bc70-40d8-8c03-576cb1b141df` (Private) |
| Brand kit (databayt.org)   | `b0a3f528-0397-41f7-85be-0b44a458a01f`           |
| Web product (databayt.org) | `6933f3b2-5611-4548-b015-2c963d054dc4`           |
| Output dir                 | `~/Downloads/higgs/YYYY-MM-DD-<slug>.<ext>`      |

## Preflight (one call, fix only what fails)

```bash
higgsfield account status || { higgsfield auth login; higgsfield workspace set 1d67d842-bc70-40d8-8c03-576cb1b141df; }
```

`auth login` opens browser OAuth (default browser holds the higgsfield.ai session — completes
hands-free). MCP `https://mcp.higgsfield.ai/mcp` is registered but unauthenticated — the CLI
is the primary lane; don't detour through MCP.

## Model defaults (costs verified per 1 job)

**Naming trap**: `nano_banana_2` = Nano Banana **Pro**; `nano_banana_flash` = Nano Banana 2.

| Use                         | Model                 | Cost | Notes                                                  |
| --------------------------- | --------------------- | ---- | ------------------------------------------------------ |
| Image draft / iteration     | `z_image`             | 0.15 | ratios 1:1,4:3,3:4,16:9,9:16                           |
| Image final                 | `nano_banana_flash`   | 1.5  | +21:9, 2:3, 4:5…; `--resolution 1k/2k/4k`; image refs  |
| Image hero / 4k / 21:9      | `nano_banana_2` (Pro) | 2    | same params as flash                                   |
| Video default               | `kling3_0_turbo`      | 7.5  | 5s 720p 16:9/9:16/1:1; `--start-image`                 |
| Video from reference video  | `seedance_2_0_mini`   | 12.5 | only seedance takes `--video-references`; 480/720p     |
| Video premium (`--premium`) | `seedance_2_0`        | 22.5 | 4k, audio, genre, ≤9 img+3 vid+3 audio refs (12 total) |

Refresh after Higgsfield ships new models: `higgsfield model list`, params via
`higgsfield model get <job_type>`.

## Brand style blocks (append to every prompt)

- **`minimal`** (default: og, hero, product, docs): `"minimal premium developer-tool
aesthetic, deep charcoal background, generous negative space, soft studio light, subtle
film grain, monochrome with one restrained cyan accent, no text"`
- **`cinematic`** (default: ads, reels, promos): `"high-end glassmorphic panels, deep dark
mode backdrop, electric cyan and warm sunset-orange rim light, shallow depth of field,
slow tracking shot, cinematic studio lighting, photorealistic, no text"`

## Recipes (copy-paste; swap prompt subject)

```bash
# Draft grid — explore 4 compositions for ~0.6 cr
for r in 1:1 16:9 9:16 4:3; do higgsfield generate create z_image --prompt "<subject>, <minimal>" --aspect_ratio $r --wait --json; done

# OG image / hero banner (final)
higgsfield generate create nano_banana_flash --prompt "<subject>, <minimal>" --aspect_ratio 16:9 --resolution 2k --wait --json

# Social square / story
higgsfield generate create nano_banana_flash --prompt "<subject>, <cinematic>" --aspect_ratio 1:1 --wait --json   # story: 9:16

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

## Result handling (verified JSON shape)

`generate create --wait --json` returns an **array of jobs**:
`[{"id", "status": "completed", "result_url": "<full-res png/mp4>", "min_result_url": "<preview webp>", ...}]`

```bash
higgsfield generate create <model> --prompt "..." --wait --json \
  | jq -r '.[].result_url' \
  | while read -r u; do curl -sL -o ~/Downloads/higgs/$(date +%F)-<slug>-$RANDOM.${u##*.} "$u"; done
```

Async batch (fire many, wait once): capture `.[].id` per create (no `--wait`), then
`higgsfield generate wait <id> --json`. List recent: `higgsfield generate list`.

## Budget ladder (free plan ≈ 10 cr — treat credits as scarce)

- Drafts are ~free (66 z_images / 10 cr); video ≥ 7.5 cr — confirm before multi-video runs.
- If a job costs more than the remaining balance, stop and report: asset plan, per-job cost,
  balance, and that the workspace needs an upgrade (https://higgsfield.ai/pricing) — a
  billing change, so it's Abdout's call (subscription doctrine).
- `higgsfield account transactions --size 20` audits spend.

## Recovery

| Symptom                     | Fix                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `Not authenticated`         | `higgsfield auth login` (browser OAuth, hands-free)                                              |
| `No workspace selected`     | `higgsfield workspace set 1d67d842-bc70-40d8-8c03-576cb1b141df`                                  |
| Unknown model / param error | `higgsfield model list`, `higgsfield model get <job_type>`                                       |
| Job stuck                   | `higgsfield generate get <id> --json`; re-wait with `generate wait <id>`                         |
| Brand kit missing           | `higgsfield ms brand-kits fetch --url https://databayt.org --wait --json` (free), update ID here |
