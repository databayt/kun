---
name: shoot
description: Stills of real product pages and flows, framed like Abdout's MacBook
when_to_use: "Use when a page or flow needs STILL screenshots — routes or a scripted e2e flow, framed like Abdout's MacBook at Chrome 125%. Video is /record. Triggers on: shoot <route|flow>, take a screenshot of <url>, screenshot the <x> flow, لقطة شاشة."
argument-hint: "<path|url>… | --flow <name> [--role admin] [--host url] [--full]"
---

# Shoot — stills of the real product

`shoot` = screenshots, `record` = video. Shoot runs headless: no screen, no Do Not Disturb,
no browser MCP. It logs into the demo by itself, so it can run while Abdout keeps working.

```
node ~/.claude/skills/shoot/scripts/shoot.mjs /ar/students /ar/teachers   # stills, one login
node ~/.claude/skills/shoot/scripts/shoot.mjs --flow add-student          # scripted flow
  [--role admin|teacher|student|guardian|accountant|staff] [--host <url>] [--repo hogwarts]
  [--full] [--zoom 1.25] [--name <stem>] [--out <dir>] [--cleanup]
```

## The frame — his manual screenshot

14" MacBook Pro M4 (1512x982 logical, Retina 2x), Chrome filling the screen (page area
1512x857), **Chrome zoom 125%** → CSS viewport **1210x686 at devicePixelRatio 2.5** →
~3025x1715 px. Approved by Abdout 2026-10-06 against his own Chrome.

Never fake zoom with CSS `zoom` on `<html>`: layout and breakpoints still see 1512 px,
and he can see the difference. DPR 2 gives the right layout at the wrong resolution.

## Where + name (his choice)

- `~/<repo>/public/screenshot/` — the file is the short URL with brand and host dropped,
  locale last: `/ar/students` → `students-ar.png`, `/ar` → `home-ar.png`,
  `/ar/s/demo/students/new` → `students-new-ar.png`.
- Same name = overwrite, so a re-shoot replaces the old shot.
- Flows: `<flow>/NN-<step>-<locale>.png` (`add-student/01-list-ar.png`).
- Every still also gets web derivatives in `derived/`: `<stem>-{1600,2400}.{avif,webp}` (UI text
  stays crisp at 4:4:4). The PNG master is oxipng'd in place. `--no-derive` skips this.
- `public/screenshot/` is **git-ignored** in hogwarts and mkan: media never ships in git (the
  `media-guard` hook blocks it). Deliver through the CDN with
  `media.sh publish --ns <brand> --slug <flow> --manifest <repo manifest> <files>`: hashed immutable
  URLs plus a manifest entry the product's `<Shot>` / `<TutorialVideo>` components read.

## Hosts + login

- Default `https://demo.balqalam.com`, the demo tenant. Its role picker is password-less,
  so `--role` picks the account (admin by default; order = `DEMO_ROLE_KEYS` in hogwarts
  `src/components/auth/login/demo-accounts.ts`).
- Marketing home: `--host https://balqalam.com`.
- Before shooting `localhost:3000`, check which repo owns the port
  (`lsof -ti tcp:3000` → `lsof -p <pid> -a -d cwd`). On 2026-10-06 it was serving `~/space`.

## Flows — write once, re-shoot forever

A flow is a file: `scripts/../flows/<repo>/<flow>.mjs`, canonical in kun.

```js
export default async ({ page, go, shot, settle }) => {
  await go("/ar/students");
  await shot("list");
  await page.getByRole("button", { name: "إضافة" }).click();
  await shot("form");
};
```

- `go(path)` navigates and logs in if asked; with `--lang` it rewrites the `/ar|/en` prefix.
  `shot(step)` settles, then saves the next numbered still: network idle, fonts, visible images
  decoded, BlurImage `data-loaded`, no skeleton on screen (capped at 10 s, then a warning).
  `t(ar, en)` returns the run's label. `page` is Playwright.
