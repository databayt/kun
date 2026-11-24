#!/usr/bin/env node
// vtt <in.srt|in.json> <out.vtt> [--offset S]
// SRT (video-use master.srt) or JSON cues [{start,end,text}] → WebVTT for <track kind="captions">.
import { readFileSync, writeFileSync } from "node:fs"
import { arg, positional } from "./rt.mjs"

const [src, dst] = positional()
if (!src || !dst) {
  console.error("usage: vtt <in.srt|in.json> <out.vtt> [--offset S]")
  process.exit(2)
}
const offset = Number(arg("offset", "0"))
const raw = readFileSync(src, "utf8")
const ts = (s) => {
  const t = Math.max(0, s + offset)
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec.toFixed(3).padStart(6, "0")}`
}
const fromSrtTime = (x) => {
  const [hms, ms] = x.trim().split(/[,.]/)
  const [h, m, s] = hms.split(":").map(Number)
  return h * 3600 + m * 60 + s + Number(ms || 0) / 1000
}

let cues
if (src.endsWith(".json")) {
  const j = JSON.parse(raw)
  cues = (Array.isArray(j) ? j : j.cues).map((c) => ({ start: Number(c.start), end: Number(c.end), text: String(c.text) }))
} else {
  cues = raw.replace(/\r/g, "").split(/\n\n+/).map((block) => {
    const lines = block.split("\n").filter(Boolean)
    const i = lines.findIndex((l) => l.includes("-->"))
    if (i < 0) return null
    const [a, b] = lines[i].split("-->")
    return { start: fromSrtTime(a), end: fromSrtTime(b), text: lines.slice(i + 1).join("\n") }
  }).filter(Boolean)
}
const body = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}`).join("\n\n")
writeFileSync(dst, `WEBVTT\n\n${body}\n`)
console.log(JSON.stringify({ vtt: dst, cues: cues.length }))
