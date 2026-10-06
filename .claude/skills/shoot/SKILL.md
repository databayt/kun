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
- `public/` is served publicly once that folder is committed and deployed (`balqalam.com/screenshot/…`).

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

- `go(path)` navigates and logs in if asked. `shot(step)` settles (network idle, fonts,
  800 ms) then saves the next numbered still. `page` is Playwright.
- Name each step after what is on screen (`list`, `form`, `filled`, `saved`, `new-row`).
- Instant `fill()` is fine — these are stills.
- Export a `cleanup({ page, go })` that undoes what the flow creates; call it at the start
  (leftovers of a crashed run) and the end. `--flow <name> --cleanup` runs it alone.
- Locate by what the UI exposes — accessible names (`getByRole("combobox", { name: "الصف" })`),
  never nth-of-type. Unknown screen? Probe it first: dump visible inputs/buttons per step,
  then write the flow. Remember every `+` that opens a wizard creates a draft row.
- Existing flows: `hogwarts/add-student` (list → documents → personal → father → address →
  academic → created dialog → new row; 9 shots).

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
- Preview frames first, read them, then render (~4 min for 48 s). Output beside the shots:
  `<repo>/public/screenshot/<flow>/<flow>-ar.mp4`.
- Keep focus zoom ≤ 2.2× and frame small targets with their neighbours, or the shot is grey.
- Claims in captions must match what the shots show (count of steps, what is required).

## Sim — the tutorial video: the real flow, filmed as a human, directed into ONE file

The real wizard on the demo, driven like an admin: an on-page cursor glides and clicks (green
ripple), every field is filled in reading order (RTL), text typed key by key, dropdowns and the
native month/year selects opened and picked, uploads through a simulated macOS Finder "Open"
sheet (Downloads → file → Open) then the real upload. Recorded headless at the Mac frame at full
Retina (`--force-device-scale-factor=2.5`, or CDP screencast drops to CSS size). A director pass
then composes, per output frame: intro card → the take in a window with a smooth camera zooming
onto the fields being filled → numbered captions in a band BELOW the window (never over a field)
→ tip toasts → outro card. Frozen server waits are trimmed to 1.2 s; typing and `sim.wait` keep
real time.

```
node ~/.claude/skills/shoot/scripts/sim.mjs --flow add-student            # take + direct (~10 min)
node ~/.claude/skills/shoot/scripts/sim.mjs --flow add-student --direct-only   # re-compose the saved take
```

- **One file, overwritten:** `<repo>/public/screenshot/<flow>/<flow>-ar.mp4`. Never sibling
  variants (Abdout, 2026-10-06). The take lives in `~/.cache/shoot-sim/<repo>-<flow>/`.
- Sim files: `sims/<repo>/<flow>.mjs` — `meta` (intro/outro text), `default async (sim)`,
  `prepare`, `cleanup`. API: `sim.caption(n, text)` · `sim.toast(text)` · `sim.focus(loc | [locs] | null, { z })`
  (camera; the zoom is fitted in the director, so `--direct-only` can re-tune it) · `sim.click` ·
  `sim.type(loc, text, { cps })` · `sim.pick(trigger, name | index)` · `sim.select(nativeSelect, value)` ·
  `sim.upload(trigger, sim.asset("…png"), { name, decoys })` · `sim.move` · `sim.wait(ms)`.
- Frame the FIELDS being filled (an array of locators), not `<form>` — a whole form puts the
  active field at the window edge. Full-width rows: frame their start (name + one cell).
- Never upload to a slot that fires paid AI extraction (hogwarts document tiles); the photo circle
  is safe. Upload drawn assets from `assets/`, never a real person's photo.
- Pick happy-path data (hogwarts: section «الصف الأول - أ» has a timetable; «الصف A-1» raises a
  warning toast). Toasts are tutorial TIPS («نصيحة») — never fake product notifications.

## Close

Read every PNG before reporting it done. Send the key ones with `SendUserFile` and give
the folder path. A wrong-looking frame means recapture, never a pixel edit.
