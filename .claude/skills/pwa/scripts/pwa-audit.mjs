#!/usr/bin/env node
// pwa-audit — is this origin installable, and does its service worker's
// precache survive a redirect? Zero dependencies; Node 18+ (global fetch).
//
//   node pwa-audit.mjs https://kingfahd.balqalam.com [--sw /service-worker.js] [--json]
//
// Lighthouse 12 dropped the PWA category, so this script is the audit. It
// checks the Chrome install criteria (web.dev/articles/install-criteria) plus
// the traps that bit hogwarts: icons that 500, precache entries that redirect
// (a redirected response is refused for navigations), missing theme-color and
// apple-touch-icon.

const args = process.argv.slice(2)
const target = args.find((a) => !a.startsWith("--"))
if (!target) {
  console.error("usage: pwa-audit.mjs <url> [--sw /service-worker.js] [--json]")
  process.exit(2)
}
const swArg = args.includes("--sw") ? args[args.indexOf("--sw") + 1] : null
const asJson = args.includes("--json")

const DISPLAY = new Set(["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"])
const UA = "kun-pwa-audit/1.0 (+https://kun.databayt.org/docs/pwa)"
const rows = []
const add = (check, status, detail = "") => rows.push({ check, status, detail })
const pass = (c, d) => add(c, "PASS", d)
const warn = (c, d) => add(c, "WARN", d)
const fail = (c, d) => add(c, "FAIL", d)

async function get(url, opts = {}) {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, ...opts })
    return res
  } catch (err) {
    return { ok: false, status: 0, headers: new Headers(), text: async () => "", error: err }
  }
}

async function head(url) {
  const res = await get(url, { method: "HEAD" })
  if (res.status === 405 || res.status === 0) return get(url)
  return res
}

const pageUrl = new URL(target)
const origin = pageUrl.origin

