#!/usr/bin/env node
// qa-pack <file…> [--profile web|av1|reel|clip|loop|image] [--ref <mezzanine>] [--vtt <captions.vtt>]
//         [--at t1,t2] [--social] [--out <dir>]
//
// Everything the media-qa agent needs, small enough to read: numbers in summary.json (probe, colour
// tags, faststart, loudness, VMAF, size budgets) and ≤1600px previews (a contact sheet plus a frame at
// every caption start). The numbers are checked here; the agent judges what only eyes can.
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join } from "node:path"
import { spawnSync } from "node:child_process"
import { arg, budgets, flag, FFMPEG, moovFirst, positional, probe, requireRt, sh } from "./rt.mjs"

const files = positional()
if (!files.length) {
  console.error("usage: qa-pack <file…> [--profile web|av1|reel|clip|loop|image] [--ref mezz] [--vtt f] [--at t1,t2] [--social] [--out dir]")
  process.exit(2)
}
const B = budgets()
const PX = B.preview_px

function ffStderr(args) {
  return spawnSync(FFMPEG, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stderr || ""
}

function loudness(file) {
  const e = ffStderr(["-hide_banner", "-nostats", "-i", file, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"])
  const tail = e.slice(e.lastIndexOf("Summary:"))
  const num = (re) => Number(re.exec(tail)?.[1])
  return { integrated: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) }
}

function vmaf(dist, ref, w, h) {
  const rp = probe(ref).video
  const rangeIn = rp.color_range === "pc" || /^yuvj/.test(rp.pix_fmt) ? "pc" : "tv"
  const matIn = rangeIn === "pc" ? "bt601" : "bt709"
  const log = join(dirname(dist), `.vmaf-${basename(dist)}.json`)
  const graph = `[0:v]scale=${w}:${h},format=yuv420p,setpts=PTS-STARTPTS[d];` +
    `[1:v]scale=${w}:${h}:flags=bicubic:in_range=${rangeIn}:in_color_matrix=${matIn}:out_range=tv:out_color_matrix=bt709,format=yuv420p,setpts=PTS-STARTPTS[r];` +
    `[d][r]libvmaf=log_fmt=json:log_path=${log}:n_threads=8`
  ffStderr(["-hide_banner", "-nostats", "-i", dist, "-i", ref, "-lavfi", graph, "-f", "null", "-"])
  try {
    return +JSON.parse(readFileSync(log, "utf8")).pooled_metrics.vmaf.mean.toFixed(2)
  } catch {
    return null
  }
}

function cueStarts(vtt) {
  return readFileSync(vtt, "utf8").split("\n").filter((l) => l.includes("-->")).map((l) => {
    const [h, m, s] = l.split("-->")[0].trim().split(":")
    return Number(h) * 3600 + Number(m) * 60 + Number(s)
  })
}

const results = []
for (const file of files) {
  const ext = extname(file).toLowerCase()
  const stem = basename(file, ext)
  const out = arg("out", join(dirname(file), "qa", stem))
  mkdirSync(out, { recursive: true })
  const checks = []
  const check = (name, ok, value, want) => checks.push({ name, ok: !!ok, value, want })

  if ([".png", ".jpg", ".jpeg", ".webp", ".avif"].includes(ext)) {
    const sharp = requireRt("sharp")
    const m = await sharp(file).metadata()
    const bytes = statSync(file).size
    const preview = join(out, `${stem}-preview.jpg`)
    await sharp(file).resize({ width: Math.min(PX, m.width) }).jpeg({ quality: 82 }).toFile(preview)
    if (ext === ".avif" && /-1600$/.test(stem)) check("avif_1600_kb", bytes / 1024 <= B.avif_1600_median_kb * 1.5, +(bytes / 1024).toFixed(1), `≤${B.avif_1600_median_kb} median`)
    results.push({ file, kind: "image", width: m.width, height: m.height, bytes, previews: [preview], checks })
    continue
  }

  const p = probe(file)
  const profile = arg("profile", /\.av1$/.test(stem) ? "av1" : p.video.height > p.video.width ? "reel" : "web")
  const social = flag("social") || profile === "reel"
  const mbPerMin = (p.bytes / 1e6) / Math.max(p.duration / 60, 1 / 60)

  // colour + container
  check("color_range_tv", p.video.color_range === "tv", p.video.color_range, "tv")
  check("bt709_tags", [p.video.color_space, p.video.color_primaries, p.video.color_transfer].every((x) => x === "bt709"), `${p.video.color_space}/${p.video.color_primaries}/${p.video.color_transfer}`, "bt709 ×3")
  check("faststart", moovFirst(file), moovFirst(file) ? "moov first" : "mdat first", "moov first")
  check("pix_fmt", p.video.codec === "av1" ? /^yuv420p(10le)?$/.test(p.video.pix_fmt) : p.video.pix_fmt === "yuv420p", p.video.pix_fmt, "yuv420p")
  // size budgets
  if (profile === "reel") check("reel_mb", p.bytes / 1e6 <= B.reel_mb, +(p.bytes / 1e6).toFixed(2), `≤${B.reel_mb} MB`)
  else if (profile === "clip") check("clip_mb", p.bytes / 1e6 <= B.clip_mb, +(p.bytes / 1e6).toFixed(2), `≤${B.clip_mb} MB`)
  else if (p.video.codec === "av1") check("av1_mb_per_min", mbPerMin <= B.av1_mb_per_min, +mbPerMin.toFixed(2), `≤${B.av1_mb_per_min}`)
  else check("h264_mb_per_min", mbPerMin <= B.h264_mb_per_min, +mbPerMin.toFixed(2), `≤${B.h264_mb_per_min}`)
  // audio
  let loud = null
  if (p.audio) {
    loud = loudness(file)
    const target = social ? B.lufs_social : B.lufs_web
    check("loudness", Math.abs(loud.integrated - target) <= B.lufs_tolerance, loud.integrated, `${target}±${B.lufs_tolerance} LUFS`)
    check("true_peak", loud.truePeak <= B.true_peak_max + 0.05, loud.truePeak, `≤${B.true_peak_max} dBTP`)
  }
  // quality vs mezzanine
  let score = null
  if (arg("ref")) {
    score = vmaf(file, arg("ref"), p.video.width, p.video.height)
    const min = p.video.codec === "av1" ? B.vmaf_av1 : B.vmaf_h264
    check("vmaf", score !== null && score >= min, score, `≥${min}`)
  }
  // previews: contact sheet (12 tiles) + one frame per caption start (or --at)
  const sheet = join(out, `${stem}-sheet.jpg`)
  const every = Math.max(p.duration / 12, 0.5)
  sh(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vf", `fps=1/${every.toFixed(3)},scale=400:-2,tile=4x3`, "-frames:v", "1", "-q:v", "3", sheet])
  const times = arg("at") ? arg("at").split(",").map(Number) : arg("vtt") ? cueStarts(arg("vtt")).map((t) => t + 0.6) : []
  const frames = times.filter((t) => t < p.duration).map((t, i) => {
    const f = join(out, `${stem}-f${String(i + 1).padStart(2, "0")}-${t.toFixed(1)}s.jpg`)
    sh(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", `scale='min(${PX},iw)':-2`, "-q:v", "3", f])
    return f
  })
  results.push({ file, kind: "video", profile, probe: p, mbPerMin: +mbPerMin.toFixed(2), loudness: loud, vmaf: score, previews: [sheet, ...frames], checks })
}

const summary = { generated: new Date().toISOString(), budgets: B, results, pass: results.every((r) => r.checks.every((c) => c.ok)) }
const where = arg("out") ? join(arg("out"), "summary.json") : join(dirname(files[0]), "qa", "summary.json")
mkdirSync(dirname(where), { recursive: true })
writeFileSync(where, JSON.stringify(summary, null, 2))
for (const r of results) {
  const bad = r.checks.filter((c) => !c.ok)
  console.log(`${bad.length ? "FIX " : "PASS"} ${r.file}${bad.length ? "  ← " + bad.map((c) => `${c.name}=${c.value} (want ${c.want})`).join("; ") : ""}`)
}
console.log(`summary: ${where}`)
process.exitCode = summary.pass ? 0 : 1
