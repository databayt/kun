#!/usr/bin/env node
// sim.mjs — film a REAL product flow as a human would do it, then direct it into finished video.
//
// Take:     the real app on the demo, driven like an admin — an on-page cursor glides and clicks,
//           text is typed key by key, dropdowns open and options are picked, uploads go through a
//           simulated macOS Finder "Open" window (finder.mjs) and then the real upload. Recorded
//           headless at Abdout's Mac frame (1210x686 CSS @ DPR 2.5 = Chrome 125%) via CDP screencast;
//           every frame and every event keeps its wall-clock time.
// Director: re-composes the take frame by frame — intro card, a smooth camera that zooms into the
//           field being filled, numbered captions, tip toasts, outro card — in the BRAND's colours and
//           type (content/media/brand-kit.json → production), optionally narrated by the consented
//           house voice, and delivers through the shared media library (edit/scripts/media.sh).
//
//   node sim.mjs --flow add-student [--repo hogwarts] [--brand balqalam] [--host url] [--role admin]
//                [--out <dir|file.mp4>] [--speed 1] [--direct-only] [--workers 3]
//                [--voice ar] [--aspect 9:16] [--steps 2-3 --name add-student-photo]
//                [--draft] [--preview 5,30,60]
//
//   --direct-only   re-compose the last take (camera, captions, toasts, voice) without driving the app
//   --voice ar      narrate from sims/<repo>/<flow>.voice.ar.json (one line per sim.caption, in order);
//                   no consented voice → captions-only, never a failed render
//   --aspect 9:16   vertical reel: brand band, square camera window, captions inside the safe area
//   --steps a-b     support clip of caption steps a..b from the same take (name it with --name)
//   --draft         960x540 @15fps via VideoToolbox, for timing checks only
//   --preview t,…   write PNG frames at those output times and stop
//
// Delivers (one file per deliverable, overwritten every run — never -v2 siblings), <stem> = <flow>-ar | <name>-ar:
//   <stem>.mp4 (H.264, plays everywhere) · <stem>.av1.mp4 · <stem>.poster.webp · <stem>.vtt
//   9:16 → <stem>.reel.mp4 · draft → <stem>.draft.mp4
// Sim file: ../sims/<repo>/<flow>.mjs → `default async (sim)`, optional `prepare`, `cleanup`, `meta`.

import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { OVERLAY as OVERLAY_SRC } from "./finder.mjs"
import { brand as brandOf, FFMPEG, requireRt } from "../../edit/scripts/media/rt.mjs"

const args = process.argv.slice(2)
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d)
const has = (k) => args.includes(`--${k}`)
const flowName = opt("flow")
if (!flowName) {
  console.log("usage: sim.mjs --flow <name> [--repo] [--brand] [--host] [--role] [--out] [--speed] [--direct-only] [--workers 3] [--voice ar] [--aspect 9:16] [--steps a-b --name stem] [--draft] [--preview t,…]")
  process.exit(0)
}
const repo = opt("repo", "hogwarts")
const REPO_BRAND = { hogwarts: "balqalam", mkan: "mkan", kun: "kun", marketing: "databayt" }
const B = brandOf(opt("brand", REPO_BRAND[repo] || repo))
const V = B.video
const host = opt("host", B.hosts?.demo || B.hosts?.prod || "https://demo.balqalam.com").replace(/\/$/, "")
const role = opt("role", "admin")
const speed = Number(opt("speed", "1"))
const workersN = Math.max(1, Number(opt("workers", "3")))
const portrait = opt("aspect", "16:9") === "9:16"
const draft = has("draft")
const previewAt = opt("preview")?.split(",").map(Number)
const steps = opt("steps")?.split("-").map(Number)
const clipName = opt("name")
const voiceLang = opt("voice")
const here = dirname(fileURLToPath(import.meta.url))
const MEDIA = join(here, "../../edit/scripts/media.sh")
const outArg = opt("out", join(homedir(), repo, "public/screenshot", flowName))
const outDir = outArg.endsWith(".mp4") ? dirname(outArg) : outArg
const stem = outArg.endsWith(".mp4") ? basename(outArg, ".mp4") : `${clipName || flowName}-ar`
const base = join(outDir, stem)
const work = join(homedir(), ".cache/shoot-sim", `${repo}-${flowName}`)
let chromium
try {
  ;({ chromium } = requireRt("playwright-core"))
} catch {
  ;({ chromium } = createRequire(join(homedir(), repo, "package.json"))("@playwright/test"))
}
const DEMO_ROLES = ["admin", "teacher", "student", "guardian", "accountant", "staff", "user", "applicant"]
const VW = 1210, VH = 686, DPR = 2.5
// the click ripple wears the brand accent
const OVERLAY = OVERLAY_SRC.replaceAll("#00bc6e", V.accent)

