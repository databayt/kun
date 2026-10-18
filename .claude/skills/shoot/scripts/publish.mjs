#!/usr/bin/env node
// publish.mjs — one flow folder → cdn.databayt.org + the product's media-manifest.json, in one go.
//   node publish.mjs --flow add-student [--repo hogwarts] [--lang ar,en] [--dry-run] [--only stills|video]
//   node publish.mjs --flow page                     the page stills (shoot.mjs <path>…)
//
// Reads ~/media/<repo>/<flow>/ (what shoot.mjs, sim.mjs and story.mjs write) and hands each asset
// to `media.sh publish --key` (clean stable keys, HEAD-verified, invalidated on overwrite, manifest upsert).
// Namespace + manifest come from the brand kit (production.<brand>.cdn / .manifest); the namespace
// is always the repo (hogwarts — balqalam is only the public name on screen). A flow's CDN home
// mirrors the app URL it films — `export const route = "<route>[/<flow>]"`, language first, the
// way the app puts [lang] first (route groups and s/[subdomain] never reach a URL, so never here):
//   tutorial    hogwarts/ar/students/add/video.mp4  (video.av1.mp4 · video.poster.webp · video.vtt)
//   still       hogwarts/ar/students/add/list.avif · list@2x.avif · list.webp · list@2x.webp
//   phone       hogwarts/ar/students/add/iphone-16/review.avif
//   reel, clip  hogwarts/ar/students/add/reel.mp4 · hogwarts/ar/students/add/details.mp4
//   english     the same path under en/: hogwarts/en/students/add/video.mp4
// Page stills land on their route: page/students-ar.png → hogwarts/ar/students/page.avif, home → hogwarts/ar/page.avif
// (a nested route spells its slashes as dots in the file name: page/finance.fees-ar.png → ar/finance/fees/page.avif).
// No hash in a key, ever: manifest URLs carry ?v=<sha8>, so a re-shoot reaches viewers on the same path.
//
// The id grammar — one name per asset, the same in the manifest, MDX and the CDN slug:
//   <flow>/<step>-<locale>           a still         add-student/created-ar      ← 12-created-ar.png
//   <flow>/<device>/<step>-<locale>  a phone still   add-student/iphone-16/review-ar ← iphone-16/03-review-ar.png
//   <flow>/video-<locale>            the tutorial    add-student/video-ar        ← add-student-ar.{mp4,av1.mp4,poster.webp,vtt}
//   <flow>/reel-<locale>             the 9:16 cut    add-student/reel-ar         ← add-student-ar.reel.mp4
//   <flow>/<clip>-<locale>           a support clip  add-student/details-ar      ← add-student-details-ar.*
//                                    a story cut     add-student/support-iphone-ar ← add-student-support-iphone-ar.*
//   page/<slug>-<locale>             a page still    page/students-ar            ← page/students-ar.png
// The NN order prefix stays in the file name and leaves the id (an image entry keeps it as `order`),
// so inserting a step never breaks a page link and the docs still list steps in shot order.
// Alt text and titles come from the flow module: `export const title = [ar, en]`, `export const alt = { step: [ar, en] }`;
// `export const block` / `paths` tell `record.sh stale` which source a re-shoot follows.

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { brand as brandOf, MEDIA_HOME, mediaRoot, REPO_BRAND } from "../../edit/scripts/media/rt.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i === -1 ? d : args[i + 1] }
const flag = (k) => args.includes(`--${k}`)

const flow = opt("flow")
if (!flow) { console.error("usage: publish.mjs --flow <name|page> [--repo hogwarts] [--lang ar,en] [--only stills|video] [--dry-run]"); process.exit(2) }
const repo = opt("repo", "hogwarts")
const brand = brandOf(opt("brand", REPO_BRAND[repo] || repo))
if (!brand.cdn || !brand.manifest) throw new Error(`brand-kit production.${brand.id} needs "cdn" and "manifest"`)
const langs = opt("lang", "ar,en").split(",")
const only = opt("only")
const dry = flag("dry-run")
const dir = join(mediaRoot(repo), flow)
const manifest = join(homedir(), repo, brand.manifest)
if (!existsSync(dir)) throw new Error(`nothing shot yet: ${dir}`)

const flowFile = join(here, "../flows", repo, `${flow}.mjs`)
const mod = existsSync(flowFile) ? await import(pathToFileURL(flowFile).href) : {}
const title = mod.title || ["", ""]
const alt = mod.alt || {}
const L = (pair, lang) => pair[lang === "en" ? 1 : 0] || ""

const media = join(here, "../../edit/scripts/media.sh")
const results = []
const published = []
const route = typeof mod.route === "string" ? mod.route.replace(/^\/+|\/+$/g, "") : undefined
if (flow !== "page" && !route) throw new Error(`${flowFile.replace(homedir(), "~")} needs \`export const route = "<route>[/<flow>]"\` — the app URL it films`)
const at = (lang, rest) => [lang, route, rest].filter(Boolean).join("/")
function publish(id, files, extra, key) {
  const r = spawnSync(media, ["publish", "--ns", brand.cdn, "--key", key, "--id", id, "--manifest", manifest, ...extra, ...(dry ? ["--dry-run"] : []), ...files], { encoding: "utf8" })
  if (r.status !== 0) throw new Error(`publish ${id} failed:\n${(r.stderr || r.stdout).slice(-600)}`)
  results.push(id)
  published.push(...files)
  console.log(`✓ ${id}  → ${brand.cdn}/${key}  (${files.length} file${files.length > 1 ? "s" : ""})`)
}

