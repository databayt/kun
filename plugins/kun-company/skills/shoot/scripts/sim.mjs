#!/usr/bin/env node
// sim.mjs — film a REAL product flow as a human would do it, then direct it into ONE video.
//
// Take:     the real app on the demo, driven like an admin — an on-page cursor glides and clicks,
//           text is typed key by key, dropdowns open and options are picked, uploads go through a
//           simulated macOS Finder "Open" sheet and then the real upload. Recorded headless at
//           Abdout's Mac frame (1210x686 CSS @ DPR 2.5 = Chrome 125%) via CDP screencast at full
//           Retina resolution; every frame and every event keeps its wall-clock time.
// Director: re-composes the take frame by frame — intro card, a smooth camera that zooms into the
//           field being filled, numbered captions, tip toasts, outro card — and encodes ONE file,
//           overwritten on every run: <repo>/public/screenshot/<flow>/<flow>-ar.mp4.
//
//   node sim.mjs --flow add-student [--repo hogwarts] [--host https://demo.balqalam.com]
//                [--role admin] [--out <file.mp4>] [--speed 1] [--direct-only]
// --direct-only re-composes the last take (camera, captions, toasts) without driving the app.
// Sim file: ../sims/<repo>/<flow>.mjs → `default async (sim)`, optional `prepare`, `cleanup`, `meta`.

import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const args = process.argv.slice(2)
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d)
const flowName = opt("flow")
if (!flowName) { console.log("usage: sim.mjs --flow <name> [--repo] [--host] [--role] [--out] [--speed] [--keep-take]"); process.exit(0) }
const repo = opt("repo", "hogwarts")
const host = opt("host", "https://demo.balqalam.com").replace(/\/$/, "")
const role = opt("role", "admin")
const speed = Number(opt("speed", "1"))
const here = dirname(fileURLToPath(import.meta.url))
const out = opt("out", join(homedir(), repo, "public/screenshot", flowName, `${flowName}-ar.mp4`))
const work = join(homedir(), ".cache/shoot-sim", `${repo}-${flowName}`)
const require = createRequire(join(homedir(), repo, "package.json"))
const { chromium } = require("@playwright/test")
const DEMO_ROLES = ["admin", "teacher", "student", "guardian", "accountant", "staff", "user", "applicant"]
const VW = 1210, VH = 686, DPR = 2.5