const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])
const fromAR = (s) => Number(String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)))
const now = () => Date.now() / 1000
const jitter = (a, b) => a + Math.random() * (b - a)

// ───────────────────────── the take ─────────────────────────
const directOnly = has("direct-only") || !!previewAt
const simFile = join(here, "..", "sims", repo, `${flowName}.mjs`)
if (!existsSync(simFile)) throw new Error(`no sim at ${simFile}`)
const mod = await import(pathToFileURL(simFile).href)
const meta = { title: "", sub: "", outro: "", outroSub: "", ...(mod.meta ?? {}) }
let frames = [], events = [], keeps = [], end = 0

if (directOnly) {
  if (!existsSync(join(work, "take.json"))) throw new Error(`no take at ${work} — run once without --direct-only`)
  ;({ frames, events, keeps, end = 0 } = JSON.parse(readFileSync(join(work, "take.json"), "utf8")))
} else {
  rmSync(work, { recursive: true, force: true }); mkdirSync(join(work, "frames"), { recursive: true })
  // Without the forced scale factor, CDP screencast frames come out at CSS size (1210 px) and zooms go soft.
  const browser = await chromium.launch({ args: [`--force-device-scale-factor=${DPR}`] })
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: "ar", timezoneId: B.timezone || "Africa/Khartoum" })
  await ctx.addInitScript(OVERLAY)
  const page = await ctx.newPage()

  let cdp = null, recording = false
  const pending = new Set()   // frames are written asynchronously so the screencast never stalls on disk
  async function startRec() {
    cdp = await ctx.newCDPSession(page)
    cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
      if (recording) {
        const f = join(work, "frames", `${String(frames.length).padStart(6, "0")}.jpg`)
        frames.push({ f, w: now() })
        const p = writeFile(f, Buffer.from(data, "base64")).finally(() => pending.delete(p))
        pending.add(p)
      }
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
    })
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: VW * DPR, maxHeight: VH * DPR, everyNthFrame: 1 })
    recording = true
  }
  async function stopRec() { recording = false; await cdp.send("Page.stopScreencast").catch(() => {}); await Promise.all([...pending]) }

  async function settle() {
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await page.waitForTimeout(400)
  }
  async function go(p) {
    const url = /^https?:/.test(p) ? p : host + p
    await page.goto(url, { waitUntil: "load", timeout: 90000 }); await settle()
    const trigger = page.locator("#demo-role")
    if (await trigger.isVisible().catch(() => false)) {
      const idx = DEMO_ROLES.indexOf(role)
      if (idx > 0) { await trigger.click(); await page.getByRole("option").nth(idx).click() }
      await page.locator("#demo-role ~ button, button:has-text('دخول')").first().click()
      await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60000 }).catch(() => {})
      const got = (await ctx.cookies()).find((c) => c.name === "authjs.role")?.value
      if (got && got.toLowerCase() !== role.toLowerCase()) throw new Error(`logged in as ${got}, wanted ${role} — DEMO_ROLES drifted`)
      await page.goto(url, { waitUntil: "load", timeout: 90000 }); await settle()
    }
  }
  async function rectOf(locator) {
    const els = Array.isArray(locator) ? locator : [locator]
    const bs = (await Promise.all(els.map((l) => l.first().boundingBox().catch(() => null)))).filter(Boolean)
    if (!bs.length) return null
    const x1 = Math.min(...bs.map((b) => b.x)), y1 = Math.min(...bs.map((b) => b.y))
    const x2 = Math.max(...bs.map((b) => b.x + b.width)), y2 = Math.max(...bs.map((b) => b.y + b.height))
    return { x1, y1, x2, y2 }
  }
  async function center(locator) {
    await locator.scrollIntoViewIfNeeded().catch(() => {})
    const b = await locator.boundingBox(); if (!b) throw new Error("not on screen: " + locator)
    return { x: b.x + b.width / 2 + jitter(-b.width * .1, b.width * .1), y: b.y + b.height / 2 + jitter(-2, 2) }
  }

  const sim = {
    page, go, settle,
    /** An intentional pause — kept in real time (server waits are trimmed, these are not). */
    async wait(ms) { const a = now(); await page.waitForTimeout(ms / speed); keeps.push([a, now()]) },
    caption(n, text) { events.push({ t: now(), type: "caption", n: n ? AR(n) : "", num: n || 0, text }) },
    toast(text, { title = "نصيحة", ms = 3400 } = {}) { events.push({ t: now(), type: "toast", title, text, ms }) },
    /** Camera: zoom onto a locator (or several, framed together); null = back to the full screen. */
    async focus(locator, { z, pad = 24 } = {}) {
      if (!locator) { events.push({ t: now(), type: "cam", cx: VW / 2, cy: VH / 2, z: 1 }); return }
      const r = await rectOf(locator); if (!r) return
      // the rect is kept so the director can re-fit the zoom (--direct-only) without a new take
      events.push({ t: now(), type: "cam", r, pad, zFix: z ?? null })
    },
    async move(locator) {
      const p = await center(locator)
      const from = await page.evaluate(() => { const c = document.getElementById("__cur"); return { x: parseFloat(c?.style.left) || 0, y: parseFloat(c?.style.top) || 0 } })
      const ms = Math.min(1000, 360 + Math.hypot(p.x - from.x, p.y - from.y) * .85) / speed
      await page.evaluate(([x, y, ms]) => window.__simMove(x, y, ms), [p.x, p.y, ms])
      await page.mouse.move(p.x, p.y); return p
    },
    async click(locator, { pause = 420 } = {}) {
      const p = await sim.move(locator); await page.waitForTimeout(jitter(150, 260) / speed)
      await page.evaluate(([x, y]) => window.__simRipple(x, y), [p.x, p.y]); await page.mouse.click(p.x, p.y)
      await sim.wait(pause)
    },
    async type(locator, text, { cps = 9 } = {}) {
      await sim.click(locator, { pause: 220 })
      const a = now()
      for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout((ch === " " ? jitter(140, 260) : jitter(600 / cps, 1500 / cps)) / speed) }
      keeps.push([a, now()]); await sim.wait(420)
    },
    /** Open a dropdown, glide over the options, pick one (name or index). */
    async pick(trigger, option) {
      await sim.click(trigger, { pause: 480 })
      const opt = typeof option === "string" ? page.getByRole("option", { name: option }) : page.getByRole("option").nth(option ?? 0)
      await sim.move(page.getByRole("option").first()); await sim.wait(220)
      await sim.click(opt.first(), { pause: 520 })
    },
    /** Native <select>: click it like a user, then choose (the OS menu itself is never rendered headless). */
    async select(locator, value) { await sim.click(locator, { pause: 380 }); await locator.selectOption(value); await sim.wait(420) },
    /** Upload through a simulated macOS Finder window: Downloads → file → Open → the real upload. */
    async upload(trigger, file, { files }) {
      const chooserP = page.waitForEvent("filechooser", { timeout: 15000 })
      await sim.click(trigger, { pause: 150 })
      const chooser = await chooserP
      const list = files.map((f) => ({ name: f.name, thumb: "data:image/jpeg;base64," + readFileSync(f.path).toString("base64") }))
      await page.evaluate((list) => window.__finderOpen(list), list)
      await sim.wait(600)
      const inDownloads = await page.locator("#__fd [data-k=downloads].sel").count()
      if (!inDownloads) await sim.click(page.locator("#__fd [data-k=downloads]"), { pause: 600 })
      const pick = files.find((f) => f.path === file)
      await sim.click(page.locator(`#__fd .f[data-f="${pick.name}"]`), { pause: 450 })
      await sim.click(page.locator("#__fd [data-k=open]"), { pause: 120 })
      await page.evaluate(() => window.__finderClose())
      // upload under the Finder name, so storage and the product see what the admin picked
      await chooser.setFiles({ name: pick.name, mimeType: "image/jpeg", buffer: readFileSync(file) }); await sim.wait(1800)
    },
    asset: (n) => join(here, "..", "assets", n),
  }

  try {
    if (mod.cleanup) await mod.cleanup(sim)
    if (mod.prepare) await mod.prepare(sim)
    await startRec()
    await mod.default(sim)
    await sim.wait(1200)
    await stopRec()
    end = now()
  } finally {
    if (mod.cleanup) await mod.cleanup(sim).catch((e) => console.warn("cleanup:", e.message))
    await browser.close()
  }
  writeFileSync(join(work, "take.json"), JSON.stringify({ frames, events, keeps, end }))
}
for (const e of events) if (e.type === "caption" && e.num === undefined) e.num = fromAR(e.n)
console.log(`take: ${frames.length} frames, ${events.length} events`)

