#!/usr/bin/env node
// shoot.mjs — headless stills that match Abdout's own manual screenshot: a 14" MacBook Pro M4
// ("looks like 1512x982", Retina 2x), Chrome window filling the screen, page zoomed to 125%.
// Chrome at 125% on that screen = a 1210x686 CSS viewport rendered at devicePixelRatio 2.5,
// so the PNG is ~3025x1715 — same pixels as cmd+shift+4 on the Chrome page area.
// (CSS `zoom` on <html> is NOT Chrome zoom: media queries and layout still see 1512 wide.)
//
// Usage (canonical: kun/.claude/skills/record/scripts/shoot.mjs, installed to ~/.claude/skills/record/scripts/):
//   node shoot.mjs /ar/students /ar/teachers              stills, one login, named by url slug
//   node shoot.mjs --flow add-student                      run flows/<repo>/add-student.mjs → numbered steps
//   node shoot.mjs --flow add-student --cleanup           only undo what the flow creates (after a crash)
//   options: --host https://demo.balqalam.com  --role admin|teacher|student|guardian|accountant|staff
//            --repo hogwarts  --out <dir>  --zoom 1.25  --full (full-page)  --name <file-stem>
//
// Output: <repo>/public/screenshot/<slug>-<locale>.png   (/ar/students → students-ar.png, /ar → home-ar.png)
//         <repo>/public/screenshot/<flow>/<NN>-<step>-<locale>.png for flows

import { createRequire } from "node:module"
import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const args = process.argv.slice(2)
if (!args.length || args.includes("--help") || args.includes("-h")) {
  console.log("usage: shoot.mjs <path|url>… | --flow <name>  [--role admin] [--host url] [--repo hogwarts] [--out dir] [--zoom 1.25] [--full] [--name stem] [--cleanup]")
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
const host = opt("host", "https://demo.balqalam.com").replace(/\/$/, "")
const role = opt("role", "admin")
const zoom = Number(opt("zoom", "1.25"))
const flowName = opt("flow")
const forcedName = opt("name")
const full = flag("full")
const cleanupOnly = flag("cleanup")
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

// Order of the demo role picker = DEMO_ROLE_KEYS in hogwarts src/components/auth/login/demo-accounts.ts
const DEMO_ROLES = ["admin", "teacher", "student", "guardian", "accountant", "staff", "user", "applicant"]

const require = createRequire(join(repoDir, "package.json"))
const { chromium } = require("@playwright/test")

const toUrl = (p) => (/^https?:/.test(p) ? p : host + (p.startsWith("/") ? p : `/${p}`))
// /ar/s/demo/students/new → students-new-ar ; /ar → home-ar
function slug(u) {
  const parts = new URL(u).pathname.split("/").filter(Boolean)
  const locale = ["ar", "en"].includes(parts[0]) ? parts.shift() : ""
  if (parts[0] === "s") parts.splice(0, 2)
  const base = parts.join("-") || "home"
  return locale ? `${base}-${locale}` : base
}
const localeOf = (u) => new URL(u).pathname.split("/")[1] || "ar"

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  await page.waitForTimeout(800)
}

async function loginIfAsked(page, wanted) {
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
  if (new URL(page.url()).pathname !== new URL(wanted).pathname) {
    await page.goto(wanted, { waitUntil: "load", timeout: 90000 })
  }
}

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport, deviceScaleFactor, locale: "ar" })
const page = await ctx.newPage()
const saved = []

async function go(p) {
  const url = toUrl(p)
  await page.goto(url, { waitUntil: "load", timeout: 90000 })
  await settle(page)
  await loginIfAsked(page, url)
  await settle(page)
  return url
}

async function snap(file) {
  await settle(page)
  mkdirSync(dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: full })
  saved.push(file)
  console.log(`✓ ${file}`)
}

try {
  if (flowName) {
    const here = dirname(fileURLToPath(import.meta.url))
    const flowFile = join(here, "..", "flows", repo, `${flowName}.mjs`)
    if (!existsSync(flowFile)) throw new Error(`no flow at ${flowFile}`)
    const mod = await import(pathToFileURL(flowFile).href)
    if (cleanupOnly) {
      if (!mod.cleanup) throw new Error(`${flowName} exports no cleanup`)
      await mod.cleanup({ page, go, settle })
      console.log(`cleanup done: ${flowName}`)
    }
    const flow = cleanupOnly ? async () => {} : mod.default
    let n = 0
    const shot = (step) =>
      snap(join(outDir, flowName, `${String(++n).padStart(2, "0")}-${step}-${localeOf(page.url())}.png`))
    await flow({ page, go, shot, settle })
  } else {
    if (!paths.length) throw new Error("give at least one path or URL, or --flow <name>")
    for (const p of paths) {
      const url = await go(p)
      await snap(join(outDir, `${forcedName && paths.length === 1 ? forcedName : slug(url)}.png`))
    }
  }
} finally {
  await browser.close()
}
console.log(`${saved.length} shot(s) · viewport ${viewport.width}x${viewport.height} @${deviceScaleFactor}x · role ${role}`)
