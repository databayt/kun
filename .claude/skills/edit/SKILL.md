---
name: edit
description: Edit video locally — footage cuts, Arabic captions, motion graphics, demos, reels
when_to_use: "Use when real footage must be cut or captioned, or a video composed from code. Filming is /record, /shoot; AI clips /higgs. Triggers on: edit video, cut the silences, rough cut, make a reel, add captions, motion graphic, title card, intro outro, filmcraft, timeline, مونتاج, قص الفيديو, ريلز, فيلم كرافت."
argument-hint: "<footage dir|file> | motion <brief> | demo <flow> | reel <file>"
lane: build
effort: medium
---

# Edit — the video lane

The agent never watches video. It reads a word-level transcript and looks at a filmstrip only at
decision points, writes an EDL or an HTML composition, and renders with ffmpeg. Everything runs on
this Mac, so there is no API spend.

Keywords (vocabulary, _The Pensieve_) map to lanes: `edit`/`مونتاج` asks, then routes ·
`rough cut`/`قص الفيديو` → raw footage · `captions`/`ترجمة الفيديو` → captions on a cut ·
`title card`, `motion graphic` → HyperFrames · `reel`/`ريلز` → cut, then `reel.sh` (AI-only reels
are /higgs). How-to for humans: `content/docs/edit.mdx`.

| Need                                                                     | Engine                                                             | Entry                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------- |
| Raw footage → cut                                                        | **video-use** (MIT, patched for local mlx-whisper)                 | `scripts/vu.sh <helper>`          |
| Timeline edit: assemble, grade, mix, titles, a project Abdout can reopen | **FilmCraft** NLE (Apache/MIT, free; replaces Adobe)               | `filmcraft` MCP · `filmcraft-cli` |
| Motion graphics, title cards, promos                                     | **HyperFrames** plugin (Apache-2.0, HTML + GSAP → MP4)             | `scripts/hf.sh <cmd>`             |
| Product demo                                                             | `/shoot` sim or `/record` take + HyperFrames cards + ffmpeg concat | below                             |
| Stills film (camera over still images) | **Blender** `stills.py`, then FilmCraft | `blender.sh stills` · `fc/assemble.mjs --deliver` |
| Reel (9:16)                                                              | a video-use cut → `scripts/reel.sh`                                | below                             |
| Quick silence strip of a long recording                                  | `auto-editor`                                                      | below                             |

First run on a machine: `bash ~/.claude/skills/edit/scripts/setup.sh`. It is idempotent and prints the toolchain.
Scripts live at `~/.claude/skills/edit/scripts/`, called `S` below.

## Raw footage → cut

Follow the **video-use** skill (`~/.claude/skills/video-use/SKILL.md`) for the whole process: inventory,
converse, strategy, EDL, render and self-check. Always go through the wrapper. It adds ffmpeg-full,
`VIDEO_USE_ASR=local` and the Arabic caption preset:

```bash
$S/vu.sh transcribe_batch <dir> --language ar      # cached in <dir>/edit/transcripts/
$S/vu.sh pack_transcripts --edit-dir <dir>/edit     # → takes_packed.md (read this, not the video)
$S/vu.sh timeline_view <video> <start> <end>        # filmstrip + waveform at a decision point only
$S/vu.sh render <dir>/edit/edl.json -o <dir>/edit/final.mp4 --build-subtitles
```

- **Whisper quirks:** word starts drift early after long silences (~0.5 s). Pad cut-ins from the
  phrase's real speech, and verify each cut with `timeline_view` or an extracted frame. Arabic
  spelling slips happen (`الأضافة` for `الإضافة`). Before `--build-subtitles`, fix `text` in the
  transcript JSON. Never re-transcribe.
- **Captions:** Thmanyah Sans on a padded dark box (`EDIT_AR_SUB_STYLE` in `lib.sh`). Outlines
  muddy Arabic dots. English footage: `VIDEO_USE_SUB_STYLE= VIDEO_USE_SUB_FONT=Helvetica`.

## Timeline edit → FilmCraft

