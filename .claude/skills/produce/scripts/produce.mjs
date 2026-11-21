#!/usr/bin/env node
// produce — the video factory's project ledger. It creates a production project, records each of the
// 14 stages, holds the human gates, and ships an approved master to the CDN video tier. It does not
// make video: every stage's work is done by the existing skill named in SKILL.md.
//
//   produce init --brand hogwarts|mkan|databayt --category <intro|promo|explainer|tutorial|…> --subject <slug> [--lang ar,en] [--title "…"]
//        [--identity <brand-kit key, default = the brand>] [--audience "…"] [--objective "…"]
//        [--markets sa,ae,eg,sd] [--slug <stable CDN slug, default = the category>]
//   produce set <ID> identity <brand-kit key>      (change which brand-kit face appears on film)
//   produce set <ID> slug <slug>  |  set <ID> markets sa,ae,eg,sd   (markets: content/media/markets.json)
//   produce status <ID>                            shared stages, then a variant x per-variant-stage grid + predicted URLs
//   produce advance <ID> <stage> --file <deliverable> [--verdict pass|fail] [--variant <v>]   (--variant for audio edit render qa publish)
//   produce approve <ID> --version Vnnn --by <login> [--gate script|version|publish] [--variant <v>|--all] [--destination facebook] [--issue databayt/x#n]
//   produce cost <ID> --item <what> --usd <n> [--note "…"]
//   produce issue <ID> [--repo databayt/kun] [--create]
//   produce url <ID> [--variant <v>]               predicted stable + archive CDN URLs, before anything renders
//   produce build <ID> --variant <v>|--all [--dry-run] [--force]   piece.mjs -> assemble.mjs per variant (skips unchanged inputs)
//   produce ship <ID> [--variant <v>|--all] [--dry-run]
//   produce index [--out <file>]
//   produce validate <project.json|shot-list.json>
//
// Projects live in ~/media/_projects/<ID>/ (outside every repo; override with PRODUCE_HOME).
// A project with markets has variants <market>-<lang> (sa-ar, eg-en). Stages request..visual are shared; audio edit
// render qa approval cdn publish are per variant (project.json variantStages[<variant>][<stage>]).
// CDN keys, variant mode (stable slug, not the dated ID):
//   video/<cdn>/<slug>/<variant>/{fb-9x16.mp4,poster.webp,<lang>.vtt}   stable, overwritten on re-approval + invalidated
//   video/<cdn>/<slug>/manifest.json                                     every shipped variant
//   video/<cdn>/<slug>/_v/<Vnnn>/<variant>/…                             immutable archive per version
// Legacy keys (projects without markets): video/<brand>/<ID>/{master.mp4,fb-16x9.mp4,…,manifest.json}, plus video/index.json.
// The existing <ns>/<lang>/<flow>/video.mp4 keys are untouched (publish.mjs modes unchanged).
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { CDN_BUCKET, CDN_HOST, CONTENT_TYPE, brand as loadBrand, sh, sha8 } from "../../edit/scripts/media/rt.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SCHEMA = join(HERE, "..", "schema")
const PUBLISH = join(HERE, "..", "..", "edit", "scripts", "media", "publish.mjs")
const HOME = process.env.PRODUCE_HOME || join(homedir(), "media", "_projects")

const BRANDS = { hogwarts: "HOG", mkan: "MKN", databayt: "DBY" }
const CODE_TO_BRAND = Object.fromEntries(Object.entries(BRANDS).map(([b, c]) => [c, b]))

// The 14 stages (blueprint §6): key, deliverable (relative to the project dir), the human gate if any.
export const STAGES = [
  ["request", "01-brief/request.json"],
  ["research", "02-research/product-research.md"],
  ["brief", "01-brief/creative-brief.md"],
  ["script", "03-script/script.md"],
  ["storyboard", "04-storyboard/shot-list.json"],
  ["assets", "05-assets/asset-manifest.json"],
  ["visual", "06-production/visual-manifest.json"],
  ["audio", "07-audio/audio-package.json"],
  ["edit", "06-production/editing/edit-project.json"],
  ["render", "08-render/masters/master.mp4"],
  ["qa", "09-quality/qa-report.md"],
  ["approval", "(approve --version)"],
  ["cdn", "(ship)"],
  ["publish", "10-publishing/publishing-record.md"],
].map(([key, file], i) => ({ key, n: String(i + 1).padStart(2, "0"), file }))
const STAGE_KEYS = STAGES.map((s) => s.key)
const PER_VARIANT = ["audio", "edit", "render", "qa", "approval", "cdn", "publish"]
const HEAVY = new Set(["visual", "audio", "edit", "render"]) // expensive: need the script sign-off first
const FOLDERS = [
  "01-brief", "02-research", "03-script", "04-storyboard",
  "05-assets/screen-recordings", "05-assets/images", "05-assets/generated-video", "05-assets/3d", "05-assets/graphics", "05-assets/audio",
  "06-production/blender", "06-production/filmcraft", "06-production/editing",
  "07-audio/voiceover", "07-audio/music", "07-audio/sound-effects",
  "08-render/previews", "08-render/masters", "08-render/delivery",
  "09-quality", "10-publishing",
]

// ---- helpers ---------------------------------------------------------------------------------
const die = (m, code = 1) => {
  console.error(`produce: ${m}`)
  process.exit(code)
}
const argv = process.argv.slice(2)
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def
}
const has = (name) => argv.includes(`--${name}`)
const VALUE_FLAGS = new Set(["markets", "slug", "variant", "brand", "category", "subject", "lang", "title", "version", "by", "gate", "destination", "issue", "file", "verdict", "item", "usd", "note", "repo", "out", "identity", "audience", "objective"])
const pos = () => {
  const out = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      if (VALUE_FLAGS.has(argv[i].slice(2))) i++
      continue
    }
    out.push(argv[i])
  }
  return out
}
const now = () => new Date().toISOString()
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"))
const writeJson = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + "\n")
const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16)

