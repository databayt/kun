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
//   node shoot.mjs --flow add-student,add-teacher         several flows, one browser, one login per language + role
//   node shoot.mjs --support --stale --lang ar,en --publish   every help-center flow whose source changed (or never shot)
//   node shoot.mjs --flow add-student --cleanup          only undo what the flow creates (after a crash)
//   options: --host <url>  --role admin|teacher|student|guardian|accountant|staff  --repo hogwarts
//            --brand <id>  --out <dir>  --zoom 1.25  --full  --name <stem>  --clock 2026-10-01T09:00:00
//            --mask "<css>,<css>"  --no-derive  --device iphone-16 (Playwright device, WebKit for iPhones)  --standalone (as the installed PWA)
//            --publish  (flows only: hand each flow's fresh stills to publish.mjs → CDN + the product manifest)
//            --support  (the flows the repo's help guides name: content/docs-en/support/*.mdx `flow:`)
//            --stale    (keep only flows `record.sh stale --flows` lists, plus flows never shot)
//            --video    (after the stills, re-film every flow that has a sim: the take + tutorial, then the
//                        cuts its sim module lists — `reel`, `clips` — and the story cuts already on disk,
//                        which reuse their cached voice; with --publish, the videos go out too)
// Flow modules may export `initScript` (runs in every page first), `masks` (CSS selectors),
// `role` (the demo account it needs; "guest" = never log in — an explicit --role wins) and
// `device` (e.g. "iphone-16" for a phone-only flow; an explicit --device wins).
// A clean run of a flow deletes that flow's older stills it did not re-take (a renumbered or
// dropped step), so the folder — and what publish sends — is exactly the flow as it is now.
//
// Deterministic by construction: light scheme, reduced motion, brand timezone, CSS animations frozen,
// caret hidden, [data-chat-button] / [data-media-hide] hidden, [data-media-mask] (and --mask) painted over, and every shot waits until visible
// images are decoded, blur-up images report data-loaded, and no skeleton is on screen.
// --clock pins Date (off by default: server-rendered dates would not match a client-side clock).
//
// Output: ~/media/<repo>/page/<slug>-<locale>.png   (/ar/students → students-ar.png, /ar → home-ar.png)
//         ~/media/<repo>/<flow>/<NN>-<step>-<locale>.png for flows (<flow>/<device>/… with --device)
//         …/derived/<stem>-{1600,2400}.{avif,webp} via media.sh derive (PNG masters are oxipng'd in place)

import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { brand as brandOf, MEDIA_HOME, mediaRoot, REPO_BRAND, requireRt } from "../../edit/scripts/media/rt.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
if (!args.length || args.includes("--help") || args.includes("-h")) {
  console.log("usage: shoot.mjs <path|url>… | --flow <name>[,<name>…] | --support [--stale] [--lang ar,en] [--publish] [--role admin] [--host url] [--repo hogwarts] [--brand id] [--out dir] [--zoom 1.25] [--full] [--name stem] [--clock iso] [--mask css,css] [--no-derive] [--cleanup]")
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
const brand = brandOf(opt("brand", REPO_BRAND[repo] || repo))
const host = opt("host", brand.hosts?.demo || brand.hosts?.prod || "https://demo.balqalam.com").replace(/\/$/, "")
const roleArg = opt("role")
const role = roleArg || "admin"
const zoom = Number(opt("zoom", "1.25"))
const flowArg = opt("flow")
const forcedName = opt("name")
const clock = opt("clock")
const langs = opt("lang", "").split(",").filter(Boolean)
const extraMasks = opt("mask", "").split(",").map((s) => s.trim()).filter(Boolean)
const deviceArg = opt("device")
const standalone = flag("standalone")
const full = flag("full")
const cleanupOnly = flag("cleanup")
const derive = !flag("no-derive")
const publishAfter = flag("publish")
const supportFlows = flag("support")
const onlyStale = flag("stale")
const videoAfter = flag("video")
const repoDir = join(homedir(), repo)
const outDir = opt("out", mediaRoot(repo))
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
// No device = the Mac frame. A flow may name its own (`export const device`); --device wins.
const dashed = (k) => k.toLowerCase().replace(/\s+/g, "-")
function deviceOf(name) {
  if (!name) return { key: undefined, desc: null, dir: "" }
  const key = Object.keys(pw.devices).find((k) => dashed(k) === dashed(name))
  if (!key) throw new Error(`unknown device "${name}" — e.g. iphone-16, iphone-16-pro-max, pixel-7`)
  if (!standalone) return { key, desc: pw.devices[key], dir: dashed(key) }
  // --standalone: the app as an installed PWA opened from the home screen — no Safari bars, so the
  // page fills the screen under the status bar (47pt on notch phones, 54pt under a Dynamic Island),
  // and `display-mode: standalone` matches. iphone-14 + --standalone is the iPhone 16e (same panel).
  const d = pw.devices[key]
  const bar = d.screen.height >= 852 ? 54 : 47
  const desc = { ...d, viewport: { width: d.screen.width, height: d.screen.height - bar } }
  return { key, desc, dir: `${dashed(key)}-pwa`, standalone: true }
}
const cliDevice = deviceOf(deviceArg)

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

// One browser per engine and one context per (device, language, role), shared by every flow of
// the run — a batch of twenty flows logs in once per language, not twenty times.
const browsers = new Map()
async function browserFor(type) {
  if (!browsers.has(type)) browsers.set(type, await pw[type].launch())
  return browsers.get(type)
}
const sessions = new Map()
async function session(lang, who = role, dev = cliDevice) {
  const key = `${dev.dir || "mac"}|${lang || "default"}|${who}`
  if (sessions.has(key)) return sessions.get(key)
  const device = dev.desc
  const browser = await browserFor(device?.defaultBrowserType || "chromium")
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
  if (dev.standalone) await ctx.addInitScript(() => {
    const mm = window.matchMedia.bind(window)
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { ...mm(q), matches: true, media: q } : mm(q))
    try { Object.defineProperty(navigator, "standalone", { value: true }) } catch {}
  })
  const page = await ctx.newPage()
  const s = { ctx, page, lang, role: who, dev, loggedIn: false, inits: new Set() }
  sessions.set(key, s)
  return s
}

