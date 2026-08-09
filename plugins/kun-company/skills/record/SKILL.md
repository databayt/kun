---
name: record
description: Screen-record demo videos and screenshot sets of real product flows, filed by repo/block/route and mirrored to Google Drive
when_to_use: "Use when a REAL product flow or block needs capturing off the screen — demo/walkthrough videos or route screenshot sets, re-records after UI changes, Drive sync. Handles login walls + email OTPs. Not /screenshot (views an existing capture) or /higgs (generates media). Triggers on: record video for <flow>, record <block>, demo video, walkthrough, screen recording, re-record, sync media to drive, سجل فيديو, تسجيل الشاشة."
argument-hint: "[block|flow|url] [--repo <repo>] [--locale ar|en] [--shots-only]"
---

# Record — capture the real product

Film and photograph databayt products as they actually run — signup flows, onboarding
wizards, block features — and file every asset into one organized library that mirrors
to Google Drive. The library is the **product-truth archive** keyed by repo/block/route;
anything destined for marketing or social goes through `/higgs` + the showroom
(`/social/media`) as before — never file generated media here.

Technique proven 2026-08-08 recording the hogwarts school-onboarding flow on prod
(origin: hogwarts memory `project_demo_video_recording_otp_2026_08_08`).

## The machinery

CLI: `bash ~/.claude/scripts/record.sh <cmd>` (canonical copy in kun).

| Command           | Does                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `init` / `status` | Create/inspect the library (`~/media/`)                                 |
| `frame`           | Size Chrome to 1512x982, dismiss the automation infobar                 |
| `start [name]`    | Begin a recording SEGMENT (`screencapture -v`, backgrounds itself)      |
| `stop`            | End the segment with SIGINT + `ffprobe` verify                          |
| `shot <name>`     | Full-screen still (browser-viewport shots: use the browser MCP instead) |
| `otp`             | Screenshot the Outlook desktop inbox → Read the image for the code      |
| `assemble <name>` | Concat pending segments into one .mov                                   |
| `file <src> …`    | Normalize name → move into library → update `manifest.json`             |
| `sync`            | Mirror library → Google Drive (rsync → Finder → printed fix)            |
| `stale [repo]`    | List assets whose block source gained commits since capture             |

## Identity, credentials, OTP

- **Fresh identity per take**: signup Zod accepts `+` aliases — use
  `osmanabdout+<take-slug>@hotmail.com`; Outlook delivers to the same inbox. Never reuse
  an alias: prior takes leave users/schools on prod that collide (known leftover:
  `osmanabdout+comboni@hotmail.com`, school `cmsjsr75p0002l404ugypes06`).
- **Hotmail/Outlook OTP** — the desktop-app screenshot lane (`record.sh otp`):
  `osmanabdout@hotmail.com` is signed into the Outlook **desktop app**; activate it and
  read the code off a screenshot. Dead ends, all verified — don't retry them:
  AppleScript can't read New Outlook's mailbox (its `inbox` is the legacy store, 0
  messages); the MCP Chrome profile has web Outlook logged OUT; no usable Keychain
  password. If Outlook has no window, reopen via Dock:
  `tell application "System Events" to tell process "Dock" to click UI element "Microsoft Outlook" of list 1`.
  Codes are **4 digits** (30-min expiry) — don't wait for 6.
- **Gmail OTP** — for flows using a Gmail identity: the Gmail MCP
  (`search_threads` newest-first → `get_message`) reads codes without any screen work.
  Note it's a claude.ai connector — absent in headless runs; fall back to the browser.
- **Any other login wall** → `/auth` (Keychain identities, Safari autofill) and
  `/credentials`. Never type a password into chat or a recorded frame.

## Browser lanes — pick ONE per take

- **chrome-devtools MCP** (real Google Chrome) — the proven lane for fresh-session
  flows (signup, onboarding). Window sizing works via
  `tell application "Google Chrome" to set bounds of window 1 to {0,0,1512,982}`
  (`System Events set size` throws -1719 here). Screenshots with relative filenames
  land in the REPO ROOT — always pass absolute paths into `_work/`.
- **browser / browser-headed MCP** (Playwright, `~/.playwright-auth` profile) — carries
  SAVED logins; use for flows that need an existing session (dashboards, admin).
