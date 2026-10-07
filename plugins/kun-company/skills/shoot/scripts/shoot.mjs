#!/usr/bin/env node
// shoot.mjs — headless stills that match Abdout's own manual screenshot: a 14" MacBook Pro M4
// ("looks like 1512x982", Retina 2x), Chrome window filling the screen, page zoomed to 125%.
// Chrome at 125% on that screen = a 1210x686 CSS viewport rendered at devicePixelRatio 2.5,
// so the PNG is ~3025x1715 — same pixels as cmd+shift+4 on the Chrome page area.
// (CSS `zoom` on <html> is NOT Chrome zoom: media queries and layout still see 1512 wide.)
//
// Usage (canonical: kun/.claude/skills/shoot/scripts/shoot.mjs, installed to ~/.claude/skills/shoot/scripts/):
//   node shoot.mjs /ar/students /en/teachers             stills, one login per language, named by url slug
//   node shoot.mjs --flow add-student --lang ar,en        run flows/<repo>/add-student.mjs once per language
//   node shoot.mjs --flow add-student --cleanup          only undo what the flow creates (after a crash)
//   options: --host <url>  --role admin|teacher|student|guardian|accountant|staff  --repo hogwarts
//            --brand <id>  --out <dir>  --zoom 1.25  --full  --name <stem>  --clock 2026-10-01T09:00:00
//            --mask "<css>,<css>"  --no-derive  --device iphone-16 (Playwright device, WebKit for iPhones)
// Flow modules may export `initScript` (runs in every page first) and `masks` (CSS selectors).
//
// Deterministic by construction: light scheme, reduced motion, brand timezone, CSS animations frozen,
// caret hidden, [data-media-mask] (and --mask) painted over, and every shot waits until visible
// images are decoded, blur-up images report data-loaded, and no skeleton is on screen.
// --clock pins Date (off by default: server-rendered dates would not match a client-side clock).
//
// Output: <repo>/public/screenshot/<slug>-<locale>.png   (/ar/students → students-ar.png, /ar → home-ar.png)
//         <repo>/public/screenshot/<flow>/<NN>-<step>-<locale>.png for flows
//         …/derived/<stem>-{1600,2400}.{avif,webp} via media.sh derive (PNG masters are oxipng'd in place)