// ───────────────────────── the in-page overlay: cursor, ripple, Finder sheet ─────────────────────────
const OVERLAY = `(() => {
  const css = \`
    #__sim{position:fixed;inset:0;pointer-events:none;z-index:2147483646}
    #__cur{position:absolute;left:0;top:0;width:22px;height:22px;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));z-index:3}
    .__rip{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #00bc6e;animation:__r .55s ease-out forwards;z-index:2}
    @keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
    #__fd{position:absolute;inset:0;display:none;pointer-events:auto;z-index:1;direction:ltr;font:13px -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:#1d1d1f;-webkit-font-smoothing:antialiased}
    #__fd.on{display:block}
    #__fw{position:absolute;left:50%;top:96px;width:720px;height:440px;transform:translateX(-50%);border-radius:26px;overflow:hidden;
      background:rgba(248,248,250,.94);backdrop-filter:blur(40px) saturate(180%);box-shadow:0 22px 60px rgba(0,0,0,.28),0 0 0 .5px rgba(0,0,0,.22);
      display:grid;grid-template-columns:196px 1fr;grid-template-rows:56px 1fr 60px}
    #__fw .side{grid-row:1/3;margin:8px 0 0 8px;border-radius:18px;background:rgba(232,232,237,.85);padding:44px 10px 10px;position:relative}
    #__fw .lights{position:absolute;top:16px;left:16px;display:flex;gap:8px}
    #__fw .lights i{width:12px;height:12px;border-radius:50%;display:block}
    #__fw .side .h{font-size:11px;font-weight:600;color:#86868b;margin:10px 8px 4px}
    #__fw .side .it{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:9px;color:#1d1d1f}
    #__fw .side .it svg{width:16px;height:16px;flex:none;color:#0a84ff}
    #__fw .side .it.sel{background:rgba(0,0,0,.09)}
    #__fw .side .tag{width:10px;height:10px;border-radius:50%;margin:0 3px}
    #__fw .tb{display:flex;align-items:center;gap:10px;padding:0 14px 0 12px}
    #__fw .cap{display:flex;align-items:center;gap:2px;height:32px;padding:0 6px;border-radius:16px;background:rgba(255,255,255,.75);box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 3px rgba(0,0,0,.06);color:#3a3a3c}
    #__fw .cap span{padding:0 7px;font-size:15px}
    #__fw .ttl{font-weight:700;font-size:15px;margin:0 4px}
    #__fw .srch{margin-left:auto;width:170px;color:#8e8e93;padding:0 12px}
    #__fw .files{padding:18px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px 10px;align-content:start;overflow:hidden}
    #__fw .f{display:flex;flex-direction:column;align-items:center;gap:7px;padding:8px 4px;border-radius:10px;text-align:center}
    #__fw .f .ic{width:86px;height:86px;display:grid;place-items:center}
    #__fw .f .ic img{max-width:86px;max-height:86px;box-shadow:0 1px 4px rgba(0,0,0,.18),0 0 0 .5px rgba(0,0,0,.12);background:#fff}
    #__fw .f .nm{font-size:12px;line-height:1.3;max-width:120px;padding:1px 6px;border-radius:5px;direction:rtl}
    #__fw .f.sel{background:rgba(0,0,0,.07)}
    #__fw .f.sel .nm{background:#0a84ff;color:#fff}
    #__fw .foot{grid-column:1/3;display:flex;align-items:center;gap:10px;padding:0 16px}
    #__fw .btn{height:32px;display:grid;place-items:center;padding:0 20px;border-radius:16px;background:rgba(255,255,255,.8);box-shadow:0 0 0 .5px rgba(0,0,0,.14),0 1px 2px rgba(0,0,0,.06);font-weight:500}
    #__fw .btn.opts{margin-right:auto}
    #__fw .btn.pri{background:#0a84ff;color:#fff;box-shadow:none;opacity:.45}
    #__fw .btn.pri.ok{opacity:1}\`
  const ico = {
    airdrop: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><circle cx='8' cy='8' r='2'/><path d='M4.5 11.5a5 5 0 1 1 7 0M2.4 13.6a8 8 0 1 1 11.2 0'/></svg>",
    recents: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><circle cx='8' cy='8' r='6.2'/><path d='M8 4.6V8l2.4 1.6'/></svg>",
    apps: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><path d='M8 1.8 3 14.2M8 1.8l5 12.4M4.6 10h6.8'/></svg>",
    desktop: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><rect x='1.8' y='2.6' width='12.4' height='8.6' rx='1.4'/><path d='M5.5 14h5M8 11.2V14'/></svg>",
    docs: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><path d='M4 1.8h5.5L12.5 5v9.2H4z'/><path d='M9.5 1.8V5h3'/></svg>",
    down: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><circle cx='8' cy='8' r='6.2'/><path d='M8 4.5v6.2M5.4 8.3 8 10.9l2.6-2.6'/></svg>",
    mac: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><rect x='2.6' y='3' width='10.8' height='7.4' rx='1'/><path d='M1 12.6h14'/></svg>",
    cloud: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><path d='M4.4 12.5a3 3 0 0 1-.3-6 4 4 0 0 1 7.7 1.2 2.4 2.4 0 0 1 .2 4.8z'/></svg>",
  }
  const finder = () => \`
    <div id="__fw">
      <div class="side"><div class="lights"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
        <div class="h">Favorites</div>
        <div class="it">\${ico.airdrop}AirDrop</div><div class="it" data-k="recents">\${ico.recents}Recents</div>
        <div class="it">\${ico.apps}Applications</div><div class="it" data-k="desktop">\${ico.desktop}Desktop</div>
        <div class="it" data-k="documents">\${ico.docs}Documents</div><div class="it" data-k="downloads">\${ico.down}Downloads</div>
        <div class="h">Locations</div><div class="it">\${ico.mac}MacBook Pro</div><div class="it">\${ico.cloud}iCloud Drive</div>
        <div class="h">Tags</div><div class="it"><span class="tag" style="background:#ff453a"></span>Red</div><div class="it"><span class="tag" style="background:#30d158"></span>Green</div></div>
      <div class="tb"><div class="cap"><span>‹</span><span>›</span></div><div class="ttl">Recents</div>
        <div class="cap" style="margin-left:6px"><span>▦</span><span>☰</span></div><div class="cap srch">⌕&nbsp; Search</div></div>
      <div class="files"></div>
      <div class="foot"><span class="btn opts">Show Options</span><span class="btn" data-k="cancel">Cancel</span><span class="btn pri" data-k="open">Open</span></div>
    </div>\`
  const mount = () => {
    if (document.getElementById("__sim")) return
    const root = document.createElement("div"); root.id = "__sim"
    root.innerHTML = "<style>" + css + "</style><svg id='__cur' viewBox='0 0 22 22'><path d='M2 1 L2 18 L6.5 13.8 L9.6 20.6 L12.6 19.3 L9.6 12.7 L15.6 12.7 Z' fill='#0a0a0a' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/></svg><div id='__fd'></div>"
    document.documentElement.appendChild(root)
    const s = JSON.parse(sessionStorage.__sim || "{}")
    const c = root.querySelector("#__cur"); c.style.left = (s.x ?? innerWidth * .55) + "px"; c.style.top = (s.y ?? innerHeight * .5) + "px"
  }
  const save = (p) => { sessionStorage.__sim = JSON.stringify({ ...JSON.parse(sessionStorage.__sim || "{}"), ...p }) }
  window.__simMove = (x, y, ms) => new Promise((done) => {
    mount(); const c = document.getElementById("__cur")
    const x0 = parseFloat(c.style.left), y0 = parseFloat(c.style.top), t0 = performance.now(), bend = (Math.random() - .5) * 50
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2
      c.style.left = (x0 + (x - x0) * e) + "px"; c.style.top = (y0 + (y - y0) * e + Math.sin(Math.PI * e) * bend * .4) + "px"
      if (k < 1) requestAnimationFrame(step); else { save({ x, y }); done() }
    }
    requestAnimationFrame(step)
  })
  window.__simRipple = (x, y) => { mount(); const r = document.createElement("div"); r.className = "__rip"; r.style.left = x + "px"; r.style.top = y + "px"; document.getElementById("__sim").appendChild(r); setTimeout(() => r.remove(), 600) }
  window.__finderOpen = (files) => {
    mount(); const fd = document.getElementById("__fd"); fd.innerHTML = finder(); fd.classList.add("on")
    const show = (k) => {
      fd.querySelectorAll(".side .it").forEach((e) => e.classList.toggle("sel", e.dataset.k === k))
      fd.querySelector(".ttl").textContent = { recents: "Recents", downloads: "Downloads", desktop: "Desktop", documents: "Documents" }[k] || k
      fd.querySelector(".files").innerHTML = (k === "downloads" ? files : []).map((f) =>
        "<div class='f' data-f='" + f.name + "'><div class='ic'><img src='" + f.thumb + "'></div><div class='nm'>" + f.name + "</div></div>").join("")
      save({ folder: k })
    }
    show(JSON.parse(sessionStorage.__sim || "{}").folder || "recents")
    fd.onclick = (ev) => {
      const it = ev.target.closest("[data-k],.f"); if (!it) return
      if (it.classList.contains("it")) show(it.dataset.k)
      else if (it.classList.contains("f")) {
        fd.querySelectorAll(".f").forEach((e) => e.classList.remove("sel")); it.classList.add("sel")
        fd.querySelector("[data-k=open]").classList.add("ok")
      }
    }
  }
  window.__finderClose = () => { const fd = document.getElementById("__fd"); if (fd) { fd.classList.remove("on"); fd.innerHTML = "" } }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount); else mount()
  new MutationObserver(() => mount()).observe(document, { childList: true })
})()`

