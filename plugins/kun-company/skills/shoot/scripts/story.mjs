#!/usr/bin/env node
// story.mjs — a flow's stills, narrated, for one screen. No captions: the voice carries it.
//
//   node story.mjs --flow add-student --device mac|iphone --cut support|ad [--repo hogwarts] [--lang ar]
//                  [--preview t1,t2]   frames only, next to the output
//                  [--tts-model id]    voice model override (default: the script's, else gemini-3.8-flash-tts)
//                  [--script file]     a variant of sims/<repo>/<flow>.story.json
//
// The script is sims/<repo>/<flow>.story.json: a voice (Gemini stock voice by default — `voice gen`
// engine "gemini") and, per cut, beats that name a still by its step. The voice sets the clock: every
// beat holds for its line plus a breath, stills crossfade with a slow push-in, and the narration is
// placed at each beat's start — nothing is ever stretched.
//
//   mac     2560x1600 — fills a MacBook screen: the still in a browser window on the brand canvas
//   iphone  1080x2340 — fills an iPhone 16 screen: status bar, the Safari page, Safari's bottom bar
//
// Output: <repo>/public/screenshot/<flow>/story/<flow>-<cut>-<device>-<lang>.{mp4,av1.mp4,poster.webp,vtt}
// The .vtt is a sidecar for accessibility (off by default in the player) — nothing is burned in.
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { brand as brandOf, FFMPEG } from "../../edit/scripts/media/rt.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const MEDIA = join(here, "../../edit/scripts/media.sh")
const args = process.argv.slice(2)
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d)
const flow = opt("flow"), repo = opt("repo", "hogwarts"), device = opt("device", "mac"), cutName = opt("cut", "support")
const lang = opt("lang", "ar"), preview = opt("preview")
if (!flow || !["mac", "iphone"].includes(device)) {
  console.log("usage: story.mjs --flow <name> --device mac|iphone --cut support|ad [--repo hogwarts] [--lang ar] [--preview t1,t2]")
  process.exit(flow ? 2 : 0)
}

const script = JSON.parse(readFileSync(opt("script", join(here, "../sims", repo, `${flow}.story.json`)), "utf8"))
const cut = script.cuts[cutName]
if (!cut) throw new Error(`no cut "${cutName}" in ${flow}.story.json`)
const B = brandOf(script.brand || repo), V = B.video
const shotRoot = join(homedir(), repo, "public/screenshot", flow)
const stillDir = device === "iphone" ? join(shotRoot, "iphone-16") : shotRoot
const stills = existsSync(stillDir) ? readdirSync(stillDir) : []
const stillOf = (step) => stills.find((f) => new RegExp(`^\\d\\d-${step}-${lang}\\.png$`).test(f))

// a beat whose still this device never shot (the Mac Finder on an iPhone) drops out with its line
// a beat may carry a per-device override, e.g. { "shot": "finder-photo", "iphone": { "shot": "documents" } }
const cutBeats = cut.beats.map((b) => ({ ...b, ...(b[device] || {}) }))
const beats = cutBeats.filter((b) => b.card || stillOf(b.shot)).map((b) => ({ ...b, img: b.shot ? join(stillDir, stillOf(b.shot)) : null }))
const missing = cutBeats.filter((b) => b.shot && !stillOf(b.shot)).map((b) => b.shot)
if (missing.length) console.log(`skipped (no ${device} still): ${missing.join(", ")}`)
if (!beats.some((b) => b.img)) throw new Error(`no stills for ${flow} in ${stillDir} — run shoot.mjs --flow ${flow}${device === "iphone" ? " --device iphone-16" : ""} first`)

const base = `${flow}-${cutName}-${device}-${lang}`
const outDir = join(shotRoot, "story")
const work = join(process.env.MEDIA_CACHE || join(homedir(), ".cache/media"), "story", base)
mkdirSync(outDir, { recursive: true }); mkdirSync(work, { recursive: true })
const media = (...a) => {
  const r = spawnSync(MEDIA, a, { encoding: "utf8" })
  if (r.status !== 0) throw new Error(`media.sh ${a[0]} failed: ${(r.stderr || r.stdout || "").slice(-500)}`)
  return r.stdout
}