FilmCraft (`storytold/filmcraft`) is a full non-linear editor — Premiere-class timeline, color,
keyframes, audio mixer, captions, titles, H.264/HEVC/ProRes export — and every action is a command
an agent can run (`filmcraft-cli commands` lists ~700). It replaced the paid Adobe lane on
2026-11-15. Install/update: `bash .claude/scripts/filmcraft.sh install` (verifies sha256, gpg and
Apple notarization). Two MCP servers, both user scope:

- **`filmcraft`** — headless, no window. The default. Tools: `media_import`, `doc_inspect`,
  `command_run`, `command_batch`, `render_frame`, `command_list`.
- **`filmcraft-desktop`** — drives the open app (adds `ui_*` click/drag/key/screenshot). Only when
  Abdout wants to watch or touch the timeline: `bash .claude/scripts/filmcraft.sh desktop <p.fcproj>`.

Loop: import → inspect for ids → batch the edits → `render_frame` and look → fix with `edit.undo` →
export. The same works from the shell. `--save` and `--project` are global options that go **before** the
subcommand (`import`, `run`, `exec`, `export`), and each call is its own process: without `--save` the
edit is lost when it exits.

```bash
P=~/media/<repo>/<flow>/<flow>.fcproj        # one project per piece; reopens in the desktop app
filmcraft-cli --save-as $P exec file.newSequence name=<flow> width=1080 height=1920 fps=30
filmcraft-cli --project $P --save import <clip.mp4> <music.wav>
filmcraft-cli --project $P --save run steps.jsonl   # `run` = many commands, one per line: {"id":"timeline.place","params":{"item":8,"track":"V1","seconds":0}} per line
filmcraft-cli --project $P render --seconds 3 --out f.png --scale 0.5
filmcraft-cli --project $P export <out>.mp4         # then media.sh encode + qa-pack as usual
```

Commands worth knowing: `timeline.place` (item → track at seconds), `clip.fillFrame` (16:9 footage
fills a 9:16 frame), `graphics.newText` + `graphics.set` (titles; Arabic shapes and runs RTL
correctly, verified 2026-11-15), `captions.import` (SRT from video-use), `essentialSound.generateDucking`,
`clip.audioGain`, `lumetri.setLook`, `file.exportMedia {burnCaptions, wait:true}` (loudness is not set here: `media.sh encode` owns it, see below).
Use `filmcraft-cli describe <id>` for a command's params before guessing. Output still goes
through `media.sh` (below); FilmCraft is the editor, not the publisher.

### Brand videos — one spec, one assembler (`scripts/fc/`)

Every brand piece (marketing promo, feature explainer, one-off support clip, lesson) is a spec
`~/media/<repo>/<piece>/<piece>.video.json` that `node $S/fc/assemble.mjs <spec> [--aspect 9:16]
[--frames]` turns into `<piece>.fcproj` + `<piece>-<lang>.mp4` (16:9) + `.reel.mp4` (9:16). The
header of `assemble.mjs` documents the spec. What it does for you:

- **Brand** from `content/media/brand-kit.json` (`balqalam` is Hogwarts' school-facing face,
  `mkan`, `databayt`): title cards and end cards (built-in `title-centered`, auto-fit to the width,
  logo via `"logo"`), labels (`lower-third-slab`, solid, `labelPos`: wide top-left, reel top-right).
- **Narration**: an item's `say` line → one batched Gemini stock-voice request (`voice.mjs`, 10
  free a day — never loop it), then the voice sets the clock (cards/stills last as long as their
  line); writes `.vo.wav`, `.srt`, `.vtt` with the steering diacritics stripped.
- **Reels**: pictures fill 9:16; a wide screenshot takes `"reel": {"cx","cy","width"}` to frame
  what the line names, over the brand canvas; captions burn through libass (house Thmanyah box).
  Wide films keep the `.vtt` sidecar, no burned captions.