// A small JSON-schema subset (type, enum, pattern, required, properties, items, minItems) — enough for
// the two shipped schemas, zero dependencies (the skill is copied to ~/.claude/skills, where kun's zod is out of reach).
export function validate(value, schema, path = "$") {
  const errs = []
  const types = [].concat(schema.type ?? [])
  const kind = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v)
  if (types.length) {
    const k = kind(value)
    if (!types.some((t) => t === k || (t === "number" && k === "integer"))) return [`${path}: expected ${types.join("|")}, got ${k}`]
  }
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: "${value}" not in [${schema.enum.join(", ")}]`)
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value)) errs.push(`${path}: "${value}" does not match ${schema.pattern}`)
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errs.push(`${path}: needs at least ${schema.minItems} item(s)`)
    if (schema.items) value.forEach((v, i) => errs.push(...validate(v, schema.items, `${path}[${i}]`)))
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const r of schema.required ?? []) if (!(r in value)) errs.push(`${path}: missing "${r}"`)
    for (const [k, s] of Object.entries(schema.properties ?? {})) if (k in value) errs.push(...validate(value[k], s, `${path}.${k}`))
  }
  return errs
}
const schemaOf = (name) => readJson(join(SCHEMA, `${name}.schema.json`))

// The hard rules, checked on the shot list: real UI only for product claims; generated scenes are illustrative.
function shotListRules(sl) {
  const errs = []
  for (const s of sl.scenes ?? []) {
    if (s.productClaim && s.source?.type !== "capture") errs.push(`scene ${s.id}: productClaim needs source.type=capture (real product UI), got ${s.source?.type}`)
    if (["ai", "3d"].includes(s.source?.type) && s.illustrative !== true) errs.push(`scene ${s.id}: generated (${s.source.type}) scenes must set illustrative:true`)
  }
  return errs
}

// identity = which brand-kit face appears on film; must be a key of brand-kit.json brands or production.
function checkIdentity(id) {
  const kit = readJson(join(HERE, "..", "..", "..", "..", "content", "media", "brand-kit.json"))
  const keys = new Set([...Object.keys(kit.brands ?? {}), ...Object.keys(kit.production ?? {})].filter((k) => !k.startsWith("$")))
  if (!keys.has(id)) die(`unknown identity "${id}" — not a key in brand-kit.json (${[...keys].join(", ")})`, 2)
  return id
}

// ---- markets + variants ------------------------------------------------------------------------
const MARKETS_FILE = join(HERE, "..", "..", "..", "..", "content", "media", "markets.json")
const loadMarkets = () => Object.fromEntries(Object.entries(readJson(MARKETS_FILE)).filter(([k]) => k !== "readme" && !k.startsWith("$")))
function parseMarkets(csv) {
  const M = loadMarkets()
  const ids = String(csv).split(",").map((s) => s.trim()).filter(Boolean)
  const bad = ids.filter((m) => !M[m])
  if (!ids.length || bad.length) die(`unknown market(s) ${bad.join(",") || "(none given)"} — known: ${Object.keys(M).join(", ")} (content/media/markets.json)`, 2)
  return [...new Set(ids)]
}
// no markets -> one variant per language, market null, id = lang (the old single-lang shape)
function deriveVariants(marketIds, langs) {
  if (!marketIds?.length) return langs.map((l) => ({ id: l, market: null, lang: l }))
  const M = loadMarkets(), out = []
  for (const m of marketIds) for (const l of M[m].langs) if (!langs || langs.includes(l)) out.push({ id: `${m}-${l}`, market: m, lang: l })
  if (!out.length) die(`markets ${marketIds.join(",")} have no language in ${langs.join(",")}`, 2)
  return out
}
const checkSlug = (s) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) ? s : die(`slug "${s}" must be lowercase a-z, 0-9 and hyphens`, 2))
const slugOf = (p) => p.slug ?? p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const variantsOf = (p) => p.variants ?? deriveVariants(null, p.langs)
const variantMode = (p) => Array.isArray(p.markets) && p.markets.length > 0
const vst = (p, v, k) => p.variantStages?.[v]?.[k]
const setV = (p, v, k, val) => { ((p.variantStages ??= {})[v] ??= {})[k] = val }
const delV = (p, v, k) => { if (p.variantStages?.[v]) delete p.variantStages[v][k] }
const vdone = (p, v, k) => ["done", "passed"].includes(vst(p, v, k)?.status)
const variantList = (p) => variantsOf(p).map((v) => v.id).join(", ")
// --variant <v> | --all | the only variant; else error with the list
function selectVariants(p, { optional = false } = {}) {
  const vs = variantsOf(p)
  if (has("all")) return vs
  const name = opt("variant")
  if (name) {
    const v = vs.find((x) => x.id === name)
    return v ? [v] : die(`unknown variant "${name}" — this project has: ${variantList(p)}`, 2)
  }
  if (vs.length === 1) return vs
  if (optional) return vs
  return die(`this project has ${vs.length} variants — pass --variant <v> or --all. Variants: ${variantList(p)}`, 2)
}
const dirOf = (id) => join(HOME, id)
function load(id) {
  if (!id) die("missing <ID>", 2)
  const f = join(dirOf(id), "project.json")
  if (!existsSync(f)) die(`no project ${id} (looked in ${f})`)
  return readJson(f)
}
function save(p) {
  const errs = validate(p, schemaOf("project"))
  if (errs.length) die(`project.json would be invalid:\n  ${errs.join("\n  ")}`)
  writeJson(join(dirOf(p.id), "project.json"), p)
}
const resolveIn = (p, file) => (isAbsolute(file) ? file : join(dirOf(p.id), file))
const rel = (p, file) => (resolve(file).startsWith(dirOf(p.id) + "/") ? resolve(file).slice(dirOf(p.id).length + 1) : resolve(file))
const approval = (p, gate, version = p.version) => p.approvals.filter((a) => a.gate === gate && a.version === version).at(-1)
const done = (p, k) => ["done", "passed"].includes(p.stages[k]?.status)
const masterFile = (p) => {
  const f = p.stages.render?.file
  return f ? resolveIn(p, f) : join(dirOf(p.id), "08-render/masters/master.mp4")
}
const vMaster = (p, v) => {
  const f = vst(p, v, "render")?.file
  return f ? resolveIn(p, f) : join(dirOf(p.id), "08-render", v, "fb-9x16.mp4")
}
const vFiles = (p, v) => {
  const d = join(dirOf(p.id), "08-render", v.id)
  return { mp4: vMaster(p, v.id), poster: join(d, "poster.webp"), vtt: join(d, `${v.lang}.vtt`) }
}
const gh = (args) => {
  const r = spawnSync("gh", args, { encoding: "utf8" })
  if (r.status !== 0) die(`gh ${args.slice(0, 3).join(" ")} failed: ${r.stderr}`)
  return r.stdout.trim()
}

// ---- init ------------------------------------------------------------------------------------
function init() {
  const b = opt("brand"), category = opt("category"), subject = opt("subject")
  if (!BRANDS[b] || !category || !subject) die("usage: init --brand hogwarts|mkan|databayt --category <cat> --subject <slug> [--lang ar,en] [--title …] [--markets sa,ae,eg,sd] [--slug <slug>]", 2)
  const langs = (opt("lang", "ar,en")).split(",").map((s) => s.trim()).filter(Boolean)
  const identity = opt("identity") ? checkIdentity(opt("identity")) : b
  const markets = opt("markets") ? parseMarkets(opt("markets")) : null
  const pslug = checkSlug(opt("slug") ?? slug(category).toLowerCase())
  const variants = deriveVariants(markets, langs)
  const kit = loadBrand(b) // throws on a draft / unknown brand: renderers never guess
  const base = `${BRANDS[b]}-${slug(category)}-${slug(subject)}`
  mkdirSync(HOME, { recursive: true })
  // next free Vnnn for this brand+category+subject, across dates
  const used = readdirSync(HOME).filter((d) => d.startsWith(base + "-")).map((d) => Number(/-V(\d{3})$/.exec(d)?.[1] || 0))
  const v = `V${String(Math.max(0, ...used) + 1).padStart(3, "0")}`
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const id = `${base}-${date}-${v}`
  const dir = dirOf(id)
  if (existsSync(dir)) die(`${id} already exists`)
  for (const f of FOLDERS) mkdirSync(join(dir, f), { recursive: true })
  const owner = spawnSync("git", ["config", "user.name"], { encoding: "utf8" }).stdout.trim() || process.env.USER || "unknown"
  const p = {
    id, brand: b, identity, category: category.toLowerCase(), subject: subject.toLowerCase(), title: opt("title", `${b} ${category} — ${subject}`),
    langs, version: v, status: "draft", createdAt: now(), issue: null, owner, reviewer: null,
    slug: pslug, ...(markets ? { markets } : {}), variants, ...(markets ? { variantStages: {} } : {}),
    stages: {}, assets: [], cost: [], approvals: [], cdn: {},
  }
  writeFileSync(join(dir, "01-brief/request.json"), JSON.stringify({ id, brand: b, identity, category, subject, langs, slug: pslug, markets, audience: opt("audience", "TODO"), objective: opt("objective", "TODO"), references: [], requestedAt: now() }, null, 2) + "\n")
  writeJson(join(dir, "04-storyboard/shot-list.json"), { id, scenes: [] })
  writeFileSync(join(dir, "10-publishing/metadata.json"), JSON.stringify({ id, brand: b, cdn: kit.cdn, destination: "facebook", caption: "TODO", hashtags: [] }, null, 2) + "\n")
  p.stages.request = { status: "done", file: "01-brief/request.json", at: now() }
  p.status = "in-production"
  save(p)
  console.log(JSON.stringify({ id, dir, brand: b, identity, cdn: kit.cdn, version: v, langs, slug: pslug, markets, variants: variants.map((x) => x.id), next: "research (02-research/product-research.md) — then `produce issue " + id + " --create`" }, null, 2))
}

// ---- status ----------------------------------------------------------------------------------
function status(id) {
  const p = load(id)
  const vm = variantMode(p)
  console.log(`${p.id}  [${p.status}]  ${p.title}\n  brand ${p.brand}  identity ${p.identity ?? p.brand}  version ${p.version}  langs ${p.langs.join(",")}  owner ${p.owner}  issue ${p.issue ?? "—"}`)
  if (vm) console.log(`  slug ${slugOf(p)}  markets ${p.markets.join(",")}  variants ${variantList(p)}`)
  let next = null
  for (const s of vm ? STAGES.filter((x) => !PER_VARIANT.includes(x.key)) : STAGES) {
    const st = p.stages[s.key]
    const mark = st ? (st.status === "failed" ? "x" : "v") : " "
    if (!st && !next) next = s
    console.log(`  [${mark}] ${s.n} ${s.key.padEnd(10)} ${st ? `${st.status}  ${st.file ?? ""}  ${st.at}` : `todo  → ${s.file}`}`)
  }
  if (vm) {
    const cell = (v, k) => { const st = vst(p, v, k); return st ? (st.status === "failed" ? "✗" : "✓") : "·" }
    const w = Math.max(8, ...variantsOf(p).map((v) => v.id.length)) + 2
    console.log(`  per-variant stages:`)
    console.log(`  ${"".padEnd(w)}${PER_VARIANT.map((k) => k.padEnd(10)).join("")}`)
    for (const v of variantsOf(p)) console.log(`  ${v.id.padEnd(w)}${PER_VARIANT.map((k) => cell(v.id, k).padEnd(10)).join("")}`)
    if (!next && variantsOf(p).some((v) => !vst(p, v.id, "render"))) next = { n: "08", key: "audio/edit/render per variant (produce build <ID> --variant <v>|--all)" }
    console.log(`  predicted URLs:`)
    const kit = loadBrand(p.brand)
    for (const v of variantsOf(p)) console.log(`    ${v.id.padEnd(w)}${cdnUrl(`${stableBase(p, kit)}/${v.id}/fb-9x16.mp4`)}`)
  }
  const g = (gate) => approval(p, gate)
  console.log(`  gates: script ${g("script") ? `signed by ${g("script").by}` : "NOT signed"} · version ${p.version} ${g("version") ? `approved by ${g("version").by}${g("version").variants ? ` (${Object.keys(g("version").variants).join(",")})` : ""}` : "NOT approved"} · publish ${g("publish") ? `approved by ${g("publish").by} (${g("publish").destination})` : "NOT approved"}`)
  console.log(`  cost: $${p.cost.reduce((a, c) => a + c.usd, 0).toFixed(2)} over ${p.cost.length} item(s)`)
  console.log(next ? `  next: ${next.n} ${next.key}` : "  next: done")
}

// ---- set (identity | slug | markets) ----------------------------------------------------------
function setField(id, field, value) {
  if (!["identity", "slug", "markets"].includes(field) || !value) die("usage: set <ID> identity <brand-kit key> | set <ID> slug <slug> | set <ID> markets sa,ae,eg,sd", 2)
  const p = load(id)
  if (field === "identity") p.identity = checkIdentity(value)
  else if (field === "slug") p.slug = checkSlug(value)
  else {
    p.markets = parseMarkets(value)
    p.variants = deriveVariants(p.markets, p.langs)
    p.variantStages ??= {}
    p.slug ??= slugOf(p)
  }
  save(p)
  const rf = join(dirOf(id), "01-brief/request.json")
  if (existsSync(rf)) writeJson(rf, { ...readJson(rf), [field]: p[field] })
  console.log(`${id}: ${field} ${Array.isArray(p[field]) ? p[field].join(",") : p[field]}${field === "markets" ? `  → variants ${variantList(p)}` : ""}`)
}

// ---- advance ---------------------------------------------------------------------------------
// Record a per-variant stage (used by `advance --variant` and by `build`). Returns the stored record.
function recordVariantStage(p, vid, stage, abs, verdict) {
  let status = "done"
  if (stage === "qa") {
    if (!["pass", "fail"].includes(verdict)) die("qa needs --verdict pass|fail (from the media-qa report)", 2)
    status = verdict === "pass" ? "passed" : "failed"
    if (status === "passed" && !vdone(p, vid, "render")) die(`qa cannot pass before ${vid} is rendered`)
  }
  const rec = { status, file: rel(p, abs), at: now(), ...(stage === "render" ? { sha: sha256(abs) } : {}) }
  setV(p, vid, stage, rec)
  // a re-render invalidates that variant's qa and approval; a re-qa invalidates its approval
  if (stage === "render") { delV(p, vid, "qa"); delV(p, vid, "approval") }
  if (stage === "qa") delV(p, vid, "approval")
  if (p.status === "draft") p.status = "in-production"
  if (stage === "qa" && variantsOf(p).every((v) => vst(p, v.id, "qa")?.status === "passed")) p.status = "in-review"
  return rec
}
function advance(id, stage) {
  const p = load(id)
  if (!STAGE_KEYS.includes(stage)) die(`unknown stage "${stage}" — one of ${STAGE_KEYS.join(" ")}`, 2)
  if (["approval", "cdn"].includes(stage)) die(`stage "${stage}" is set by \`${stage === "approval" ? "approve" : "ship"}\`, never by hand`)
  const perVariant = variantMode(p) && PER_VARIANT.includes(stage)
  if (!perVariant && opt("variant")) die(`--variant only applies to per-variant stages (${PER_VARIANT.join(" ")}) on a project with markets`, 2)
  const targets = perVariant ? selectVariants(p) : [null]
  if (perVariant && has("all")) die("advance takes one --variant at a time (the deliverable differs per variant)", 2)
  if (stage === "publish" && !approval(p, "publish")) die("publish needs its own approval first: produce approve <ID> --gate publish --version Vnnn --by <login> --destination facebook")
  if (HEAVY.has(stage) && !approval(p, "script") && !has("force")) die(`"${stage}" is expensive production: sign the script off first (produce approve <ID> --gate script --version ${p.version} --by <login>), or pass --force`)
  const file = opt("file")
  if (!file) die(`advance needs --file <deliverable> (expected ${STAGES.find((s) => s.key === stage).file})`, 2)
  const abs = resolveIn(p, file)
  if (!existsSync(abs)) die(`deliverable not found: ${abs}`)
  if (!statSync(abs).isFile()) die(`deliverable is not a file: ${abs}`)
  if (stage === "storyboard") {
    const sl = readJson(abs)
    const errs = [...validate(sl, schemaOf("shot-list")), ...shotListRules(sl)]
    if (errs.length) die(`shot list invalid:\n  ${errs.join("\n  ")}`)
  }
  if (perVariant) {
    const v = targets[0]
    if (stage === "publish" && !vdone(p, v.id, "cdn")) die(`publish: ${v.id} is not on the CDN yet (produce ship <ID> --variant ${v.id})`)
    const rec = recordVariantStage(p, v.id, stage, abs, opt("verdict"))
    save(p)
    return console.log(`${id}: ${stage} ${rec.status} [${v.id}] (${rel(p, abs)})`)
  }
  let status = "done"
  if (stage === "qa") {
    const v = opt("verdict")
    if (!["pass", "fail"].includes(v)) die("qa needs --verdict pass|fail (from the media-qa report)", 2)
    status = v === "pass" ? "passed" : "failed"
    if (status === "passed" && !done(p, "render")) die("qa cannot pass before the render stage is done")
  }
  p.stages[stage] = { status, file: rel(p, abs), at: now(), ...(stage === "render" ? { sha: sha256(abs) } : {}) }
  if (stage === "qa") p.status = status === "passed" ? "in-review" : "in-production"
  else if (p.status === "draft") p.status = "in-production"
  // a re-render or a re-QA invalidates anything downstream of it
  if (stage === "render") for (const k of ["qa"]) delete p.stages[k]
  save(p)
  console.log(`${id}: ${stage} ${status} (${rel(p, abs)})`)
}