// ───────────────────────── the director: timeline ─────────────────────────
// Source timeline → output timeline: a frozen screen holds at most HOLD seconds unless the gap falls
// inside an intentional pause (typing, sim.wait). `holds` adds seconds onto the frame just before a
// source time — how narration gets room without ever stretching audio.
const HOLD = 1.2, FPS = draft ? 15 : 30, INTRO = 3.2, OUTRO = 3.8, XF = 0.5
// a sped-up reel samples the timeline faster; tips stretch by the same factor so they stay readable
let TK = 1
const kept = (a, b) => keeps.some(([s, e]) => a < e && b > s)
const LAYOUT = portrait
  ? { W: 1080, H: 1920, WIN: { x: 0, y: 340, w: 1080, h: 1080 } }
  : { W: 1920, H: 1080, WIN: { x: 0, y: 0, w: 1920, h: 1080 } }
const WIN = LAYOUT.WIN
const k0 = portrait ? WIN.h / VH : WIN.w / VW
const CAP_CSS = (z) => (portrait ? 0 : 170 / (k0 * z))   // landscape captions overlay the bottom strip
const ease = (x) => -(Math.cos(Math.PI * x) - 1) / 2   // sine in-out: no snap at either end
const CAM_T = 1.25
const lerpCam = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, z: a.z + (b.z - a.z) * k })

