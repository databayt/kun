// Shared runtime for the media helpers — paths, deps, ffprobe, budgets, Arabic text tools.
// Deps (sharp, playwright-core) resolve from the media runtime dir, never from a product repo,
// so every script works the same in hogwarts, mkan or a repo without Playwright installed.
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const HOME = homedir()
export const KUN_DIR = process.env.KUN_DIR || join(HOME, "kun")
export const MEDIA_RT = process.env.MEDIA_RT || join(HOME, ".local/share/databayt/media")
export const VOICE_DIR = process.env.MEDIA_VOICE_DIR || join(HOME, "Library/Application Support/databayt/voice")
export const CDN_BUCKET = "databayt-cdn"
export const CDN_HOST = "cdn.databayt.org"

// The brand a repo renders in by default (palette, fonts, hosts). The CDN namespace is the
// brand kit's `cdn`, which is always the repo name — balqalam is a tenant brand of hogwarts.
export const REPO_BRAND = { hogwarts: "balqalam", mkan: "mkan", kun: "kun", marketing: "databayt" }

// One local home per repo for every finished still, tutorial, reel and raw take — outside the
// repo (nothing under public/ gets served by accident) and mirrored to Drive by `record.sh sync`.
//   ~/media/<repo>/<flow>/…   ~/media/<repo>/page/<slug>-<locale>.png   ~/media/<repo>/<flow>/raw/
export const MEDIA_HOME = process.env.MEDIA_HOME || join(HOME, "media")
export const mediaRoot = (repo) => join(MEDIA_HOME, repo)
const FF = "/opt/homebrew/opt/ffmpeg-full/bin"
export const FFMPEG = existsSync(join(FF, "ffmpeg")) ? join(FF, "ffmpeg") : "ffmpeg"
export const FFPROBE = existsSync(join(FF, "ffprobe")) ? join(FF, "ffprobe") : "ffprobe"

const rtRequire = createRequire(join(MEDIA_RT, "package.json"))
export function requireRt(name) {
  try {
    return rtRequire(name)
  } catch {
    throw new Error(`${name} missing from ${MEDIA_RT} — run: bash ~/.claude/skills/edit/scripts/media.sh setup`)
  }
}

// Run a command; throw with its stderr on failure. Returns stdout as text.
export function sh(cmd, args, { input, quiet = true } = {}) {
  const r = spawnSync(cmd, args, { input, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["pipe", "pipe", quiet ? "pipe" : "inherit"] })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 6).join(" ")} … failed (${r.status}): ${(r.stderr || "").slice(-800)}`)
  return r.stdout
}

export function probe(file) {
  const j = JSON.parse(sh(FFPROBE, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]))
  const v = j.streams.find((s) => s.codec_type === "video")
  const a = j.streams.find((s) => s.codec_type === "audio")
  const [n, d] = (v?.avg_frame_rate || v?.r_frame_rate || "0/1").split("/").map(Number)
  return {
    file,
    bytes: Number(j.format.size),
    duration: Number(j.format.duration || v?.duration || 0),
    video: v && {
      codec: v.codec_name, profile: v.profile, pix_fmt: v.pix_fmt, width: v.width, height: v.height,
      fps: d ? +(n / d).toFixed(3) : 0, color_range: v.color_range, color_space: v.color_space,
      color_primaries: v.color_primaries, color_transfer: v.color_transfer, level: v.level,
    },
    audio: a && { codec: a.codec_name, channels: a.channels, sample_rate: Number(a.sample_rate) },
  }
}

// moov before mdat = the file can start playing before it has fully downloaded.
export function moovFirst(file) {
  const buf = readFileSync(file)
  let off = 0
  while (off + 8 <= buf.length) {
    let size = buf.readUInt32BE(off)
    const type = buf.toString("latin1", off + 4, off + 8)
    if (type === "moov") return true
    if (type === "mdat") return false
    if (size === 1) size = Number(buf.readBigUInt64BE(off + 8))
    if (size < 8) return false
    off += size
  }
  return false
}

export const sha8 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8)

export const CONTENT_TYPE = {
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav",
  avif: "image/avif", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", vtt: "text/vtt; charset=utf-8", srt: "application/x-subrip", json: "application/json", pdf: "application/pdf",
}

// Budgets: engine.json → media wins; these defaults mirror the approved plan.
export function budgets() {
  const d = {
    h264_mb_per_min: 8, av1_mb_per_min: 5, reel_mb: 15, clip_mb: 6, avif_1600_median_kb: 150,
    vmaf_h264: 95, vmaf_av1: 93, lufs_web: -16, lufs_social: -14, lufs_tolerance: 1, true_peak_max: -1.5,
    voice_cer_max: 0.1, preview_px: 1600, cache_days: 7, disk_floor_gb: 10,
  }
  try {
    const e = JSON.parse(readFileSync(join(KUN_DIR, ".claude/engine.json"), "utf8"))
    return { ...d, ...(e.media || {}) }
  } catch {
    return d
  }
}

// Arabic normalisation for transcript comparison: drop tashkeel + tatweel, fold alef/ya/ta-marbuta,
// drop punctuation and spaces. What remains is what a listener would hear as "the same words".
export function normAr(s) {
  return String(s)
    .normalize("NFKC")
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/ـ/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase()
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

export const cer = (ref, hyp) => {
  const r = normAr(ref), h = normAr(hyp)
  return r.length ? levenshtein(r, h) / r.length : h.length ? 1 : 0
}

// Brand production entry (content/media/brand-kit.json → production[id]); falls back to the
// publishing kit's palette for the four wired brands so nothing breaks before the map exists.
export function brand(id) {
  const kit = JSON.parse(readFileSync(join(KUN_DIR, "content/media/brand-kit.json"), "utf8"))
  const alias = { moallimee: "moalimee" }
  const key = alias[id] || id
  const p = kit.production?.[key]
  if (p) {
    if (p.status === "draft") throw new Error(`brand "${key}" is a draft in content/media/brand-kit.json → production — fill its TODO fields (colours, hosts, cdn) first; renderers never guess a brand`)
    return { id: key, ...p, logoPath: p.logo && join(KUN_DIR, p.logo) }
  }
  const b = kit.brands?.[key]
  if (!b) throw new Error(`Unknown brand "${id}" — add it to content/media/brand-kit.json → production`)
  const hex = (name) => [...(b.palette?.canvas || []), ...(b.palette?.support || [])].find((c) => c.name === name)?.hex
  return {
    id: key, status: "fallback", repo: key, locales: ["ar", "en"], timezone: "Africa/Khartoum",
    fonts: { arabicHeadline: "thmanyah-serif-display-900.ttf", arabicBody: "thmanyah-sans-500.ttf" },
    video: { canvas: hex("Ivory Light") || "#faf9f5", ink: hex("Slate Dark") || "#141413", accent: hex("Clay") || "#d97757", accentSoft: "#ebcece", captionBg: "#141413", captionInk: "#faf9f5", numerals: "arab" },
    cdn: key, logoPath: b.mark?.file && join(KUN_DIR, b.mark.file),
  }
}

export function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def
}
export const flag = (name) => process.argv.includes(`--${name}`)
export const positional = () => {
  const out = []
  const a = process.argv.slice(2)
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      if (i + 1 < a.length && !a[i + 1].startsWith("--") && !BOOLEAN.has(a[i].slice(2))) i++
      continue
    }
    out.push(a[i])
  }
  return out
}
const BOOLEAN = new Set(["check", "dry-run", "json", "css", "ass", "force", "deep", "photo", "ui", "no-upload", "overwrite"])
