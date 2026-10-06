#!/usr/bin/env node
// sim.mjs — film a REAL product flow as a human would do it: an on-page cursor glides and
// clicks, text is typed key by key, dropdowns open and options are picked, files go through
// the real upload. Captions are injected into the page (native Arabic shaping). Headless,
// framed like Abdout's MacBook (1210x686 CSS @ DPR 2.5 = Chrome 125%); CDP screencast frames
// keep their timestamps, so pauses and typing play back in real time.
//
//   node sim.mjs --flow add-student [--repo hogwarts] [--host https://demo.balqalam.com]
//                [--role admin] [--out <file.mp4>] [--speed 1]
// Flow file: ../sims/<repo>/<flow>.mjs exporting `default async (sim) => {}` and optional `cleanup`.

import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const args = process.argv.slice(2)
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d)
const repo = opt("repo", "hogwarts")
const host = opt("host", "https://demo.balqalam.com").replace(/\/$/, "")
const role = opt("role", "admin")
const flowName = opt("flow")
const speed = Number(opt("speed", "1"))
const here = dirname(fileURLToPath(import.meta.url))
const out = opt("out", join(homedir(), repo, "public/screenshot", flowName, `${flowName}-sim-ar.mp4`))
if (!flowName) { console.log("usage: sim.mjs --flow <name> [--repo] [--host] [--role] [--out] [--speed]"); process.exit(0) }

const require = createRequire(join(homedir(), repo, "package.json"))
const { chromium } = require("@playwright/test")
const DEMO_ROLES = ["admin", "teacher", "student", "guardian", "accountant", "staff", "user", "applicant"]

// ---- the overlay: cursor, click ripple, caption — re-created on every document ----
const OVERLAY = `(() => {
  const mount = () => {
    if (document.getElementById("__sim")) return
    const root = document.createElement("div"); root.id = "__sim"
    root.innerHTML = \`
      <style>
        #__sim{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
        #__cur{position:absolute;left:0;top:0;width:22px;height:22px;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
        .__rip{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #00bc6e;animation:__r .55s ease-out forwards}
        @keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
        #__cap{position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;direction:rtl;
          padding:9px 20px 9px 22px;background:#0a0a0a;color:#fff;border-radius:999px;font:500 19px/1.3 var(--font-thmanyah-text, system-ui), system-ui;
          white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.18);transition:opacity .35s, transform .35s;opacity:0}
        #__cap.on{opacity:1}
        #__num{width:30px;height:30px;border-radius:50%;background:#00bc6e;color:#0a0a0a;display:grid;place-items:center;font-weight:700;font-size:17px}
      </style>
      <svg id="__cur" viewBox="0 0 22 22"><path d="M2 1 L2 18 L6.5 13.8 L9.6 20.6 L12.6 19.3 L9.6 12.7 L15.6 12.7 Z" fill="#0a0a0a" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
      <div id="__cap"><div id="__num"></div><div id="__txt"></div></div>\`
    document.documentElement.appendChild(root)
    const s = JSON.parse(sessionStorage.__sim || "{}")
    const c = root.querySelector("#__cur"); c.style.left = (s.x ?? innerWidth * .55) + "px"; c.style.top = (s.y ?? innerHeight * .5) + "px"
    if (s.cap) { root.querySelector("#__num").textContent = s.n; root.querySelector("#__txt").textContent = s.cap; root.querySelector("#__cap").classList.add("on") }
  }
  const save = (patch) => { sessionStorage.__sim = JSON.stringify({ ...JSON.parse(sessionStorage.__sim || "{}"), ...patch }) }
  window.__simMove = (x, y, ms) => new Promise((done) => {
    mount(); const c = document.getElementById("__cur")
    const x0 = parseFloat(c.style.left), y0 = parseFloat(c.style.top), t0 = performance.now()
    const bend = (Math.random() - .5) * 60
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2
      const ox = Math.sin(Math.PI * e) * bend
      c.style.left = (x0 + (x - x0) * e) + "px"; c.style.top = (y0 + (y - y0) * e + ox * .4) + "px"
      if (k < 1) requestAnimationFrame(step); else { save({ x, y }); done() }
    }
    requestAnimationFrame(step)
  })
  window.__simRipple = (x, y) => { mount(); const r = document.createElement("div"); r.className = "__rip"; r.style.left = x + "px"; r.style.top = y + "px"; document.getElementById("__sim").appendChild(r); setTimeout(() => r.remove(), 600) }
  window.__simCaption = (n, txt) => {
    mount(); save({ n, cap: txt }); const cap = document.getElementById("__cap")
    cap.classList.remove("on"); setTimeout(() => { document.getElementById("__num").textContent = n; document.getElementById("__txt").textContent = txt; cap.classList.add("on") }, txt ? 180 : 0)
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount); else mount()
  new MutationObserver(() => mount()).observe(document, { childList: true, subtree: false })
})()`