const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])
const now = () => Date.now() / 1000
const jitter = (a, b) => a + Math.random() * (b - a)

// ───────────────────────── the take ─────────────────────────
const directOnly = args.includes("--direct-only")
if (!directOnly) { rmSync(work, { recursive: true, force: true }); mkdirSync(join(work, "frames"), { recursive: true }) }
// Without the forced scale factor, CDP screencast frames come out at CSS size (1210 px) and zooms go soft.
const browser = await chromium.launch({ args: [`--force-device-scale-factor=${DPR}`] })
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: "ar" })
await ctx.addInitScript(OVERLAY)
const page = await ctx.newPage()

let frames = [], events = [], keeps = []
let cdp = null, recording = false
async function startRec() {
  cdp = await ctx.newCDPSession(page)
  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    if (recording) { const f = join(work, "frames", `${String(frames.length).padStart(6, "0")}.jpg`); writeFileSync(f, Buffer.from(data, "base64")); frames.push({ f, w: now() }) }
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
  })
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: VW * DPR, maxHeight: VH * DPR, everyNthFrame: 1 })
  recording = true
}
async function stopRec() { recording = false; await cdp.send("Page.stopScreencast").catch(() => {}) }

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
  caption(n, text) { events.push({ t: now(), type: "caption", n: n ? AR(n) : "", text }) },
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
  /** Upload through a simulated macOS Finder sheet: Downloads → file → Open → the real upload. */
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