async function loginIfAsked(s, wanted) {
  const { page, ctx, role } = s
  if (role === "guest") return // a signed-out flow (the login page itself) never picks a demo role
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
let current = null // the flow being shot, so snap() can file each still under it
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
      // floating helpers (the hogwarts chat launcher) are chrome, not the flow being taught
      style: "[data-chat-button],[data-media-hide]{visibility:hidden!important}",
    })
    saved.push(file)
    current?.files.push(file)
    console.log(`✓ ${file}`)
  }
  const t = (ar, en) => (lang === "en" ? en : ar)
  return { page, go, snap, settle: () => settle(page), lang: lang || "ar", t }
}

// ── which flows: --flow a,b · --support (the help guides' `flow:`) · --stale (only what changed) ──
function guideFlows() {
  const dir = join(repoDir, "content", "docs-en", "support")
  if (!existsSync(dir)) throw new Error(`--support: no help guides at ${dir}`)
  const names = readdirSync(dir).filter((f) => f.endsWith(".mdx"))
    .map((f) => /^---\n[\s\S]*?^flow:\s*["']?([\w-]+)/m.exec(readFileSync(join(dir, f), "utf8"))?.[1])
  return [...new Set(names.filter(Boolean))].sort()
}
const recordSh = join(here, "../../../scripts/record.sh")
function staleFilter(list) {
  const r = spawnSync("bash", [recordSh, "stale", repo, "--flows"], { encoding: "utf8" })
  if (r.status !== 0) throw new Error(`record.sh stale failed: ${(r.stderr || "").slice(-300)}`)
  const stale = new Set(r.stdout.split("\n").filter(Boolean))
  // a flow with nothing published yet is a gap, which is staler than stale
  const manifest = join(MEDIA_HOME, "manifest.json")
  const shot = new Set(existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")).assets.filter((a) => a.repo === repo).map((a) => a.flow) : [])
  return list.filter((f) => stale.has(f) || !shot.has(f))
}
let flows = (flowArg || "").split(",").map((f) => f.trim()).filter(Boolean)
if (supportFlows) flows = [...new Set([...flows, ...guideFlows()])]
if (onlyStale) {
  if (!flows.length) throw new Error("--stale filters a set of flows: add --flow <a,b> or --support")
  const all = flows
  flows = staleFilter(all)
  console.log(`stale: ${flows.length} of ${all.length} flow(s)${flows.length ? ` — ${flows.join(", ")}` : " — everything is current"}`)
  if (!flows.length) process.exit(0)
}

// The commit the shots show: local HEAD for a local host; for a remote one, the last commit that
// reached origin/main — unpushed work is not on the host, so stamping HEAD would mark a still
// "fresh" against code it never saw. (Pushed is not always deployed: deploy before a re-shoot.)
const git = (...a) => spawnSync("git", ["-C", repoDir, ...a], { encoding: "utf8" })
const localHost = /^https?:\/\/([\w-]+\.)*localhost(:\d+)?$/.test(host)
const base = localHost ? "HEAD" : git("merge-base", "HEAD", "origin/main").stdout?.trim() || "HEAD"
const sha = git("rev-parse", "--short", base).stdout?.trim() || ""

/** Delete this flow's older stills (and their derivatives) that the clean run did not re-take. */
function pruneOld(dir, files) {
  const kept = new Set(files.map((f) => f.split("/").pop()))
  const langs = new Set([...kept].map((f) => /-(ar|en)\.png$/.exec(f)?.[1]).filter(Boolean))
  if (!existsSync(dir)) return []
  const gone = []
  for (const f of readdirSync(dir)) {
    const m = /^\d+-.+-(ar|en)\.png$/.exec(f)
    if (!m || !langs.has(m[1]) || kept.has(f)) continue
    unlinkSync(join(dir, f))
    const stem = f.slice(0, -4)
    const derived = join(dir, "derived")
    if (existsSync(derived)) for (const d of readdirSync(derived)) if (d.startsWith(`${stem}-`)) unlinkSync(join(derived, d))
    gone.push(f)
  }
  return gone
}

const runs = [] // { flow, ok, files, error, dir }
try {
  if (flows.length) {
    for (const flowName of flows) {
      const flowFile = join(here, "..", "flows", repo, `${flowName}.mjs`)
      const run = { flow: flowName, ok: false, files: [], error: "" }
      runs.push(run)
      current = run
      try {
        if (!existsSync(flowFile)) throw new Error(`no flow at ${flowFile.replace(homedir(), "~")}`)
        const mod = await import(pathToFileURL(flowFile).href)
        if (!cleanupOnly && typeof mod.default !== "function") throw new Error("exports no default — a metadata-only module cannot be re-shot")
        const who = roleArg || mod.role || role
        const dev = deviceArg ? cliDevice : deviceOf(mod.device)
        run.dir = join(outDir, flowName, dev.dir)
        if (flows.length > 1) console.log(`\n▸ ${flowName}${who !== "admin" ? ` (${who})` : ""}${dev.key ? ` · ${dev.key}` : ""}`)
        for (const lang of langs.length ? langs : [null]) {
          const s = await session(lang, who, dev)
          // a flow's initScript runs in every page before its own scripts (e.g. blur real phone numbers);
          // contexts are shared across flows, so each distinct script is added once
          if (mod.initScript && !s.inits.has(mod.initScript)) { await s.ctx.addInitScript(mod.initScript); s.inits.add(mod.initScript) }
          const a = api(s)
          if (cleanupOnly) {
            if (!mod.cleanup) throw new Error(`${flowName} exports no cleanup`)
            await mod.cleanup({ page: a.page, go: a.go, settle: a.settle, t: a.t, lang: a.lang })
            console.log(`cleanup done: ${flowName}${lang ? ` (${lang})` : ""}`)
            continue
          }
          let n = 0
          const shot = (step) =>
            a.snap(join(run.dir, `${String(++n).padStart(2, "0")}-${step}-${lang || localeOf(a.page.url())}.png`), mod.masks || [])
          await mod.default({ page: a.page, go: a.go, shot, settle: a.settle, t: a.t, lang: a.lang, device: dev.key })
        }
        run.ok = true
        if (!cleanupOnly && run.files.length) {
          const gone = pruneOld(run.dir, run.files)
          if (gone.length) console.log(`  ↳ removed ${gone.length} older still(s) this run did not re-take: ${gone.join(" ")}`)
        }
        // a remote host does not run unpushed commits: say so instead of shooting the old UI silently
        if (!localHost && mod.paths?.length) {
          const ahead = git("log", "--oneline", "origin/main..HEAD", "--", ...mod.paths).stdout?.trim()
          if (ahead) console.warn(`  ⚠ ${flowName}: ${ahead.split("\n").length} unpushed commit(s) touch its source — ${host} shows the UI before them`)
        }
      } catch (e) {
        run.error = String(e?.message || e).split("\n")[0]
        console.error(`✗ ${flowName}: ${run.error}`)
        if (flows.length === 1) throw e
      }
    }
    current = null
  } else {
    if (!paths.length) throw new Error("give at least one path or URL, or --flow <name> / --support")
    for (const p of paths) {
      const lang = localeOf(toUrl(p))
      const a = api(await session(lang))
      const url = await a.go(p)
      await a.snap(join(outDir, "page", cliDevice.dir, `${forcedName && paths.length === 1 ? forcedName : slug(url)}.png`))
    }
  }
} finally {
  for (const b of browsers.values()) await b.close()
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
const vp = cliDevice.desc?.viewport ?? viewport
console.log(`${saved.length} shot(s) · ${cliDevice.key ? `${cliDevice.key} · ` : ""}viewport ${vp.width}x${vp.height} @${cliDevice.desc?.deviceScaleFactor ?? deviceScaleFactor}x · role ${role} · brand ${brand.id}`)

// --publish: each flow that ran clean sends its stills to the CDN and the product manifest (see
// publish.mjs), stamped with the commit the host was running. A failed flow publishes nothing.
if (publishAfter && !cleanupOnly && runs.length) {
  if (!derive) console.warn("  ⚠ --publish needs derivatives; drop --no-derive")
  else for (const run of runs.filter((r) => r.ok && r.files.length)) {
    const r = spawnSync("node", [join(here, "publish.mjs"), "--flow", run.flow, "--repo", repo, "--brand", brand.id, "--only", "stills", "--sha", sha, ...(langs.length ? ["--lang", langs.join(",")] : [])], { stdio: "inherit" })
    if (r.status !== 0) { run.ok = false; run.error = "publish failed" }
  }
}

// --video: the tutorial follows the stills. Serial by nature (one take drives one demo session), and
// every cut after the take is a --direct-only re-compose of it, which costs seconds, not a retake.
if (videoAfter && !cleanupOnly) {
  const node = (script, extra) => spawnSync("node", [join(here, script), "--flow", ...extra], { stdio: "inherit" }).status === 0
  for (const run of runs.filter((r) => r.ok)) {
    const simFile = join(here, "..", "sims", repo, `${run.flow}.mjs`)
    if (!existsSync(simFile)) { run.video = "—"; continue }
    const sm = await import(pathToFileURL(simFile).href)
    const base = [run.flow, "--repo", repo, "--brand", brand.id, "--host", host]
    console.log(`\n▸ ${run.flow} · video`)
    let ok = node("sim.mjs", base)
    if (ok && sm.reel) ok = node("sim.mjs", [...base, "--direct-only", "--aspect", "9:16"])
    for (const [name, range] of Object.entries(sm.clips || {})) if (ok) ok = node("sim.mjs", [...base, "--direct-only", "--steps", range, "--name", name])
    // story cuts (stills + a stock voice) that exist re-render over the fresh stills; lines cache by text
    const storyFile = join(here, "..", "sims", repo, `${run.flow}.story.json`)
    const flowDir = join(outDir, run.flow)
    if (ok && existsSync(storyFile) && existsSync(flowDir)) {
      const cuts = Object.keys(JSON.parse(readFileSync(storyFile, "utf8")).cuts || {})
      for (const f of readdirSync(flowDir)) {
        const m = new RegExp(`^${run.flow}-(${cuts.join("|")})-(mac|iphone)-ar\\.mp4$`).exec(f)
        if (m && ok) ok = node("story.mjs", [run.flow, "--repo", repo, "--device", m[2], "--cut", m[1]])
      }
    }
    if (ok && publishAfter) {
      const r = spawnSync("node", [join(here, "publish.mjs"), "--flow", run.flow, "--repo", repo, "--brand", brand.id, "--only", "video", "--sha", sha], { stdio: "inherit" })
      ok = r.status === 0
    }
    run.video = ok ? "ok" : "FAILED"
    if (!ok) { run.ok = false; run.error = run.error || "video failed" }
  }
}

if (runs.length > 1 || runs.some((r) => !r.ok)) {
  console.log(`\nflow                  stills  ${videoAfter ? "video   " : ""}result`)
  for (const r of runs) console.log(`${r.flow.padEnd(22)}${String(r.files.length).padStart(6)}  ${videoAfter ? `${(r.video || "").padEnd(8)}` : ""}${r.ok ? "ok" : `FAILED — ${r.error}`}`)
}
if (runs.some((r) => !r.ok)) process.exitCode = 1
