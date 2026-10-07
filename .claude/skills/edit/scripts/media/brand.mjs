#!/usr/bin/env node
// brand <id> [--json|--css|--ass]
// One source for every renderer: sim overlays and HyperFrames read --css, libass captions --ass.
// Fonts resolve to ~/Library/Fonts (Thmanyah is licensed for local use only — never copied into a repo).
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { brand, flag, positional } from "./rt.mjs"

const [id] = positional()
if (!id) {
  console.error("usage: brand <id> [--json|--css|--ass]")
  process.exit(2)
}
let b
try {
  b = brand(id)
} catch (e) {
  console.error(e.message)
  process.exit(2)
}
const v = b.video
const fontDir = join(homedir(), "Library/Fonts")
const font = (f) => (f && existsSync(join(fontDir, f)) ? `file://${join(fontDir, f)}` : null)

if (flag("css")) {
  const head = font(b.fonts?.arabicHeadline), body = font(b.fonts?.arabicBody)
  const faces = [
    head && `@font-face{font-family:"Brand Display";src:url("${head}");font-weight:900}`,
    body && `@font-face{font-family:"Brand Sans";src:url("${body}")}`,
  ].filter(Boolean).join("\n")
  console.log(`${faces}
:root{--canvas:${v.canvas};--ink:${v.ink};--accent:${v.accent};--accent-soft:${v.accentSoft};--caption-bg:${v.captionBg};--caption-ink:${v.captionInk};
--font-display:"Brand Display","Thmanyah Serif Display",serif;--font-sans:"Brand Sans","Thmanyah Sans",system-ui,sans-serif}`)
} else if (flag("ass")) {
  // libass colours are &HAABBGGRR; 0x33 alpha ≈ 80% opaque caption box (outlines muddy Arabic dots).
  const bgr = (hex) => hex.replace("#", "").match(/../g).reverse().join("").toUpperCase()
  console.log(`FontName=Thmanyah Sans,FontSize=17,Bold=1,PrimaryColour=&H00${bgr(v.captionInk)},OutlineColour=&H33${bgr(v.captionBg)},BackColour=&H33${bgr(v.captionBg)},BorderStyle=3,Outline=4,Shadow=0,Alignment=2,MarginV=60`)
} else {
  console.log(JSON.stringify(b, null, 2))
}