// ───────────────────────── 1 · voice ─────────────────────────
// --tts-model overrides the script's model (e.g. gemini-3.8-flash-lite-tts while Flash's daily quota is spent)
const ttsModel = opt("tts-model", script.model)
writeFileSync(join(work, "script.json"), JSON.stringify({ engine: script.engine, voice: script.voice, model: ttsModel, style: cut.style, lang, lines: beats.map((b) => b.say) }))
const gen = JSON.parse(media("voice", "gen", join(work, "script.json"), "--out", join(work, "voice")))
const voice = JSON.parse(readFileSync(join(work, "voice/voice.json"), "utf8"))
// no captions means the voice IS the content: a dropped line would leave a silent, unexplained beat
if (voice.lines.some((l) => !l.ok)) {
  const bad = voice.lines.filter((l) => !l.ok).map((l) => `${l.i + 1} (cer ${l.cer ?? "—"}${l.error ? `, ${l.error}` : ""})`)
  throw new Error(`voice: lines failed the gate — ${bad.join("; ")}. Fix the script line or retry; no captions to fall back on.`)
}
console.log(`voice: ${gen.ok}/${gen.of} lines · ${voice.model} · ${script.voice}`)

// ───────────────────────── 2 · the clock ─────────────────────────
const ad = cutName === "ad"
const LEAD = ad ? 0.25 : 0.4, TAIL = ad ? 0.35 : 0.6, XF = 0.45
let clock = 0
const segs = beats.map((b, i) => {
  const min = b.card === "outro" ? 3.2 : b.card ? 2.4 : ad ? 2.2 : 2.6
  const dur = Math.max(min, LEAD + voice.lines[i].duration + TAIL)
  const s = { ...b, t0: clock, dur }
  clock += dur
  return s
})
const total = clock

// ───────────────────────── 3 · the stage ─────────────────────────
const fontDir = join(homedir(), "Library/Fonts")   // Thmanyah: licensed for local use, never copied into a repo
const font = (ttf, woff) => (existsSync(join(fontDir, ttf)) ? `file://${join(fontDir, ttf)}` : `file://${homedir()}/${repo}/public/fonts/thmanyah/${woff}`)
const logo = B.logoPath && existsSync(B.logoPath) ? `file://${B.logoPath}` : ""
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }
const url = script.url || new URL(B.hosts?.prod || "https://databayt.org").host

const mac = device === "mac"
const W = mac ? 2560 : 1080, H = mac ? 1600 : 2340
// Mac: the 3025x1715 still in a 2240-wide window; iPhone: 393pt-wide screen at 1080 px (k = 2.748)
const k = 1080 / 393
const PAGE = mac
  ? (() => { const w = 2240, h = Math.round(w * 1715 / 3025), bar = 58, top = Math.round((H - h - bar) / 2); return { x: (W - w) / 2, y: top + bar, w, h, bar, top } })()
  : { x: 0, y: Math.round(54 * k), w: 1080, h: Math.round(659 * k) }
// slow push-in over a beat; the ad moves a little more. None on the phone: its stills are edge to edge,
// so any push crops right-aligned Arabic labels («الاسم» → «لاسم», media-qa 2026-10-08)
const PUSH = device === "iphone" ? 0 : ad ? 0.07 : 0.045