function build(holds = []) {
  let acc = 0
  const fr = frames.map((f) => ({ ...f }))
  for (let i = 0; i < fr.length; i++) {
    // the last frame runs to the end of the take: a closing wait is a still screen, not an idle gap
    const gap = (fr[i + 1]?.w ?? Math.max(fr[i].w + HOLD, end)) - fr[i].w
    fr[i].out = acc
    fr[i].dur = kept(fr[i].w, fr[i].w + gap) ? gap : Math.min(HOLD, gap)
    for (const h of holds) if (fr[i].w <= h.t && (fr[i + 1]?.w ?? Infinity) > h.t) fr[i].dur += h.d
    acc += fr[i].dur
  }
  const takeLen = acc
  const toOut = (w) => {
    const i = fr.findLastIndex((f) => f.w <= w); if (i < 0) return 0
    return fr[i].out + Math.min(w - fr[i].w, fr[i].dur)
  }
  const timeline = events.map((e) => ({ ...e, o: INTRO + toOut(e.t) }))
  // Fit: the framed rect (plus room for labels above fields) fills ~80% of the window, ≤ 1.9×.
  const fit = (e) => {
    if (!e.r) return { cx: e.cx ?? VW / 2, cy: e.cy ?? VH / 2, z: e.z ?? 1 }
    const top = e.r.y1 - e.pad - 26, w = e.r.x2 - e.r.x1 + 2 * e.pad, h = e.r.y2 + e.pad - top
    const vw = WIN.w / k0, vh = WIN.h / k0
    const z = e.zFix ?? Math.max(1, Math.min(1.9, (vw * .78) / w, (vh * .7) / h))
    return { cx: (e.r.x1 + e.r.x2) / 2, cy: (top + e.r.y2 + e.pad) / 2 + CAP_CSS(z) / 2, z }
  }
  const cams = [{ o: 0, cx: VW / 2, cy: VH / 2, z: 1 }, ...timeline.filter((e) => e.type === "cam").map((e) => ({ o: e.o, ...fit(e) }))]
  for (let i = 1; i < cams.length; i++) cams[i].from = lerpCam(cams[i - 1].from ?? cams[0], cams[i - 1], ease(Math.min(1, (cams[i].o - cams[i - 1].o) / CAM_T)))
  return { fr, takeLen, timeline, cams, total: INTRO + takeLen + OUTRO }
}

let T = build()
const captionsOf = (tl) => tl.timeline.filter((e) => e.type === "caption")

// ───────────────────────── voice (consent-gated, local) ─────────────────────────
let voice = null
if (voiceLang) {
  const scriptFile = join(here, "..", "sims", repo, `${flowName}.voice.${voiceLang}.json`)
  if (!existsSync(scriptFile)) throw new Error(`no voice script at ${scriptFile}`)
  const script = JSON.parse(readFileSync(scriptFile, "utf8"))
  const caps = captionsOf(T)
  if (script.lines.length !== caps.length) throw new Error(`voice script has ${script.lines.length} lines, the take has ${caps.length} captions — one line per sim.caption, in order`)
  const key = createHash("sha256").update(JSON.stringify(script)).digest("hex").slice(0, 10)
  const vdir = join(work, `voice-${key}`)
  const cached = existsSync(join(vdir, "voice.json")) && !JSON.parse(readFileSync(join(vdir, "voice.json"), "utf8")).captionsOnly
  if (!cached) {
    const r = spawnSync(MEDIA, ["voice", "gen", scriptFile, "--out", vdir], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] })
    if (r.status !== 0) throw new Error("voice gen failed")
  }
  voice = JSON.parse(readFileSync(join(vdir, "voice.json"), "utf8"))
  if (voice.captionsOnly) {
    console.warn(`voice: captions-only — ${voice.reason}`)
    voice = null
  } else {
    // room for each line: lead 0.25 s + the line + 0.4 s before the next caption
    const holds = []
    caps.forEach((c, i) => {
      const l = voice.lines[i]
      if (!l?.ok) return
      const nextO = caps[i + 1]?.o ?? INTRO + T.takeLen
      const need = 0.25 + l.duration + 0.4 - (nextO - c.o)
      if (need > 0) holds.push({ t: caps[i + 1]?.t ?? frames.at(-1).w, d: +need.toFixed(3) })
    })
    if (holds.length) {
      console.log(`voice: holding ${holds.length} frame(s) for ${holds.reduce((s, h) => s + h.d, 0).toFixed(1)}s so every line fits`)
      T = build(holds)
    }
  }
}

