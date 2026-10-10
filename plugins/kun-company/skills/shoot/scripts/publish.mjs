#!/usr/bin/env node
// publish.mjs — one flow folder → cdn.databayt.org + the product's media-manifest.json, in one go.
//   node publish.mjs --flow add-student [--repo hogwarts] [--lang ar,en] [--dry-run] [--only stills|video]
//
// Reads <repo>/public/screenshot/<flow>/ (what shoot.mjs and sim.mjs write) and hands each asset
// to `media.sh publish` (content-hashed immutable keys, HEAD-verified, manifest upsert).
// Namespace + manifest come from the brand kit (production.<brand>.cdn / .manifest).
//
// The id grammar — one name per asset, the same in the manifest, MDX and the CDN slug:
//   <flow>/<step>-<locale>      a still        add-student/created-ar      ← 12-created-ar.png
//   <flow>/video-<locale>       the tutorial   add-student/video-ar        ← add-student-ar.{mp4,av1.mp4,poster.webp,vtt}
//   <flow>/reel-<locale>        the 9:16 cut   add-student/reel-ar         ← add-student-ar.reel.mp4
//   <flow>/<clip>-<locale>      a support clip add-student/details-ar      ← add-student-details-ar.*
//   <flow>/<device>/<step>-<locale>  a phone still                         ← iphone-16/03-review-ar.png
// The NN order prefix stays in the file name and leaves the id, so inserting a step never breaks a page.
// Alt text and titles come from the flow module: `export const title = [ar, en]`, `export const alt = { step: [ar, en] }`.

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { brand as brandOf } from "../../edit/scripts/media/rt.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i === -1 ? d : args[i + 1] }
const flag = (k) => args.includes(`--${k}`)

const flow = opt("flow")
if (!flow) { console.error("usage: publish.mjs --flow <name> [--repo hogwarts] [--lang ar,en] [--only stills|video] [--dry-run]"); process.exit(2) }
const repo = opt("repo", "hogwarts")
const REPO_BRAND = { hogwarts: "balqalam", mkan: "mkan", kun: "kun", marketing: "databayt" }
const brand = brandOf(opt("brand", REPO_BRAND[repo] || repo))
if (!brand.cdn || !brand.manifest) throw new Error(`brand-kit production.${brand.id} needs "cdn" and "manifest"`)
const langs = opt("lang", "ar,en").split(",")
const only = opt("only")
const dry = flag("dry-run")
const dir = join(homedir(), repo, "public/screenshot", flow)
const manifest = join(homedir(), repo, brand.manifest)
if (!existsSync(dir)) throw new Error(`nothing shot yet: ${dir}`)

const flowFile = join(here, "../flows", repo, `${flow}.mjs`)
const mod = existsSync(flowFile) ? await import(pathToFileURL(flowFile).href) : {}
const title = mod.title || ["", ""]
const alt = mod.alt || {}
const L = (pair, lang) => pair[lang === "en" ? 1 : 0] || ""

const media = join(here, "../../edit/scripts/media.sh")
const results = []
function publish(id, files, extra) {
  const r = spawnSync(media, ["publish", "--ns", brand.cdn, "--slug", flow, "--id", id, "--manifest", manifest, ...extra, ...(dry ? ["--dry-run"] : []), ...files], { encoding: "utf8" })
  if (r.status !== 0) throw new Error(`publish ${id} failed:\n${(r.stderr || r.stdout).slice(-600)}`)
  results.push(id)
  console.log(`✓ ${id}  (${files.length} file${files.length > 1 ? "s" : ""})`)
}

// ── stills: every NN-<step>-<locale>.png with its derived avif/webp ──
const underived = {}
function stills(folder, prefix) {
  if (!existsSync(folder)) return
  const derived = join(folder, "derived")
  for (const f of readdirSync(folder).sort()) {
    const full = join(folder, f)
    if (statSync(full).isDirectory() && f !== "derived") { stills(full, `${prefix}${f}/`); continue }
    const m = /^(\d+)-(.+)-(ar|en)\.png$/.exec(f)
    if (!m || !langs.includes(m[3])) continue
    const stem = f.slice(0, -4)
    const files = ["1600", "2400"].flatMap((w) => ["avif", "webp"].map((x) => join(derived, `${stem}-${w}.${x}`)))
    if (!files.every(existsSync)) { (underived[folder] ||= []).push(stem); continue }
    const pair = alt[m[2]] || [`${L(title, "ar")} — ${m[2]}`, `${L(title, "en")} — ${m[2]}`]
    publish(`${flow}/${prefix}${m[2]}-${m[3]}`, files, ["--alt-ar", pair[0], "--alt-en", pair[1]])
  }
}

// ── videos (the 16:9 poster does not fit a reel, so a reel carries only its captions): <flow>-<locale>.* is the tutorial; <flow>-<clip>-<locale>.* a support clip; .reel.mp4 the 9:16 ──
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
      publish(`${flow}/${part}-${lang}`, files, t)
      if (names.includes(`${stem}.reel.mp4`)) publish(`${flow}/${part === "video" ? "reel" : `${part}-reel`}-${lang}`, [join(dir, `${stem}.reel.mp4`), ...files.filter((x) => x.endsWith(".vtt"))], t)
    }
  }
}

if (only !== "video") {
  stills(dir, "")
  for (const [folder, stems] of Object.entries(underived))
    console.warn(`  ⚠ ${stems.length} still(s) in ${folder.replace(homedir(), "~")} have no derivatives — skipped (media.sh derive <png…> --kind ui, then publish again)`)
}
if (only !== "stills") videos()
console.log(`${results.length} entr${results.length === 1 ? "y" : "ies"} → ${brand.cdn} · ${dry ? "dry run, manifest untouched" : manifest.replace(homedir(), "~")}`)