const css = `
@font-face{font-family:S;src:url(${font("thmanyah-sans-500.ttf", "thmanyah-sans-500.woff2")});font-weight:500}
@font-face{font-family:S;src:url(${font("thmanyah-sans-700.ttf", "thmanyah-sans-700.woff2")});font-weight:700}
@font-face{font-family:D;src:url(${font("thmanyah-serif-display-900.ttf", "thmanyah-serif-display-900.woff2")});font-weight:900}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${V.canvas};font-family:S;color:${V.ink}}
body{background:radial-gradient(120% 90% at 50% 0%, ${hexA(V.accentSoft, .55)}, ${V.canvas} 60%)}
#page{position:absolute;left:${PAGE.x}px;top:${PAGE.y}px;width:${PAGE.w}px;height:${PAGE.h}px;overflow:hidden;background:#fff}
#page img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;transform-origin:50% 30%;opacity:0;will-change:transform,opacity}
.card{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:${V.canvas};opacity:0;z-index:20}
.card .in{display:flex;flex-direction:column;align-items:center;gap:${mac ? 34 : 44}px;padding:0 80px}
.card img{width:${mac ? 150 : 190}px;height:${mac ? 150 : 190}px;object-fit:contain}
.ti{font-family:D;font-weight:900;line-height:1.2;font-size:${mac ? 150 : 112}px}.ti mark{background:${V.accentSoft};color:inherit;padding:0 20px;white-space:nowrap}
.su{font-size:${mac ? 52 : 50}px;color:${hexA(V.ink, .66)}}
.pill{font-size:${mac ? 40 : 44}px;padding:16px 38px;border-radius:999px;background:#fff;box-shadow:0 2px 12px ${hexA(V.ink, .07)};direction:ltr;font-family:-apple-system,Geist,sans-serif;font-weight:600}
` + (mac ? `
#win{position:absolute;left:${PAGE.x}px;top:${PAGE.top}px;width:${PAGE.w}px;height:${PAGE.h + PAGE.bar}px;border-radius:22px;overflow:hidden;
  box-shadow:0 40px 120px ${hexA(V.ink, .22)},0 0 0 1.5px ${hexA(V.ink, .1)};background:#fff}
#bar{position:absolute;left:0;top:0;right:0;height:${PAGE.bar}px;background:#f2f1ed;border-bottom:1.5px solid ${hexA(V.ink, .08)};direction:ltr}
#bar i{position:absolute;top:20px;width:18px;height:18px;border-radius:50%}
#url{position:absolute;left:50%;top:11px;transform:translateX(-50%);height:36px;min-width:560px;padding:0 26px;border-radius:10px;background:#fff;
  display:flex;align-items:center;justify-content:center;gap:10px;font:500 21px -apple-system,Geist,sans-serif;color:${hexA(V.ink, .7)}}
#page{border-radius:0 0 22px 22px}` : `
#status{position:absolute;left:0;top:0;width:${W}px;height:${PAGE.y}px;background:#fff;direction:ltr;font-family:-apple-system,Geist,sans-serif}
#status .time{position:absolute;left:${Math.round(52 * k)}px;top:${Math.round(18 * k)}px;font:600 ${Math.round(17 * k)}px -apple-system,Geist,sans-serif;color:#000}
#island{position:absolute;left:50%;top:${Math.round(11 * k)}px;width:${Math.round(126 * k)}px;height:${Math.round(37 * k)}px;transform:translateX(-50%);border-radius:999px;background:#000}
#status .r{position:absolute;right:${Math.round(30 * k)}px;top:${Math.round(21 * k)}px;display:flex;gap:${Math.round(6 * k)}px;align-items:center}
#safari{position:absolute;left:0;top:${PAGE.y + PAGE.h}px;width:${W}px;height:${H - PAGE.y - PAGE.h}px;background:#f7f7f7;border-top:1.5px solid ${hexA(V.ink, .08)};direction:ltr}
#addr{position:absolute;left:${Math.round(14 * k)}px;right:${Math.round(14 * k)}px;top:${Math.round(10 * k)}px;height:${Math.round(44 * k)}px;border-radius:999px;background:#fff;
  box-shadow:0 1px 6px ${hexA(V.ink, .08)};display:flex;align-items:center;justify-content:center;gap:12px;font:500 ${Math.round(16 * k)}px -apple-system,Geist,sans-serif;color:#111}
#home{position:absolute;left:50%;bottom:${Math.round(8 * k)}px;width:${Math.round(134 * k)}px;height:${Math.round(5 * k)}px;transform:translateX(-50%);border-radius:9px;background:#000}`)

const lock = `<svg width="${mac ? 16 : 34}" height="${mac ? 18 : 38}" viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="2" fill="currentColor"/><path d="M5 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>`
const statusIcons = `<svg width="${Math.round(18 * k)}" height="${Math.round(12 * k)}" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg width="${Math.round(16 * k)}" height="${Math.round(12 * k)}" viewBox="0 0 16 12"><path d="M8 11.5 5.6 8.9a3.4 3.4 0 0 1 4.8 0zM2.8 6.1a7.4 7.4 0 0 1 10.4 0L11.8 7.5a5.4 5.4 0 0 0-7.6 0zM0 3.3a11.4 11.4 0 0 1 16 0L14.6 4.7a9.4 9.4 0 0 0-13.2 0z"/></svg>
<svg width="${Math.round(27 * k)}" height="${Math.round(13 * k)}" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#000" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.2"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" opacity=".4"/></svg>`

const card = (b, i) => {
  const ti = b.card === "outro" ? cut.outro : cut.title, su = b.card === "outro" ? cut.outroSub : cut.sub
  const pill = b.card === "outro" && su === url
  return `<div class="card" id="s${i}"><div class="in">${logo ? `<img src="${logo}">` : ""}<div class="ti">${ti}</div>${su ? `<div class="${pill ? "pill" : "su"}">${su}</div>` : ""}</div></div>`
}
const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>
${mac
  ? `<div id="win"><div id="bar"><i style="left:22px;background:#ff5f57"></i><i style="left:50px;background:#febc2e"></i><i style="left:78px;background:#28c840"></i><div id="url">${lock}${url}</div></div></div>`
  : `<div id="status"><div class="time">9:41</div><div id="island"></div><div class="r">${statusIcons}</div></div><div id="safari"><div id="addr">${lock}${url}</div><div id="home"></div></div>`}
