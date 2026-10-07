#!/usr/bin/env node
// voice — local Arabic narration with a consented house voice (Chatterbox Multilingual v3 on MLX).
//
//   voice status [id]                                   consent + sample state of every voice
//   voice record <id> --speaker "<name>" [--seconds 15]  record the reference sample at this Mac's mic
//   voice consent <id> --given | --revoke                record the speaker's yes (or withdraw it)
//   voice gen <script.json> --out <dir> [--retries 3]    synthesize + gate every line → <dir>/voice.json
//                                                       script.engine "gemini" = a stock Google voice
//                                                       (script.voice e.g. "Charon", script.style) —
//                                                       no clone, so no consent; GEMINI_API_KEY from kun/.env;
//                                                       --model picks the TTS model (default gemini-3.8-flash-tts)
//   voice mix <voice.json> --cues <cues.json> --duration S --out <file.wav> [--lufs -16] [--lead 0.25]
//   voice revoke <id>                                   withdraw consent + list published assets using it
//
// Samples and consent live in ~/Library/Application Support/databayt/voice/<id>/ (mode 700): never in
// git, never in ~/media (that syncs to Drive). No valid consent → gen returns captionsOnly and the
// video ships with captions alone. A line whose transcript drifts from the script (CER > budget) or
// whose length is implausible is retried, then dropped — its caption still carries the meaning.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { basename, join } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { arg, budgets, cer, FFMPEG, flag, KUN_DIR, normAr, positional, probe, sh, VOICE_DIR } from "./rt.mjs"

const MODEL = process.env.MEDIA_TTS_MODEL || "mlx-community/chatterbox-multilingual-v3"
const WHISPER = "mlx-community/whisper-large-v3-turbo"
const PY = join(homedir(), ".local/share/uv/tools/mlx-audio/bin/python")
const WPY = join(homedir(), ".local/share/uv/tools/mlx-whisper/bin/python")
const here = new URL(".", import.meta.url).pathname
const [sub, ...rest] = positional()
const today = new Date().toISOString().slice(0, 10)

