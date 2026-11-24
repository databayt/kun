#!/usr/bin/env node
// hero.mjs — the looping 16:9 clip at the top of each /<lang>/features/<id> page, from the real product.
//
//   node hero.mjs --feature student[,admission…] [--lang ar,en] [--no-shoot] [--preview 1,5,11.5] [--publish]
//   node hero.mjs --all | --stale   [--lang ar,en] [--publish]
//   node hero.mjs --status
//
// One feature = one flow module, flows/<repo>/feature-<id>.mjs (route "features/<id>", 2–4 tour
// steps of the module's real pages). Per language: shoot.mjs takes the stills, motion/<repo>/
// feature-hero.html composes them into a seamless loop (flat screens, slow camera, crossfades, no
// text, no audio), motion.mjs renders 1920x1080, media.sh encodes the `loop` profile (H.264 + AV1,
// delivered 1600x900 at 24 fps) and a poster of frame 0, and publish.mjs puts them at their one
// predictable home:
//
//   ~/media/<repo>/feature-<id>/feature-<id>-<lang>.{mp4,av1.mp4,poster.webp}     local master
//   cdn.databayt.org/<repo>/<lang>/features/<id>/video.{mp4,av1.mp4,poster.webp}  CDN (overwritten in place)
//   feature-<id>/video-<lang>                                                     manifest id
//
// The page (hogwarts features/feature-video.ts) reads that id and falls back to the brand story.
// A flow can tune the camera: `export const hero = { zoom: 1.1, focus: { <step>: [x, y] } }` —
// fractions of the still, in LTR terms (mirrored for RTL). The default looks at the content area
// beside the sidebar, a little above the middle.
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOOT = join(HERE, "..")
const MEDIA_SH = join(SHOOT, "../edit/scripts/media.sh")
const RECORD_SH = join(homedir(), ".claude/scripts/record.sh")

const args = process.argv.slice(2)
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d)
const flag = (k) => args.includes(`--${k}`)

const repo = opt("repo", "hogwarts")
const langs = opt("lang", "ar,en").split(",").filter(Boolean)
const preview = opt("preview")
const flowsDir = join(SHOOT, "flows", repo)
const lib = join(homedir(), "media", repo)
const work = join(homedir(), ".cache/shoot-hero")
const manifestPath = join(homedir(), repo, "src/components/docs/media-manifest.json")

const allFeatures = () =>
  readdirSync(flowsDir)
    .filter((f) => /^feature-.+\.mjs$/.test(f))
    .map((f) => f.slice("feature-".length, -".mjs".length))
    .sort()

function staleFeatures() {
  const r = spawnSync("bash", [RECORD_SH, "stale", repo, "--flows"], { encoding: "utf8" })
  const stale = new Set(r.stdout.split("\n").map((s) => s.trim()).filter(Boolean))
  const published = readManifest()
  return allFeatures().filter(
    (id) => stale.has(`feature-${id}`) || langs.some((l) => !published[`feature-${id}/video-${l}`])
  )
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"))
  } catch {
    return {}
  }
}