<div id="page">${segs.map((s, i) => (s.img ? `<img id="s${i}" src="file://${s.img}">` : "")).join("")}</div>
${segs.map((s, i) => (s.card ? card(s, i) : "")).join("")}
<script>
const SEGS = ${JSON.stringify(segs.map((s) => ({ t0: s.t0, dur: s.dur, card: !!s.card })))}, XF = ${XF}, PUSH = ${PUSH}
window.DURATION = ${total.toFixed(3)}
const ease = (x) => -(Math.cos(Math.PI * Math.min(1, Math.max(0, x))) - 1) / 2
window.render = (t) => {
  SEGS.forEach((s, i) => {
    const el = document.getElementById("s" + i); if (!el) return
    const on = t >= s.t0 - (i ? XF : 0) && t < s.t0 + s.dur + XF
    // each beat fades in over the one before it, which stays put underneath until covered
    let a = !on ? 0 : i === 0 ? 1 : ease((t - (s.t0 - XF)) / XF)
    // a card sits above the stills, so it must fade out itself while the next still fades in under it
    if (s.card && SEGS[i + 1]) a *= 1 - ease((t - (s.t0 + s.dur - XF)) / XF)
    el.style.opacity = a
    if (!s.card) el.style.transform = "scale(" + (1 + PUSH * ease((t - s.t0 + XF) / (s.dur + XF))) + ")"
    el.style.zIndex = s.card ? 20 + i : i
  })
}
window.render(0)
</script></body></html>`
const htmlFile = join(work, "story.html")
writeFileSync(htmlFile, html)

// ───────────────────────── 4 · render ─────────────────────────
const outBase = join(outDir, base)
if (preview) {
  const r = spawnSync("node", [join(here, "motion.mjs"), htmlFile, `${outBase}.mp4`, "--size", `${W}x${H}`, "--preview", preview], { stdio: "inherit" })
  process.exit(r.status ?? 1)
}
const t0 = Date.now()
const r = spawnSync("node", [join(here, "motion.mjs"), htmlFile, join(work, "video.mp4"), "--size", `${W}x${H}`, "--mezz-only"], { stdio: "inherit" })
if (r.status !== 0) throw new Error("render failed")
const mezz = join(work, "video.mezz.mkv")

// ───────────────────────── 5 · narration + mux ─────────────────────────
writeFileSync(join(work, "cues.json"), JSON.stringify(segs.map((s) => ({ start: +s.t0.toFixed(3) }))))
const lufs = ad ? "-14" : "-16"
const mix = JSON.parse(media("voice", "mix", join(work, "voice/voice.json"), "--cues", join(work, "cues.json"), "--duration", total.toFixed(3), "--out", join(work, "narration.wav"), "--lufs", lufs, "--lead", String(LEAD)))
for (const w of mix.warnings) console.warn(`voice: ${w}`)
const master = join(work, "master.mkv")
const m = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", mezz, "-i", join(work, "narration.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "pcm_s16le", "-shortest", master], { stdio: "inherit" })
if (m.status !== 0) throw new Error("mux failed")

// ───────────────────────── 6 · deliver ─────────────────────────
const box = `${W}x${H}`, max = String(Math.ceil(total) + 1)
const profile = ad && !mac ? "reel" : "web"   // the phone ad is social: -14 LUFS, stereo, capped bitrate
media("encode", profile, master, `${outBase}.mp4`, "--box", box, "--max", max)
media("encode", profile, master, `${outBase}.av1.mp4`, "--box", box, "--max", max)
// poster: the title card for a tutorial, the first still for an ad (it opens on the product)
const posterAt = segs[0].card ? Math.min(1.2, segs[0].dur / 2) : Math.min(1.5, segs[0].dur / 2)
media("poster", `${outBase}.mp4`, `${outBase}.poster.webp`, "--at", posterAt.toFixed(2))
writeFileSync(join(work, "vtt.json"), JSON.stringify(mix.placed.map((p) => ({ start: p.at, end: p.end, text: voice.lines[p.i].text }))))
media("vtt", join(work, "vtt.json"), `${outBase}.vtt`)
for (const f of ["mp4", "av1.mp4", "poster.webp", "vtt"]) console.log(`✓ ${outBase}.${f}`)
console.log(`${total.toFixed(1)}s · ${device} ${box} · ${cutName} · ${beats.length} beats · voice ${script.voice} · ${((Date.now() - t0) / 1000).toFixed(0)}s render+deliver`)
