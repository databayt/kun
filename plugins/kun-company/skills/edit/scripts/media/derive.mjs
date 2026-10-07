#!/usr/bin/env node
// derive <image…> [--kind ui|photo] [--widths 1600,2400] [--out <dir>] [--check]
//
// PNG master → oxipng (lossless, in place) → AVIF + WebP at display widths.
// UI screenshots keep chroma 4:4:4 so text edges stay crisp; photos take 4:2:0 and lower quality.
// sharp strips EXIF/GPS by default — listing photos never leak a location.
// --check scores each 1600w AVIF against the master with ssimulacra2 (≥80 ≈ visually lossless).
import { mkdirSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join } from "node:path"
import { tmpdir } from "node:os"
import { arg, flag, positional, requireRt, sh } from "./rt.mjs"

const sharp = requireRt("sharp")
const files = positional()
if (!files.length) {
  console.error("usage: derive <image…> [--kind ui|photo] [--widths 1600,2400] [--out dir] [--check]")
  process.exit(2)
}
const kind = arg("kind", "ui")
const widths = arg("widths", "1600,2400").split(",").map(Number)
const Q = kind === "photo"
  ? { avif: { quality: 55, effort: 6, chromaSubsampling: "4:2:0" }, webp: { quality: 78, effort: 6, smartSubsample: true } }
  : { avif: { quality: 70, effort: 6, chromaSubsampling: "4:4:4" }, webp: { quality: 88, effort: 6, smartSubsample: true } }

const which = (bin) => { try { return sh("/bin/sh", ["-c", `command -v ${bin}`]).trim() } catch { return "" } }
const oxipng = which("oxipng")
const ssim = which("ssimulacra2")

const report = []
for (const file of files) {
  const ext = extname(file).toLowerCase()
  const stem = basename(file, ext)
  const out = arg("out", join(dirname(file), "derived"))
  mkdirSync(out, { recursive: true })
  const before = statSync(file).size
  if (ext === ".png" && oxipng) sh(oxipng, ["-o", "3", "--strip", "safe", "-q", file])
  const meta = await sharp(file).metadata()
  const entry = { master: file, width: meta.width, height: meta.height, masterBytes: statSync(file).size, masterBefore: before, avif: {}, webp: {} }
  // Never upscale; if the source is narrower than every target, ship it at native width.
  const targets = [...new Set(widths.filter((w) => w <= meta.width).concat(widths.every((w) => w > meta.width) ? [meta.width] : []))]
  for (const w of targets) {
    for (const fmt of ["avif", "webp"]) {
      const dst = join(out, `${stem}-${w}.${fmt}`)
      await sharp(file).resize({ width: w, kernel: "lanczos3" })[fmt](Q[fmt]).toFile(dst)
      entry[fmt][w] = { file: dst, bytes: statSync(dst).size }
    }
    if (flag("check") && ssim && w === targets[0]) {
      const ref = join(tmpdir(), `${stem}-${w}-ref.png`), dist = join(tmpdir(), `${stem}-${w}-avif.png`)
      await sharp(file).resize({ width: w, kernel: "lanczos3" }).png().toFile(ref)
      await sharp(entry.avif[w].file).png().toFile(dist)
      entry.ssimulacra2 = Number(sh(ssim, [ref, dist]).trim().split(/\s+/).pop())
    }
  }
  report.push(entry)
}
const json = JSON.stringify(report, null, 2)
if (arg("json-out")) writeFileSync(arg("json-out"), json)
console.log(json)