// ---- approve ---------------------------------------------------------------------------------
function approve(id) {
  const p = load(id)
  const gate = opt("gate", "version"), version = opt("version"), by = opt("by")
  if (!["script", "version", "publish"].includes(gate)) die("--gate is script|version|publish", 2)
  if (!version || !by) die("usage: approve <ID> --version Vnnn --by <login> [--gate script|version|publish] [--variant <v>|--all] [--destination facebook] [--issue databayt/x#n]", 2)
  if (version !== p.version) die(`this project is ${p.version}; approval is for the exact version, got ${version}`)
  const rec = { gate, version, by, at: now(), ...(opt("issue") ? { issue: opt("issue") } : {}) }
  const vm = variantMode(p)
  if (gate === "version") {
    if (vm) {
      const vs = selectVariants(p)
      const notQa = vs.filter((v) => vst(p, v.id, "qa")?.status !== "passed")
      if (notQa.length) die(`refusing to approve: qa has not passed for ${notQa.map((v) => v.id).join(", ")} (produce advance <ID> qa --variant <v> --file … --verdict pass)`)
      const shas = {}
      for (const v of vs) {
        const m = vMaster(p, v.id)
        if (!existsSync(m)) die(`refusing to approve ${v.id}: master not found at ${m}`)
        shas[v.id] = sha256(m)
      }
      rec.variants = { ...(approval(p, "version")?.variants ?? {}), ...shas }
      for (const v of vs) setV(p, v.id, "approval", { status: "done", file: `approval:${version}`, at: rec.at })
      p.reviewer = by
      if (variantsOf(p).every((v) => vdone(p, v.id, "approval"))) p.status = "approved"
    } else {
      if (p.stages.qa?.status !== "passed") die("refusing to approve: the qa stage has not passed (produce advance <ID> qa --file 09-quality/qa-report.md --verdict pass)")
      const m = masterFile(p)
      if (!existsSync(m)) die(`refusing to approve: master not found at ${m}`)
      rec.masterSha = sha256(m)
      p.reviewer = by
      p.stages.approval = { status: "done", file: `approval:${version}`, at: rec.at }
      p.status = "approved"
    }
  } else if (gate === "publish") {
    if (!approval(p, "version")) die("refusing: the exact version is not approved yet")
    if (!(vm ? variantsOf(p).some((v) => vdone(p, v.id, "cdn")) : done(p, "cdn"))) die("refusing: the master is not on the CDN yet (produce ship <ID>)")
    rec.destination = opt("destination", "facebook")
    if (vm && (opt("variant") || has("all"))) rec.variant = has("all") ? "all" : opt("variant")
  }
  p.approvals.push(rec)
  save(p)
  console.log(JSON.stringify(rec, null, 2))
}

