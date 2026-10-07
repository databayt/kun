---
name: edit
description: Edit video locally — footage cuts, Arabic captions, motion graphics, demos, reels
when_to_use: "Use when real footage must be cut or captioned, or a video composed from code. Filming is /record, /shoot; AI clips /higgs. Triggers on: edit video, cut the silences, rough cut, make a reel, add captions, motion graphic, title card, intro outro, مونتاج, قص الفيديو, ريلز."
argument-hint: "<footage dir|file> | motion <brief> | demo <flow> | reel <file>"
---

# Edit — the video lane

The agent never watches video. It reads a word-level transcript and looks at a filmstrip only at
decision points, writes an EDL or an HTML composition, and renders with ffmpeg. Everything runs on
this Mac, so there is no API spend.

Keywords (vocabulary, *The Pensieve*) map to lanes: `edit`/`مونتاج` asks, then routes ·
`rough cut`/`قص الفيديو` → raw footage · `captions`/`ترجمة الفيديو` → captions on a cut ·
`title card`, `motion graphic` → HyperFrames · `reel`/`ريلز` → cut, then `reel.sh` (AI-only reels
are /higgs). How-to for humans: `content/docs/edit.mdx`.

| Need                                    | Engine                                                             | Entry                    |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| Raw footage → cut                       | **video-use** (MIT, patched for local mlx-whisper)                 | `scripts/vu.sh <helper>` |
| Motion graphics, title cards, promos    | **HyperFrames** plugin (Apache-2.0, HTML + GSAP → MP4)             | `scripts/hf.sh <cmd>`    |
| Product demo                            | `/shoot` sim or `/record` take + HyperFrames cards + ffmpeg concat | below                    |
| Reel (9:16)                             | a video-use cut → `scripts/reel.sh`                                | below                    |
| Quick silence strip of a long recording | `auto-editor`                                                      | below                    |

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
$S/reel.sh base.mp4 reel.mp4 --srt <dir>/edit/master.srt --mode pad   # pad: screen content; crop: talking head
```

`--max 90` is the default cap. Captions sit at MarginV 60, above the platform UI.

## Fast silence strip

`auto-editor in.mp4 --margin 0.2s -o out.mp4` cuts on audio level only, which is good for long
recordings before the transcript pass. Transcript-driven cuts (video-use) are the quality path.

## House rules

- **One file per piece, always overwritten**, for example `<flow>-ar.mp4`. Never `-v2` or `-final2`.
  Delete superseded renders in the same turn.
- **Disk floor 10 GiB.** `vu.sh render`, `hf.sh render` and `reel.sh` refuse below it. Delete
  `<dir>/edit/` scratch (`_concat.txt`, `*.prenorm.mp4`, preview renders) and HyperFrames
  `renders/` drafts once the final is delivered.
- Confirm the strategy before the first full render. Use `--draft` or `--preview` while iterating.
- You cannot listen. Report the loudness numbers that `render` prints (−14 LUFS target) instead of
  claiming it sounds right.
- **Remotion is not used:** databayt has more than 3 people, so it needs the paid Company licence.
  HyperFrames covers the same ground for free.

Docs: `content/docs/edit.mdx`.