// 1. The page: manifest link, theme-color, apple-touch-icon
const page = await get(pageUrl.href, { redirect: "follow" })
const html = page.status === 200 ? await page.text() : ""
if (page.status !== 200) fail("page", `${pageUrl.href} → ${page.status}`)
else pass("page", `${page.url ?? pageUrl.href} → 200`)

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}=["']([^"']+)["']`))
  return m ? m[1] : null
}
const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0])
const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0])

const manifestLink = links.find((l) => /rel=["']manifest["']/.test(l))
const manifestHref = manifestLink ? attr(manifestLink, "href") : "/manifest.webmanifest"
if (!manifestLink) warn("manifest link", "no <link rel=manifest> in HTML — trying /manifest.webmanifest")

const themeMeta = metas.find((m) => /name=["']theme-color["']/.test(m))
themeMeta ? pass("theme-color meta", attr(themeMeta, "content") ?? "") : fail("theme-color meta", "missing — add viewport.themeColor")

const appleIcon = links.find((l) => /rel=["']apple-touch-icon["']/.test(l))
if (appleIcon) {
  const href = new URL(attr(appleIcon, "href"), origin).href
  const r = await head(href)
  r.status === 200 ? pass("apple-touch-icon", href) : fail("apple-touch-icon", `${href} → ${r.status}`)
} else fail("apple-touch-icon", "missing — iOS falls back to a screenshot")

const appleCapable = metas.find((m) => /name=["'](apple-)?mobile-web-app-capable["']/.test(m))
appleCapable ? pass("mobile-web-app-capable", "") : warn("mobile-web-app-capable", "missing — set metadata.appleWebApp.capable")

// 2. The manifest
const manifestUrl = new URL(manifestHref, origin).href
const mres = await get(manifestUrl, { redirect: "manual" })
let manifest = null
if (mres.status !== 200) fail("manifest", `${manifestUrl} → ${mres.status}`)
else {
  const ct = mres.headers.get("content-type") ?? ""
  ;/manifest\+json|application\/json/.test(ct) ? pass("manifest", `${manifestUrl} (${ct.split(";")[0]})`) : warn("manifest content-type", ct)
  try {
    manifest = JSON.parse(await mres.text())
  } catch {
    fail("manifest json", "unparseable")
  }
}

const sizePx = (s) => {
  const m = String(s ?? "").match(/(\d+)x(\d+)/)
  return m ? Math.min(+m[1], +m[2]) : 0
}

if (manifest) {
  manifest.name || manifest.short_name ? pass("name|short_name", manifest.name ?? manifest.short_name) : fail("name|short_name", "missing")
  if (manifest.short_name && manifest.short_name.length > 12) warn("short_name", `${manifest.short_name.length} chars — launchers truncate past 12`)
  manifest.start_url ? pass("start_url", manifest.start_url) : fail("start_url", "missing")
  if (manifest.start_url) {
    const su = new URL(manifest.start_url, origin)
    if (su.origin !== origin) fail("start_url origin", `${su.origin} ≠ ${origin} — not installable`)
  }
  DISPLAY.has(manifest.display) ? pass("display", manifest.display) : fail("display", `${manifest.display} — need one of ${[...DISPLAY].join("|")}`)
  manifest.prefer_related_applications === true ? fail("prefer_related_applications", "true blocks install") : pass("prefer_related_applications", String(manifest.prefer_related_applications ?? "unset"))
  manifest.lang ? pass("lang", `${manifest.lang} · dir=${manifest.dir ?? "unset"}`) : warn("lang", "missing — launchers show the wrong script direction")
  if (manifest.dir === "auto" || !manifest.dir) warn("dir", `${manifest.dir ?? "unset"} — set rtl for Arabic-default products`)
  manifest.theme_color ? pass("theme_color", manifest.theme_color) : warn("theme_color", "missing")

  const icons = Array.isArray(manifest.icons) ? manifest.icons : []
  const png = icons.filter((i) => /png/.test(i.type ?? "") || /\.png(\?|$)/.test(i.src ?? ""))
  const has192 = png.some((i) => sizePx(i.sizes) >= 192)
  const has512 = png.some((i) => sizePx(i.sizes) >= 512)
  has192 && has512 ? pass("icons 192+512 png", `${png.length} png icons`) : fail("icons 192+512 png", `192:${has192} 512:${has512} — "any" does not satisfy the install check`)
  const maskable = icons.some((i) => /maskable/.test(i.purpose ?? ""))
  maskable ? pass("maskable icon", "") : warn("maskable icon", "none — Android shows a letterboxed icon")

  const iconUrls = new Set()
  for (const i of icons) if (i.src) iconUrls.add(new URL(i.src, origin).href)
  for (const s of manifest.shortcuts ?? []) for (const i of s.icons ?? []) if (i.src) iconUrls.add(new URL(i.src, origin).href)
  for (const s of manifest.screenshots ?? []) if (s.src) iconUrls.add(new URL(s.src, origin).href)
  for (const u of iconUrls) {
    const r = await head(u)
    const ct = r.headers?.get?.("content-type") ?? ""
    r.status === 200 && /^image\//.test(ct) ? pass("icon", `${u.replace(origin, "")}`) : fail("icon", `${u.replace(origin, "")} → ${r.status} ${ct}`)
  }
  for (const s of manifest.shortcuts ?? []) {
    const su = new URL(s.url, origin)
    const scope = new URL(manifest.scope ?? "/", origin)
    su.href.startsWith(scope.href) ? pass("shortcut in scope", s.url) : fail("shortcut in scope", `${s.url} outside ${scope.pathname}`)
  }
}

// 3. The service worker and its precache list
if (swArg) {
  const swUrl = new URL(swArg, origin).href
  const sres = await get(swUrl, { redirect: "manual" })
  if (sres.status !== 200) fail("service worker", `${swUrl} → ${sres.status}`)
  else {
    const ct = sres.headers.get("content-type") ?? ""
    ;/javascript/.test(ct) ? pass("service worker", `${swUrl} (${ct.split(";")[0]})`) : fail("service worker content-type", ct)
    const cc = sres.headers.get("cache-control") ?? ""
    ;/max-age=(?:[1-9]\d{3,})/.test(cc) && !/no-cache|must-revalidate/.test(cc) ? warn("sw cache-control", `${cc} — updates will lag`) : pass("sw cache-control", cc || "default")
    const js = await sres.text()
    const lists = [...js.matchAll(/addAll\(\s*([A-Za-z_$][\w$]*)\s*\)/g)].map((m) => m[1])
    const literal = (name) => {
      const m = js.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`))
      return m ? [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]) : []
    }
    const entries = new Set()
    for (const n of lists) for (const e of literal(n)) entries.add(e)
    for (const m of js.matchAll(/addAll\(\s*\[([^\]]*)\]/g)) for (const x of m[1].matchAll(/["']([^"']+)["']/g)) entries.add(x[1])
    if (entries.size === 0) warn("precache list", "no addAll([...]) literal found — inspect by hand")
    for (const e of entries) {
      const u = new URL(e, origin).href
      const r = await get(u, { redirect: "manual" })
      if (r.status >= 300 && r.status < 400) fail("precache entry", `${e} → ${r.status} to ${r.headers.get("location")} — redirected responses are refused for navigations`)
      else if (r.status !== 200) fail("precache entry", `${e} → ${r.status} — cache.addAll rejects, install fails`)
      else pass("precache entry", e)
    }
    ;/addEventListener\(\s*["']push["']/.test(js) ? pass("push handler", "") : warn("push handler", "none")
    ;/addEventListener\(\s*["']notificationclick["']/.test(js) ? pass("notificationclick handler", "") : warn("notificationclick handler", "none")
  }
} else warn("service worker", "skipped — pass --sw /service-worker.js")

// 4. Report
const failed = rows.filter((r) => r.status === "FAIL").length
const warned = rows.filter((r) => r.status === "WARN").length
if (asJson) {
  console.log(JSON.stringify({ origin, manifest: manifestUrl, failed, warned, rows }, null, 2))
} else {
  const w = Math.max(...rows.map((r) => r.check.length))
  for (const r of rows) console.log(`${r.status.padEnd(4)} ${r.check.padEnd(w)}  ${r.detail}`)
  console.log(`\n${origin}: ${failed} FAIL · ${warned} WARN · ${rows.length - failed - warned} PASS`)
}
process.exit(failed ? 1 : 0)
