#!/usr/bin/env node
// publish --ns <namespace> (--key <path> | --slug <route> [--prefix <flow>-]) --id <manifest id> [--manifest <path>]
//         [--title-ar …] [--title-en …] [--alt-ar …] [--alt-en …] [--order N] [--voice <id>] [--dry-run] <files…>
//
// Two key modes on cdn.databayt.org:
//   --key   CLEAN, STABLE keys — <ns>/<key><suffix>, e.g. hogwarts/students/add.mp4,
//           hogwarts/students/add/list.avif. The suffix comes from each file's role: .mp4 · .av1.mp4 ·
//           .poster.webp · .vtt for a video (a .reel.mp4 source publishes as .mp4 under its own key),
//           and for a still the narrowest width is bare and each wider one adds @2x, @3x
//           (list-1600.avif → list.avif, list-2400.avif → list@2x.avif). Re-publishing the same key
//           overwrites in place: objects carry their sha8 as metadata (unchanged bytes are skipped),
//           cache for an hour in browsers and a year at the edge, and every overwritten key gets a
//           CloudFront invalidation. Manifest URLs carry ?v=<sha8> — the edge ignores the query,
//           browsers see a new URL, so a re-render reaches viewers without a stale hour.
//   --slug  CONTENT-HASHED, immutable keys that mirror a route — <ns>/<route>/<stem>.<hash8>.<ext>
//           (--slug "" is the root). --prefix names a file after its flow (01-list-ar → add-student-list-ar).
//           New pixels are a new URL; nothing is overwritten and nothing needs invalidating.
// Every URL is verified with a HEAD (200 + exact content-type), then the entry is upserted into the
// product's media-manifest.json:
//   video → {kind, title, poster, width, height, duration, sources[{src,type}], tracks[]}
//   image → {kind, width, height, alt, order?, avif{w:url}, webp{w:url}}   (order = the still's NN in its flow)
// Video sources are ordered AV1 first, H.264 second; <video> takes the first it can decode.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { basename, extname } from "node:path"
import { arg, CDN_BUCKET, CDN_HOST, CONTENT_TYPE, flag, positional, probe, requireRt, sh, sha8 } from "./rt.mjs"

const files = positional()
const ns = arg("ns"), key = arg("key")?.replace(/^\/+|\/+$/g, ""), slug = (arg("slug") ?? "").replace(/^\/+|\/+$/g, ""), prefix = arg("prefix", "")
const id = arg("id", key ?? slug)
if (!ns || (key === undefined && arg("slug") === undefined) || !files.length) {
  console.error("usage: publish --ns <ns> (--key <path> | --slug <route> [--prefix <flow>-]) --id <id> [--manifest path] [--dry-run] <files…>")
  process.exit(2)
}
const dry = flag("dry-run")
const IMMUTABLE = "public, max-age=31536000, immutable"
const STABLE = "public, max-age=3600, s-maxage=31536000"

// --key: a still's widths become bare / @2x / @3x, narrowest first; a phone's lone 1179 stays bare
const widthOf = (f) => Number(/-(\d+)\.(avif|webp)$/.exec(basename(f))?.[1] || 0)
const tiers = [...new Set(files.map(widthOf).filter(Boolean))].sort((a, b) => a - b)
function cleanKey(file, ext) {
  const w = widthOf(file)
  if (w) return `${ns}/${key}${tiers.indexOf(w) ? `@${tiers.indexOf(w) + 1}x` : ""}.${ext}`
  const role = /\.(av1|poster)\.[a-z0-9]+$/.exec(basename(file))?.[1]
  return `${ns}/${key}${role ? `.${role}` : ""}.${ext}`
}

const remoteSha = (k) => {
  try {
    return JSON.parse(sh("aws", ["s3api", "head-object", "--bucket", CDN_BUCKET, "--key", k, "--output", "json"])).Metadata?.sha ?? "?"
  } catch {
    return null
  }
}
const head = (url) => {
  try {
    return sh("curl", ["-sI", "--max-time", "20", url])
  } catch {
    return ""
  }
}

const up = []
const overwritten = []
for (const file of files) {
  const ext = extname(file).slice(1).toLowerCase()
  const ct = CONTENT_TYPE[ext]
  if (!ct) throw new Error(`no content-type for .${ext} (${file})`)
  const stem = basename(file, `.${ext}`)
  const sha = sha8(file)
  let k, url
  if (key !== undefined) {
    k = cleanKey(file, ext)
    url = `https://${CDN_HOST}/${k}`
    if (!dry) {
      const had = remoteSha(k)
      if (had !== sha) {
        sh("aws", ["s3", "cp", file, `s3://${CDN_BUCKET}/${k}`, "--content-type", ct, "--cache-control", STABLE, "--metadata", `sha=${sha}`, "--only-show-errors"])
        if (had !== null) overwritten.push(`/${k}`)
      }
    }
  } else {
    const named = !prefix || stem.startsWith(prefix) ? stem : prefix + stem.replace(/^\d+-/, "")
    k = `${ns}/${slug ? `${slug}/` : ""}${named}.${sha}.${ext}`
    url = `https://${CDN_HOST}/${k}`
    if (!dry && !/^HTTP\/\S+ 200/m.test(head(url)))
      sh("aws", ["s3", "cp", file, `s3://${CDN_BUCKET}/${k}`, "--content-type", ct, "--cache-control", IMMUTABLE, "--only-show-errors"])
  }
  up.push({ file, ext, stem, key: k, url: key !== undefined ? `${url}?v=${sha}` : url, bare: url, ct })
}