// Gemini TTS — a stock voice through the Interactions API (gemini-3.8-*-tts). The text field is a
// verbatim transcript; delivery goes in a speech_metadata style annotation, never in the text (older
// prompt-style directions get read aloud). The free tier allows ~10 requests a day per model, so a
// whole script goes in ONE request with long pauses between lines, split back at the widest gaps —
// and every line is cached by (model, voice, style, text) so a re-render spends nothing.
const TTS_CACHE = join(process.env.MEDIA_CACHE || join(homedir(), ".cache/media"), "tts")
function geminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const m = /^GEMINI_API_KEY=(.*)$/m.exec(readFileSync(join(KUN_DIR, ".env"), "utf8"))
  if (!m) throw new Error("GEMINI_API_KEY missing from kun/.env")
  return m[1].replace(/^["']|["']$/g, "").trim()
}
const ttsKey = (o, text) => createHash("sha256").update(JSON.stringify([o.model, o.voice, o.style, text, o.attempt])).digest("hex").slice(0, 16)
async function geminiSay(text, { model, voice, style }) {
  const body = { model, input: [{ type: "user_input", content: [{ type: "text", text, annotations: style ? [{ type: "speech_metadata", style }] : [] }] }], response_format: { type: "audio" }, generation_config: { speech_config: [{ voice }] } }
  for (let k = 0; k < 4; k++) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (r.status === 429 && /per day/i.test(j.error?.message || "")) throw new Error(`gemini ${model}: daily free quota used — ${j.error.message.replace(/ or upgrade.*$/, "")}`)
    if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 15000 * (k + 1))); continue }
    if (!r.ok) throw new Error(`gemini ${r.status}: ${(j.error?.message || "").slice(0, 200)}`)
    const data = j.steps?.flatMap((s) => s.content || []).find((c) => c.data)?.data
    if (!data) throw new Error("gemini returned no audio")
    return Buffer.from(data, "base64")
  }
  throw new Error(`gemini ${model}: rate-limited after 4 tries`)
}
const toWav = (buf, file) => {
  const tmp = file + ".raw"
  writeFileSync(tmp, buf)
  const isWav = buf.subarray(0, 4).toString() === "RIFF"   // WAV by default; bare 24 kHz PCM on some tiers
  ffmpeg([...(isWav ? [] : ["-f", "s16le", "-ar", "24000", "-ac", "1"]), "-i", tmp, "-c:a", "pcm_s16le", file])
  spawnSync("rm", ["-f", tmp])
}
async function geminiLines(texts, o) {
  mkdirSync(TTS_CACHE, { recursive: true })
  const files = texts.map((t) => join(TTS_CACHE, `${ttsKey(o, t)}.wav`))
  const todo = texts.map((t, i) => i).filter((i) => !existsSync(files[i]))
  if (todo.length > 1) {
    // one request: lines separated by a double long pause, cut back at the N-1 widest silences
    const all = join(TTS_CACHE, `batch-${process.pid}.wav`)
    toWav(await geminiSay(todo.map((i) => texts[i]).join(" <long pause> <long pause> <long pause> "), o), all)
    const log = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", all, "-af", "silencedetect=n=-40dB:d=0.5", "-f", "null", "-"], { encoding: "utf8" }).stderr
    const sil = [...log.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => ({ end: +m[1], d: +m[2] }))
    const cuts = sil.sort((a, b) => b.d - a.d).slice(0, todo.length - 1).sort((a, b) => a.end - b.end)
    if (cuts.length === todo.length - 1 && cuts.every((c) => c.d >= 0.9)) {
      const edges = [0, ...cuts.map((c) => c.end - c.d / 2), probe(all).duration]
      todo.forEach((i, k) => ffmpeg(["-i", all, "-ss", edges[k].toFixed(3), "-to", edges[k + 1].toFixed(3), "-c:a", "pcm_s16le", files[i]]))
      spawnSync("rm", ["-f", all])
    } else {
      // never fall back to a request per line: at ~10 free requests a day that one fallback spends the
      // whole day. Keep the take for a look and fail; the cached lines from a good batch stay.
      throw new Error(`gemini: batch split found ${cuts.length}/${todo.length - 1} clean gaps — take kept at ${all}; shorten or re-punctuate a line and retry`)
    }
  }
  if (todo.length === 1) toWav(await geminiSay(texts[todo[0]], o), files[todo[0]])
  return files
}

function consent(id) {
  const dir = join(VOICE_DIR, id)
  const f = join(dir, "consent.md")
  if (!existsSync(f)) return { id, dir, ok: false, reason: "no consent.md" }
  const fm = Object.fromEntries((/^---\n([\s\S]*?)\n---/.exec(readFileSync(f, "utf8"))?.[1] || "").split("\n").map((l) => l.split(/:\s*/, 2).map((x) => x?.trim())).filter((kv) => kv[0]))
  const ok = fm.consent === "given" && fm.revoked !== "true" && (fm.review_by || "0") >= today && existsSync(join(dir, "reference.wav"))
  const reason = ok ? "valid" : fm.revoked === "true" ? "revoked" : fm.consent !== "given" ? `consent: ${fm.consent || "missing"}` : (fm.review_by || "0") < today ? `expired ${fm.review_by}` : "no reference.wav"
  return { id, dir, ok, reason, speaker: fm.speaker, review_by: fm.review_by }
}