const simFile = join(here, "..", "sims", repo, `${flowName}.mjs`)
if (!existsSync(simFile)) throw new Error(`no sim at ${simFile}`)
const mod = await import(pathToFileURL(simFile).href)
const meta = { title: "", sub: "", outro: "", outroSub: "", ...(mod.meta ?? {}) }
if (directOnly) {
  ({ frames, events, keeps } = JSON.parse(readFileSync(join(work, "take.json"), "utf8")))
  await browser.close()
} else try {
  if (mod.cleanup) await mod.cleanup(sim)
  if (mod.prepare) await mod.prepare(sim)
  await startRec()
  await mod.default(sim)
  await sim.wait(1200)
  await stopRec()
} finally {
  if (mod.cleanup) await mod.cleanup(sim).catch((e) => console.warn("cleanup:", e.message))
  await browser.close()
}
if (!directOnly) writeFileSync(join(work, "take.json"), JSON.stringify({ frames, events, keeps }))
console.log(`take: ${frames.length} frames, ${events.length} events`)

// ───────────────────────── the director ─────────────────────────
// Source timeline → output timeline: a frozen screen holds at most HOLD seconds unless the
// gap falls inside an intentional pause (typing, sim.wait).
const HOLD = 1.2, FPS = 30, INTRO = 3.2, OUTRO = 3.8, XF = 0.5
const kept = (a, b) => keeps.some(([s, e]) => a < e && b > s)
let acc = 0
for (let i = 0; i < frames.length; i++) {
  const gap = (frames[i + 1]?.w ?? frames[i].w + HOLD) - frames[i].w
  frames[i].out = acc; frames[i].dur = kept(frames[i].w, frames[i].w + gap) ? gap : Math.min(HOLD, gap); acc += frames[i].dur
}
const takeLen = acc
const toOut = (w) => {
  let i = frames.findLastIndex((f) => f.w <= w); if (i < 0) return 0
  return frames[i].out + Math.min(w - frames[i].w, frames[i].dur)
}
const timeline = events.map((e) => ({ ...e, o: INTRO + toOut(e.t) }))
const total = INTRO + takeLen + OUTRO

