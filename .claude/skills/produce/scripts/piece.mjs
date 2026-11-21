#!/usr/bin/env node
// piece — resolve one market×language version of a project's script into a FilmCraft piece spec.
//
//   node piece.mjs <projectDir> <variant> [--dry-run]     variant = <market>-<lang> (sa-ar, eg-en) or a bare lang
//
// Reads   03-script/script.json · 04-storyboard/shot-list.json · project.json · content/media/markets.json
//         (MARKETS_FILE overrides the markets path)
// Writes  03-script/variants/<variant>.json            the resolved lines {variant, market, lang, dialect, style, scenes}
//         07-audio/voiceover/<variant>.script.json     input for `voice.mjs gen <it> --out 07-audio/voiceover/<variant>`
//         06-production/editing/<variant>.video.json   the spec for edit/scripts/fc/assemble.mjs (never rendered here)
// Prints  {script, voiceScript, piece, missing:[...]} — --dry-run only means missing assets don't fail the run.
// Line resolution: voice "<lang>@<dialect>" beats "<lang>"; tokens {{price}} {{currency}} {{currencySymbol}} {{market}}.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"

const KUN = resolve(dirname(new URL(import.meta.url).pathname), "../../../..")
const args = process.argv.slice(2)
const [projectDir0, variant] = args.filter((a) => !a.startsWith("--"))
const dry = args.includes("--dry-run")
if (!projectDir0 || !variant) { console.error("usage: piece.mjs <projectDir> <variant> [--dry-run]"); process.exit(2) }
const P = resolve(projectDir0.replace(/^~/, homedir()))
const readJson = (f) => JSON.parse(readFileSync(f, "utf8"))
const writeJson = (f, o) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(o, null, 2) + "\n") }

const markets = readJson(process.env.MARKETS_FILE || join(KUN, "content/media/markets.json"))
const project = readJson(join(P, "project.json"))
const script = readJson(join(P, "03-script/script.json"))
const shots = readJson(join(P, "04-storyboard/shot-list.json")).scenes

// variant → market + lang (a bare lang takes the first market that offers it)
const parts = variant.split("-")
const lang = parts.length > 1 ? parts[parts.length - 1] : parts[0]
const marketId = parts.length > 1 ? parts.slice(0, -1).join("-") : Object.keys(markets).find((k) => k !== "readme" && markets[k].langs?.includes(lang))
const market = markets[marketId]
if (!market) throw new Error(`unknown market "${marketId}" for variant ${variant}`)
if (!["ar", "en"].includes(lang)) throw new Error(`unsupported lang "${lang}"`)
const vo = market.voice?.[lang] || {}
const dialect = vo.dialect || "neutral"
const style = vo.style || ""

const CURRENCY = { SAR: { ar: "ريالاً", en: "riyals" }, AED: { ar: "درهماً", en: "dirhams" }, USD: { ar: "دولارات", en: "dollars" } }
const CURRENCY_ONE = { SAR: "ريال", AED: "درهم", USD: "دولار" }
const arab = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])
// A fractional price shows with two decimals ($6.40; Arabic ٦٫٤٠ with the Arabic decimal mark)
const shown = Number.isInteger(market.price) ? String(market.price) : market.price.toFixed(2)
const price = market.numerals === "arab" && lang === "ar" ? arab(shown).replace(".", "٫") : shown
// Spoken, a fraction reads as units + cents ("6 dollars 40 cents" / "٦ دولارات و٤٠ سنتاً"), never "six point four"
const whole = Math.trunc(market.price), cents = Math.round((market.price - whole) * 100)
const num = (n) => (market.numerals === "arab" && lang === "ar" ? arab(n) : String(n))
// en: "$" goes before the figure; any other currency reads as its code after it
const symbolEn = market.currency === "USD" ? "$" : market.currency
// Arabic with a bare "$" reads badly ("٧ $"): use the currency word (دولارات) instead
const symbol = lang === "ar" ? (market.symbol?.svg || market.symbol?.text !== "$" ? market.symbol?.text || market.currency : CURRENCY[market.currency]?.ar || market.currency) : symbolEn
const tokens = { price, currency: CURRENCY[market.currency]?.[lang] || market.currency, currencySymbol: symbol, market: market.name?.[lang] || marketId }
const fill = (s, { dropSymbol = false, spoken = false } = {}) => {
  let t = s
  if (spoken && cents) t = t.replace("{{price}} {{currency}}", lang === "ar" ? `${num(whole)} ${tokens.currency} و${num(cents)} سنتاً` : `${whole} ${tokens.currency} ${cents} cents`)
  if (lang === "en" && symbolEn !== "$") t = t.replace("{{currencySymbol}}{{price}}", "{{price}} {{currencySymbol}}")
  if (dropSymbol) t = t.replace(/\s*\{\{currencySymbol\}\}/, "")
  // Arabic after a decimal figure takes the singular: «٦٫٤٠ دولار», not «دولارات»
  if (!spoken && cents && lang === "ar") t = t.replace(/\{\{price\}\}(\s*)\{\{(currency|currencySymbol)\}\}/, `{{price}}$1${CURRENCY_ONE[market.currency] || "{{$2}}"}`)
  return t.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m)).replace(/ {2,}/g, " ").trim()
}
const pick = (o) => o[`${lang}@${dialect}`] ?? o[lang] ?? ""