const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])
const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed))
const jitter = (a, b) => a + Math.random() * (b - a)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1210, height: 686 }, deviceScaleFactor: 2.5, locale: "ar" })
await ctx.addInitScript(OVERLAY)
const page = await ctx.newPage()

async function settle() {
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  await page.waitForTimeout(500)
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

// ---- recording: CDP screencast, frames streamed to disk with their timestamps ----
const frameDir = join(dirname(out), ".sim-frames"); rmSync(frameDir, { recursive: true, force: true }); mkdirSync(frameDir, { recursive: true })
const frames = []; let cdp = null; let recording = false
async function startRec() {
  cdp = await ctx.newCDPSession(page)
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    if (recording) { const f = join(frameDir, `${String(frames.length).padStart(6, "0")}.jpg`); writeFileSync(f, Buffer.from(data, "base64")); frames.push({ f, ts: metadata.timestamp }) }
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
  })
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1090, everyNthFrame: 1 })
  recording = true
}
async function stopRec() { recording = false; await cdp.send("Page.stopScreencast").catch(() => {}) }

// ---- the human: everything a flow can do ----
async function center(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  const b = await locator.boundingBox(); if (!b) throw new Error("not on screen: " + locator)
  return { x: b.x + b.width / 2 + jitter(-b.width * .12, b.width * .12), y: b.y + b.height / 2 + jitter(-2, 2) }
}
const sim = {
  page, go, settle, wait,
  async caption(n, txt) { await page.evaluate(([n, t]) => window.__simCaption(n, t), [n ? AR(n) : "", txt]); await wait(900) },
  async move(locator) {
    const p = await center(locator)
    const from = await page.evaluate(() => { const c = document.getElementById("__cur"); return { x: parseFloat(c?.style.left) || 0, y: parseFloat(c?.style.top) || 0 } })
    const dist = Math.hypot(p.x - from.x, p.y - from.y), ms = Math.min(1100, 380 + dist * .9) / speed
    await page.evaluate(([x, y, ms]) => window.__simMove(x, y, ms), [p.x, p.y, ms])
    await page.mouse.move(p.x, p.y); return p
  },
  async click(locator, { pause = 450 } = {}) {
    const p = await sim.move(locator); await wait(jitter(160, 280))
    await page.evaluate(([x, y]) => window.__simRipple(x, y), [p.x, p.y]); await page.mouse.click(p.x, p.y)
    await wait(pause)
  },
  async type(locator, text, { cps = 9 } = {}) {
    await sim.click(locator, { pause: 250 })
    for (const ch of text) { await page.keyboard.type(ch); await wait(ch === " " ? jitter(120, 260) : jitter(1000 / cps * .6, 1000 / cps * 1.5)) }
    await wait(500)
  },
  async pick(trigger, option) {
    await sim.click(trigger, { pause: 500 })
    const opt = typeof option === "string" ? page.getByRole("option", { name: option }) : page.getByRole("option").nth(option ?? 0)
    await sim.move(page.getByRole("option").first()); await wait(250)
    await sim.click(opt.first(), { pause: 600 })
  },
  async upload(trigger, file) {
    const chooser = page.waitForEvent("filechooser", { timeout: 15000 })
    await sim.click(trigger, { pause: 200 })
    await (await chooser).setFiles(file); await wait(2500)
  },
  asset: (name) => join(here, "..", "assets", name),
}

// ---- run ----
const flowFile = join(here, "..", "sims", repo, `${flowName}.mjs`)
if (!existsSync(flowFile)) throw new Error(`no sim at ${flowFile}`)
const mod = await import(pathToFileURL(flowFile).href)
try {
  if (mod.cleanup) await mod.cleanup(sim)
  if (mod.prepare) await mod.prepare(sim)
  await startRec()
  await mod.default(sim)
  await wait(1500)
  await stopRec()
} finally {
  if (mod.cleanup) await mod.cleanup(sim).catch((e) => console.warn("cleanup:", e.message))
  await browser.close()
}

// ---- encode: each frame holds until the next one (real-time), then constant 30 fps ----
mkdirSync(dirname(out), { recursive: true })
// A frozen screen (server saving, network) never holds longer than HOLD — dead air is cut.
const HOLD = 1.4
const list = frames.map((fr, i) => `file '${fr.f}'\nduration ${Math.min(HOLD, (frames[i + 1]?.ts ?? fr.ts + HOLD) - fr.ts).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).f}'\n`
writeFileSync(join(frameDir, "list.txt"), list)
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(frameDir, "list.txt"),
  "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,fps=30",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
rmSync(frameDir, { recursive: true, force: true })
console.log(`✓ ${out} · ${frames.length} frames · ${frames.reduce((a, fr, i) => a + Math.min(HOLD, (frames[i + 1]?.ts ?? fr.ts + HOLD) - fr.ts), 0).toFixed(1)}s`)