// The take plays inside a window; the band beneath it belongs to the captions, so a caption
// never covers a field however far the camera zooms.
// Flat: the take fills the whole 1920x1080 frame (no window, no shadow); only the camera moves.
const WIN = { x: 0, y: 0, w: 1920, h: 1080 }
const k0 = WIN.w / VW
const CAP_CSS = (z) => 170 / (k0 * z)   // the caption's strip at the bottom, in page px at zoom z
const ease = (x) => -(Math.cos(Math.PI * x) - 1) / 2   // sine in-out: no snap at either end
// Fit: the framed rect (plus room for labels above fields) fills ~80% of the window, ≤ 2×.
const fit = (e) => {
  if (!e.r) return { cx: e.cx ?? VW / 2, cy: e.cy ?? VH / 2, z: e.z ?? 1 }
  const top = e.r.y1 - e.pad - 26, w = e.r.x2 - e.r.x1 + 2 * e.pad, h = e.r.y2 + e.pad - top
  const z = e.zFix ?? Math.max(1, Math.min(1.9, (VW * .78) / w, (VH * .7) / h))
  // nudge down so the framed fields sit above the caption strip
  return { cx: (e.r.x1 + e.r.x2) / 2, cy: (top + e.r.y2 + e.pad) / 2 + CAP_CSS(z) / 2, z }
}
const cams = [{ o: 0, cx: VW / 2, cy: VH / 2, z: 1 }, ...timeline.filter((e) => e.type === "cam").map((e) => ({ o: e.o, ...fit(e) }))]
// Each move starts from wherever the camera is when it fires (a move may interrupt another).
const CAM_T = 1.25
const lerpCam = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, z: a.z + (b.z - a.z) * k })
for (let i = 1; i < cams.length; i++) cams[i].from = lerpCam(cams[i - 1].from ?? cams[0], cams[i - 1], ease(Math.min(1, (cams[i].o - cams[i - 1].o) / CAM_T)))
function camAt(T) {
  const i = cams.findLastIndex((c) => c.o <= T), c = cams[Math.max(0, i)]
  const s = i <= 0 ? cams[0] : lerpCam(c.from, c, ease(Math.min(1, (T - c.o) / CAM_T)))
  const hw = WIN.w / 2 / (k0 * s.z), hh = WIN.h / 2 / (k0 * s.z)
  return { ...s, cx: Math.max(hw, Math.min(VW - hw, s.cx)), cy: Math.max(Math.min(hh, VH / 2), Math.min(Math.max(VH - hh, VH / 2), s.cy)) }
}
function stateAt(T) {
  const tt = T - INTRO
  const fi = Math.max(0, frames.findLastIndex((f) => f.out <= tt))
  const cap = timeline.filter((e) => e.type === "caption" && e.o <= T).at(-1)
  const capSince = cap ? T - cap.o : 0
  const toasts = timeline.filter((e) => e.type === "toast" && T >= e.o && T < e.o + e.ms / 1000)
    .map((e) => ({ title: e.title, text: e.text, a: Math.min(1, (T - e.o) / .3, (e.o + e.ms / 1000 - T) / .3) }))
  return {
    T, frame: "file://" + frames[Math.min(fi, frames.length - 1)].f, cam: camAt(T),
    cap: cap && tt < takeLen ? { n: cap.n, text: cap.text, a: Math.min(1, capSince / .35) } : null, toasts,
    intro: T < INTRO + XF ? Math.min(1, (INTRO + XF - T) / XF) : 0,
    outro: T > INTRO + takeLen - XF ? Math.min(1, (T - (INTRO + takeLen - XF)) / XF) : 0,
    introT: T,
  }
}