// ---- 1. resolved script
const scenes = shots.map((sh) => {
  const sc = script.scenes.find((x) => x.id === sh.id)
  if (!sc) throw new Error(`scene ${sh.id} is in shot-list.json but not in script.json`)
  return { id: sh.id, durationS: sh.durationS, onScreen: fill(pick(sc.onScreen)), voice: fill(pick(sc.voice), { spoken: true }), overridden: !!sc.voice[`${lang}@${dialect}`] }
})
const scriptOut = join(P, "03-script/variants", `${variant}.json`)
writeJson(scriptOut, { variant, market: marketId, lang, dialect, style, scenes: scenes.map(({ overridden, ...s }) => s) })

// ---- 2. voice script (voice.mjs gen): stock Gemini voice, dialect + style steer the delivery
const vdir = join(P, "07-audio/voiceover")
const voiceScript = join(vdir, `${variant}.script.json`)
writeJson(voiceScript, { engine: "gemini", voice: "Charon", lang, dialect, style, lines: scenes.map((s) => s.voice) })

// ---- 3. piece spec for assemble.mjs
const missing = []
const need = (f) => { if (!existsSync(f)) missing.push(f); return f }
const items = []
let endCard
shots.forEach((sh, i) => {
  const s = scenes[i]
  const last = i === shots.length - 1
  if (sh.source?.type === "capture") {
    items.push({ type: "clip", id: sh.id, src: need(join(P, "05-assets/screen-recordings", lang, `${sh.id}.mp4`)), in: 0, out: sh.durationS, label: s.onScreen })
  } else if (last) {
    const [title, ...rest] = s.onScreen.split(" · ")
    endCard = { title, subtitle: rest.join(" · "), seconds: sh.durationS }
  } else {
    const sc = script.scenes.find((x) => x.id === sh.id)
    const raw = pick(sc.onScreen)
    const money = /^\s*((?:\{\{currencySymbol\}\}\s*)?\{\{price\}\}(?:\s*\{\{currencySymbol\}\})?)\s*(.*)$/s.exec(raw)
    if (money) {
      // the figure is the title; a symbol with an SVG becomes the card's image (it follows the number)
      const svg = market.symbol?.svg ? resolve(KUN, market.symbol.svg) : null
      items.push({ type: "card", id: sh.id, title: fill(money[1], { dropSymbol: !!svg }), subtitle: fill(money[2]), seconds: sh.durationS, ...(svg ? { image: need(svg) } : {}) })
    } else {
      items.push({ type: "card", id: sh.id, title: s.onScreen, seconds: sh.durationS })
    }
  }
})
const music = join(P, "07-audio/music/bed.wav")
const pieceFile = join(P, "06-production/editing", `${variant}.video.json`)
writeJson(pieceFile, {
  piece: variant, brand: project.identity || "balqalam", lang, aspects: ["9:16"], fps: 30,
  items, ...(endCard ? { endCard } : {}),
  voice: join(vdir, `${variant}.wav`),
  ...(existsSync(music) ? { music: { src: music, db: -18 } } : {}),
  captions: true, burnCaptions: true,
  outDir: join(P, "08-render", variant),
  variant: { market: marketId, dialect, price: market.price, currency: market.currency },
})

const out = { script: scriptOut, voiceScript, piece: pieceFile, missing }
console.log(JSON.stringify(out, null, 2))
if (missing.length && !dry && process.env.PIECE_STRICT) process.exit(1)