// ───────────────────────── render range ─────────────────────────
let takeEnd = INTRO + T.takeLen
let T0 = 0, T1 = T.total, clip = false
if (steps) {
  const caps = captionsOf(T)
  const a = caps.find((c) => c.num >= steps[0])
  const b = caps.find((c) => c.num > (steps[1] ?? steps[0]))
  if (!a) throw new Error(`no caption step ${steps[0]} in this take`)
  T0 = Math.max(INTRO, a.o - 0.3); T1 = b ? b.o : takeEnd; clip = true
}

function camAt(t) {
  const { cams } = T
  const i = cams.findLastIndex((c) => c.o <= t), c = cams[Math.max(0, i)]
  const s = i <= 0 ? cams[0] : lerpCam(c.from, c, ease(Math.min(1, (t - c.o) / CAM_T)))
  const hw = WIN.w / 2 / (k0 * s.z), hh = WIN.h / 2 / (k0 * s.z)
  return { ...s, cx: Math.max(hw, Math.min(VW - hw, s.cx)), cy: Math.max(Math.min(hh, VH / 2), Math.min(Math.max(VH - hh, VH / 2), s.cy)) }
}
// A tip lasts its duration (stretched in a sped-up reel) but never past the next step's caption:
// a tip about the map must not sit over the academic form.
function toastEnd(e) {
  const next = T.timeline.find((c) => c.type === "caption" && c.o > e.o)
  return Math.min(e.o + (e.ms / 1000) * TK, next ? next.o : Infinity)
}
function stateAt(t) {
  const tt = t - INTRO
  const fi = Math.max(0, T.fr.findLastIndex((f) => f.out <= tt))
  const cap = T.timeline.filter((e) => e.type === "caption" && e.o <= t).at(-1)
  const capSince = cap ? t - cap.o : 0
  const toasts = T.timeline.filter((e) => e.type === "toast" && t >= e.o && t < toastEnd(e))
    .map((e) => ({ title: e.title, text: e.text, a: Math.min(1, (t - e.o) / (.3 * TK), (toastEnd(e) - t) / (.3 * TK)) }))
  return {
    frame: "file://" + T.fr[Math.min(fi, T.fr.length - 1)].f, cam: camAt(t),
    cap: cap && tt < T.takeLen ? { n: cap.n, text: cap.text, a: Math.min(1, capSince / .35) } : null, toasts,
    intro: clip ? 0 : t < INTRO + XF ? Math.min(1, (INTRO + XF - t) / XF) : 0,
    outro: clip ? 0 : t > takeEnd - XF ? Math.min(1, (t - (takeEnd - XF)) / XF) : 0,
    introT: t,
  }
}
// identical state → identical pixels: reuse the last capture instead of painting again
const sig = (s) => JSON.stringify([s.frame, Math.round(s.cam.cx * 4), Math.round(s.cam.cy * 4), Math.round(s.cam.z * 1000),
  s.cap && [s.cap.n, s.cap.text, Math.round(s.cap.a * 50)], s.toasts.map((x) => [x.text, Math.round(x.a * 50)]),
  Math.round(s.intro * 100), Math.round(s.outro * 100), s.intro > 0 ? Math.round(s.introT * 20) : 0])