// ---- cost / issue ----------------------------------------------------------------------------
function cost(id) {
  const p = load(id)
  const item = opt("item"), usd = Number(opt("usd"))
  if (!item || !Number.isFinite(usd)) die("usage: cost <ID> --item <what> --usd <n> [--note …]", 2)
  p.cost.push({ item, usd, note: opt("note", "") })
  save(p)
  console.log(`${id}: +$${usd} ${item} (total $${p.cost.reduce((a, c) => a + c.usd, 0).toFixed(2)})`)
}

function issueBody(p) {
  const box = (s) => `- [${p.stages[s.key] ? "x" : " "}] ${s.n} ${s.key} → \`${s.file}\``
  return `Production **${p.id}** — ${p.title}

Brand ${p.brand} · category ${p.category} · subject ${p.subject} · languages ${p.langs.join(", ")} · version ${p.version}
Project folder: \`~/media/_projects/${p.id}/\` · driven by \`/produce\` (\`produce.mjs status ${p.id}\`)

## Stages
${STAGES.map(box).join("\n")}

## Human gates
- [ ] Script sign-off (light) — \`produce approve ${p.id} --gate script --version ${p.version} --by <login>\`
- [ ] Exact-version approval before any master reaches the CDN — \`--gate version\`
- [ ] Separate publish approval (destination named) — \`--gate publish --destination facebook\`

Hard rules: real product UI only for product claims; generated property scenes are illustrative; no publish without approve.

<!-- kun: repos=kun; items=skill:produce; project=${p.id} -->`
}
function issue(id) {
  const p = load(id)
  const body = issueBody(p)
  if (!has("create")) return console.log(`title: video: ${p.title} (${p.id})\nlabels: dept:video, P2\n\n${body}`)
  const repo = opt("repo", "databayt/kun")
  spawnSync("gh", ["label", "create", "dept:video", "--repo", repo, "--color", "5319E7"], { encoding: "utf8" })
  const url = gh(["issue", "create", "--repo", repo, "--title", `video: ${p.title} (${p.id})`, "--body", body, "--label", "dept:video", "--label", "P2"])
  p.issue = `${repo}#${url.split("/").pop()}`
  save(p)
  console.log(url)
}