- **Sound**: music ducked under the voice (`essentialSound`), a −4 dB limiter on the mix bus.
  **Loudness has one owner, `media.sh encode`** (two-pass EBU R128: −16 web, −14 reel, true-peak
  safe). FilmCraft exports the master un-normalised (no `loudnessLufs`; a spec's `loudness` is
  ignored), so the level is never changed twice. `--deliver` runs `media.sh encode web|reel` +
  `qa-pack` for you; FilmCraft's export is a high-bitrate master, never the deliverable.
- **Ken Burns without Blender**: a still's `"move": {"from":[cx,cy,zoom],"to":[cx,cy,zoom],"ease"}`
  keys Motion scale/position. **Dissolve**: `"transition": {"type":"cross_dissolve","frames":12}` on
  an item. **Music**: `"music": {"src","db","fadeIn","fadeOut","start"}`; `"end": S` trims the
  piece; `"canvas": {"16:9":[1920,1072],"9:16":[1080,2332]}` sets frame sizes; an item's `src` may
  be `{ "16:9": …, "9:16": … }` for a per-aspect take. A piece with clips and music, no voice or
  cards, is fine. `--deliver` encodes with `--max <real length>` (the reel profile's 60 s default
  never truncates it) and `--box <canvas>`, then prints the `qa-pack` verdict.

Recipes:

| Kind              | Source                                                                                    | Spec shape                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Marketing promo   | feature loops `~/media/<repo>/feature-*/…-ar.mp4` + a Lyria bed (`uv run media/lyria.py`) | card → 5 s clips with `label`+`say` → endCard                                                         |
| Feature explainer | the feature's stills/loop                                                                 | card → stills with `label`+`say`+`reel` → endCard                                                     |
| Support clip      | a `/record` take (tutorials stay on `/shoot` sim)                                         | clips with `label`, captions                                                                          |
| Lesson            | catalog textbook twin → `lesson.json`                                                     | `node $S/fc/lesson.mjs lesson.json` renders brand slides (title/points/definition/fact) and assembles |

Lessons: write `lesson.json` from the textbook's own text only (header of `lesson.mjs`); grade
B twins are garbled — read through it, never invent. Hogwarts stores lesson videos as `Video`
rows on a catalog `Lesson` (S3 `storageKey`, approval PENDING → approved): publishing one is a
prod write, so it waits for Abdout's yes.