// stable keys that changed bytes: drop the edge copy (CloudFront, aliased cdn.databayt.org)
if (overwritten.length) {
  const dist = sh("aws", ["cloudfront", "list-distributions", "--query", `DistributionList.Items[?contains(Aliases.Items, '${CDN_HOST}')].Id | [0]`, "--output", "text"]).trim()
  if (!dist || dist === "None") throw new Error(`no CloudFront distribution aliased ${CDN_HOST}`)
  sh("aws", ["cloudfront", "create-invalidation", "--distribution-id", dist, "--paths", ...overwritten, "--output", "text", "--query", "Invalidation.Id"])
}

if (!dry) {
  for (const u of up) {
    const h = head(u.bare)
    const status = /^HTTP\/\S+ (\d+)/m.exec(h)?.[1]
    const got = /^content-type:\s*(.+)$/im.exec(h)?.[1]?.trim()
    if (status !== "200" || (got || "").split(";")[0] !== u.ct.split(";")[0]) throw new Error(`verify failed for ${u.bare}: status ${status}, content-type ${got}`)
  }
}

// --- manifest entry -------------------------------------------------------------------------
const videos = up.filter((u) => u.ext === "mp4" || u.ext === "webm")
let entry
if (videos.length) {
  const codec = (u) => {
    const p = probe(u.file)
    const audio = p.audio ? ", mp4a.40.2" : ""
    if (p.video.codec === "av1") {
      const lvl = String(Number.isFinite(p.video.level) && p.video.level >= 0 ? p.video.level : 8).padStart(2, "0")
      const depth = /10/.test(p.video.pix_fmt) ? "10" : "08"
      return { p, type: `video/mp4; codecs="av01.0.${lvl}M.${depth}${audio}"`, rank: 0 }
    }
    if (p.video.codec === "h264") {
      const lvl = (p.video.level > 0 ? p.video.level : 41).toString(16).padStart(2, "0").toUpperCase()
      return { p, type: `video/mp4; codecs="avc1.6400${lvl}${audio}"`, rank: 1 }
    }
    return { p, type: u.ct, rank: 2 }
  }
  const srcs = videos.map((u) => ({ u, ...codec(u) })).sort((a, b) => a.rank - b.rank)
  const ref = srcs.find((s) => s.rank === 1) || srcs[0]
  const poster = up.find((u) => /\.poster$/.test(u.stem) || /-poster$/.test(u.stem))
  const tracks = up.filter((u) => u.ext === "vtt").map((u) => {
    const lang = /[-.](ar|en)$/.exec(u.stem)?.[1] || "ar"
    return { src: u.url, srclang: lang, label: lang === "ar" ? "العربية" : "English", default: lang === "ar" }
  })
  entry = {
    kind: "video",
    title: { ar: arg("title-ar", ""), en: arg("title-en", "") },
    ...(poster ? { poster: poster.url } : {}),
    width: ref.p.video.width, height: ref.p.video.height, duration: +ref.p.duration.toFixed(2),
    ...(arg("voice") ? { voice: arg("voice") } : {}),
    sources: srcs.map((s) => ({ src: s.u.url, type: s.type })),
    tracks,
  }
} else {
  const sharp = requireRt("sharp")
  const byFmt = { avif: {}, webp: {} }
  let width = 0, height = 0
  for (const u of up) {
    const w = /-(\d+)$/.exec(u.stem)?.[1]
    if (!w || !byFmt[u.ext]) continue
    byFmt[u.ext][w] = u.url
    if (Number(w) >= width) {
      const m = await sharp(u.file).metadata()
      width = m.width
      height = m.height
    }
  }
  entry = { kind: "image", width, height, alt: { ar: arg("alt-ar", ""), en: arg("alt-en", "") }, ...(arg("order") ? { order: Number(arg("order")) } : {}), avif: byFmt.avif, webp: byFmt.webp }
}

const manifest = arg("manifest")
if (manifest && !dry) {
  const m = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")) : {}
  m[id] = entry
  writeFileSync(manifest, JSON.stringify(m, null, 2) + "\n")
}
console.log(JSON.stringify({ id, manifest: manifest || null, dry, entry, uploads: up.map(({ file, url }) => ({ file, url })), invalidated: overwritten }, null, 2))