const run = (cmd, argv, label) => {
  const r = spawnSync(cmd, argv, { stdio: "inherit" })
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`)
}

// PNG width/height straight from the IHDR chunk.
function pngSize(file) {
  const b = readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

// ── --status: one row per feature flow, one column per language ──
if (flag("status")) {
  const m = readManifest()
  const stale = new Set(
    spawnSync("bash", [RECORD_SH, "stale", repo, "--flows"], { encoding: "utf8" })
      .stdout.split("\n")
      .map((s) => s.trim())
  )
  const rows = allFeatures().map((id) => {
    const cells = langs.map((l) => {
      const e = m[`feature-${id}/video-${l}`]
      if (!e) return "missing → story"
      const v = /[?&]v=([0-9a-f]+)/.exec(e.sources.at(-1).src)?.[1] ?? "?"
      return `${e.duration.toFixed(1)}s v=${v}`
    })
    return [id, ...cells, stale.has(`feature-${id}`) ? "STALE" : "fresh"]
  })
  console.table(rows.map(([id, ...rest]) => ({ feature: id, ...Object.fromEntries(langs.map((l, i) => [l, rest[i]])), source: rest.at(-1) })))
  process.exit(0)
}

const features = flag("all") ? allFeatures() : flag("stale") ? staleFeatures() : opt("feature", "").split(",").filter(Boolean)
if (!features.length) {
  console.error(flag("stale") ? "nothing stale — every feature hero is current" : "usage: hero.mjs --feature <id[,id…]> | --all | --stale | --status  [--lang ar,en] [--no-shoot] [--preview t,…] [--publish]")
  process.exit(flag("stale") ? 0 : 2)
}
for (const id of features) {
  if (!existsSync(join(flowsDir, `feature-${id}.mjs`))) throw new Error(`no flow ${flowsDir}/feature-${id}.mjs`)
}

// A flow that exports `anim` is drawn, not shot: motion/<repo>/feature-<id>.html animates the module
// as live UI at anim.size (the page band's ratio, e.g. 2400x720), fed { dir, ...anim[lang] }.
const flowMod = async (id) => import(pathToFileURL(join(flowsDir, `feature-${id}.mjs`)).href)
const animated = new Set()
for (const id of features) if ((await flowMod(id)).anim) animated.add(id)

// ── 1. stills: one browser for the whole batch ──
const toShoot = features.filter((id) => !animated.has(id))
if (!flag("no-shoot") && toShoot.length) {
  run("node", [join(HERE, "shoot.mjs"), "--repo", repo, "--flow", toShoot.map((id) => `feature-${id}`).join(","), "--lang", langs.join(",")], "shoot")
}

const template = readFileSync(join(SHOOT, "motion", repo, "feature-hero.html"), "utf8")
mkdirSync(work, { recursive: true })
const done = []

for (const id of features) {
  const flow = `feature-${id}`
  const mod = await flowMod(id)
  const tune = mod.hero ?? {}
  const dir = join(lib, flow)
  mkdirSync(dir, { recursive: true })
  const size = mod.anim?.size ?? "1920x1080"
  const [sw, sh] = size.split("x").map(Number)
  // delivered inside 1600x900 for 16:9 shots; a wide anim keeps its full width (crisp across a 4K band)
  const box = mod.anim ? size : "1600x900"

  for (const lang of langs) {
    const rtl = lang === "ar"
    const html = join(work, `${repo}-${flow}-${lang}.html`)
    if (mod.anim) {
      const src = readFileSync(join(SHOOT, "motion", repo, `${flow}.html`), "utf8")
      writeFileSync(html, src.replace("/*ANIM*/ null", JSON.stringify({ dir: rtl ? "rtl" : "ltr", ...mod.anim[lang] })))
    } else {
    // NN-<step>-<lang>.png, in shot order
    const stills = readdirSync(dir)
      .filter((f) => new RegExp(`^\\d+-.+-${lang}\\.png$`).test(f))
      .sort()
    if (stills.length < 2) throw new Error(`${flow} ${lang}: ${stills.length} still(s) — a loop needs 2+ (did the shoot fail?)`)

    const shots = stills.map((f) => {
      const step = f.replace(/^\d+-/, "").replace(new RegExp(`-${lang}\\.png$`), "")
      const [fx, fy] = tune.focus?.[step] ?? [0.6, 0.42]
      return { src: pathToFileURL(join(dir, f)).href, ...pngSize(join(dir, f)), focus: [rtl ? 1 - fx : fx, fy], zoom: tune.zoom ?? 1.1 }
    })
    const hero = { dir: rtl ? "rtl" : "ltr", shots, shotDur: tune.shotDur ?? 4, fade: tune.fade ?? 0.8 }
    writeFileSync(html, template.replace("/*HERO*/ null", JSON.stringify(hero)))
    }

    const out = join(dir, `${flow}-${lang}.mp4`)
    if (preview) {
      // previews stay in the cache, never in the library folder that publish reads
      const pdir = join(work, `${flow}-${lang}`)
      mkdirSync(pdir, { recursive: true })
      run("node", [join(HERE, "motion.mjs"), html, join(pdir, "x.mp4"), "--size", size, "--preview", preview], "preview")
      console.log(`previews → ${pdir}/preview-*.jpg`)
      continue
    }

    // ── 2. render → mezzanine → loop encodes + poster of frame 0 ──
    run("node", [join(HERE, "motion.mjs"), html, out, "--size", size, "--fps", "24", "--mezz-only"], "render")
    const mezz = out.replace(/\.mp4$/, ".mezz.mkv")
    // Delivered at 1600x900 / 24 fps: as crisp as 1080p30 on UI text at 3x zoom, AV1 ~1 MB
    // (inside media.av1_mb_per_min), H.264 ~2 MB — rendered at 1920x1080, scaled once here.
    const enc = ["--box", box, "--fps", "24"]
    run("bash", [MEDIA_SH, "encode", "loop", mezz, out, ...enc], "encode h264")
    run("bash", [MEDIA_SH, "encode", "loop", mezz, out.replace(/\.mp4$/, ".av1.mp4"), ...enc], "encode av1")
    run("bash", [MEDIA_SH, "poster", out, out.replace(/\.mp4$/, ".poster.webp"), "--at", "0", "--width", String(Math.min(sw, 2400))], "poster")
    spawnSync("rm", ["-f", mezz])
    done.push(`${flow} ${lang}`)
  }

  // ── 3. publish the loop (not the stills) at features/<id> ──
  if (flag("publish") && !preview) {
    run("node", [join(HERE, "publish.mjs"), "--flow", flow, "--repo", repo, "--lang", langs.join(","), "--only", "video"], "publish")
  }
}

if (done.length) console.log(`\n✓ rendered: ${done.join(" · ")}${flag("publish") ? " — published; commit the manifest in ~/" + repo : " — add --publish to ship"}`)
