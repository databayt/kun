#!/usr/bin/env node
// produce — the video factory's project ledger. It creates a production project, records each of the
// 14 stages, holds the human gates, and ships an approved master to the CDN video tier. It does not
// make video: every stage's work is done by the existing skill named in SKILL.md.
//
//   produce init --brand hogwarts|mkan|databayt --category <intro|promo|explainer|tutorial|…> --subject <slug> [--lang ar,en] [--title "…"]
//        [--identity <brand-kit key, default = the brand>] [--audience "…"] [--objective "…"]
//   produce set <ID> identity <brand-kit key>      (change which brand-kit face appears on film)
//   produce status <ID>
//   produce advance <ID> <stage> --file <deliverable> [--verdict pass|fail]
//   produce approve <ID> --version Vnnn --by <login> [--gate script|version|publish] [--destination facebook] [--issue databayt/x#n]
//   produce cost <ID> --item <what> --usd <n> [--note "…"]
//   produce issue <ID> [--repo databayt/kun] [--create]
//   produce ship <ID> [--dry-run]
//   produce index [--out <file>]
//   produce validate <project.json|shot-list.json>
//
// Projects live in ~/media/_projects/<ID>/ (outside every repo; override with PRODUCE_HOME).
// CDN keys: video/<brand>/<ID>/{master.mp4,fb-16x9.mp4,fb-9x16.mp4,fb-1x1.mp4,<lang>.vtt,poster.webp,manifest.json}
// and video/index.json. The existing <ns>/<lang>/<flow>/video.mp4 keys are untouched (publish.mjs modes unchanged).
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
const VALUE_FLAGS = new Set(["brand", "category", "subject", "lang", "title", "version", "by", "gate", "destination", "issue", "file", "verdict", "item", "usd", "note", "repo", "out", "identity", "audience", "objective"])
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
const gh = (args) => {
  const r = spawnSync("gh", args, { encoding: "utf8" })
  if (r.status !== 0) die(`gh ${args.slice(0, 3).join(" ")} failed: ${r.stderr}`)
  return r.stdout.trim()
}

// ---- init ------------------------------------------------------------------------------------
function init() {
  const b = opt("brand"), category = opt("category"), subject = opt("subject")
  if (!BRANDS[b] || !category || !subject) die("usage: init --brand hogwarts|mkan|databayt --category <cat> --subject <slug> [--lang ar,en] [--title …]", 2)
  const langs = (opt("lang", "ar,en")).split(",").map((s) => s.trim()).filter(Boolean)
  const identity = opt("identity") ? checkIdentity(opt("identity")) : b
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
    stages: {}, assets: [], cost: [], approvals: [], cdn: {},
  }
  writeFileSync(join(dir, "01-brief/request.json"), JSON.stringify({ id, brand: b, identity, category, subject, langs, audience: opt("audience", "TODO"), objective: opt("objective", "TODO"), references: [], requestedAt: now() }, null, 2) + "\n")
  writeJson(join(dir, "04-storyboard/shot-list.json"), { id, scenes: [] })
  writeFileSync(join(dir, "10-publishing/metadata.json"), JSON.stringify({ id, brand: b, cdn: kit.cdn, destination: "facebook", caption: "TODO", hashtags: [] }, null, 2) + "\n")
  p.stages.request = { status: "done", file: "01-brief/request.json", at: now() }
  p.status = "in-production"
  save(p)
  console.log(JSON.stringify({ id, dir, brand: b, identity, cdn: kit.cdn, version: v, langs, next: "research (02-research/product-research.md) — then `produce issue " + id + " --create`" }, null, 2))
}

// ---- status ----------------------------------------------------------------------------------
function status(id) {
  const p = load(id)
  console.log(`${p.id}  [${p.status}]  ${p.title}\n  brand ${p.brand}  identity ${p.identity ?? p.brand}  version ${p.version}  langs ${p.langs.join(",")}  owner ${p.owner}  issue ${p.issue ?? "—"}`)
  let next = null
  for (const s of STAGES) {
    const st = p.stages[s.key]
    const mark = st ? (st.status === "failed" ? "x" : "v") : " "
    if (!st && !next) next = s
    console.log(`  [${mark}] ${s.n} ${s.key.padEnd(10)} ${st ? `${st.status}  ${st.file ?? ""}  ${st.at}` : `todo  → ${s.file}`}`)
  }
  const g = (gate) => approval(p, gate)
  console.log(`  gates: script ${g("script") ? `signed by ${g("script").by}` : "NOT signed"} · version ${p.version} ${g("version") ? `approved by ${g("version").by}` : "NOT approved"} · publish ${g("publish") ? `approved by ${g("publish").by} (${g("publish").destination})` : "NOT approved"}`)
  console.log(`  cost: $${p.cost.reduce((a, c) => a + c.usd, 0).toFixed(2)} over ${p.cost.length} item(s)`)
  console.log(next ? `  next: ${next.n} ${next.key}` : "  next: done")
}

// ---- set (identity only) -----------------------------------------------------------------------
function setField(id, field, value) {
  if (field !== "identity" || !value) die("usage: set <ID> identity <brand-kit key>", 2)
  const p = load(id)
  p.identity = checkIdentity(value)
  save(p)
  const rf = join(dirOf(id), "01-brief/request.json")
  if (existsSync(rf)) writeJson(rf, { ...readJson(rf), identity: p.identity })
  console.log(`${id}: identity ${p.identity}`)
}

// ---- advance ---------------------------------------------------------------------------------
function advance(id, stage) {
  const p = load(id)
  if (!STAGE_KEYS.includes(stage)) die(`unknown stage "${stage}" — one of ${STAGE_KEYS.join(" ")}`, 2)
  if (["approval", "cdn"].includes(stage)) die(`stage "${stage}" is set by \`${stage === "approval" ? "approve" : "ship"}\`, never by hand`)
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
  if (!version || !by) die("usage: approve <ID> --version Vnnn --by <login> [--gate script|version|publish] [--destination facebook] [--issue databayt/x#n]", 2)
  if (version !== p.version) die(`this project is ${p.version}; approval is for the exact version, got ${version}`)
  const rec = { gate, version, by, at: now(), ...(opt("issue") ? { issue: opt("issue") } : {}) }
  if (gate === "version") {
    if (p.stages.qa?.status !== "passed") die("refusing to approve: the qa stage has not passed (produce advance <ID> qa --file 09-quality/qa-report.md --verdict pass)")
    const m = masterFile(p)
    if (!existsSync(m)) die(`refusing to approve: master not found at ${m}`)
    rec.masterSha = sha256(m)
    p.reviewer = by
    p.stages.approval = { status: "done", file: `approval:${version}`, at: rec.at }
    p.status = "approved"
  } else if (gate === "publish") {
    if (!approval(p, "version")) die("refusing: the exact version is not approved yet")
    if (!done(p, "cdn")) die("refusing: the master is not on the CDN yet (produce ship <ID>)")
    rec.destination = opt("destination", "facebook")
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
  index,
  validate: () => validateFile(rest[0]),
}[cmd]
if (!run) die("usage: produce <init|set|status|advance|approve|cost|issue|ship|index|validate> …  (see the header of this file)", 2)
run()