function writeConsent(id, patch) {
  const dir = join(VOICE_DIR, id)
  const f = join(dir, "consent.md")
  const cur = existsSync(f) ? readFileSync(f, "utf8") : ""
  const fm = Object.fromEntries((/^---\n([\s\S]*?)\n---/.exec(cur)?.[1] || "").split("\n").map((l) => l.split(/:\s*/, 2)).filter((kv) => kv[0]))
  const next = {
    voice: id, speaker: "", consent: "pending", date: today,
    scope: "Arabic narration for databayt product tutorials, support clips and marketing videos across all brands; synthesized by AI from this sample and labelled as an AI voice where shown",
    review_by: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), revoked: "false",
    ...fm, ...patch,
  }
  const body = `---\n${Object.entries(next).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n` +
    `Consent for the "${id}" house voice.\n\n` +
    `- The speaker agrees that an AI voice cloned from this sample (zero-shot; no model is trained on it) narrates databayt videos within the scope above.\n` +
    `- To withdraw: tell Abdout, or run \`media.sh voice revoke ${id}\`. Every published asset using this voice is then re-rendered captions-only.\n` +
    `- A signed copy (consent-signed.pdf) in this folder is recommended.\n`
  mkdirSync(dir, { recursive: true })
  chmodSync(VOICE_DIR, 0o700)
  chmodSync(dir, 0o700)
  writeFileSync(f, body)
  return consent(id)
}

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" })
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-600)}`)
}

// --- status ---------------------------------------------------------------------------------
if (sub === "status") {
  const ids = rest[0] ? [rest[0]] : existsSync(VOICE_DIR) ? readdirSync(VOICE_DIR).filter((d) => !d.startsWith(".")) : []
  if (!ids.length) console.log("voice   none recorded — captions-only until `media.sh voice record house-ar --speaker \"<name>\"`")
  for (const id of ids) {
    const c = consent(id)
    console.log(`voice   ${id}: ${c.ok ? "ready" : "NOT usable"} (${c.reason}${c.speaker ? `, speaker ${c.speaker}` : ""}${c.review_by ? `, review by ${c.review_by}` : ""})`)
  }
  process.exit(0)
}

// --- record ---------------------------------------------------------------------------------
if (sub === "record") {
  const id = rest[0]
  const speaker = arg("speaker")
  if (!id || !speaker) throw new Error('usage: voice record <id> --speaker "<name>" [--seconds 15]')
  const secs = Number(arg("seconds", "15"))
  const dir = join(VOICE_DIR, id)
  mkdirSync(dir, { recursive: true })
  const prompt = "مرحباً بكم. في هذا الدرس سنتعلم خطوة بخطوة كيف ننجز المهمة بسهولة، ثم نراجع النتيجة معاً قبل الحفظ."
  writeFileSync(join(dir, "reference.txt"), prompt + "\n")
  console.log(`Read this aloud, calmly, starting when recording begins (${secs}s):\n\n  ${prompt}\n`)
  const raw = join(dir, "reference.raw.wav")
  ffmpeg(["-f", "avfoundation", "-i", ":0", "-t", String(secs), "-ar", "48000", "-ac", "1", raw])
  // trim the lead-in / tail silence, gentle denoise, level to −20 LUFS for a stable clone
  ffmpeg(["-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.2,areverse,afftdn=nf=-25,loudnorm=I=-20:TP=-2:LRA=7", "-ar", "24000", "-ac", "1", join(dir, "reference.wav")])
  const c = writeConsent(id, { speaker, consent: "pending", date: today })
  console.log(JSON.stringify({ recorded: join(dir, "reference.wav"), seconds: probe(join(dir, "reference.wav")).duration, consent: c }, null, 2))
  console.log(`\nNext: once ${speaker} agrees to the scope in consent.md → media.sh voice consent ${id} --given`)
  process.exit(0)
}

// --- consent / revoke -----------------------------------------------------------------------
if (sub === "consent" || sub === "revoke") {
  const id = rest[0]
  if (!id) throw new Error(`usage: voice ${sub} <id>`)
  if (sub === "consent" && flag("given")) {
    console.log(JSON.stringify(writeConsent(id, { consent: "given", date: today, revoked: "false" }), null, 2))
    process.exit(0)
  }
  const c = writeConsent(id, { revoked: "true", revoked_at: today })
  const roots = ["hogwarts", "mkan", "kun", "souq", "shifa", "marketing", "codebase"].map((r) => join(homedir(), r))
  const hits = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const out = spawnSync("find", [root, "-name", "media-manifest.json", "-not", "-path", "*/node_modules/*"], { encoding: "utf8" }).stdout.trim()
    for (const f of out ? out.split("\n") : []) {
      for (const [k, v] of Object.entries(JSON.parse(readFileSync(f, "utf8")))) if (v.voice === id) hits.push(`${f} → ${k}`)
    }
  }
  console.log(JSON.stringify({ consent: c, reRenderCaptionsOnly: hits }, null, 2))
  process.exit(0)
}