- **Never mix lanes mid-take** — cookies and window geometry differ; a lane switch
  reads as a cut and breaks the session on camera.
- **Typing feel**: CDP `fill` populates fields INSTANTLY — footage reads as automated.
  For human-feel demos, focus the field then type with `cliclick t:<text>` (cliclick
  coords are LOGICAL points = screenshot pixels ÷ 2 on this Retina display). Decide
  before the take; per-field mixing looks worse than either.

## Procedure

### 1. Prep

1. Resolve scope: a named flow (`record video for school onboarding`), a block
   (`record admission` → routes from the repo's `.claude/blocks.json` `blocks[b].routes`,
   discover via `src/app/**/page.tsx` stripping `[lang]`/`s/[subdomain]`/groups if
   missing), or one URL. Default locale **ar**; capture en too when the flow is bilingual.
2. Target prod for client-facing demos (balqalam.com, ed.databayt.org); dev for
   pre-release captures. Note which — it goes in the manifest URL.
3. `record.sh init` (idempotent) · `record.sh frame` · **zoom the browser to 125%**
   (cmd+= twice from 100%; verify `devicePixelRatio` reads 2.5 on this Retina display)
   — ad footage must read large. Ask Abdout to enable Do Not Disturb (no automation
   shortcut exists on this Mac) and to keep the screen free.
4. **Set dressing — benchmark every page that will be on camera BEFORE rolling.**
   These are ADS: the first screen sells. Walk the shot's pages and fix blemishes:
   junk rows (nameless drafts, test entries → archive them), empty states, broken
   images, debug text, sparse tables. If the data looks poor, improve it first —
   never film an ugly benchmark. What can't be fixed gets reframed out of the shot.
5. Plan the take as a **shot list** (steps, where OTP lands, expected screens) BEFORE
   rolling — a fumbled step costs one segment, an unplanned take costs the session.

### 2. Capture

**Video (flows)** — record in SEGMENTS so the inbox never appears on camera:

```
record.sh start intro        # segment 1: landing → signup form → submit
… drive the browser …
record.sh stop
record.sh otp                # NOT recording now; Read the image → extract 4-digit code
record.sh start verify      # segment 2: enter code → continue the wizard
… drive …
record.sh stop
record.sh assemble onboarding-flow--ar
```

`stop` uses SIGINT — a plain kill leaves the .mov unfinalized. `otp` refuses to run
while recording, by design.

**Screenshots (blocks/routes)** — for each route: navigate, wait for settle, capture
via the browser MCP (`browser_take_screenshot` / `take_screenshot`) with an ABSOLUTE
path into `~/media/_work/`, both locales when relevant. `record.sh shot` is
only for desktop-context stills.

### 3. File — the naming convention

`record.sh file <src> --repo <repo> --block <block> --url <real-url> [--kind flow] [--locale ar] [--note …]`

Every asset lands as:

```
~/media/<repo>/<block>/<repo>--<block>--<url-slug>--<kind>--<locale>--v<N>.<ext>
   hogwarts/onboarding/hogwarts--onboarding--onboarding-title--shot--ar--v1.png
   hogwarts/students/hogwarts--students--students--flow--ar--v2.mov
```

The repo + block ride IN the filename on purpose — the designation survives when the
file leaves its folder (Drive links, chat attachments, client handoffs).

- **url-slug** derives from the URL path — scheme/host, locale prefix, and
  `/s/<subdomain>` are stripped (`https://balqalam.com/ar/onboarding/x/title` →
  `onboarding-x-title`); root = `home`. Directories are repo (= brand) then block.
- **kind**: `shot` (still) | `clip` (segment worth keeping alone) | `flow` (assembled
  walkthrough). Extension decides the default.
- **vN** auto-increments; old versions stay in place (the manifest carries dates —
  no archive dirs).
- The manifest records repo, block, url, sha (repo HEAD at capture), capturedAt, note
  — that sha is what staleness is measured against.

### 3½. Ad cut — flows ship blazing fast