// ───────────────────────── the stage (brand-driven) ─────────────────────────
// Thmanyah is licensed for local use: read from ~/Library/Fonts, never copied into a repo.
const fontDir = join(homedir(), "Library/Fonts")
const fontSrc = (ttf, woff) => (existsSync(join(fontDir, ttf)) ? `file://${join(fontDir, ttf)}` : `file://${homedir()}/${repo}/public/fonts/thmanyah/${woff}`)
const logoPath = [B.logoPath, join(homedir(), repo, "public/logo.png")].find((p) => p && existsSync(p))
const logo = logoPath ? `file://${logoPath}` : ""
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }
const FONTS = `@font-face{font-family:S;src:url(${fontSrc("thmanyah-sans-500.ttf", "thmanyah-sans-500.woff2")});font-weight:500}
@font-face{font-family:S;src:url(${fontSrc("thmanyah-sans-700.ttf", "thmanyah-sans-700.woff2")});font-weight:700}
@font-face{font-family:D;src:url(${fontSrc("thmanyah-serif-display-900.ttf", "thmanyah-serif-display-900.woff2")});font-weight:900}`
const COMMON = `*{margin:0;box-sizing:border-box}html,body{width:${LAYOUT.W}px;height:${LAYOUT.H}px;overflow:hidden;background:${V.canvas};font-family:S;color:${V.ink}}
#win{position:absolute;left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${WIN.h}px;overflow:hidden;background:#fff}
#scr{position:absolute;left:0;top:0;width:${VW}px;height:${VH}px;transform-origin:0 0}
#cap .n{flex:none;border-radius:50%;background:${V.accent};color:#fff;display:grid;place-items:center;font-weight:700}
.toast{display:flex;gap:18px;align-items:flex-start;background:#fff;border-radius:20px;border:1.5px solid ${hexA(V.ink, .12)};box-shadow:0 8px 28px ${hexA(V.ink, .1)}}
.toast .i{flex:none;border-radius:50%;background:${V.accentSoft};color:${V.accent};display:grid;place-items:center;font-weight:700}
.toast b{display:block;color:${V.accent}}.toast span{color:${V.ink}}
.card{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:${V.canvas}}
.card .in{display:flex;flex-direction:column;align-items:center;gap:26px;padding:0 60px}
.ti{font-family:D;font-weight:900;line-height:1.15;font-feature-settings:"ss01"}.ti mark{background:${V.accentSoft};color:inherit;padding:0 18px}
.su{color:${hexA(V.ink, .66)}}.pill{padding:14px 30px;border-radius:999px;background:#fff;box-shadow:0 2px 10px ${hexA(V.ink, .06)}}`
const LAND = `#cap{position:absolute;bottom:72px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:20px;padding:16px 38px 16px 40px;background:${hexA(V.captionBg, .92)};color:${V.captionInk};border-radius:999px;white-space:nowrap}
#cap .n{width:56px;height:56px;font-size:31px}#cap .t{font-size:38px;font-weight:500}
#toasts{position:absolute;right:150px;top:150px;display:flex;flex-direction:column;gap:12px;align-items:flex-end}
.toast{width:640px;padding:22px 26px}.toast .i{width:44px;height:44px;font-size:24px}.toast b{font-size:26px;margin-bottom:4px}.toast span{font-size:31px;line-height:1.4}
.card img{width:110px;height:110px}.ti{font-size:120px}.su{font-size:42px}.pill{font-size:32px}`
// 9:16 — text lives between 220 px from the top and 380 px from the bottom (platform UI covers the rest).
const PORT = `#band{position:absolute;left:0;top:0;width:1080px;height:340px;display:flex;align-items:flex-end;justify-content:center;gap:22px;padding-bottom:34px}
#band img{width:64px;height:64px}#band .bt{font-family:D;font-weight:900;font-size:58px;font-feature-settings:"ss01"}#band .bt mark{background:${V.accentSoft};color:inherit;padding:0 10px}
#cap{position:absolute;top:1440px;left:60px;right:60px;display:flex;align-items:center;gap:20px;padding:20px 28px;background:${hexA(V.captionBg, .94)};color:${V.captionInk};border-radius:36px}
#cap .n{width:62px;height:62px;font-size:34px}#cap .t{font-size:40px;font-weight:500;line-height:1.35}
#toasts{position:absolute;left:60px;right:60px;top:1240px;display:flex;flex-direction:column;gap:10px}
.toast{padding:16px 20px}.toast .i{width:38px;height:38px;font-size:20px}.toast b{font-size:24px;margin-bottom:2px}.toast span{font-size:28px;line-height:1.35}
.card img{width:110px;height:110px}.ti{font-size:104px}.su{font-size:40px}.pill{font-size:30px}`
const STAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${FONTS}${COMMON}${portrait ? PORT : LAND}</style></head><body>
${portrait ? `<div id="band">${logo ? `<img src="${logo}">` : ""}<div class="bt">${meta.title}</div></div>` : ""}
<div id="win"><img id="scr"></div><div id="cap"><div class="n"></div><div class="t"></div></div><div id="toasts"></div>
<div id="intro" class="card"><div class="in">${logo ? `<img src="${logo}">` : ""}<div class="ti">${meta.title}</div><div class="su">${meta.sub}</div></div></div>
<div id="outro" class="card"><div class="in"><div class="ti" style="font-size:${portrait ? 92 : 104}px">${meta.outro}</div><div class="pill">${meta.outroSub}</div>${logo ? `<img src="${logo}" style="width:80px;height:80px">` : ""}</div></div>
<script>
const k0=${k0};
window.paint=async(s)=>{
  const img=document.getElementById("scr");
  if(img.dataset.src!==s.frame){img.src=s.frame;img.dataset.src=s.frame;await img.decode().catch(()=>{})}
  const sc=k0*s.cam.z;img.style.transform="translate("+(${WIN.w / 2}-s.cam.cx*sc)+"px,"+(${WIN.h / 2}-s.cam.cy*sc)+"px) scale("+sc+")";
  const cap=document.getElementById("cap");
  if(s.cap){cap.style.opacity=s.cap.a;cap.querySelector(".n").textContent=s.cap.n;cap.querySelector(".t").textContent=s.cap.text}else cap.style.opacity=0;
  document.getElementById("toasts").innerHTML=s.toasts.map(t=>'<div class="toast" style="opacity:'+t.a+'"><div class="i">✓</div><div><b>'+t.title+'</b><span>'+t.text+'</span></div></div>').join("");
  const i=document.getElementById("intro");i.style.opacity=s.intro;i.style.display=s.intro>0?"grid":"none";
  i.querySelector(".ti").style.opacity=Math.min(1,s.introT/.7);i.querySelector(".su").style.opacity=Math.max(0,Math.min(1,(s.introT-.5)/.7));
  const o=document.getElementById("outro");o.style.opacity=s.outro;o.style.display=s.outro>0?"grid":"none";
  await new Promise(r=>requestAnimationFrame(()=>r()));
};
</script></body></html>`
mkdirSync(work, { recursive: true })
writeFileSync(join(work, "stage.html"), STAGE)

// ───────────────────────── render: parallel pages → MJPEG segments (no file per frame) ─────────────
const scale = draft ? 0.5 : 1
const b2 = await chromium.launch({ args: ["--allow-file-access-from-files"] })
async function stagePage() {
  const p = await b2.newPage({ viewport: { width: LAYOUT.W, height: LAYOUT.H }, deviceScaleFactor: scale })
  await p.goto("file://" + join(work, "stage.html"))
  await p.evaluate(() => document.fonts.ready)
  const cdp = await p.context().newCDPSession(p)
  const grab = async () => Buffer.from((await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true })).data, "base64")
  return { p, grab }
}

if (previewAt) {
  const { p } = await stagePage()
  mkdirSync(outDir, { recursive: true })
  for (const t of previewAt) {
    await p.evaluate((s) => window.paint(s), stateAt(t))
    const f = `${base}${portrait ? ".reel" : ""}.preview-${t}s.png`
    await p.screenshot({ path: f })
    console.log(`✓ ${f}`)
  }
  await b2.close()
  process.exit(0)
}

// Reels must fit the platforms' 60 s: a longer flow plays uniformly faster rather than being cut off.
const REEL_MAX = 58
const tscale = portrait && T1 - T0 > REEL_MAX ? (T1 - T0) / REEL_MAX : 1
TK = tscale
// the outro waits for the last tip, so a stretched closing tip is never cut by the end card
if (!clip) {
  const tail = Math.max(0, ...T.timeline.filter((e) => e.type === "toast").map((e) => toastEnd(e) + 0.3 * TK - (takeEnd - XF)))
  if (tail > 0) { takeEnd += tail; T1 += tail }
}
if (tscale > 1) console.log(`reel: ${(T1 - T0).toFixed(0)}s flow plays at ${tscale.toFixed(2)}× to fit ${REEL_MAX}s`)
const times = []
for (let k = 0; k < Math.round(((T1 - T0) / tscale) * FPS); k++) times.push(T0 + (k / FPS) * tscale)
const segDir = join(work, "seg")
rmSync(segDir, { recursive: true, force: true }); mkdirSync(segDir, { recursive: true })
const chunk = Math.ceil(times.length / workersN)
const started = Date.now()
let captured = 0, reused = 0
await Promise.all(Array.from({ length: workersN }, async (_, w) => {
  const slice = times.slice(w * chunk, (w + 1) * chunk)
  if (!slice.length) return
  const { p, grab } = await stagePage()
  const seg = join(segDir, `seg-${w}.mkv`)
  const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "mjpeg", "-framerate", String(FPS), "-i", "-", "-c:v", "copy", seg], { stdio: ["pipe", "inherit", "inherit"] })
  let lastSig = null, lastBuf = null
  for (const t of slice) {
    const s = stateAt(t)
    const k = sig(s)
    if (k !== lastSig) {
      await p.evaluate((st) => window.paint(st), s)
      lastBuf = await grab(); lastSig = k; captured++
    } else reused++
    if (!ff.stdin.write(lastBuf)) await once(ff.stdin, "drain")
  }
  ff.stdin.end()
  const [code] = await once(ff, "close")
  if (code !== 0) throw new Error(`segment ${w} failed`)
}))
await b2.close()
console.log(`direct: ${times.length} frames (${captured} painted, ${reused} reused) in ${((Date.now() - started) / 1000).toFixed(1)}s with ${workersN} workers`)

const list = join(segDir, "list.txt")
writeFileSync(list, Array.from({ length: workersN }, (_, w) => join(segDir, `seg-${w}.mkv`)).filter(existsSync).map((f) => `file '${f}'`).join("\n") + "\n")
const mezz = join(segDir, "mezz.mkv")
spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", mezz], { stdio: "inherit" })

// ───────────────────────── narration + captions ─────────────────────────
const dur = (T1 - T0) / tscale
let master = mezz
if (voice && tscale > 1) { console.warn("voice: skipped — a sped-up reel would distort the narration (captions carry it)"); voice = null }
const cueList = []
if (voice) {
  const caps = captionsOf(T)
  const cues = caps.map((c) => ({ start: +(c.o - T0).toFixed(3) }))
  const inRange = { ...voice, lines: voice.lines.map((l, i) => ({ ...l, ok: l.ok && caps[i].o >= T0 - 0.01 && caps[i].o < T1 })) }
  writeFileSync(join(segDir, "voice.json"), JSON.stringify(inRange))
  writeFileSync(join(segDir, "cues.json"), JSON.stringify(cues))
  const narration = join(segDir, "narration.wav")
  const r = spawnSync(MEDIA, ["voice", "mix", join(segDir, "voice.json"), "--cues", join(segDir, "cues.json"), "--duration", dur.toFixed(3), "--out", narration, "--lufs", portrait ? "-14" : "-16"], { encoding: "utf8" })
  if (r.status === 0) {
    const mix = JSON.parse(r.stdout)
    for (const w of mix.warnings) console.warn(`voice: ${w}`)
    for (const p of mix.placed) cueList.push({ start: p.at, end: p.end, text: voice.lines[p.i].text })
    master = join(segDir, "mezz-av.mkv")
    spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", mezz, "-i", narration, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "pcm_s16le", "-shortest", master], { stdio: "inherit" })
  } else console.warn(`voice mix failed — captions-only: ${(r.stderr || "").slice(-300)}`)
}
if (!cueList.length) {
  const caps = captionsOf(T).filter((c) => c.o >= T0 - 0.01 && c.o < T1)
  // the last caption ends where the outro card starts, not over it
  caps.forEach((c, i) => cueList.push({ start: Math.max(0, c.o - T0), end: Math.min(dur, (caps[i + 1]?.o ?? (clip ? T1 : takeEnd - XF)) - T0), text: c.text }))
}

// ───────────────────────── deliver through the shared media library ─────────────────────────
mkdirSync(outDir, { recursive: true })
const media = (...a) => {
  const r = spawnSync(MEDIA, a, { encoding: "utf8" })
  if (r.status !== 0) throw new Error(`media.sh ${a[0]} failed: ${(r.stderr || r.stdout || "").slice(-400)}`)
  return r.stdout
}
const delivered = []
if (draft) {
  media("encode", "draft", master, `${base}.draft.mp4`); delivered.push(`${base}.draft.mp4`)
} else if (portrait) {
  media("encode", "reel", master, `${base}.reel.mp4`, "--max", String(Math.ceil(dur) + 1)); delivered.push(`${base}.reel.mp4`)
} else {
  const profile = clip ? "clip" : "web"
  // never truncate: a support clip over its 30 s budget is flagged by qa-pack, not cut mid-step
  if (clip && dur > 30) console.warn(`clip: ${dur.toFixed(0)}s is over the 30 s support-clip budget — pick fewer steps`)
  const max = String(Math.ceil(dur) + 1)
  media("encode", profile, master, `${base}.mp4`, "--max", max); delivered.push(`${base}.mp4`)
  media("encode", profile, master, `${base}.av1.mp4`, "--max", max); delivered.push(`${base}.av1.mp4`)
  // Poster = the brand title card: a frame of the app can carry a stale row, a face or a phone
  // number (media-qa, 2026-10-07). A clip has no title card, so it takes its first caption.
  const firstCap = captionsOf(T).find((c) => c.o >= T0)
  const posterAt = meta.posterAt ?? (clip ? Math.max(0, (firstCap?.o ?? T0 + 1) - T0 + 0.5) : INTRO / 2)
  media("poster", `${base}.mp4`, `${base}.poster.webp`, "--at", String(posterAt))
  delivered.push(`${base}.poster.webp`)
  writeFileSync(join(segDir, "cues-vtt.json"), JSON.stringify(cueList))
  media("vtt", join(segDir, "cues-vtt.json"), `${base}.vtt`); delivered.push(`${base}.vtt`)
}
rmSync(segDir, { recursive: true, force: true })   // the take stays for --direct-only; media.sh purge ages it out
for (const f of delivered) console.log(`✓ ${f}`)
console.log(`${dur.toFixed(1)}s · ${portrait ? "9:16" : "16:9"} · brand ${B.id}${voice ? ` · voice ${voice.voice}` : ""} · ${((Date.now() - started) / 1000).toFixed(0)}s directing+delivery`)