// ── stills: every [NN-]<step>-<locale>.png with whatever avif/webp widths derive made ──
// (derive never upscales, so a 1179 px phone still carries -1179 rather than -1600/-2400)
const SKIP = new Set(["derived", "qa", "raw", "_scratch"])
const underived = {}
function stills(folder, prefix) {
  if (!existsSync(folder)) return
  const derived = join(folder, "derived")
  const have = existsSync(derived) ? readdirSync(derived) : []
  for (const f of readdirSync(folder).sort()) {
    const full = join(folder, f)
    if (statSync(full).isDirectory()) { if (!SKIP.has(f)) stills(full, `${prefix}${f}/`); continue }
    const m = /^(?:(\d+)-)?(.+)-(ar|en)\.png$/.exec(f)
    if (!m || !langs.includes(m[3])) continue
    const stem = f.slice(0, -4)
    const files = have.filter((d) => new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+\\.(avif|webp)$`).test(d)).map((d) => join(derived, d))
    if (!files.some((x) => x.endsWith(".avif")) || !files.some((x) => x.endsWith(".webp"))) { (underived[folder] ||= []).push(stem); continue }
    const pair = alt[m[2]] || [`${L(title, "ar")} — ${m[2]}`, `${L(title, "en")} — ${m[2]}`]
    const key = flow === "page"
      ? [m[3], m[2] === "home" ? "" : m[2].replace(/\./g, "/"), "page"].filter(Boolean).join("/")
      : at(m[3], `${prefix}${m[2]}`)
    publish(`${flow}/${prefix}${m[2]}-${m[3]}`, files, ["--alt-ar", pair[0], "--alt-en", pair[1], ...(m[1] ? ["--order", String(Number(m[1]))] : [])], key)
  }
}

// ── videos (the 16:9 poster does not fit a reel, so a reel carries only its captions): <flow>-<locale>.* is the tutorial; <flow>-<clip>-<locale>.* a support clip or story cut; .reel.mp4 the 9:16 ──
function videos() {
  const names = readdirSync(dir)
  for (const lang of langs) {
    const re = new RegExp(`^${flow}(?:-(.+))?-${lang}\\.mp4$`)
    for (const f of names) {
      const m = re.exec(f)
      if (!m) continue
      const stem = f.slice(0, -4)
      const part = m[1] || "video"
      const files = [f, `${stem}.av1.mp4`, `${stem}.poster.webp`, `${stem}.vtt`].filter((x) => names.includes(x)).map((x) => join(dir, x))
      const t = ["--title-ar", L(title, "ar"), "--title-en", L(title, "en")]
      publish(`${flow}/${part}-${lang}`, files, t, at(lang, part))
      const reel = part === "video" ? "reel" : `${part}-reel`
      if (names.includes(`${stem}.reel.mp4`)) publish(`${flow}/${reel}-${lang}`, [join(dir, `${stem}.reel.mp4`), ...files.filter((x) => x.endsWith(".vtt"))], t, at(lang, reel))
    }
  }
}

// ── stamp what went out into ~/media/manifest.json, so `record.sh stale` covers shoot + sim output ──
function stamp() {
  const path = join(MEDIA_HOME, "manifest.json")
  if (!existsSync(path)) return
  let sha = ""
  const g = spawnSync("git", ["-C", join(homedir(), repo), "rev-parse", "--short", "HEAD"], { encoding: "utf8" })
  if (g.status === 0) sha = g.stdout.trim()
  const m = JSON.parse(readFileSync(path, "utf8"))
  const masters = [...new Set(published.map((f) => f.includes("/derived/") ? join(dirname(dirname(f)), f.split("/").pop().replace(/-\d+\.(avif|webp)$/, ".png")) : f))].filter((f) => /\.png$|(?<!\.av1)\.mp4$/.test(f))
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z")
  for (const f of masters) {
    const rel = relative(MEDIA_HOME, f)
    m.assets = m.assets.filter((a) => a.file !== rel)
    m.assets.push({
      file: rel, repo, block: mod.block || flow, ...(mod.paths ? { paths: mod.paths } : {}), flow,
      kind: f.endsWith(".png") ? "shot" : "clip", locale: /-(ar|en)(?:\.[a-z0-9]+)*$/.exec(f)?.[1] || "ar",
      sha, capturedAt: now, note: "published by shoot/publish.mjs",
    })
  }
  writeFileSync(`${path}.tmp`, JSON.stringify(m, null, 1) + "\n")
  renameSync(`${path}.tmp`, path)
}

if (only !== "video") {
  stills(dir, "")
  for (const [folder, stems] of Object.entries(underived))
    console.warn(`  ⚠ ${stems.length} still(s) in ${folder.replace(homedir(), "~")} have no derivatives — skipped (media.sh derive <png…> --kind ui, then publish again)`)
}
if (only !== "stills" && flow !== "page") videos()
if (!dry && published.length) stamp()
console.log(`${results.length} entr${results.length === 1 ? "y" : "ies"} → ${brand.cdn} · ${dry ? "dry run, manifest untouched" : manifest.replace(homedir(), "~")}`)