// ---- CDN tier --------------------------------------------------------------------------------
const cdnBase = (p, kit) => `video/${kit.cdn}/${p.id}`
const stableBase = (p, kit) => `video/${kit.cdn}/${slugOf(p)}` // variant mode: stable slug, never the dated ID
const archiveBase = (p, kit) => `${stableBase(p, kit)}/_v/${p.version}`
const cdnUrl = (key, sha) => `https://${CDN_HOST}/${key}${sha ? `?v=${sha}` : ""}`
function shipPlan(p, kit) {
  const D = (f) => join(dirOf(p.id), "08-render/delivery", f)
  const base = cdnBase(p, kit)
  const plan = [{ role: "master", file: masterFile(p), key: `${base}/master.mp4`, required: true }]
  for (const [n, name] of [["fb-16x9", "fb-16x9.mp4"], ["fb-9x16", "fb-9x16.mp4"], ["fb-1x1", "fb-1x1.mp4"]]) plan.push({ role: n, file: D(name), key: `${base}/${name}` })
  for (const l of p.langs) plan.push({ role: `vtt-${l}`, file: D(`${l}.vtt`), key: `${base}/${l}.vtt`, required: true })
  plan.push({ role: "poster", file: D("poster.webp"), key: `${base}/poster.webp`, required: true })
  return plan
}
const aws = (args) => sh("aws", args)
function putObject(file, key, cacheControl) {
  const ext = file.split(".").pop().toLowerCase(), ct = CONTENT_TYPE[ext]
  const sha = sha8(file)
  let had = null
  try { had = JSON.parse(aws(["s3api", "head-object", "--bucket", CDN_BUCKET, "--key", key, "--output", "json"])).Metadata?.sha ?? "?" } catch {}
  if (had !== sha) aws(["s3", "cp", file, `s3://${CDN_BUCKET}/${key}`, "--content-type", ct, "--cache-control", cacheControl, "--metadata", `sha=${sha}`, "--only-show-errors"])
  return { sha, overwritten: had !== null && had !== sha }
}
function invalidate(paths) {
  if (!paths.length) return
  const dist = aws(["cloudfront", "list-distributions", "--query", `DistributionList.Items[?contains(Aliases.Items, '${CDN_HOST}')].Id | [0]`, "--output", "text"]).trim()
  if (!dist || dist === "None") throw new Error(`no CloudFront distribution aliased ${CDN_HOST}`)
  aws(["cloudfront", "create-invalidation", "--distribution-id", dist, "--paths", ...paths, "--output", "text", "--query", "Invalidation.Id"])
}

