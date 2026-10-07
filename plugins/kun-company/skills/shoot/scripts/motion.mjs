// motion.mjs <html> <out.mp4> [--fps 30] [--preview t1,t2,…] [--range t0,t1]
// Steps a deterministic window.render(t) frame by frame and delivers through the shared media library:
// frames are captured over CDP and piped straight into an MJPEG mezzanine (no file per frame), and
// media.sh encodes the tv-range BT.709 web file.
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { FFMPEG, requireRt } from "../../edit/scripts/media/rt.mjs"

const { chromium } = requireRt("playwright-core")
const MEDIA = join(dirname(fileURLToPath(import.meta.url)), "../../edit/scripts/media.sh")
const args = process.argv.slice(2)
const [html, out] = args
const fps = Number(args.includes("--fps") ? args[args.indexOf("--fps") + 1] : 30)
const range = args.includes("--range") ? args[args.indexOf("--range") + 1].split(",").map(Number) : null
const preview = args.includes("--preview") ? args[args.indexOf("--preview") + 1].split(",").map(Number) : null

const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.goto("file://" + html)
await page.evaluate(async () => {
  await document.fonts.ready
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
})
const duration = await page.evaluate(() => window.DURATION)
const cdp = await page.context().newCDPSession(page)

async function paint(t) {
  await page.evaluate((t) => window.render(t), t)
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : i.decode().catch(() => {})))))
}

if (preview) {
  for (const t of preview) {
    await paint(t)
    await page.screenshot({ path: join(dirname(out), `preview-${t}.jpg`), type: "jpeg", quality: 92 })
  }
  console.log(`previews at ${preview.join(", ")}s · duration ${duration.toFixed(1)}s`)
} else {
  const mezz = out.replace(/\.mp4$/, ".mezz.mkv")
  mkdirSync(dirname(out), { recursive: true })
  const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "mjpeg", "-framerate", String(fps), "-i", "-", "-c:v", "copy", mezz], { stdio: ["pipe", "inherit", "inherit"] })
  const [t0, t1] = range ?? [0, duration]
  const n = Math.round((t1 - t0) * fps)
  for (let f = 0; f < n; f++) {
    await paint(t0 + f / fps)
    const jpg = Buffer.from((await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true })).data, "base64")
    if (!ff.stdin.write(jpg)) await once(ff.stdin, "drain")
    if (f % 300 === 0) console.log(`frame ${f}/${n}`)
  }
  ff.stdin.end()
  await once(ff, "close")
  const r = spawnSync(MEDIA, ["encode", "web", mezz, out], { encoding: "utf8" })
  rmSync(mezz, { force: true })
  if (r.status !== 0) throw new Error(`encode failed: ${r.stderr}`)
  console.log(`✓ ${out} · ${duration.toFixed(1)}s · ${n} frames`)
}
await browser.close()
