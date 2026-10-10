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

## Naming — one grammar, local to CDN

A flow is named `<verb>-<entity>`, singular and kebab-case: `add-student`, `add-teacher`,
`bulk-student`, `bulk-teacher`. That one word names the flow file, its local folder, its file
names on the CDN and its manifest ids. **hogwarts** is the internal name in every path, folder and
namespace; **balqalam** is only the public brand drawn on screen (palette, logo, captions).

Everything lands in **one local home per repo, outside the repo**: `~/media/<repo>/` (mirrored to
Drive by `record.sh sync`; nothing is captured into a repo's `public/`).

| Asset | Local file (`~/media/<repo>/`) | Manifest id | CDN key (`cdn.databayt.org/…`) |
| --- | --- | --- | --- |
| page still | `page/<slug>-<locale>.png` | `page/<slug>-<locale>` | `hogwarts/<slug>/<slug>-<locale>-<w>.<hash>.avif` |
| flow still | `<flow>/NN-<step>-<locale>.png` | `<flow>/<step>-<locale>` | `hogwarts/<route>/<flow>-<step>-<locale>-<w>.<hash>.avif` |
| phone still | `<flow>/iphone-16/NN-<step>-<locale>.png` | `<flow>/iphone-16/<step>-<locale>` | `hogwarts/<route>/<flow>-iphone-16-<step>-<locale>-1179.<hash>.avif` |
| tutorial | `<flow>/<flow>-<locale>.{mp4,av1.mp4,poster.webp,vtt}` | `<flow>/video-<locale>` | `hogwarts/<route>/<flow>-<locale>.<hash>.mp4` |
| reel | `<flow>/<flow>-<locale>.reel.mp4` | `<flow>/reel-<locale>` | `hogwarts/<route>/<flow>-<locale>.reel.<hash>.mp4` |
| support clip | `<flow>/<flow>-<clip>-<locale>.*` | `<flow>/<clip>-<locale>` | `hogwarts/<route>/<flow>-<clip>-<locale>.<hash>.mp4` |
| story cut | `<flow>/<flow>-<cut>-<device>-<locale>.*` | `<flow>/<cut>-<device>-<locale>` | same as a support clip |
| raw footage (`/record`) | `<flow>/raw/<flow>[-<part>]-<locale>.mov` | — (archive + Drive) | — |

- **The CDN mirrors the app's routes.** `<route>` is the page the flow films, from the flow's
  `export const route` (`students`, `teachers`, `school/bulk`, …; `/` is the namespace root):
  `cdn.databayt.org/hogwarts/students/add-student-created-ar-1600.3a9f1c2e.avif`. Images and videos
  sit flat in that folder; the flow name inside each file keeps two flows on one route apart.
- **Same name = overwrite.** A re-shoot or re-render replaces the file; never `-v2`, `-sim`,
  `-final` siblings. The `NN-` order prefix stays in the local file, leaves the id and the CDN
  name, and is kept as the manifest entry's `order` — the docs list stills by it, so inserting a
  step neither breaks a page nor reshuffles it. Step names say what is on screen (`list`, `map`, `review`, `created`).
- Every still also gets web derivatives in `derived/`: `<stem>-{1600,2400}.{avif,webp}` (UI text
  stays crisp at 4:4:4); a narrower master (an iPhone's 1179 px) ships at its native width. The PNG
  master is oxipng'd in place. `--no-derive` skips this.
- Tutorials are **Arabic-only**: a sim drives the `/ar` app and captions in Arabic. `FlowMedia`
  shows the Arabic video on English pages.

## CDN — publish a flow in one command

```
node ~/.claude/skills/shoot/scripts/publish.mjs --flow add-student [--lang ar,en] [--only stills|video] [--dry-run]
node ~/.claude/skills/shoot/scripts/publish.mjs --flow page                                # page stills
node ~/.claude/skills/shoot/scripts/shoot.mjs --flow add-student --lang ar,en --publish   # shoot, then publish the stills
```

- Every asset in the flow folder goes through `media.sh publish`: content-hashed immutable keys
  (table above), each URL HEAD-verified, then upserted into the product manifest under its id.
  A re-render is a new URL; nothing is invalidated.
- Namespace and manifest come from `content/media/brand-kit.json → production.<brand>.{cdn,manifest}`
  — `cdn` is always the repo (`hogwarts`, also for the balqalam brand), manifest
  `src/components/docs/media-manifest.json`.
- A flow module carries its metadata: `export const route` (the CDN folder), `title = [ar, en]`,
  `alt = { <step>: [ar, en] }` (a step with no alt falls back to «title — step»), and `block` /
  `paths` — publish stamps them into `~/media/manifest.json` so `record.sh stale` flags a still
  whose source changed.
- Then commit the product's manifest on its `main` (the only file that changes there) and use
  `<Shot id="add-student/created-ar" />` / `<TutorialVideo id="add-student/video-ar" />` /
  `<FlowMedia flow="add-student" />` in MDX.

## Hosts + login

- Default `https://demo.balqalam.com`, the demo tenant. Its role picker is password-less,
  so `--role` picks the account (admin by default; order = `DEMO_ROLE_KEYS` in hogwarts
  `src/components/auth/login/demo-accounts.ts`).
- Marketing home: `--host https://balqalam.com`.
- Before shooting `localhost:3000`, check which repo owns the port
  (`lsof -ti tcp:3000` → `lsof -p <pid> -a -d cwd`). On 2026-10-06 it was serving `~/space`.

## Flows — write once, re-shoot forever

A flow is a file: `flows/<repo>/<flow>.mjs`, canonical in kun. A leading `_` marks a shared
helper, not a flow (`_bulk.mjs` drives both bulk flows).

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
- **Phone**: `--device iphone-16` (any Playwright device name, dashed) shoots in WebKit, Safari's engine,
  at the page area under Safari's bars (393x659 @3x, touch, iOS UA) into `<flow>/iphone-16/`. The phone is a
  returning visitor (the add-to-home-screen sheet is pre-dismissed); flows get `device` and skip the Mac
  Finder stills. First run on a new Playwright: `node ~/.local/share/databayt/media/node_modules/playwright-core/cli.js install webkit`.
  Labels come from the product dictionaries via `t()`, e.g.
  `t("التالي", "Next")` from `school.students.wizard.next`.
- Name each step after what is on screen (`list`, `form`, `filled`, `saved`, `new-row`).
- Instant `fill()` is fine — these are stills.
- Export a `cleanup({ page, go })` that undoes what the flow creates; call it at the start
  (leftovers of a crashed run) and the end. `--flow <name> --cleanup` runs it alone.
- Locate by what the UI exposes — accessible names (`getByRole("combobox", { name: "الصف" })`),
  never nth-of-type. Unknown screen? Probe it first: dump visible inputs/buttons per step,
  then write the flow. Remember every `+` that opens a wizard creates a draft row.
- Existing flows (hogwarts): `bulk-student` / `bulk-teacher` (bulk page → Finder on the CSV →
  columns matched → review → import finished with logins → history; 6 shots each). The CSVs are
  fictional (`assets/hogwarts/make-sheets.mjs`: DEMO- ids, +249 900 000 0xx, example.com), and
  cleanup is the product's own **Undo** on every finished import of that file. Each run leaves
  an «تم التراجع» row in the demo's import history; that is the product's record, not a leftover.
- `hogwarts/add-student` (list → documents → Finder on the photo → photo uploaded →
  Finder on the CV → CV uploaded → personal → father → address → academic → created; 12 shots).
  `hogwarts/add-teacher` (list → information → filled → expertise → subjects picked → contact →
  address → employment → created; 9 shots). Blurs seeded emails too (real providers); the take's
  own are `@example.com`. From hogwarts 162c8b891 Create opens on documents (one more still).
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
  `~/media/<repo>/<flow>/<flow>-ar.mp4`.
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
  fonts and the mark from `content/media/brand-kit.json → production` (the hogwarts repo renders as
  `balqalam`, Clay). Fonts come from `~/Library/Fonts`.
- **Deliverables**, one file each, overwritten (never `-v2`):
  - into `~/media/<repo>/<flow>/`: `<flow>-ar.mp4` (H.264), `<flow>-ar.av1.mp4`, `<flow>-ar.poster.webp`, `<flow>-ar.vtt`
  - reel: `<flow>-ar.reel.mp4`. 1080×1920 with a brand band, a square camera, captions inside the
    safe area; a flow over 58 s plays uniformly faster to fit.
  - support clip: `<flow>-<clip>-ar.*` (`--steps a-b --name <clip>`; a bare clip name gets the flow
    prefixed). Never truncated; qa-pack flags anything over 30 s.
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
  **Git-ignored**: kun is public and the photo's licence is unverified. Abdout signed off on showing
  this photo in the tutorials (2026-10-10) — media-qa notes it, never fails a render on it. Never a real child's photo
  from the web; AI image generation needs a paid Gemini tier (free tier = 0 images/day).
- Happy-path data: section «الصف الأول - أ» (has a timetable; «الصف A-1» raises a warning toast).
  Toasts are tutorial TIPS («نصيحة») — never fake product notifications.
- Found by sims, fixed in hogwarts 2026-10-06: Arabic file names failed every S3 upload (header
  metadata), and document slots refused photos. Sims are QA — report what they hit.

## Story — the stills, narrated, per screen (no captions)

```
node ~/.claude/skills/shoot/scripts/story.mjs --flow add-student --device mac    --cut support
node ~/.claude/skills/shoot/scripts/story.mjs --flow add-student --device iphone --cut ad
   [--tts-model gemini-3.8-flash-lite-tts] [--preview 1.2,6] [--script variant.json]
```

- Script: `sims/<repo>/<flow>.story.json` — voice + per-cut `style` and `beats` (`{shot|card, say}`).
  A beat names a still by its step; a still the device never shot (Finder on iPhone) drops out.
- `mac` = 2560x1600 (fills a MacBook): the still in a browser window on the brand canvas.
  `iphone` = 1080x2340 (fills an iPhone 16): status bar + Safari page + bottom bar, from
  `shoot --device iphone-16` stills. Cuts: `support` (calm walkthrough), `ad` (≤30 s, upbeat).
- Voice = a stock Google voice (`voice gen` engine `gemini`, Interactions API, `speech_metadata`
  style — never directions in the text, they get read aloud). **Free tier: 10 requests/day per
  model** — a whole cut goes in ONE request, split at long pauses; lines cache by text, so
  mac + iphone share a cut's voice and re-renders cost nothing. Diacritics steer it: بِالقَلَم, اخترْ.
- The voice sets the clock (beat = line + breath); no captions, a `.vtt` sidecar for accessibility.

## Close

Read every PNG before reporting it done. Send the key ones with `SendUserFile` and give
the folder path. A wrong-looking frame means recapture, never a pixel edit.