// The video index: product, feature/subject, version, approved, current, urls — what the docs site and the chatbot read.
function buildIndex({ approvedOnly = false } = {}) {
  const projects = existsSync(HOME)
    ? readdirSync(HOME).filter((d) => existsSync(join(HOME, d, "project.json"))).map((d) => readJson(join(HOME, d, "project.json")))
    : []
  const key = (p) => `${p.brand}/${p.category}/${p.subject}`
  const newestApproved = {}
  for (const p of projects) if (approval(p, "version") && (!newestApproved[key(p)] || p.version > newestApproved[key(p)])) newestApproved[key(p)] = p.version
  const videos = projects.map((p) => {
    const ap = approval(p, "version")
    const c = p.cdn || {}
    return {
      id: p.id, product: p.brand, category: p.category, feature: p.subject, title: p.title, version: p.version,
      langs: p.langs, approved: !!ap, approvedBy: ap?.by ?? null, approvedAt: ap?.at ?? null,
      current: !!ap && newestApproved[key(p)] === p.version,
      published: !!approval(p, "publish"),
      urls: c.urls ?? null,
    }
  }).filter((v) => !approvedOnly || v.approved).sort((a, b) => a.id.localeCompare(b.id))
  return { generated: now(), count: videos.length, videos }
}
function index() {
  const out = opt("out", join(HOME, "_index", "video-index.json"))
  mkdirSync(dirname(out), { recursive: true })
  const idx = buildIndex()
  writeJson(out, idx)
  console.log(`${out}  (${idx.count} video(s), ${idx.videos.filter((v) => v.approved).length} approved)`)
}

function ship(id) {
  const p = load(id)
  if (variantMode(p)) return shipVariants(p)
  if (opt("variant") || has("all")) die("--variant/--all need a project with markets (produce set <ID> markets …)", 2)
  const dry = has("dry-run")
  const kit = loadBrand(p.brand)
  const ap = approval(p, "version")
  if (!ap) die(`refusing to ship ${id}: ${p.version} has no exact-version approval (produce approve <ID> --version ${p.version} --by <login>). Nothing was uploaded.`)
  if (p.stages.qa?.status !== "passed") die("refusing to ship: qa has not passed")
  const m = masterFile(p)
  if (!existsSync(m)) die(`refusing to ship: master not found at ${m}`)
  if (ap.masterSha && sha256(m) !== ap.masterSha) die("refusing to ship: the master changed after it was approved — re-render, re-QA, re-approve")
  const plan = shipPlan(p, kit)
  const missing = plan.filter((x) => x.required && !existsSync(x.file))
  if (missing.length && !dry) die(`refusing to ship, missing required files:\n  ${missing.map((x) => x.file).join("\n  ")}`)
  const report = []
  const urls = { base: `https://${CDN_HOST}/${cdnBase(p, kit)}/`, vtt: {} }
  for (const x of plan) {
    if (!existsSync(x.file)) { report.push({ ...x, status: x.required ? "MISSING (would refuse)" : "absent, skipped" }); continue }
    const sha = sha8(x.file)
    const url = cdnUrl(x.key, sha)
    if (x.file.endsWith(".mp4")) {
      // videos go through publish.mjs (verify HEAD, sha skip, CloudFront invalidation, codec probing); no product manifest is written
      const ns = "video", k = x.key.slice(ns.length + 1).replace(/\.mp4$/, "")
      const r = spawnSync("node", [PUBLISH, "--ns", ns, "--key", k, "--id", p.id, ...(dry ? ["--dry-run"] : []), x.file], { encoding: "utf8" })
      if (r.status !== 0) die(`publish.mjs failed for ${x.key}: ${r.stderr.slice(-600)}`)
      report.push({ role: x.role, key: x.key, url, via: "publish.mjs", dry })
    } else {
      const put = dry ? { overwritten: false } : putObject(x.file, x.key, "public, max-age=3600, s-maxage=31536000")
      if (put.overwritten) invalidate([`/${x.key}`])
      report.push({ role: x.role, key: x.key, url, via: "wrapper", dry })
    }
    if (x.role === "master") urls.master = url
    else if (x.role === "poster") urls.poster = url
    else if (x.role.startsWith("vtt-")) urls.vtt[x.role.slice(4)] = url
    else urls[x.role] = url
  }
  const manifest = {
    id: p.id, product: p.brand, category: p.category, feature: p.subject, title: p.title, version: p.version, langs: p.langs,
    approved: { by: ap.by, at: ap.at, masterSha: ap.masterSha ?? null, issue: ap.issue ?? null },
    files: report.filter((r) => r.url).map((r) => ({ role: r.role, key: r.key, url: r.url })),
    illustrativeScenes: illustrativeScenes(p), cost: p.cost,
    generated: now(),
  }
  const mPath = join(dirOf(p.id), "10-publishing", "manifest.json")
  const idxKey = "video/index.json"
  const mKey = `${cdnBase(p, kit)}/manifest.json`
  urls.manifest = cdnUrl(mKey)
  if (!dry) {
    p.cdn = { urls, shippedAt: now(), keys: report.map((r) => r.key) }
    writeJson(mPath, manifest)
    putObject(mPath, mKey, "public, max-age=60, s-maxage=60")
    invalidate([`/${mKey}`])
    p.stages.cdn = { status: "done", file: `cdn:${cdnBase(p, kit)}`, at: now() }
    p.status = "shipped"
    save(p)
    const idxFile = join(HOME, "_index", "video-index.json")
    mkdirSync(dirname(idxFile), { recursive: true })
    writeJson(idxFile, buildIndex({ approvedOnly: true }))
    putObject(idxFile, idxKey, "public, max-age=60, s-maxage=60")
    invalidate([`/${idxKey}`])
  }
  console.log(JSON.stringify({ id, dry, approvedBy: ap.by, uploads: report, manifestKey: mKey, indexKey: idxKey, manifestPreview: manifest, indexPreview: buildIndexPreview(p, urls) }, null, 2))
}
function illustrativeScenes(p) {
  const f = join(dirOf(p.id), "04-storyboard/shot-list.json")
  return existsSync(f) ? (readJson(f).scenes ?? []).filter((s) => s.illustrative).map((s) => s.id) : []
}
function buildIndexPreview(p, urls) {
  const idx = buildIndex({ approvedOnly: true })
  return { count: idx.count, entry: idx.videos.find((v) => v.id === p.id) ? { ...idx.videos.find((v) => v.id === p.id), urls } : null }
}