- **Deterministic by construction**: frozen CSS animations, hidden caret, `reducedMotion`, light
  scheme, the brand's timezone, `[data-media-mask]` plus `--mask`/`export const masks` painted
  over. Use `--clock <iso>` to pin `Date` (off by default: server-rendered dates won't match).
  Login is checked against the `authjs.role` cookie.
- **Bilingual**: `--flow add-student --lang ar,en` runs once per language in its own context.
  Labels come from the product dictionaries via `t()`, e.g.
  `t("التالي", "Next")` from `school.students.wizard.next`.
- Name each step after what is on screen (`list`, `form`, `filled`, `saved`, `new-row`).
- Instant `fill()` is fine — these are stills.
- Export a `cleanup({ page, go })` that undoes what the flow creates; call it at the start
  (leftovers of a crashed run) and the end. `--flow <name> --cleanup` runs it alone.
- Locate by what the UI exposes — accessible names (`getByRole("combobox", { name: "الصف" })`),
  never nth-of-type. Unknown screen? Probe it first: dump visible inputs/buttons per step,
  then write the flow. Remember every `+` that opens a wizard creates a draft row.
- Existing flows: `hogwarts/add-student` (list → documents → Finder on the photo → photo uploaded →
  Finder on the CV → CV uploaded → personal → father → address → academic → created; 12 shots).
- Uploads in stills: `finderStill(page, { files, pick })` from `scripts/finder.mjs` draws the same
  macOS Finder the sim films, open on Documents with the file selected; then the real upload. The
  files are `~/Documents/*.jpg` (copies of `assets/hogwarts/`). Headless never shows the native panel.

## Motion — a tutorial video from a flow's stills

A flow's shots become a captioned Arabic explainer: each still in a clean window, the
camera glides to the field that matters, a green ring marks it, a numbered caption says
what to do. One deterministic `render(t)` per composition; frames are screenshotted and
encoded, so Arabic shapes exactly as in the browser (ffmpeg drawtext does not).

```
node ~/.claude/skills/shoot/scripts/motion.mjs <composition.html> <out.mp4> [--preview 1.5,13.9]
```

- Compositions: `motion/<repo>/<flow>.html` — a `STEPS` list (shot, caption, focus rects in
  screenshot pixels, optional image swap). Fonts: the product's own Thmanyah (local render only,
  never shipped). 1920x1080, 30 fps, H.264.
- Preview frames first, read them, then render (CDP capture piped into ffmpeg; ~45 s for 48 s),
  delivered through `media.sh encode web` (tv-range BT.709, faststart). Output beside the shots:
  `<repo>/public/screenshot/<flow>/<flow>-ar.mp4`.
- Keep focus zoom ≤ 2.2× and frame small targets with their neighbours, or the shot is grey.
- Claims in captions must match what the shots show (count of steps, what is required).

## Sim — the tutorial video: the real flow, filmed as a human, directed into ONE file

The real wizard on the demo, driven like an admin: an on-page cursor glides and clicks (green
ripple in the brand accent), every field filled in reading order (RTL), text typed key by key, dropdowns and native
month/year selects picked, and every upload through a simulated **macOS 27 Finder** "Open"
window (Liquid Glass, sidebar, Downloads with real thumbnails, remembers the last folder) then the
real upload — so tiles show the product's own thumbnail, label and × clear button. Recorded
headless at the Mac frame at full Retina (`--force-device-scale-factor=2.5`, or the CDP
screencast drops to CSS size). A director pass composes the ONE file: intro card → the take
**flat and full-screen** (no window, no shadow) with a calm sine-eased camera on the fields being
filled → large numbered captions inward at the bottom (the camera keeps fields above them) → tip
toasts inward at the top-right, fade only → outro card. Frozen server waits are trimmed to 1.2 s.

```
node ~/.claude/skills/shoot/scripts/sim.mjs --flow add-student                 # take (real time) + direct (~2 min)
node ~/.claude/skills/shoot/scripts/sim.mjs --flow add-student --direct-only   # re-compose the saved take
  [--voice ar] [--aspect 9:16] [--steps 2-3 --name <clip>] [--draft] [--preview 5,30] [--brand <id>] [--workers 3]
```