Raw captures are minutes; **the deliverable is an ad: 15-45 seconds**. Render with
`record.sh adcut <raw> <out> [--target 30] [--tail 3]` — it speeds the body to hit
the target and keeps the last seconds real-time so the payoff (the new row, the
success state) is readable. File the AD as the flow asset; keep the raw only if a
slower walkthrough was explicitly requested. Instant field-fills are FINE for ads —
at ad speed they read as snappy, so prefer the fast fill lane over human typing.

### 4. Sync to Google Drive

`record.sh sync` mirrors the library to **My Drive/databayt/media** (account
`osmanabdout.jr@gmail.com`, Drive desktop must be running). It cascades: direct rsync
(needs the terminal app in System Settings → Privacy & Security → **Full Disk Access**)
→ Finder AppleScript copy (needs one-time "control Finder" Automation approval) →
prints the fix if both are blocked. The local library is always the truth; a blocked
sync loses nothing.

### 5. Verify + close

- Play the assembled .mov (`open <file>`) or Read filed screenshots — confirm no inbox
  frames, no notification banners, right locale.
- `record.sh status` — assets filed, sync stamp.
- If the repo's block protocol is active, note the new/refreshed assets in the block's
  ISSUE.md or the related GitHub issue.
- Clean up what the take created on prod when feasible (test school/user), or record
  the leftover in the repo memory so the next take avoids the collision.

## Iterate — re-record and fine-tune

- **Staleness is automatic**: the `session-media-stale` SessionStart hook nudges when a
  repo's filed blocks gained commits since capture; `record.sh stale [repo]` lists the
  detail. Re-recording files the same slug as vN+1.
- **Fine-tune a video without a retake**: trim/splice segments with ffmpeg
  (`ffmpeg -i in.mov -ss 0:04 -to 1:32 -c copy out.mov`), then `file` the result as the
  next version. Fine-tune a SCREENSHOT by recapturing the route — never edit pixels of
  product truth.
- **Sweep a whole brand**: loop the repo's blocks.json blocks, screenshots per route,
  flow videos for the journeys that matter (onboarding, admission, checkout). Sweeps
  are SERIAL by nature — one screen, one recorder — which is why there is deliberately
  no Workflow-tool fan-out here; plan the order, then work the list in-session.

## Gotchas (all verified, don't rediscover)

- `screencapture -v` stops with **`kill -INT` only**; segments concat losslessly
  (`-c copy`) because they share the codec.
- record.sh writes OUTSIDE the project (`~/media`) and drives screen capture —
  run its capture/library commands through the **non-sandboxed** shell or they fail
  on "Operation not permitted".
- **cliclick, not `System Events click at`** (-609 Connection invalid); Retina ÷2.
- Chrome's "controlled by automated test software" infobar HAS a close button —
  `record.sh frame` best-efforts it; verify it's gone before rolling.
- **If the browser MCP dies mid-session** (tools deregister; they cannot come back until
  restart): relaunch the SAME profile manually — `open -na "Google Chrome" --args
--user-data-dir=~/.cache/chrome-devtools-mcp/chrome-profile --use-mock-keychain
--password-store=basic --disable-sync …` (omitting mock-keychain loses the cookies) —
  and drive pages with Chrome AppleScript `execute javascript` (one-time enable:
  `browser.allow_javascript_apple_events=true` in the profile's Default/Preferences,
  edited with Chrome DOWN; the View-menu toggle via System Events does not stick).
  React inputs need the native value setter + an `input` event; browser-chrome popups
  (Save password → Never) are cliclick-only; autofill dropdowns EAT the Tab key
  (press Escape first); cliclick keystrokes silently vanish if the window lost focus —
  activate + wake-click before typing.
- `screencapture -v` is VARIABLE frame rate — still stretches are one long frame, so
  `-c copy` trims cannot cut inside them. Final cut = ffmpeg concat FILTER + `fps=30`
  re-encode; never stream-copy the edit.
- Park the cursor AFTER your last cliclick, not before. Verify success by what the UI
  RENDERS (the students table shows "first last", not the full three-part name — an
  innerText check for the typed full name false-negatives).
- Web Outlook in the MCP Chrome profile is logged OUT — the desktop app is the lane.
- Screen-recording permission is already granted to the terminal host; Drive-folder
  writes are TCC-blocked until one of the two sync fixes above is applied.
- The dev-server route table goes stale after hours up — restart before recording dev.