// ---- variant mode: url / ship / build ----------------------------------------------------------
function variantUrls(p, kit, v) {
  const names = { mp4: "fb-9x16.mp4", poster: "poster.webp", vtt: `${v.lang}.vtt` }
  const stable = {}, archive = {}
  for (const [k, n] of Object.entries(names)) {
    stable[k] = cdnUrl(`${stableBase(p, kit)}/${v.id}/${n}`)
    archive[k] = cdnUrl(`${archiveBase(p, kit)}/${v.id}/${n}`)
  }
  return { stable, archive }
}
function urlCmd(id) {
  const p = load(id)
  const kit = loadBrand(p.brand)
  const vs = selectVariants(p, { optional: true })
  for (const v of vs) {
    const u = variantUrls(p, kit, v)
    console.log(`${v.id}${v.market ? `  (${v.market}, ${v.lang})` : ""}\n  video    ${u.stable.mp4}\n  poster   ${u.stable.poster}\n  captions ${u.stable.vtt}\n  archive  ${u.archive.mp4}   (${p.version}, immutable)`)
  }
  console.log(`manifest ${cdnUrl(`${stableBase(p, kit)}/manifest.json`)}`)
}

function shipVariants(p) {
  const dry = has("dry-run")
  const kit = loadBrand(p.brand)
  const vs = selectVariants(p)
  const ap = approval(p, "version")
  if (!ap) die(`refusing to ship ${p.id}: ${p.version} has no exact-version approval (produce approve <ID> --version ${p.version} --by <login> --variant <v>|--all). Nothing was uploaded.`)
  const slugV = slugOf(p)
  // the slug belongs to one film: another brand+slug owner with a different category/subject blocks this ship
  for (const d of existsSync(HOME) ? readdirSync(HOME) : []) {
    if (d === p.id || !existsSync(join(HOME, d, "project.json"))) continue
    const o = readJson(join(HOME, d, "project.json"))
    if (o.brand === p.brand && slugOf(o) === slugV && (o.category !== p.category || o.subject !== p.subject) && (o.markets?.length || o.cdn?.slug === slugV))
      die(`refusing to ship: slug "${slugV}" on ${p.brand} is owned by ${o.id} (${o.category}/${o.subject}) — pick another with \`set ${p.id} slug <slug>\``)
  }
  const jobs = []
  for (const v of vs) {
    if (!ap.variants?.[v.id]) die(`refusing to ship ${v.id}: it is not in the version approval (produce approve <ID> --version ${p.version} --by <login> --variant ${v.id}). Nothing was uploaded.`)
    if (vst(p, v.id, "qa")?.status !== "passed") die(`refusing to ship ${v.id}: qa has not passed`)
    const f = vFiles(p, v)
    if (!existsSync(f.mp4)) die(`refusing to ship ${v.id}: master not found at ${f.mp4}`)
    if (sha256(f.mp4) !== ap.variants[v.id]) die(`refusing to ship ${v.id}: the master changed after it was approved — re-render, re-QA, re-approve`)
    const missing = [f.vtt, f.poster].filter((x) => !existsSync(x))
    if (missing.length && !dry) die(`refusing to ship ${v.id}, missing required files:\n  ${missing.join("\n  ")}`)
    jobs.push({ v, files: [["fb-9x16.mp4", f.mp4], ["poster.webp", f.poster], [`${v.lang}.vtt`, f.vtt]] })
  }
  // archive keys first (immutable), then the stable keys, then the merged manifest
  const plan = []
  for (const tier of ["archive", "stable"])
    for (const { v, files } of jobs)
      for (const [name, file] of files)
        plan.push({ tier, variant: v.id, file, key: `${tier === "archive" ? archiveBase(p, kit) : stableBase(p, kit)}/${v.id}/${name}`, present: existsSync(file) })
  const mKey = `${stableBase(p, kit)}/manifest.json`
  if (dry) {
    console.log(JSON.stringify({ id: p.id, dry: true, slug: slugV, version: p.version, approvedBy: ap.by, keys: [...plan.map((x) => ({ tier: x.tier, key: x.key, url: cdnUrl(x.key), source: x.file, present: x.present })), { tier: "manifest", key: mKey, url: cdnUrl(mKey) }] }, null, 2))
    return
  }
  const IMMUTABLE = "public, max-age=31536000, immutable", STABLE = "public, max-age=3600, s-maxage=31536000"
  for (const x of plan) {
    if (x.file.endsWith(".mp4")) {
      // publish.mjs key mode: HEAD-verified, sha-skipping, overwrite + CloudFront invalidation, codec probing
      const k = x.key.slice("video/".length).replace(/\.mp4$/, "")
      const r = spawnSync("node", [PUBLISH, "--ns", "video", "--key", k, "--id", `${p.id}/${x.variant}`, x.file], { encoding: "utf8" })
      if (r.status !== 0) die(`publish.mjs failed for ${x.key}: ${r.stderr.slice(-600)}`)
    } else {
      const put = putObject(x.file, x.key, x.tier === "archive" ? IMMUTABLE : STABLE)
      if (put.overwritten) invalidate([`/${x.key}`])
    }
  }
  p.cdn = { ...p.cdn, slug: slugV, variants: p.cdn?.variants ?? {} }
  for (const { v } of jobs) {
    const u = variantUrls(p, kit, v)
    p.cdn.variants[v.id] = { variant: v.id, market: v.market, lang: v.lang, version: p.version, sha: ap.variants[v.id], approvedAt: ap.at, urls: { ...u.stable, archive: u.archive.mp4 } }
    setV(p, v.id, "cdn", { status: "done", file: `cdn:${stableBase(p, kit)}/${v.id}`, at: now() })
  }
  const manifest = { slug: slugV, brand: p.brand, project: p.id, title: p.title, generated: now(), variants: Object.values(p.cdn.variants), illustrativeScenes: illustrativeScenes(p) }
  const mPath = join(dirOf(p.id), "10-publishing", "manifest.json")
  writeJson(mPath, manifest)
  putObject(mPath, mKey, "public, max-age=60, s-maxage=60")
  invalidate([`/${mKey}`])
  p.cdn.urls = { manifest: cdnUrl(mKey) }
  p.cdn.shippedAt = now()
  p.cdn.keys = plan.map((x) => x.key)
  p.stages.cdn = { status: "done", file: `cdn:${stableBase(p, kit)}`, at: now() }
  if (variantsOf(p).every((v) => vdone(p, v.id, "cdn"))) p.status = "shipped"
  save(p)
  const idxFile = join(HOME, "_index", "video-index.json")
  mkdirSync(dirname(idxFile), { recursive: true })
  writeJson(idxFile, buildIndex({ approvedOnly: true }))
  putObject(idxFile, "video/index.json", "public, max-age=60, s-maxage=60")
  invalidate(["/video/index.json"])
  console.log(JSON.stringify({ id: p.id, dry: false, shipped: jobs.map((j) => j.v.id), manifest: cdnUrl(mKey), keys: plan.map((x) => x.key) }, null, 2))
}