- **Speed**: the director captures over CDP into an MJPEG pipe across 3 pages and reuses unchanged
  frames. A 121 s tutorial directs in ~30 s and delivers in under 2 min (it used to take ~25 min).
- **Look = brand kit**: overlay, caption badge, toasts, cards and the click ripple take colours,
  fonts and the mark from `content/media/brand-kit.json → production` (hogwarts → `balqalam`
  Clay). Fonts come from `~/Library/Fonts`.
- **Deliverables**, one file each, overwritten (never `-v2`):
  - `<flow>-ar.mp4` (H.264), `<flow>-ar.av1.mp4`, `<flow>-ar.poster.webp`, `<flow>-ar.vtt`
  - reel: `<flow>-ar.reel.mp4`. 1080×1920 with a brand band, a square camera, captions inside the
    safe area; a flow over 58 s plays uniformly faster to fit.
  - support clip: `<name>-ar.*` (`--steps a-b`). Never truncated; qa-pack flags anything over 30 s.
  - draft: `<flow>-ar.draft.mp4`.
- **Voice** (`--voice ar`): `sims/<repo>/<flow>.voice.ar.json` holds one line per `sim.caption`, in
  order. Lines are synthesized locally (Chatterbox, `media.sh voice gen`) in the consented house
  voice, gated by a whisper transcript (CER ≤ 0.10). The director holds frames so each line fits,
  never stretching audio. No consented voice means captions only, never a failed render.
- **QA before anything ships**: `media.sh qa-pack <outputs> --vtt <flow>-ar.vtt --out <dir>`, then
  the `media-qa` agent (PASS / FIX / FAIL).
  The take is `~/.cache/shoot-sim/<repo>-<flow>/` (frames + `take.json`). Camera/caption/toast
  timing is in `take.json` — edit an event there and `--direct-only` instead of a new take.
- Sim files: `sims/<repo>/<flow>.mjs` — `meta`, `prepare`, `cleanup`, `default async (sim)`. API:
  `sim.caption(n, text)` · `sim.toast(text)` · `sim.focus(loc | [locs] | null, { z })` · `sim.click` ·
  `sim.type(loc, text, { cps })` · `sim.pick(trigger, name | index)` · `sim.select(nativeSelect, value)` ·
  `sim.upload(trigger, path, { files })` (files = everything Finder shows) · `sim.move` · `sim.wait(ms)`.
- Frame the FIELDS being filled, not `<form>`; a page where everything matters (6 upload tiles +
  Finder) stays full-screen. Tips go AFTER modal moments, never on top of the Finder window.
- **Paid side effects are blocked, not avoided:** hogwarts document tiles fire a paid AI extraction
  (and would pre-fill fields) — `prepare` aborts exactly that server action (`next-action` POST
  ending in `"…Url"]`) and logs each block; the upload itself runs as in the real app.
- Media: `assets/hogwarts/` — `photo.jpg` (Abdout's supplied stock photo, checkerboard removed by
  `clean-bg.py`) and five A4 sample "scans" from `make-docs.mjs`, all watermarked «نموذج للعرض».
  **Git-ignored**: kun is public and the photo's licence is unverified. Never a real child's photo
  from the web; AI image generation needs a paid Gemini tier (free tier = 0 images/day).
- Happy-path data: section «الصف الأول - أ» (has a timetable; «الصف A-1» raises a warning toast).
  Toasts are tutorial TIPS («نصيحة») — never fake product notifications.
- Found by sims, fixed in hogwarts 2026-10-06: Arabic file names failed every S3 upload (header
  metadata), and document slots refused photos. Sims are QA — report what they hit.

## Close

Read every PNG before reporting it done. Send the key ones with `SendUserFile` and give
the folder path. A wrong-looking frame means recapture, never a pixel edit.