import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { brand as brandOf, requireRt } from "../../edit/scripts/media/rt.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
if (!args.length || args.includes("--help") || args.includes("-h")) {
  console.log("usage: shoot.mjs <path|url>… | --flow <name> [--lang ar,en] [--role admin] [--host url] [--repo hogwarts] [--brand id] [--out dir] [--zoom 1.25] [--full] [--name stem] [--clock iso] [--mask css,css] [--no-derive] [--cleanup]")
  process.exit(0)
}
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`)
  if (i === -1) return d
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const flag = (k) => {
  const i = args.indexOf(`--${k}`)
  if (i === -1) return false
  args.splice(i, 1)
  return true
}

const repo = opt("repo", "hogwarts")
const REPO_BRAND = { hogwarts: "balqalam", mkan: "mkan", kun: "kun", marketing: "databayt" }
const brand = brandOf(opt("brand", REPO_BRAND[repo] || repo))
const host = opt("host", brand.hosts?.demo || brand.hosts?.prod || "https://demo.balqalam.com").replace(/\/$/, "")
const role = opt("role", "admin")
const zoom = Number(opt("zoom", "1.25"))
const flowName = opt("flow")
const forcedName = opt("name")
const clock = opt("clock")
const langs = opt("lang", "").split(",").filter(Boolean)
const extraMasks = opt("mask", "").split(",").map((s) => s.trim()).filter(Boolean)
const deviceArg = opt("device")
const full = flag("full")
const cleanupOnly = flag("cleanup")
const derive = !flag("no-derive")
const repoDir = join(homedir(), repo)
const outDir = opt("out", join(repoDir, "public/screenshot"))
const paths = args

// Mac truth: 1512x982 logical screen minus menu bar (~38) and Chrome tabs+toolbar (~87).
const SCREEN = { width: 1512, height: 857 }
const viewport = {
  width: Math.round(SCREEN.width / zoom),
  height: Math.round(SCREEN.height / zoom),
}
const deviceScaleFactor = 2 * zoom

// Order of the demo role picker = DEMO_ROLE_KEYS in hogwarts src/components/auth/login/demo-accounts.ts.
// Picked by position, then verified against the authjs.role cookie so a reorder fails loudly.
const DEMO_ROLES = ["admin", "teacher", "student", "guardian", "accountant", "staff", "user", "applicant"]

// Playwright comes from the media runtime (pinned to kun's version), so shoot works in any repo.
let pw
try {
  pw = requireRt("playwright-core")
} catch {
  pw = createRequire(join(repoDir, "package.json"))("@playwright/test")
}

// --device iphone-16 → Playwright's "iPhone 16": the page area under Safari's bars (393x659),
// DPR 3, touch, iOS Safari UA — rendered by WebKit, Safari's engine. Shots go to a device folder.
const deviceKey = deviceArg && Object.keys(pw.devices).find((k) => k.toLowerCase().replace(/\s+/g, "-") === deviceArg.toLowerCase().replace(/\s+/g, "-"))
if (deviceArg && !deviceKey) throw new Error(`unknown --device "${deviceArg}" — e.g. iphone-16, iphone-16-pro-max, pixel-7`)
const device = deviceKey ? pw.devices[deviceKey] : null
const deviceDir = deviceKey ? deviceKey.toLowerCase().replace(/\s+/g, "-") : ""

const toUrl = (p) => (/^https?:/.test(p) ? p : host + (p.startsWith("/") ? p : `/${p}`))
// /ar/s/demo/students/new → students-new-ar ; /ar → home-ar
function slug(u) {
  const parts = new URL(u).pathname.split("/").filter(Boolean)
  const locale = ["ar", "en"].includes(parts[0]) ? parts.shift() : ""
  if (parts[0] === "s") parts.splice(0, 2)
  const base = parts.join("-") || "home"
  return locale ? `${base}-${locale}` : base
}
const localeOf = (u) => {
  const seg = new URL(u).pathname.split("/")[1]
  return ["ar", "en"].includes(seg) ? seg : "ar"
}
// When a run is pinned to a language, flows written with /ar/… paths follow it.
const withLang = (u, lang) => (lang ? u.replace(/^(https?:\/\/[^/]+)?\/(ar|en)(?=\/|$)/, (_, origin = "") => `${origin}/${lang}`) : u)

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  const ok = await page
    .waitForFunction(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
      }
      if ([...document.images].filter(vis).some((i) => !i.complete || i.naturalWidth === 0)) return false
      // BlurImage stamps data-loaded once the real pixels are in; before that it carries blur-xl/opacity-0.
      if ([...document.querySelectorAll("img.blur-xl:not([data-loaded]), img.opacity-0:not([data-loaded])")].some(vis)) return false
      if ([...document.querySelectorAll('[data-slot="skeleton"], .animate-pulse, .animate-spin, [aria-busy="true"]')].some(vis)) return false
      return true
    }, null, { timeout: 10000, polling: 200 })
    .then(() => true)
    .catch(() => false)
  if (!ok) console.warn("  ⚠ page not fully settled after 10s (images/skeletons still loading) — shooting anyway")
  await page.waitForTimeout(250)
}

const browser = await pw[device?.defaultBrowserType || "chromium"].launch()
const sessions = new Map()
async function session(lang) {
  const key = lang || "default"
  if (sessions.has(key)) return sessions.get(key)
  const locale = brand.locales?.[lang || "ar"] || lang || "ar"
  const ctx = await browser.newContext({
    ...(device ?? { viewport, deviceScaleFactor }), locale,
    timezoneId: brand.timezone || "Africa/Khartoum",
    colorScheme: "light", reducedMotion: "reduce",
  })
  if (clock) await ctx.clock.setFixedTime(new Date(clock))
  // A phone is a returning visitor: the "add to home screen" sheet (hogwarts offline/install-card)
  // was dismissed already, so it never covers the page being shot.
  if (device?.isMobile) await ctx.addInitScript(() => { try { localStorage.setItem("pwa-install-dismissed-at", String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  const s = { ctx, page, lang, loggedIn: false }
  sessions.set(key, s)
  return s
}

async function loginIfAsked(s, wanted) {
  const { page, ctx } = s
  const trigger = page.locator("#demo-role")
  if (!(await trigger.isVisible().catch(() => false))) return
  const idx = DEMO_ROLES.indexOf(role)
  if (idx < 0) throw new Error(`unknown role "${role}" — one of ${DEMO_ROLES.join(", ")}`)
  if (idx > 0) {
    await trigger.click()
    await page.getByRole("option").nth(idx).click()
  }
  await page.locator("#demo-role ~ button, button:has-text('دخول'), button:has-text('Login')").first().click()
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60000 }).catch(() => {})
  await settle(page)
  const got = (await ctx.cookies()).find((c) => c.name === "authjs.role")?.value
  if (got && got.toLowerCase() !== role.toLowerCase()) {
    throw new Error(`logged in as ${got}, wanted ${role} — DEMO_ROLES drifted from hogwarts demo-accounts.ts`)
  }
  s.loggedIn = true
  if (new URL(page.url()).pathname !== new URL(wanted).pathname) {
    await page.goto(wanted, { waitUntil: "load", timeout: 90000 })
  }
}

const saved = []
function api(s) {
  const { page, lang } = s
  const go = async (p) => {
    const url = withLang(toUrl(p), lang)
    await page.goto(url, { waitUntil: "load", timeout: 90000 })
    await settle(page)
    await loginIfAsked(s, url)
    await settle(page)
    return url
  }
  const snap = async (file, masks = []) => {
    await settle(page)
    mkdirSync(dirname(file), { recursive: true })
    await page.screenshot({
      path: file, fullPage: full, animations: "disabled", caret: "hide", scale: "device",
      mask: ["[data-media-mask]", ...extraMasks, ...masks].map((sel) => page.locator(sel)),
      maskColor: "#e9e9e7",
    })
    saved.push(file)
    console.log(`✓ ${file}`)
  }
  const t = (ar, en) => (lang === "en" ? en : ar)
  return { page, go, snap, settle: () => settle(page), lang: lang || "ar", t }
}

try {
  if (flowName) {
    const flowFile = join(here, "..", "flows", repo, `${flowName}.mjs`)
    if (!existsSync(flowFile)) throw new Error(`no flow at ${flowFile}`)
    const mod = await import(pathToFileURL(flowFile).href)
    for (const lang of langs.length ? langs : [null]) {
      const s = await session(lang)
      // a flow's initScript runs in every page before its own scripts (e.g. blur real phone numbers)
      if (mod.initScript && !s.init) { await s.ctx.addInitScript(mod.initScript); s.init = true }
      const a = api(s)
      if (cleanupOnly) {
        if (!mod.cleanup) throw new Error(`${flowName} exports no cleanup`)
        await mod.cleanup({ page: a.page, go: a.go, settle: a.settle, t: a.t, lang: a.lang })
        console.log(`cleanup done: ${flowName}${lang ? ` (${lang})` : ""}`)
        continue
      }
      let n = 0
      const shot = (step) =>
        a.snap(join(outDir, flowName, deviceDir, `${String(++n).padStart(2, "0")}-${step}-${lang || localeOf(a.page.url())}.png`), mod.masks || [])
      await mod.default({ page: a.page, go: a.go, shot, settle: a.settle, t: a.t, lang: a.lang, device: deviceKey })
    }
  } else {
    if (!paths.length) throw new Error("give at least one path or URL, or --flow <name>")
    for (const p of paths) {
      const lang = localeOf(toUrl(p))
      const a = api(await session(lang))
      const url = await a.go(p)
      await a.snap(join(outDir, deviceDir, `${forcedName && paths.length === 1 ? forcedName : slug(url)}.png`))
    }
  }
} finally {
  await browser.close()
}

if (derive && saved.length) {
  const media = join(here, "../../edit/scripts/media.sh")
  const r = spawnSync(media, ["derive", ...saved, "--kind", "ui"], { encoding: "utf8" })
  if (r.status === 0) {
    for (const e of JSON.parse(r.stdout)) {
      const kb = (x) => (x ? `${Math.round(x.bytes / 1024)}KB` : "—")
      console.log(`  ↳ ${e.master.split("/").pop()}: png ${Math.round(e.masterBytes / 1024)}KB · avif@1600 ${kb(e.avif[1600])} · webp@1600 ${kb(e.webp[1600])}`)
    }
  } else console.warn(`  ⚠ derive failed: ${(r.stderr || "").slice(-300)}`)
}
const vp = device?.viewport ?? viewport
console.log(`${saved.length} shot(s) · ${deviceKey ? `${deviceKey} · ` : ""}viewport ${vp.width}x${vp.height} @${device?.deviceScaleFactor ?? deviceScaleFactor}x · role ${role} · brand ${brand.id}`)