// build: per variant, piece.mjs writes the resolved script + the FilmCraft piece; assemble.mjs renders it.
function build(id) {
  const p = load(id)
  if (!variantMode(p)) die(`build needs markets: produce set ${id} markets sa,ae,eg,sd`)
  const vs = selectVariants(p)
  const dry = has("dry-run")
  const PIECE = join(HERE, "piece.mjs")
  const ASSEMBLE = join(HERE, "..", "..", "edit", "scripts", "fc", "assemble.mjs")
  const MEDIA = join(HERE, "..", "..", "edit", "scripts", "media.sh")
  if (!existsSync(PIECE)) die(`piece.mjs not found at ${PIECE} — it writes 03-script/variants/<v>.json and 06-production/editing/<v>.video.json; build cannot run without it`)
  const M = loadMarkets(), dir = dirOf(p.id)
  const results = []
  for (const v of vs) {
    const r = spawnSync("node", [PIECE, dir, v.id, ...(dry ? ["--dry-run"] : [])], { encoding: "utf8", maxBuffer: 1 << 26 })
    if (r.status !== 0) die(`piece.mjs failed for ${v.id}:\n${(r.stderr || r.stdout).slice(-800)}`)
    let out
    try { out = JSON.parse(r.stdout) } catch { die(`piece.mjs printed no JSON for ${v.id}:\n${r.stdout.slice(-400)}`) }
    const scriptF = resolveIn(p, out.script), pieceF = resolveIn(p, out.piece)
    const h = createHash("sha256")
    for (const f of [scriptF, pieceF]) h.update(existsSync(f) ? readFileSync(f) : r.stdout)
    h.update(JSON.stringify(M[v.market] ?? null))
    const hash = h.digest("hex").slice(0, 16)
    const prev = vst(p, v.id, "render")
    if (prev?.inputsHash === hash && existsSync(vMaster(p, v.id))) {
      results.push({ variant: v.id, status: "unchanged (inputs hash matches the last render) — skipped" })
      continue
    }
    if (dry) {
      results.push({ variant: v.id, status: "dry-run", script: rel(p, scriptF), piece: rel(p, pieceF), inputsHash: hash, wouldRun: `node assemble.mjs ${rel(p, pieceF)} --aspect 9:16 --deliver` })
      continue
    }
    if (!approval(p, "script") && !has("force")) die(`"build" renders heavy stages: sign the script off first (produce approve ${id} --gate script --version ${p.version} --by <login>), or pass --force`)
    const a = spawnSync("node", [ASSEMBLE, pieceF, "--aspect", "9:16", "--deliver"], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "inherit"] })
    if (a.status !== 0) die(`assemble.mjs failed for ${v.id} (exit ${a.status})`)
    let rep
    try { rep = JSON.parse(a.stdout) } catch { die(`assemble.mjs printed no JSON report for ${v.id}`) }
    const d = (rep.delivered ?? []).find((x) => x.aspect === "9:16")
    if (!d?.file || !existsSync(d.file)) die(`assemble.mjs delivered no 9:16 file for ${v.id}`)
    const outDir = join(dir, "08-render", v.id)
    mkdirSync(outDir, { recursive: true })
    const master = join(outDir, "fb-9x16.mp4")
    writeFileSync(master, readFileSync(d.file))
    const poster = spawnSync("bash", [MEDIA, "poster", master, join(outDir, "poster.webp")], { encoding: "utf8" })
    if (poster.status !== 0) console.error(`produce: poster failed for ${v.id}: ${poster.stderr.slice(-200)}`)
    const spec = readJson(pieceF)
    if (spec.captions) {
      const srt = resolve(dirname(pieceF), spec.captions)
      if (existsSync(srt)) spawnSync("node", [join(HERE, "..", "..", "edit", "scripts", "media", "vtt.mjs"), srt, join(outDir, `${v.lang}.vtt`)], { encoding: "utf8" })
    }
    const voice = spec.voice ? resolve(dirname(pieceF), spec.voice) : join(dir, "07-audio", "voiceover", `${v.id}.wav`)
    if (existsSync(voice)) recordVariantStage(p, v.id, "audio", voice)
    else console.error(`produce: no voice file found for ${v.id}; audio stage not recorded`)
    recordVariantStage(p, v.id, "edit", pieceF)
    const rr = recordVariantStage(p, v.id, "render", master)
    rr.inputsHash = hash
    setV(p, v.id, "render", rr)
    save(p)
    results.push({ variant: v.id, status: "rendered", master: rel(p, master), sha: rr.sha, inputsHash: hash })
  }
  console.log(JSON.stringify({ id, dry, results }, null, 2))
}

// ---- validate (any project.json or shot-list.json) --------------------------------------------
function validateFile(f) {
  if (!f || !existsSync(f)) die("usage: validate <project.json|shot-list.json>", 2)
  const j = readJson(f)
  const isShot = Array.isArray(j.scenes)
  const errs = [...validate(j, schemaOf(isShot ? "shot-list" : "project")), ...(isShot ? shotListRules(j) : [])]
  console.log(errs.length ? errs.join("\n") : `ok (${isShot ? "shot-list" : "project"})`)
  process.exit(errs.length ? 1 : 0)
}

// ---- dispatch --------------------------------------------------------------------------------
const [cmd, ...rest] = pos()
const run = {
  init,
  status: () => status(rest[0]),
  set: () => setField(rest[0], rest[1], rest[2]),
  advance: () => advance(rest[0], rest[1]),
  approve: () => approve(rest[0]),
  cost: () => cost(rest[0]),
  issue: () => issue(rest[0]),
  ship: () => ship(rest[0]),
  url: () => urlCmd(rest[0]),
  build: () => build(rest[0]),
  index,
  validate: () => validateFile(rest[0]),
}[cmd]
if (!run) die("usage: produce <init|set|status|advance|approve|cost|issue|url|build|ship|index|validate> …  (see the header of this file)", 2)
run()