const font = (w) => `file://${homedir()}/${repo}/public/fonts/thmanyah/thmanyah-${w}.woff2`
const logo = `file://${homedir()}/${repo}/public/logo.png`
const STAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:S;src:url(${font("sans-500")});font-weight:500}@font-face{font-family:S;src:url(${font("sans-700")});font-weight:700}
@font-face{font-family:D;src:url(${font("serif-display-900")});font-weight:900}
*{margin:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden;background:#fff;font-family:S;color:#0a0a0a}
html,body{background:#fff}#win{position:absolute;inset:0;overflow:hidden;background:#fff}
#scr{position:absolute;left:0;top:0;width:${VW}px;height:${VH}px;transform-origin:0 0}
#cap{position:absolute;bottom:72px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:20px;padding:16px 38px 16px 40px;background:rgba(10,10,10,.92);color:#fff;border-radius:999px;white-space:nowrap}
#cap .n{width:56px;height:56px;border-radius:50%;background:#00bc6e;color:#0a0a0a;display:grid;place-items:center;font-weight:700;font-size:31px}
#cap .t{font-size:38px;font-weight:500}
#toasts{position:absolute;right:150px;top:150px;display:flex;flex-direction:column;gap:12px;align-items:flex-end}
.toast{display:flex;gap:18px;align-items:flex-start;width:640px;padding:22px 26px;background:#fff;border-radius:20px;border:1.5px solid #e4e4e0}
.toast .i{flex:none;width:44px;height:44px;border-radius:50%;background:#e3f8ee;color:#00a35f;display:grid;place-items:center;font-size:24px;font-weight:700}
.toast b{display:block;font-size:26px;margin-bottom:4px;color:#00a35f}.toast span{font-size:31px;line-height:1.4;color:#222}
.card{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:#f4f4f2}
.card .in{display:flex;flex-direction:column;align-items:center;gap:26px}
.card img{width:110px;height:110px}.ti{font-family:D;font-weight:900;font-size:120px;line-height:1.15}.ti mark{background:#a7e8c9;color:inherit;padding:0 18px}
.su{font-size:42px;color:#555}.pill{font-size:32px;padding:14px 30px;border-radius:999px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.06)}
</style></head><body>
<div id="win"><img id="scr"></div><div id="cap"><div class="n"></div><div class="t"></div></div><div id="toasts"></div>
<div id="intro" class="card"><div class="in"><img src="${logo}"><div class="ti">${meta.title}</div><div class="su">${meta.sub}</div></div></div>
<div id="outro" class="card"><div class="in"><div class="ti" style="font-size:104px">${meta.outro}</div><div class="pill">${meta.outroSub}</div><img src="${logo}" style="width:80px;height:80px"></div></div>
<script>
const k0=${k0};
window.paint=async(s)=>{
  const img=document.getElementById("scr");
  if(img.dataset.src!==s.frame){img.src=s.frame;img.dataset.src=s.frame;await img.decode().catch(()=>{})}
  const sc=k0*s.cam.z;img.style.transform="translate("+(${WIN.w / 2}-s.cam.cx*sc)+"px,"+(${WIN.h / 2}-s.cam.cy*sc)+"px) scale("+sc+")";
  const cap=document.getElementById("cap");
  if(s.cap){cap.style.opacity=s.cap.a;cap.style.transform="translateX(-50%)";cap.querySelector(".n").textContent=s.cap.n;cap.querySelector(".t").textContent=s.cap.text}else cap.style.opacity=0;
  document.getElementById("toasts").innerHTML=s.toasts.map(t=>'<div class="toast" style="opacity:'+t.a+'"><div class="i">✓</div><div><b>'+t.title+'</b><span>'+t.text+'</span></div></div>').join("");
  const i=document.getElementById("intro");i.style.opacity=s.intro;i.style.display=s.intro>0?"grid":"none";
  i.querySelector(".ti").style.opacity=Math.min(1,s.introT/.7);i.querySelector(".su").style.opacity=Math.max(0,Math.min(1,(s.introT-.5)/.7));
  const o=document.getElementById("outro");o.style.opacity=s.outro;o.style.display=s.outro>0?"grid":"none";
};
</script></body></html>`
writeFileSync(join(work, "stage.html"), STAGE)

const b2 = await chromium.launch({ args: ["--allow-file-access-from-files"] })
const dp = await b2.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await dp.goto("file://" + join(work, "stage.html")); await dp.evaluate(() => document.fonts.ready)
mkdirSync(join(work, "out"), { recursive: true })
const N = Math.round(total * FPS)
for (let k = 0; k < N; k++) {
  await dp.evaluate((s) => window.paint(s), stateAt(k / FPS))
  await dp.screenshot({ path: join(work, "out", `${String(k).padStart(6, "0")}.jpg`), type: "jpeg", quality: 92 })
  if (k % 300 === 0) console.log(`direct ${k}/${N}`)
}
await b2.close()
mkdirSync(dirname(out), { recursive: true })
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(work, "out", "%06d.jpg"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
rmSync(join(work, "out"), { recursive: true, force: true })   // the take stays for --direct-only
console.log(`✓ ${out} · ${total.toFixed(1)}s`)