Known FilmCraft limits (2026-11-15): its caption renderer drops the dots of a final ي in Thmanyah
(the graphics engine does not — hence libass for burned captions); TTS is English-only and
transcription tops out at whisper-small (kun's Gemini voice and mlx-whisper stay); removal is
blur/mosaic only (Mkan keeps `mkan-video`'s Vision + LaMa fill).

## 3D → Blender

Blender 5.3 (`blender/blender`, GPL, free; installed 2026-11-15) makes what a timeline cannot: product
shots, a logo sting, a 3D scene or explainer object. Install/update: `bash .claude/scripts/blender.sh
install` (checks blender.org's own SHA-256 and the Blender Foundation's notarization).

- **Headless — the default, no window:** write a Python scene script, then
  `blender.sh render scene.py -- <args>` renders a PNG sequence and `blender.sh frames <dir> out.mp4`
  encodes it. Set `view_settings.view_transform = 'Standard'` for exact brand colours (AgX washes
  them). Blender 5 has no FFMPEG image format: always frames → `blender.sh frames`.
- **`blender` MCP** — only with Blender open (its add-on serves on :9876): `execute_blender_code`,
  `get_scene_info`, `look`. `generate_3d`, `generate_gaussian_world` and `search_assets` call outside
  services, some paid: not without Abdout's yes.
- **Stills film** (a camera over still images — zoom into a rect of one picture while a child
  picture takes over): `blender.sh stills scene.json out/` renders PNGs with `scripts/blender/stills.py`
  (schema, semantics and the per-aspect overrides: `scripts/blender/stills.schema.md`) and encodes
  each leg and aspect to `out/<leg>-<aspect>.mp4`. Colour-exact (Standard view, emission only), ~0.12
  s/frame at 1920x1072. Then `assemble.mjs` takes those clips like any other.
- **Arabic text:** Blender's text objects don't shape Arabic. Render the 3D without words and put
  titles on in FilmCraft (`assemble.mjs` takes the clip like any other).

### Stills film recipe — Blender camera, FilmCraft assembly, media.sh deliver

1. Write `scene.json` (stills.schema.md): images as a tree, legs with camera keys and opacity.
   Check a moment first: `blender.sh render $S/blender/stills.py -- scene.json out --frames 90 --aspect landscape`.
2. `blender.sh stills scene.json out/` — a mezzanine clip per leg and aspect.
3. A `<piece>.video.json`: clips (`src` per aspect), `transition` dissolves, `music`, `end`, `canvas`.
4. `node $S/fc/assemble.mjs <piece>.video.json --deliver` — master, then `media.sh encode` + `qa-pack`.
   Simple pushes (no child image) skip step 1-2: use a still's `move`.
   Note: `qa-pack` judges photo-dense footage against the UI-footage MB/min budget; a FIX for size
   alone on a stills film is expected, not a defect.

## Motion graphics → HyperFrames

Load the plugin's router skill `/hyperframes:hyperframes`. It routes to core, animation, captions,
product-launch and more. Build the composition in a project dir and check it before rendering:

```bash
cd <project> && $S/hf.sh check && $S/hf.sh render     # output in renders/
```

House rules that its lint doesn't fully teach:

- **Never `<html dir="rtl">`.** It renders a blank video. Put `direction: rtl` on each text element.
- **Fonts:** copy the Thmanyah `.ttf` from `~/Library/Fonts/` into the project's `fonts/` and
  declare it with `@font-face`. Lint requires that. Never commit or rehost them. Headlines use
  Thmanyah Serif Display 900 with `ss01`, and body text Thmanyah Sans. Brand kit:
  `content/docs/media.mdx` (clay `#e05638`).
- Run `check` until it shows 0 errors, so the contrast and layout audits actually run. Then read a
  mid-frame: `ffmpeg -ss <t> -i out.mp4 -frames:v 1 f.png`.

## Product demo

1. Get the take: `/shoot` sim (`--direct-only` re-composes the cached take with no new filming) or a
   `/record` take.
2. Intro and outro cards from HyperFrames (above).
3. Join them at a constant frame rate. Always use the concat **filter** with `fps=30`, never
   `-c copy`, because `screencapture` output has a variable frame rate:
   ```bash
   ffmpeg -i intro.mp4 -i take.mp4 -i outro.mp4 -filter_complex \
    "[0:v]fps=30,scale=1920:1080,setsar=1[a];[1:v]fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=0x0b0f14,setsar=1[b];[2:v]fps=30,scale=1920:1080,setsar=1[c];[a][b][c]concat=n=3:v=1:a=0[v]" \
    -map "[v]" -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart <flow>-ar.mp4
   ```

## Reel (1080×1920 @ 30)

Render the cut **without** subtitles, then reframe it and burn the captions last:

```bash
$S/vu.sh render edl.json -o base.mp4 --no-subtitles
$S/reel.sh base.mp4 ~/media/<repo>/<flow>/<flow>-ar.reel.mp4 --srt <dir>/edit/master.srt --mode pad   # pad: screen content; crop: talking head
```

A product flow's reel is `~/media/<repo>/<flow>/<flow>-<locale>.reel.mp4` — the name `publish.mjs`
files as `<flow>/reel-<locale>`. `--max 58` is the default cap (the same as the sim's reel, under
the 60 s platform limit). Captions sit at MarginV 60, above the platform UI.

## Fast silence strip

`auto-editor in.mp4 --margin 0.2s -o out.mp4` cuts on audio level only, which is good for long
recordings before the transcript pass. Transcript-driven cuts (video-use) are the quality path.

## Media library — `media.sh` (shared by edit, shoot, sim and record)

`$S/media.sh` is the one path for encoding, deriving, publishing and checking media. It is local
and free:

| Command                                                                                  | Does                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encode <web\|av1\|reel\|clip\|loop\|draft> <in> <out>`                                  | tv-range BT.709 tags, faststart, two-pass loudnorm (−16 web, −14 social). An out ending in `.av1.mp4` encodes SVT-AV1.                                                                                                                                                                                                                                                    |
| `poster <in> <out.webp> --at S`                                                          | A meaningful frame as WebP, 1600 px wide                                                                                                                                                                                                                                                                                                                                  |
| `derive <png…> [--kind ui\|photo] [--check]`                                             | oxipng master plus AVIF/WebP at 1600/2400 (4:4:4 for UI text); EXIF stripped; ssimulacra2 score                                                                                                                                                                                                                                                                           |
| `vtt <srt\|json> <out.vtt>`                                                              | WebVTT captions for `<track>`                                                                                                                                                                                                                                                                                                                                             |
| `publish --ns <brand> (--key <path> \| --slug <s>) --id <id> --manifest <path> <files…>` | `--key`: clean stable keys that mirror the app URL (`hogwarts/ar/students/add/video.mp4`, `…/add/list@2x.avif`), overwritten in place + CloudFront-invalidated, `?v=<sha8>` in the manifest; `--slug`: legacy hashed immutable keys — don't use for new media. Each HEAD-verified, plus an upsert into the product's `media-manifest.json` (AV1 source first, then H.264) |
| `prune --ns <brand> --manifest <path> --repo <dir> [--match re] [--delete]`              | Lists CDN keys nothing serves or names any more (default: hashed leftovers); `--delete` removes them one by one after a human yes                                                                                                                                                                                                                                         |
| `qa-pack <files…> [--vtt] [--ref]`                                                       | Numbers against `engine.json → media` plus ≤1600 px previews for the `media-qa` agent                                                                                                                                                                                                                                                                                     |
| `voice status\|record\|consent\|gen\|mix\|revoke`                                        | Consent-gated local Arabic narration (Chatterbox Multilingual v3 on MLX), whisper-gated                                                                                                                                                                                                                                                                                   |
| `brand <id> --json\|--css\|--ass`                                                        | The brand kit's production entry for any renderer                                                                                                                                                                                                                                                                                                                         |
| `doctor` · `purge [--deep]`                                                              | Toolchain status; age out render caches (`--deep` with every session closed)                                                                                                                                                                                                                                                                                              |

- **Before shipping:** run `qa-pack`, then have `media-qa` judge it. PASS means publish; FIX means
  re-render with the named change.
- **Media never enters git** (the `media-guard` hook): publish to the CDN and commit only the
  manifest.
- **Voice:** a house voice needs a consenting speaker. Record it once with
  `media.sh voice record house-ar --speaker "<name>"`, then
  `media.sh voice consent house-ar --given`. Samples and consent live outside git and outside
  Drive. Without them, every render ships with captions only.
- **AI imagery is free first** (higgs ladder): Adobe for creativity (enable per media session),
  Canva, Claude Design, Figma Weave. Google and Higgsfield stay off until funded.

## House rules

- **One file per piece, always overwritten**, for example `<flow>-ar.mp4`. Never `-v2` or `-final2`.
  Delete superseded renders in the same turn.
- **Disk floor 10 GiB.** `vu.sh render`, `hf.sh render` and `reel.sh` refuse below it. Delete
  `<dir>/edit/` scratch (`_concat.txt`, `*.prenorm.mp4`, preview renders) and HyperFrames
  `renders/` drafts once the final is delivered.
- Confirm the strategy before the first full render. Use `--draft` or `--preview` while iterating.
- You cannot listen. Report the loudness numbers that `render` prints (−14 LUFS target) instead of
  claiming it sounds right.
- **Adobe is not used:** Premiere and After Effects need a paid licence; FilmCraft covers the
  timeline for free (the staged Adobe MCPs stay unregistered).
- **Remotion is not used:** databayt has more than 3 people, so it needs the paid Company licence.
  HyperFrames covers the same ground for free.

Docs: `content/docs/edit.mdx`.
