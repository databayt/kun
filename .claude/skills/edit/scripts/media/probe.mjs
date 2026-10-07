#!/usr/bin/env node
// probe <file> — compact JSON: codec, profile, pix_fmt, size, fps, colour tags, faststart, MB/min.
import { moovFirst, positional, probe } from "./rt.mjs"

const [file] = positional()
if (!file) {
  console.error("usage: probe <file>")
  process.exit(2)
}
const p = probe(file)
const isMp4 = /\.(mp4|m4v|mov)$/i.test(file)
console.log(JSON.stringify({
  ...p,
  mb: +(p.bytes / 1e6).toFixed(2),
  mbPerMin: p.duration ? +((p.bytes / 1e6) / (p.duration / 60)).toFixed(2) : null,
  ...(isMp4 ? { faststart: moovFirst(file) } : {}),
}, null, 2))