// --- gen ------------------------------------------------------------------------------------
if (sub === "gen") {
  const scriptFile = rest[0]
  const out = arg("out")
  if (!scriptFile || !out) throw new Error("usage: voice gen <script.json> --out <dir> [--retries 3]")
  const script = JSON.parse(readFileSync(scriptFile, "utf8"))
  const id = arg("voice", script.voice || "house-ar")
  const lang = script.lang || "ar"
  const lines = script.lines.map((l) => (typeof l === "string" ? l : l.text))
  mkdirSync(out, { recursive: true })
  const gemini = script.engine === "gemini"
  const GEMINI_MODEL = arg("model", script.model || process.env.MEDIA_GEMINI_TTS || "gemini-3.8-flash-tts")
  const result = { voice: id, engine: gemini ? "gemini" : "chatterbox", model: gemini ? GEMINI_MODEL : MODEL, lang, generated: new Date().toISOString(), lines: lines.map((text, i) => ({ i, text, file: null, ok: false, tries: 0 })) }
  const c = gemini ? { ok: true, speaker: `Google stock voice ${id} (AI)` } : consent(id)
  if (!c.ok) {
    Object.assign(result, { captionsOnly: true, reason: `voice ${id}: ${c.reason}`, okRatio: 0 })
    writeFileSync(join(out, "voice.json"), JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ captionsOnly: true, reason: result.reason }))
    process.exit(0)
  }
  result.speaker = c.speaker
  const B = budgets()
  const retries = Number(arg("retries", "3"))
  const work = join(out, ".work")
  mkdirSync(work, { recursive: true })
  for (let t = 1; t <= retries; t++) {
    const pending = result.lines.filter((l) => !l.ok)
    if (!pending.length) break
    const items = pending.map((l) => ({ id: `line-${String(l.i + 1).padStart(2, "0")}-t${t}`, text: l.text }))
    let gen
    if (gemini) {
      try {
        const files = await geminiLines(items.map((it) => it.text), { model: GEMINI_MODEL, voice: id, style: script.style, attempt: t })
        gen = items.map((it, k) => ({ id: it.id, ok: true, file: files[k] }))
      } catch (e) {
        // the daily quota is not a per-line failure — stop and say so instead of burning retries
        if (/daily free quota/.test(e.message)) throw e
        gen = items.map((it) => ({ id: it.id, ok: false, error: e.message }))
      }
    } else {
      const job = join(work, `job-${t}.json`)
      writeFileSync(job, JSON.stringify({ model: MODEL, lang, ref: join(c.dir, "reference.wav"), out: work, items }))
      gen = JSON.parse(sh(PY, [join(here, "tts_batch.py"), job]).trim().split("\n").pop())
    }
    const made = []
    for (const g of gen) {
      const l = result.lines[Number(/line-(\d+)/.exec(g.id)[1]) - 1]
      l.tries = t
      if (!g.ok) { l.error = g.error; continue }
      const clean = join(work, `${g.id}.clean.wav`)
      ffmpeg(["-i", g.file, "-af", "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse", "-ar", "48000", "-ac", "1", clean])
      made.push({ l, clean })
    }
    if (!made.length) continue
    // one whisper load for the whole round (the CLI's multi-file mode overwrites its own outputs)
    const ajob = join(work, `asr-${t}.json`)
    writeFileSync(ajob, JSON.stringify({ model: WHISPER, lang, files: made.map((m) => m.clean) }))
    const heardBy = JSON.parse(sh(WPY, [join(here, "asr_batch.py"), ajob]).trim().split("\n").pop())
    for (const { l, clean } of made) {
      const heard = heardBy[clean] || ""
      const dur = probe(clean).duration
      // Calm tutorial narration runs ~7–9 normalised Arabic letters a second; the window only has to
      // catch a cut-off line (far too short) or a runaway/looping one (far too long).
      const expected = normAr(l.text).length / 10
      const ratio = expected ? dur / expected : 0
      const e = cer(l.text, heard)
      const ok = e <= B.voice_cer_max && ratio >= 0.5 && ratio <= 2.0
      if (ok || l.cer === undefined || e < l.cer) Object.assign(l, { candidate: clean, heard, cer: +e.toFixed(3), duration: +dur.toFixed(2), ratio: +ratio.toFixed(2) })
      if (ok) {
        const final = join(out, `line-${String(l.i + 1).padStart(2, "0")}.wav`)
        ffmpeg(["-i", clean, "-c:a", "pcm_s16le", final])
        Object.assign(l, { ok: true, file: final })
      }
    }
  }
  const okCount = result.lines.filter((l) => l.ok).length
  result.okRatio = +(okCount / result.lines.length).toFixed(2)
  result.captionsOnly = result.okRatio < 0.75
  if (result.captionsOnly) result.reason = `only ${okCount}/${result.lines.length} lines passed the gate`
  for (const l of result.lines) delete l.candidate
  writeFileSync(join(out, "voice.json"), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ voice: id, ok: okCount, of: result.lines.length, captionsOnly: result.captionsOnly, lines: result.lines.map(({ i, ok, cer: e, ratio, tries }) => ({ i, ok, cer: e, ratio, tries })) }, null, 2))
  process.exit(0)
}

