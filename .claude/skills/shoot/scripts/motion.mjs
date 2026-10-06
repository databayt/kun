// render.mjs <html> <out.mp4> [--fps 30] [--preview t1,t2,…]
// Steps a deterministic window.render(t) frame by frame, screenshots each, encodes H.264.
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"

const require = createRequire("/Users/abdout/hogwarts/package.json")
const { chromium } = require("@playwright/test")
const args = process.argv.slice(2)
const [html, out] = args
const fps = Number(args.includes("--fps") ? args[args.indexOf("--fps") + 1] : 30)
const preview = args.includes("--preview") ? args[args.indexOf("--preview") + 1].split(",").map(Number) : null

const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.goto("file://" + html)
await page.evaluate(async () => {
  await document.fonts.ready
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
})
const duration = await page.evaluate(() => window.DURATION)

// Preload every screenshot once so frame captures never wait on decode.
await page.evaluate(async () => {
  const srcs = [...new Set([...document.querySelectorAll("script")].flatMap(() => []))]
  return srcs
})

async function frame(t, file) {
  await page.evaluate((t) => window.render(t), t)
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : i.decode().catch(() => {})))))
  await page.screenshot({ path: file, type: "jpeg", quality: 92 })
}

if (preview) {
  for (const t of preview) await frame(t, join(dirname(out), `preview-${t}.jpg`))
  console.log(`previews at ${preview.join(", ")}s · duration ${duration.toFixed(1)}s`)
} else {
  const dir = join(dirname(out), "frames")
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const n = Math.round(duration * fps)
  for (let f = 0; f < n; f++) {
    await frame(f / fps, join(dir, `${String(f).padStart(5, "0")}.jpg`))
    if (f % 150 === 0) console.log(`frame ${f}/${n}`)
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%05d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
  rmSync(dir, { recursive: true, force: true })
  console.log(`✓ ${out} · ${duration.toFixed(1)}s · ${n} frames`)
}
await browser.close()
