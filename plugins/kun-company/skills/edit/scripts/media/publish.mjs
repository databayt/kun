#!/usr/bin/env node
// publish --ns <namespace> --slug <route> --id <manifest id> [--prefix <flow>-] [--manifest <path>]
//         [--title-ar …] [--title-en …] [--alt-ar …] [--alt-en …] [--order N] [--voice <id>] [--dry-run] <files…>
//
// Uploads to cdn.databayt.org with CONTENT-HASHED keys that MIRROR the app's routes —
// <ns>/<route>/<stem>.<hash8>.<ext>, e.g. hogwarts/students/add-student-list-ar-1600.3a9f1c2e.avif
// (--slug "" is the root route /). --prefix names a file after its flow: a stem that doesn't
// already start with it loses its NN- order prefix and gains the flow (01-list-ar → add-student-list-ar). Keys use
// `immutable` caching — new pixels are a new URL, so nothing is ever overwritten in place and no
// CloudFront invalidation is needed. Every URL is verified with a HEAD (200 + exact content-type),
// then the entry is upserted into the product's media-manifest.json:
//   video → {kind, title, poster, width, height, duration, sources[{src,type}], tracks[]}
//   image → {kind, width, height, alt, order?, avif{w:url}, webp{w:url}}   (order = the still's NN in its flow)
// Video sources are ordered AV1 first, H.264 second; <video> takes the first it can decode.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { basename, extname } from "node:path"
import { arg, CDN_BUCKET, CDN_HOST, CONTENT_TYPE, flag, positional, probe, requireRt, sh, sha8 } from "./rt.mjs"

const files = positional()
const ns = arg("ns"), slug = (arg("slug") ?? "").replace(/^\/+|\/+$/g, ""), id = arg("id", slug), prefix = arg("prefix", "")
if (!ns || arg("slug") === undefined || !files.length) {
  console.error("usage: publish --ns <ns> --slug <route> --id <id> [--prefix <flow>-] [--manifest path] [--dry-run] <files…>")
  process.exit(2)
}
const dry = flag("dry-run")

const up = []
for (const file of files) {
  const ext = extname(file).slice(1).toLowerCase()
  const ct = CONTENT_TYPE[ext]
  if (!ct) throw new Error(`no content-type for .${ext} (${file})`)
  const stem = basename(file, `.${ext}`)
  const named = !prefix || stem.startsWith(prefix) ? stem : prefix + stem.replace(/^\d+-/, "")
  const key = `${ns}/${slug ? `${slug}/` : ""}${named}.${sha8(file)}.${ext}`
  const url = `https://${CDN_HOST}/${key}`
  const head = () => {
    try {
      return sh("curl", ["-sI", "--max-time", "20", url])
    } catch {
      return ""
    }
  }
  let h = dry ? "" : head()
  if (!dry && !/^HTTP\/\S+ 200/m.test(h)) {
    sh("aws", ["s3", "cp", file, `s3://${CDN_BUCKET}/${key}`, "--content-type", ct, "--cache-control", "public, max-age=31536000, immutable", "--only-show-errors"])
    h = head()
  }
  if (!dry) {
    const status = /^HTTP\/\S+ (\d+)/m.exec(h)?.[1]
    const got = /^content-type:\s*(.+)$/im.exec(h)?.[1]?.trim()
    if (status !== "200" || (got || "").split(";")[0] !== ct.split(";")[0]) throw new Error(`verify failed for ${url}: status ${status}, content-type ${got}`)
  }
  up.push({ file, ext, stem, url, ct })
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
console.log(JSON.stringify({ id, manifest: manifest || null, dry, entry, uploads: up.map(({ file, url }) => ({ file, url })) }, null, 2))