// --- mix ------------------------------------------------------------------------------------
if (sub === "mix") {
  const vfile = rest[0]
  const cuesFile = arg("cues"), out = arg("out"), duration = Number(arg("duration"))
  if (!vfile || !cuesFile || !out || !duration) throw new Error("usage: voice mix <voice.json> --cues <cues.json> --duration S --out <file.wav> [--lufs -16] [--lead 0.25]")
  const v = JSON.parse(readFileSync(vfile, "utf8"))
  const cues = JSON.parse(readFileSync(cuesFile, "utf8"))
  const lead = Number(arg("lead", "0.25")), lufs = Number(arg("lufs", "-16"))
  const placed = []
  const warnings = []
  let cursor = 0
  v.lines.forEach((l, i) => {
    if (!l.ok || !cues[i]) return
    let at = Number(cues[i].start) + lead
    if (at < cursor + 0.15) { warnings.push(`line ${i + 1} would overlap the previous one by ${(cursor + 0.15 - at).toFixed(2)}s — hold the frame longer before caption ${i + 1}`); at = cursor + 0.15 }
    const end = at + l.duration
    const next = cues[i + 1] ? Number(cues[i + 1].start) : duration
    if (end > next + 0.4) warnings.push(`line ${i + 1} runs ${(end - next).toFixed(2)}s past caption ${i + 2}`)
    placed.push({ i, file: l.file, at: +at.toFixed(3), end: +end.toFixed(3) })
    cursor = end
  })
  if (!placed.length) throw new Error("no usable lines to mix")
  const inputs = placed.flatMap((p) => ["-i", p.file])
  const delays = placed.map((p, k) => `[${k}:a]adelay=${Math.round(p.at * 1000)}:all=1[a${k}]`).join(";")
  const join_ = placed.length === 1 ? "[a0]anull" : `${placed.map((_, k) => `[a${k}]`).join("")}amix=inputs=${placed.length}:normalize=0:dropout_transition=0`
  const tmp = join(tmpdir(), `mix-${process.pid}.wav`)
  ffmpeg([...inputs, "-filter_complex", `${delays};${join_},apad,atrim=0:${duration}[m]`, "-map", "[m]", "-ar", "48000", "-ac", "1", tmp])
  // two-pass loudnorm to the web/social target
  const m = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", tmp, "-af", `loudnorm=I=${lufs}:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr
  const j = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1))
  ffmpeg(["-i", tmp, "-af", `loudnorm=I=${lufs}:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", out])
  console.log(JSON.stringify({ out, placed, warnings }, null, 2))
  process.exit(0)
}

console.error("usage: voice <status|record|consent|gen|mix|revoke> … (see header)")
process.exit(2)
