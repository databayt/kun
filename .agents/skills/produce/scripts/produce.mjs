#!/usr/bin/env node
// produce — the video factory's project ledger. It creates a production project, records each of the
// 14 stages, holds the human gates, and ships an approved master to the CDN video tier. It does not
// make video: every stage's work is done by the existing skill named in SKILL.md.
//
//   produce init --brand hogwarts|mkan|databayt --category <film type: introduction|feature|tutorial|…> [--subject <slug, default = the type's default>] [--lang ar,en] [--title "…"]
//        (the category is normalised through types.json aliases and must be a type the brand has; id = <brand>-<type>-<subject>-v<NNN>)
//   produce types [--brand b] [--json]             the brand's film types, subject hints, defaults and the URL pattern
//        [--identity <brand-kit key, default = the brand>] [--audience "…"] [--objective "…"]
//        [--markets sa,ae,eg,sd] [--slug <stable CDN slug, default = <type>/<subject>>]
//   produce set <ID> identity <brand-kit key>      (change which brand-kit face appears on film)
//   produce set <ID> slug <slug>  |  set <ID> markets sa,ae,eg,sd   (markets: content/media/markets.json)
//   produce status <ID>                            shared stages, then a variant x per-variant-stage grid + predicted URLs
//   produce advance <ID> <stage> --file <deliverable> [--verdict pass|fail] [--variant <v>]   (--variant for audio edit render qa publish)
//   produce approve <ID> --version Vnnn --by <login> [--gate script|version|publish] [--variant <v>|--all] [--destination facebook] [--issue databayt/x#n]
//   produce cost <ID> --item <what> --usd <n> [--note "…"]
//   produce issue <ID> [--repo databayt/kun] [--create] [--sync]   the FILM issue (tracker); no flag = print the draft
//   produce order <ID> <formula-id> --to <login> [--set k=v]… [--after ref,ref] [--create]   a WORK ORDER issue for one person
//   produce submit <issue-ref> <file>… [--summary "…"] [--next "…"] [--stage s] [--create]   upload deliverables + receipt comment
//   (set PRODUCE_STUB_DIR=<dir> to stub gh, the CDN uploader and station in tests: calls are logged to <dir>/gh.log + upload.log)
//   produce lock <ID> --all [--plan <file>] [--set k=v]… | lock <ID> <stage> [--set k=v]… [--spec <file>]   [--by <login>] [--no-sync] [--json]
//        write 00-plan/<NN>-<stage>.spec.{json,md}, record project.json locks, recompile 00-plan/plan.{json,md}; heavy stages need a lock
//   produce unlock <ID> <stage>  |  produce plan <ID> [--json]   drop one lock (spec files stay) / recompile the plan
//   produce mirror <ID> [--stage <s>] [--create]   upload stage folders to work/<ID>/ref/<path> (draft without --create; never 08-render, fonts, >50 MB)
//   produce url <ID> --path <relative path>        the CDN URL of any film file (work/<ID>/ref/<path>)
//   produce url <ID> [--variant <v>]               predicted stable + archive CDN URLs, before anything renders
//   produce build <ID> --variant <v>|--all [--dry-run] [--force]   piece.mjs -> assemble.mjs per variant (skips unchanged inputs)
//   produce ship <ID> [--variant <v>|--all] [--dry-run]
//   produce index [--out <file>]
//   produce validate <project.json|shot-list.json>
//   produce init … --from-reference <video>        also copy the video to 02-research/reference/, transcribe it (mlx_whisper), cut a contact sheet, seed 03-script/script.md
//   produce from-reference <ID> <video>            the same seeding on an existing project (no init)
//        --voiceover [--variant <v>|--all]          also extract the video's audio as 48 kHz mono wav to 07-audio/voiceover/<variant>.wav and
//                                                   record it in project.json `voice` as the voice source (a single-variant project needs no --variant)
//   produce status <ID> --json                     shared stages, variant grid, gates, next, predicted URLs, and the shot-list / asset-manifest paths
//   produce list [--json] [--repo <line>]          every project, newest first, with its next stage
//   produce readiness [--fix] [--json]             tool/runtime/disk/power/MCP/key check; exit 0 when every critical row passes
//
// Projects live in ~/media/_projects/<ID>/ (outside every repo; override with PRODUCE_HOME).
// A project with markets has variants <market>-<lang> (sa-ar, eg-en). Stages request..visual are shared; audio edit
// render qa approval cdn publish are per variant (project.json variantStages[<variant>][<stage>]).
// CDN keys, variant mode (stable slug, not the dated ID):
//   (slug = <type>/<subject>)
//   <cdn>/video/<slug>/<variant>/{fb-9x16.mp4,poster.webp,<lang>.vtt}   stable, overwritten on re-approval + invalidated
//   <cdn>/video/<slug>/manifest.json                                     every shipped variant
//   <cdn>/video/<slug>/_v/<Vnnn>/<variant>/…                             immutable archive per version
// Legacy keys (projects without markets): <brand>/video/<ID>/{master.mp4,fb-16x9.mp4,…,manifest.json}, plus video/index.json.
// The existing <ns>/<lang>/<flow>/video.mp4 keys are untouched (publish.mjs modes unchanged).
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { createRequire } from "node:module"
import { basename, dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { CDN_BUCKET, CDN_HOST, CONTENT_TYPE, KUN_DIR, brand as loadBrand, sh, sha8 } from "../../edit/scripts/media/rt.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SCHEMA = join(HERE, "..", "schema")
const PUBLISH = join(HERE, "..", "..", "edit", "scripts", "media", "publish.mjs")
const HOME = process.env.PRODUCE_HOME || join(homedir(), "media", "_projects")

// Production lines, by their full names — never an abbreviation (Abdout 2026-11-21).
const BRANDS = new Set(["hogwarts", "mkan", "databayt"])

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
  "00-plan", "01-brief", "02-research", "03-script", "04-storyboard",
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
const optAll = (name) => argv.flatMap((a, i) => (a === `--${name}` && i + 1 < argv.length ? [argv[i + 1]] : []))
const VALUE_FLAGS = new Set(["markets", "slug", "variant", "brand", "category", "subject", "lang", "title", "version", "by", "gate", "destination", "issue", "file", "verdict", "item", "usd", "note", "repo", "out", "identity", "audience", "objective", "from-reference", "to", "set", "after", "summary", "next", "stage", "items", "plan", "spec", "path"])
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
const sha256Full = (f) => createHash("sha256").update(readFileSync(f)).digest("hex")
// who is acting: --by, else KUN_LOGIN, else the git user, else $USER
const actor = () => opt("by") || process.env.KUN_LOGIN || spawnSync("git", ["config", "user.name"], { encoding: "utf8" }).stdout.trim() || process.env.USER || "unknown"

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
// a slug is `<type>/<subject>`: one or two lowercase segments, joined by a single slash
const checkSlug = (s) => (/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)?$/.test(s) ? s : die(`slug "${s}" must be lowercase a-z, 0-9 and hyphens, with at most one "/" (<type>/<subject>)`, 2))
const slugOf = (p) => p.slug ?? p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") // films made before types.json carry no slash
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
// ---- gh + CDN, with a test stub ----------------------------------------------------------------
// PRODUCE_STUB_DIR=<dir> (tests only): `gh` is never run and nothing is uploaded; every call is appended as a JSON
// line to <dir>/gh.log or <dir>/upload.log. `issue create` answers https://github.com/<repo>/issues/<100+n>;
// `issue view` answers <dir>/issue-view.json when present; station `fill` answers <dir>/station.json when present.
const STUB = process.env.PRODUCE_STUB_DIR || ""
const logStub = (name, o) => { mkdirSync(STUB, { recursive: true }); writeFileSync(join(STUB, name), JSON.stringify(o) + "\n", { flag: "a" }) }
const stubLines = (name) => (existsSync(join(STUB, name)) ? readFileSync(join(STUB, name), "utf8").split("\n").filter(Boolean) : [])
// -> {ok, out, err}; never exits. A machine with no gh gets a clear message, not a stack.
function ghRun(args) {
  if (STUB) {
    logStub("gh.log", args)
    if (args[0] === "issue" && args[1] === "create") return { ok: true, out: `https://github.com/${args[args.indexOf("--repo") + 1]}/issues/${99 + stubLines("gh.log").filter((l) => /"issue","create"/.test(l)).length}`, err: "" }
    if (args[0] === "issue" && args[1] === "view") return { ok: true, out: existsSync(join(STUB, `issue-view-${args[2]}.json`)) ? readFileSync(join(STUB, `issue-view-${args[2]}.json`), "utf8") : existsSync(join(STUB, "issue-view.json")) ? readFileSync(join(STUB, "issue-view.json"), "utf8") : '{"body":"","state":"OPEN","labels":[],"title":""}', err: "" }
    return { ok: true, out: "", err: "" }
  }
  const r = spawnSync("gh", args, { encoding: "utf8" })
  if (r.error?.code === "ENOENT") return { ok: false, out: "", err: "the GitHub CLI (gh) is not installed or not on PATH — install it (brew install gh) and run `gh auth login`" }
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() }
}
const gh = (args) => {
  const r = ghRun(args)
  if (!r.ok) die(`gh ${args.slice(0, 3).join(" ")} failed: ${r.err}`)
  return r.out
}
// a GitHub failure on a side effect warns and returns null (advance/approve must still succeed)
const ghSoft = (args) => {
  const r = ghRun(args)
  if (!r.ok) { console.error(`produce: warning — gh ${args.slice(0, 3).join(" ")} failed: ${r.err}`); return null }
  return r.out
}
const LABEL_COLORS = { "dept:video": "5319E7", P2: "fbca04", film: "0e8a16", "status:review": "0e8a16" }
const ensureLabels = (repo, names, soft = false) => {
  for (const n of names) ghRun(["label", "create", n, "--repo", repo, "--color", LABEL_COLORS[n] ?? (n.startsWith("for:") ? "5319e7" : "ededed")]) // exists already = fine
}
const parseRef = (r) => {
  const m = /^(?:https:\/\/github\.com\/)?([\w.-]+\/[\w.-]+)(?:#|\/issues\/)(\d+)$/.exec(String(r ?? "").trim())
  return m ? { repo: m[1], n: Number(m[2]), ref: `${m[1]}#${m[2]}` } : null
}
const contentTypeOf = (f) => CONTENT_TYPE[f.split(".").pop().toLowerCase()] ?? "application/octet-stream"
// upload one local file to a CDN key (only reachable from --create paths); returns the public URL
function uploadToCdn(file, key) {
  if (STUB) { logStub("upload.log", { file, key }); return cdnUrl(key) }
  aws(["s3", "cp", file, `s3://${CDN_BUCKET}/${key}`, "--content-type", contentTypeOf(file), "--cache-control", "public, max-age=3600", "--only-show-errors"])
  return cdnUrl(key)
}

// ---- init ------------------------------------------------------------------------------------
function init() {
  const b = opt("brand"), rawCategory = opt("category")
  if (!BRANDS.has(b) || !rawCategory) die("usage: init --brand hogwarts|mkan|databayt --category <cat> --subject <slug> [--lang ar,en] [--title …] [--markets sa,ae,eg,sd] [--slug <slug>]  (category is a film type: produce types)", 2)
  const types = typesDoc()
  const category = types ? (types.aliases?.[rawCategory.toLowerCase()] ?? rawCategory.toLowerCase()) : rawCategory
  if (types) {
    const mine = types.brands?.[b] ?? []
    if (!types.types?.[category] || !mine.includes(category)) die(`${b} has no film type "${rawCategory}". Its types: ${mine.join(", ")} (produce types --brand ${b})`, 2)
  }
  const subject = opt("subject") ?? types?.types?.[category]?.subject?.default
  if (!subject) die("init needs --subject <slug>", 2)
  const langs = (opt("lang", "ar,en")).split(",").map((s) => s.trim()).filter(Boolean)
  const identity = opt("identity") ? checkIdentity(opt("identity")) : b
  const markets = opt("markets") ? parseMarkets(opt("markets")) : null
  const pslug = checkSlug(opt("slug") ?? `${slug(category).toLowerCase()}/${slug(subject).toLowerCase()}`)
  const variants = deriveVariants(markets, langs)
  const kit = loadBrand(b) // throws on a draft / unknown brand: renderers never guess
  // ID = full names, lowercase, no date: hogwarts-intro-owners-v001
  const base = `${b}-${slug(category)}-${slug(subject)}`.toLowerCase()
  mkdirSync(HOME, { recursive: true })
  // next free Vnnn for this brand+category+subject, across dates
  const used = readdirSync(HOME).filter((d) => d.toLowerCase().startsWith(base + "-")).map((d) => Number(/-v(\d{3})$/i.exec(d)?.[1] || 0))
  const v = `V${String(Math.max(0, ...used) + 1).padStart(3, "0")}`
  const id = `${base}-${v.toLowerCase()}`
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
  const ref = opt("from-reference")
  if (ref) fromReferenceSeed(id, ref, true)
  console.log(JSON.stringify({ id, dir, brand: b, identity, cdn: kit.cdn, version: v, langs, slug: pslug, markets, variants: variants.map((x) => x.id), next: "research (02-research/product-research.md) — then `produce issue " + id + " --create`" }, null, 2))
}

// who did what, when: work orders, stage records that carry `by`, and approvals
function contributors(p) {
  const rows = []
  for (const o of p.orders ?? []) rows.push({ who: o.to, what: `work order ${o.label ?? o.formula} (${o.issue})`, at: o.createdAt })
  for (const [k, st] of Object.entries(p.stages ?? {})) if (st?.by) rows.push({ who: st.by, what: `stage ${k} ${st.status}`, at: st.at })
  for (const [v, ss] of Object.entries(p.variantStages ?? {})) for (const [k, st] of Object.entries(ss)) if (st?.by) rows.push({ who: st.by, what: `stage ${k} ${st.status} [${v}]`, at: st.at })
  for (const a of p.approvals ?? []) rows.push({ who: a.by, what: `approved ${a.gate} ${a.version}`, at: a.at })
  return rows.sort((a, b) => String(a.at).localeCompare(String(b.at)))
}

// `status --json`: everything the Kun app's production strip draws, in one read. Additive: the first keys
// (id … contributors) are the original shape; `stage_list`, `variants`, `next`, `urls`, `paths`, `files` and
// `voice` are for the strip.
function statusJson(p) {
  const vm = variantMode(p)
  const dir = dirOf(p.id)
  const defs = stageDefs()
  const cellOf = (v, k) => (vm ? (vst(p, v, k)?.status ?? "todo") : (p.stages[k]?.status ?? "todo"))
  const stageList = STAGES.map((s) => {
    const per = PER_VARIANT.includes(s.key)
    const st = p.stages[s.key]
    let status = st?.status ?? "todo"
    if (vm && per) {
      const cells = variantsOf(p).map((v) => cellOf(v.id, s.key))
      status = cells.every((c) => ["done", "passed"].includes(c)) ? "done" : cells.some((c) => c !== "todo") ? "partial" : "todo"
    }
    const d = defs.find((x) => x.key === s.key)
    const sp = d && existsSync(specPath(p.id, d)) ? specPath(p.id, d) : null
    return { key: s.key, n: s.n, file: s.file, per_variant: per, status, done: stageDone(p, s), at: vm && per ? null : st?.at ?? null,
      dir: d?.dir ?? null, spec: sp, spec_url: sp ? refUrl(p.id, `00-plan/${specName(d)}.json`) : null, file_url: d?.file && !String(d.file).startsWith("08-render/") ? refUrl(p.id, d.file) : null, locked: !!p.locks?.[s.key] }
  })
  const shared = STAGES.filter((s) => !(vm && PER_VARIANT.includes(s.key)))
  const nextShared = shared.find((s) => !p.stages[s.key])
  const next = nextShared ? nextShared.key : vm ? (variantsOf(p).some((v) => !vst(p, v.id, "render")) ? "build" : "done") : "done"
  const variants = variantsOf(p).map((v) => ({ id: v.id, market: v.market ?? null, lang: v.lang, stages: Object.fromEntries(PER_VARIANT.map((k) => [k, cellOf(v.id, k)])) }))
  const paths = { dir, project: join(dir, "project.json"), request: join(dir, "01-brief/request.json"), script: join(dir, "03-script/script.md"), shot_list: join(dir, "04-storyboard/shot-list.json"), asset_manifest: join(dir, "05-assets/asset-manifest.json"), voiceover_dir: join(dir, "07-audio/voiceover") }
  const files = Object.fromEntries(["script", "shot_list", "asset_manifest"].map((k) => [k, existsSync(paths[k])]))
  return {
    id: p.id, title: p.title, status: p.status, version: p.version, issue: p.issue ?? null, orders: p.orders ?? [],
    stages: Object.fromEntries(STAGES.map((s) => [s.key, stageDone(p, s)])),
    gates: Object.fromEntries(GATE_NAMES.map((g) => [g, gateRec(p, g) ? { by: gateRec(p, g).by, at: gateRec(p, g).at } : null])),
    contributors: contributors(p),
    brand: p.brand, identity: p.identity ?? p.brand, category: p.category, subject: p.subject, langs: p.langs, markets: p.markets ?? [], focus: p.focus ?? [],
    stage_list: stageList, variants, next, urls: filmUrls(p), paths, files, voice: p.voice ?? {},
    locks: p.locks ?? {}, plan: existsSync(planInfo(p).json) ? planInfo(p) : null,
  }
}

// ---- status ----------------------------------------------------------------------------------
function status(id) {
  const p = load(id)
  const vm = variantMode(p)
  if (has("json")) return console.log(JSON.stringify(statusJson(p), null, 2))
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
  console.log(`  gates: look ${g("look") ? `approved by ${g("look").by}` : "NOT signed"} · script ${g("script") ? `signed by ${g("script").by}` : "NOT signed"} · version ${p.version} ${g("version") ? `approved by ${g("version").by}${g("version").variants ? ` (${Object.keys(g("version").variants).join(",")})` : ""}` : "NOT approved"} · publish ${g("publish") ? `approved by ${g("publish").by} (${g("publish").destination})` : "NOT approved"}`)
  const orders = p.orders ?? []
  if (orders.length) console.log(`  work orders: ${orders.map((o) => `${o.issue.split("#").pop()} ${o.label ?? o.formula} → ${o.to}`).join(" · ")}`)
  const who = contributors(p)
  if (who.length) { console.log("  contributors:"); for (const c of who) console.log(`    ${c.who.padEnd(12)} ${c.what}  ${c.at}`) }
  console.log(`  cost: $${p.cost.reduce((a, c) => a + c.usd, 0).toFixed(2)} over ${p.cost.length} item(s)`)
  console.log(next ? `  next: ${next.n} ${next.key}` : "  next: done")
}

// ---- set (identity | slug | markets) ----------------------------------------------------------
function setField(id, field, value) {
  if (!["identity", "slug", "markets", "focus", "doc"].includes(field) || !value) die("usage: set <ID> identity <brand-kit key> | slug <slug> | markets sa,ae,eg,sd | focus sd-ar,eg-ar | doc <plan|script|storyboard|look> <url>", 2)
  const p = load(id)
  // focus: the versions to build first; doc: a shared review doc (Claude Docs) for a stage
  if (field === "focus") {
    const ids = new Set(variantsOf(p).map((v) => v.id))
    const f = value.split(",").map((x) => x.trim()).filter(Boolean)
    const bad = f.filter((x) => !ids.has(x))
    if (bad.length) die(`unknown version(s) ${bad.join(", ")} — known: ${[...ids].join(", ")}`, 2)
    p.focus = f
    save(p)
    return console.log(`${id}: focus ${f.join(",")}`)
  }
  if (field === "doc") {
    const url = rest[3]
    if (!["plan", "script", "storyboard", "look"].includes(value) || !/^https:\/\//.test(url || "")) die("usage: set <ID> doc <plan|script|storyboard|look> <https url>", 2)
    p.docs = { ...(p.docs ?? {}), [value]: { url, at: new Date().toISOString() } }
    save(p)
    return console.log(`${id}: doc ${value} ${url}`)
  }
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
  const rec = { status, file: rel(p, abs), at: now(), by: actor(), ...(stage === "render" ? { sha: sha256(abs) } : {}) }
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
  if (HEAVY.has(stage) && !p.locks?.[stage] && !has("force")) die(`"${stage}" is not locked: lock its spec first (produce lock ${id} ${stage} [--set k=v]…, or produce lock ${id} --all), or pass --force`)
  // a stage whose spec was re-locked after it was done must be redone first: the stages after it wait for it
  const stale = STAGE_KEYS.slice(0, STAGE_KEYS.indexOf(stage)).find((k) => p.locks?.[k]?.changed)
  if (stale && !has("force")) die(`"${stale}" was re-locked after it was done: redo it first (produce advance ${id} ${stale} --file …), or pass --force`)
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
  // redoing a stage settles a spec that changed after it was done
  if (p.locks?.[stage]?.changed) delete p.locks[stage].changed
  if (perVariant) {
    const v = targets[0]
    if (stage === "publish" && !vdone(p, v.id, "cdn")) die(`publish: ${v.id} is not on the CDN yet (produce ship <ID> --variant ${v.id})`)
    const rec = recordVariantStage(p, v.id, stage, abs, opt("verdict"))
    save(p)
    console.log(`${id}: ${stage} ${rec.status} [${v.id}] (${rel(p, abs)})`)
    return syncFilm(p, `advance: ${stage} [${v.id}] · ${rel(p, abs)} · sha ${sha256(abs)} · by ${actor()}`)
  }
  let status = "done"
  if (stage === "qa") {
    const v = opt("verdict")
    if (!["pass", "fail"].includes(v)) die("qa needs --verdict pass|fail (from the media-qa report)", 2)
    status = v === "pass" ? "passed" : "failed"
    if (status === "passed" && !done(p, "render")) die("qa cannot pass before the render stage is done")
  }
  p.stages[stage] = { status, file: rel(p, abs), at: now(), by: actor(), ...(stage === "render" ? { sha: sha256(abs) } : {}) }
  if (stage === "qa") p.status = status === "passed" ? "in-review" : "in-production"
  else if (p.status === "draft") p.status = "in-production"
  // a re-render or a re-QA invalidates anything downstream of it
  if (stage === "render") for (const k of ["qa"]) delete p.stages[k]
  save(p)
  console.log(`${id}: ${stage} ${status} (${rel(p, abs)})`)
  syncFilm(p, `advance: ${stage} · ${rel(p, abs)} · sha ${sha256(abs)} · by ${actor()}`)
}

// ---- approve ---------------------------------------------------------------------------------
function approve(id) {
  const p = load(id)
  const gate = opt("gate", "version"), version = opt("version"), by = opt("by")
  if (!["script", "look", "version", "publish"].includes(gate)) die("--gate is script|look|version|publish", 2)
  if (!version || !by) die("usage: approve <ID> --version Vnnn --by <login> [--gate script|look|version|publish] [--variant <v>|--all] [--destination facebook] [--issue databayt/x#n]", 2)
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
  syncFilm(p, `approved: ${gate} · ${version} · by ${by}`)
}

// ---- lock / plan / mirror ----------------------------------------------------------------------
// A spec is one stage's decisions written to 00-plan/<NN>-<stage>.spec.json; a lock records it in project.json;
// the plan (00-plan/plan.json + plan.md) is all 14 specs in order. One path rule maps a film file to the CDN:
// ~/media/_projects/<film>/<rel>  <->  work/<film>/ref/<rel>  <->  https://cdn.databayt.org/work/<film>/ref/<rel>.
const refKey = (id, relPath) => `work/${id}/ref/${relPath}`
const refUrl = (id, relPath) => cdnUrl(refKey(id, relPath))
const planDir = (id) => join(dirOf(id), "00-plan")
const specName = (d) => `${String(d.n).padStart(2, "0")}-${d.key}.spec`
function videoData(name) {
  for (const base of [KUN_DIR, join(HERE, "..", "..", "..", "..")]) {
    const f = join(base, "departments", "video", name)
    if (!existsSync(f)) continue
    try { return readJson(f) } catch {}
  }
  return null
}
let _warned = false
const stagesDoc = () => videoData("stages.json")
const typesDoc = () => videoData("types.json")
const settingsDoc = () => videoData("settings.json")
// the 14 stage definitions: stages.json when found, else the bare ledger list (no owns, no tools)
function stageDefs() {
  const doc = stagesDoc()
  if (doc?.stages?.length) return doc.stages
  if (!_warned && !settingsDoc()) { _warned = true; console.error("produce: warning — departments/video/stages.json and settings.json not found; locking with empty decisions") }
  return STAGES.map((s) => ({ key: s.key, n: Number(s.n), label: { en: s.key }, dir: s.file.startsWith("(") ? null : s.file.split("/")[0], file: s.file.startsWith("(") ? null : s.file, gate: null, tool: null, lane: null, owns: [], inputs: [] }))
}
const toolsDoc = () => stagesDoc()?.tools ?? {}
const stageLabel = (d) => d.label?.en ?? d.key
const choiceOf = (k) => settingsDoc()?.choices?.[k]
const choiceLabel = (k) => choiceOf(k)?.label?.en ?? k
const optionLabel = (k, v) => choiceOf(k)?.options?.find((o) => String(o.value) === String(v))?.label?.en ?? String(v)
const specPath = (id, d) => join(planDir(id), `${specName(d)}.json`)
const readSpec = (id, d) => { try { return readJson(specPath(id, d)) } catch { return null } }
const allLocked = (p) => stageDefs().every((d) => p.locks?.[d.key])
const planInfo = (p) => ({ json: join(planDir(p.id), "plan.json"), md: join(planDir(p.id), "plan.md"), url: refUrl(p.id, "00-plan/plan.md"), locked_all: allLocked(p) })
const parseSets = () => optAll("set").map((x) => {
  const i = x.indexOf("=")
  if (i < 1) die(`--set takes k=v, got: ${x}`, 2)
  return [x.slice(0, i), x.slice(i + 1)]
})
// 08-render is never mirrored (masters ship to the video tier), so a path under it has no work/ link
const mirrored = (rel) => !String(rel).startsWith("08-render/")
const ioList = (id, paths) => (paths ?? []).map((path) => ({ path, url: mirrored(path) ? refUrl(id, path) : null }))

// decisions: default <- plan.picks <- plan.stages[stage].decisions <- --set <- --spec (the existing spec, when
// re-locking one stage, sits just above the default so earlier answers survive a one-key --set)
function specFor(p, d, sources) {
  const { plan = {}, sets = [], spec = null, prior = null } = sources
  const decisions = {}
  for (const k of d.owns ?? []) if (choiceOf(k)?.default !== undefined) decisions[k] = choiceOf(k).default
  let source = "default"
  if (prior?.decisions) Object.assign(decisions, prior.decisions)
  for (const k of d.owns ?? []) if (plan.picks?.[k] !== undefined) { decisions[k] = plan.picks[k]; source = "plan" }
  const ps = plan.stages?.[d.key]
  if (ps) { Object.assign(decisions, ps.decisions ?? {}); source = "plan" }
  for (const [k, v] of sets) if ((d.owns ?? []).includes(k)) { decisions[k] = v; source = "set" }
  if (spec) { Object.assign(decisions, spec.decisions ?? {}); source = "spec" }
  // a plan is written by an agent for all 14 stages at once: a tool id it got wrong must not sink the whole lock,
  // so that stage keeps its own tool; a spec for one stage is explicit and an unknown tool there is an error
  let planTool = ps?.tool
  if (planTool && Object.keys(toolsDoc()).length && !toolsDoc()[planTool]) {
    console.error(`produce: warning — the plan names an unknown tool "${planTool}" for ${d.key}; keeping ${d.tool}`)
    planTool = undefined
  }
  const tool = spec?.tool ?? planTool ?? prior?.tool ?? d.tool
  if (tool && Object.keys(toolsDoc()).length && !toolsDoc()[tool]) die(`unknown tool "${tool}" for ${d.key} — one of ${Object.keys(toolsDoc()).join(", ")}`, 2)
  return {
    film: p.id, stage: d.key, n: d.n, label: stageLabel(d), decisions, tool: tool ?? null, lane: prior?.lane ?? d.lane ?? null,
    inputs: ioList(p.id, d.inputs), outputs: ioList(p.id, d.file ? [d.file] : []), gate: d.gate ?? null,
    notes: spec?.notes ?? ps?.notes ?? prior?.notes ?? "", source,
  }
}
const decisionLines = (s) => Object.entries(s.decisions).map(([k, v]) => `- ${choiceLabel(k)}: ${optionLabel(k, v)}`)
const toolLabel = (t) => (t ? (toolsDoc()[t]?.label ?? t) : "-")
function specMd(p, s) {
  const lines = [`# ${String(s.n).padStart(2, "0")} ${s.label} — ${p.title}`, ""]
  const dl = decisionLines(s)
  lines.push(...(dl.length ? dl : ["_No decisions for this stage._"]), "", `Tool: ${toolLabel(s.tool)}`, "")
  lines.push("Inputs:", ...(s.inputs.length ? s.inputs.map((x) => `- ${x.path}${x.url ? ` — ${x.url}` : ""}`) : ["- (none)"]), "")
  lines.push("Outputs:", ...(s.outputs.length ? s.outputs.map((x) => `- ${x.path}${x.url ? ` — ${x.url}` : ""}`) : ["- (none)"]), "")
  lines.push(`Gate: ${s.gate ?? "none"}`)
  if (s.notes) lines.push("", `Notes: ${s.notes}`)
  lines.push("", `Locked by ${s.by} at ${s.at} (${s.source})`, "")
  return lines.join("\n")
}
const stripVolatile = (s) => { const { by, at, source, ...rest } = s; return JSON.stringify(rest) }
// write one spec (json + md); an unchanged spec keeps its file, its lock and its time, so repeating a lock is a no-op
function writeSpec(p, d, spec, source) {
  const prior = readSpec(p.id, d)
  const body = { ...spec, source, by: actor(), at: now() }
  if (prior && p.locks?.[d.key] && stripVolatile(prior) === stripVolatile(body)) return { changed: false }
  mkdirSync(planDir(p.id), { recursive: true })
  const f = specPath(p.id, d)
  writeFileSync(f, JSON.stringify(body, null, 2) + "\n")
  writeFileSync(join(planDir(p.id), `${specName(d)}.md`), specMd(p, body))
  const sha = sha256Full(f)
  const prev = p.locks?.[d.key]
  const rec = { by: body.by, at: body.at, sha, source }
  const wasDone = stageDone(p, { key: d.key })
  if (wasDone && !prev) rec.backfill = true
  else if (wasDone && prev) { if (prev.backfill) rec.backfill = true; if (prev.sha !== sha) rec.changed = true }
  ;(p.locks ??= {})[d.key] = rec
  return { changed: true }
}
// all 14 steps in order (an unlocked stage shows its defaults), as plan.json + plan.md
function compilePlan(p, input) {
  const inFile = join(planDir(p.id), "plan.input.json")
  const inp = input ?? (existsSync(inFile) ? readJson(inFile) : {})
  const steps = stageDefs().map((d) => {
    const s = readSpec(p.id, d) ?? specFor(p, d, { plan: inp })
    return {
      n: d.n, stage: d.key, label: stageLabel(d), tool: s.tool, tool_label: toolLabel(s.tool), lane: s.lane, decisions: s.decisions,
      inputs: s.inputs, outputs: s.outputs, gate: s.gate, locked: !!p.locks?.[d.key], done: stageDone(p, d),
    }
  })
  const cost = Array.isArray(inp.cost) ? inp.cost : []
  const plan = { film: p.id, version: p.version, compiledAt: now(), locked_all: allLocked(p), steps, cost }
  const info = planInfo(p)
  mkdirSync(planDir(p.id), { recursive: true })
  writeFileSync(info.json, JSON.stringify(plan, null, 2) + "\n")
  const cell = (x) => String(x ?? "-").replace(/\|/g, "\\|")
  const md = [`# Plan — ${p.title} (${p.id} ${p.version})`, "", "| # | Stage | Tool | Lane | Output | Gate | Locked |", "| --- | --- | --- | --- | --- | --- | --- |",
    ...steps.map((s) => `| ${String(s.n).padStart(2, "0")} | ${cell(s.label)} | ${cell(s.tool_label)} | ${cell(s.lane)} | ${s.outputs.length ? s.outputs.map((o) => (o.url ? `[${cell(o.path)}](${o.url})` : cell(o.path))).join(", ") : "-"} | ${cell(s.gate ?? "none")} | ${s.locked ? `locked by ${p.locks[s.stage].by}` : "open"} |`), ""]
  if (cost.length) md.push("## Cost", ...cost.map((c) => `- ${typeof c === "string" ? c : JSON.stringify(c)}`), "")
  writeFileSync(info.md, md.join("\n"))
  return info
}
function lockOut(p, touched, info) {
  const out = { id: p.id, locked: touched, locks: p.locks ?? {}, plan: info }
  if (has("json")) return console.log(JSON.stringify(out, null, 2))
  console.log(`${p.id}: ${touched.join(", ")} — locked ${Object.keys(p.locks ?? {}).length} of ${stageDefs().length}\nplan: ${info.url}`)
}
function lockCmd(id, stage) {
  const p = load(id)
  const defs = stageDefs()
  const all = has("all")
  if (all && stage) die("lock takes either <stage> or --all, not both", 2)
  if (!all && !stage) die("usage: lock <ID> --all [--plan <file>] | lock <ID> <stage> [--set k=v]… [--spec <file>]  [--by <login>] [--no-sync] [--json]", 2)
  const target = all ? defs : defs.filter((d) => d.key === stage)
  if (!target.length) die(`unknown stage "${stage}" — one of ${defs.map((d) => d.key).join(" ")}`, 2)
  const sets = parseSets()
  for (const [k] of sets) {
    const owners = defs.filter((d) => (d.owns ?? []).includes(k))
    if (!owners.length) die(`--set ${k}: no stage owns a choice called "${k}"`, 2)
    if (!all && !owners.some((d) => d.key === stage)) die(`--set ${k}: ${stage} does not own it (owned by ${owners.map((d) => d.key).join(", ")})`, 2)
  }
  let plan = {}, planGiven = false
  if (opt("plan")) {
    try { plan = readJson(resolve(opt("plan"))) } catch (e) { die(`--plan file unreadable: ${e.message}`, 2) }
    planGiven = true
  }
  let spec = null
  if (opt("spec")) {
    if (all) die("--spec is for one stage: lock <ID> <stage> --spec <file>", 2)
    try { spec = readJson(resolve(opt("spec"))) } catch (e) { die(`--spec file unreadable: ${e.message}`, 2) }
    if (spec.stage !== stage) die(`--spec is for stage "${spec.stage}", not "${stage}"`, 2)
  }
  if (planGiven) {
    mkdirSync(planDir(id), { recursive: true })
    writeFileSync(join(planDir(id), "plan.input.json"), JSON.stringify(plan, null, 2) + "\n")
  }
  for (const d of target) {
    // an existing spec always sits just above the defaults, so `lock --all` on a locked film keeps what each
    // stage already decided and only applies what the plan or --set brings
    const s = specFor(p, d, { plan, sets, spec, prior: readSpec(id, d) })
    writeSpec(p, d, s, s.source)
  }
  save(p)
  const info = compilePlan(p, planGiven ? plan : undefined)
  lockOut(p, target.map((d) => d.key), info)
  if (!has("no-sync")) syncFilm(p, null)
}
function unlockCmd(id, stage) {
  const p = load(id)
  if (!stage || !stageDefs().some((d) => d.key === stage)) die(`usage: unlock <ID> <stage> — one of ${stageDefs().map((d) => d.key).join(" ")}`, 2)
  if (p.locks) delete p.locks[stage]
  save(p)
  const info = compilePlan(p)
  lockOut(p, [stage], info)
  if (!has("no-sync")) syncFilm(p, null)
}
function planCmd(id) {
  const p = load(id)
  const info = compilePlan(p)
  if (has("json")) return console.log(JSON.stringify({ id: p.id, locked: Object.keys(p.locks ?? {}), locks: p.locks ?? {}, plan: info }, null, 2))
  process.stdout.write(readFileSync(info.md, "utf8"))
  console.log(`\n${info.url}`)
}

const NO_MIRROR_EXT = new Set(["ttf", "otf", "woff", "woff2"])
const MAX_MIRROR = 50 * 1024 * 1024
function walkFiles(root) {
  const out = []
  const go = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".DS_Store") continue
      const f = join(d, e.name)
      if (e.isDirectory()) go(f)
      else if (e.isFile()) out.push(f)
    }
  }
  if (existsSync(root)) go(root)
  return out.sort()
}
function mirrorCmd(id) {
  const p = load(id)
  const defs = stageDefs()
  const only = opt("stage")
  let units // [{ rel dir, stage label }]
  if (only) {
    const d = defs.find((x) => x.key === only)
    if (!d) die(`unknown stage "${only}" — one of ${defs.map((x) => x.key).join(" ")}`, 2)
    if (!d.dir) die(`stage ${only} has no folder to mirror`, 2)
    units = [{ dir: d.dir, stage: only }]
  } else {
    const by = new Map([["00-plan", ["plan"]]])
    for (const d of defs) if (d.dir) by.set(d.dir, [...(by.get(d.dir) ?? []), d.key])
    const dirs = [...by.keys()].filter((x) => ![...by.keys()].some((o) => o !== x && x.startsWith(o + "/")))
    units = dirs.map((x) => ({ dir: x, stage: by.get(x).join(",") }))
  }
  const base = dirOf(id)
  const jobs = [], skipped = []
  for (const u of units) {
    const files = []
    for (const f of walkFiles(join(base, u.dir))) {
      const r = f.slice(base.length + 1)
      if (r === `${u.dir}/index.json`) continue // the index this command writes
      const ext = r.split(".").pop().toLowerCase()
      if (r.startsWith("08-render/")) skipped.push({ path: r, why: "masters belong to the video tier (ship)" })
      else if (NO_MIRROR_EXT.has(ext)) skipped.push({ path: r, why: "fonts are never rehosted" })
      else if (statSync(f).size > MAX_MIRROR) skipped.push({ path: r, why: "over 50 MB" })
      else files.push({ file: f, path: r, key: refKey(id, r), url: refUrl(id, r), bytes: statSync(f).size })
    }
    jobs.push({ ...u, files })
  }
  if (!has("create")) {
    console.log(`DRAFT — nothing uploaded. Add --create to mirror to the CDN.\nfilm: ${id}`)
    for (const j of jobs) { console.log(`\n${j.dir}/ (${j.files.length} file(s))`); for (const x of j.files) console.log(`  ${x.path}\n    => ${x.url}`) }
    if (skipped.length) { console.log("\nskipped:"); for (const s of skipped) console.log(`  ${s.path} — ${s.why}`) }
    return
  }
  const indexes = []
  for (const j of jobs) {
    const entries = []
    for (const x of j.files) { uploadToCdn(x.file, x.key); entries.push({ path: x.path, url: x.url, sha: sha256Full(x.file), bytes: x.bytes }) }
    const idx = join(base, j.dir, "index.json")
    mkdirSync(dirname(idx), { recursive: true })
    writeFileSync(idx, JSON.stringify({ film: id, stage: j.stage, files: entries }, null, 2) + "\n")
    const irel = `${j.dir}/index.json`
    indexes.push({ dir: j.dir, files: entries.length, index: uploadToCdn(idx, refKey(id, irel)) })
  }
  console.log(JSON.stringify({ id, uploaded: jobs.reduce((a, j) => a + j.files.length, 0), indexes, skipped }, null, 2))
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

// ---- the film issue (tracker) + work orders ------------------------------------------------------
// One film issue per film: the brief, versions, the 14 stages, the gates and a Work orders section.
// A work order is its own issue: one request, one person, one deliverable (formula body from station.mjs fill).
const GATE_NAMES = ["script", "look", "version", "publish"]
const DEFAULT_REPO = "databayt/kun"
const brandRepo = (p) => ({ hogwarts: "hogwarts", mkan: "mkan", databayt: "kun" })[p.brand] ?? p.brand
// The only text a public tracker must never carry: commission or revenue-share terms. Prices (the public list price) are fine.
const COMMISSION = /commission|revenue[\s-]*share|% of (?:the )?(?:first[- ]year )?revenue|عمولة|عمولات|حصة من الإيرادات/i
const safeText = (t) => (t && typeof t === "string" && !COMMISSION.test(t) && t !== "TODO" ? t.replace(/\s+/g, " ").trim() : null)
const stageDone = (p, s) => (variantMode(p) && PER_VARIANT.includes(s.key) ? variantsOf(p).every((v) => vdone(p, v.id, s.key)) : done(p, s.key))
const gateRec = (p, g) => approval(p, g)
const gateState = (p, g) => {
  const a = gateRec(p, g)
  return a ? `approved by ${a.by}` : "waiting"
}
function filmUrls(p) {
  try {
    const kit = loadBrand(p.brand)
    if (variantMode(p)) return variantsOf(p).map((v) => ({ id: v.id, url: cdnUrl(`${stableBase(p, kit)}/${v.id}/fb-9x16.mp4`) }))
    return [{ id: p.version, url: cdnUrl(`${cdnBase(p, kit)}/master.mp4`) }]
  } catch { return [] }
}
function requestOf(p) {
  const f = join(dirOf(p.id), "01-brief/request.json")
  try { return readJson(f) } catch { return {} }
}
function briefLines(p) {
  const r = requestOf(p)
  const out = [`${p.brand}${p.identity && p.identity !== p.brand ? ` (on film: ${p.identity})` : ""} · ${p.category} · ${p.subject} · languages ${p.langs.join(", ")} · ${p.version}`]
  const add = (label, v) => { const t = safeText(v); if (t) out.push(`${label}: ${t}`) }
  add("Audience", r.audience)
  add("Objective", r.objective)
  add("Viewing", r.viewing)
  if (r.formats?.length) out.push(`Formats: ${r.formats.join(", ")}`)
  if (r.destinations?.length) out.push(`Destinations: ${r.destinations.join(", ")}`)
  if (p.markets?.length) out.push(`Markets: ${p.markets.join(", ")}`)
  return out
}
// closed work orders: one `gh issue view` per order; a failure warns and falls back to the last known state
function orderStates(p) {
  return Object.fromEntries((p.orders ?? []).map((o) => {
    const r = parseRef(o.issue)
    const v = r && ghSoft(["issue", "view", String(r.n), "--repo", r.repo, "--json", "state"])
    let state = null
    try { state = JSON.parse(v).state } catch {}
    return [o.issue, state ? state === "CLOSED" : !!o.closed]
  }))
}
const rememberClosed = (p, states) => {
  let changed = false
  for (const o of p.orders ?? []) if (states[o.issue] && !o.closed) { o.closed = true; changed = true }
  if (changed) save(p)
}
function issueBody(p, states = orderStates(p)) {
  const box = (s) => `- [${stageDone(p, s) ? "x" : " "}] ${s.n} ${s.key} → \`${s.file}\` · ${p.locks?.[s.key] ? `locked by ${p.locks[s.key].by}` : "open"}`
  const orders = (p.orders ?? []).map((o) => `- [${states[o.issue] ? "x" : " "}] #${o.issue.split("#").pop()} ${o.label ?? o.formula} — ${o.to}`)
  const urls = filmUrls(p).map((u) => `- ${u.id}: ${u.url}`)
  const repo = (p.issue ?? DEFAULT_REPO).split("#")[0].split("/").pop()
  return `Production **${p.id}** — ${p.title}

## Brief
${briefLines(p).map((l) => `- ${l}`).join("\n")}

Project folder: \`~/media/_projects/${p.id}/\` · driven by \`/produce\` (\`produce.mjs status ${p.id}\`)

## Versions
${urls.length ? urls.join("\n") : "- (no CDN keys yet)"}

## Stages
${STAGES.map(box).join("\n")}

## Gates
${GATE_NAMES.map((g) => `- [${gateRec(p, g) ? "x" : " "}] ${g} — ${gateState(p, g)}`).join("\n")}

Hard rules: real product UI only for product claims; generated property scenes are illustrative; no publish without approve.

## Plan
- ${refUrl(p.id, "00-plan/plan.md")}
- locked: ${Object.keys(p.locks ?? {}).length} of ${STAGES.length}

## Work orders
${orders.length ? orders.join("\n") : "_none yet — `produce order <ID> <formula> --to <login>`_"}

<!-- kun: repos=${repo}; items=skill:produce; film=${p.id} -->`
}
const filmTitle = (p) => `video: ${p.title} (${p.id})`
const FILM_LABELS = ["dept:video", "P2", "film"]

function issue(id) {
  const p = load(id)
  const write = has("create") || has("sync")
  const states = orderStates(p) // read-only; in draft it shows what would be ticked
  const body = issueBody(p, states)
  if (!write) return console.log(`title: ${filmTitle(p)}\nlabels: ${FILM_LABELS.join(", ")}\n${p.issue ? `(existing issue ${p.issue}: --create or --sync would rewrite its body)\n` : "(no issue yet: --create would create it)\n"}\n${body}`)
  if (p.issue) {
    const r = parseRef(p.issue)
    if (!r) die(`project.json issue "${p.issue}" is not repo#n`)
    ensureLabels(r.repo, FILM_LABELS)
    gh(["issue", "edit", String(r.n), "--repo", r.repo, "--title", filmTitle(p), "--body", body, "--add-label", FILM_LABELS.join(",")])
    rememberClosed(p, states)
    return console.log(`https://github.com/${r.repo}/issues/${r.n}  (body rewritten from current state)`)
  }
  if (has("sync")) die(`${id} has no film issue yet — run \`produce issue ${id} --create\` first`)
  const repo = opt("repo", DEFAULT_REPO)
  ensureLabels(repo, FILM_LABELS)
  const url = gh(["issue", "create", "--repo", repo, "--title", filmTitle(p), "--body", body, ...FILM_LABELS.flatMap((l) => ["--label", l])])
  p.issue = `${repo}#${url.split("/").pop()}`
  save(p)
  console.log(url)
}

// Rewrite the film issue body from current state and add one comment. Never throws: a GitHub failure warns.
function syncFilm(p, commentText) {
  if (!p.issue) return
  const r = parseRef(p.issue)
  if (!r) return console.error(`produce: warning — project issue "${p.issue}" is not repo#n; film issue not updated`)
  const states = orderStates(p)
  ghSoft(["issue", "edit", String(r.n), "--repo", r.repo, "--body", issueBody(p, states)])
  try { rememberClosed(p, states) } catch {}
  if (commentText) ghSoft(["issue", "comment", String(r.n), "--repo", r.repo, "--body", commentText])
}

// ---- order ---------------------------------------------------------------------------------------
function stationPath() {
  for (const f of [join(HERE, "..", "..", "..", "scripts", "station.mjs"), join(KUN_DIR, ".claude", "scripts", "station.mjs")]) if (existsSync(f)) return f
  return null
}
function formulaHeader(fid) {
  for (const base of [KUN_DIR, join(HERE, "..", "..", "..", "..")]) {
    const f = join(base, "departments", "video", "formulas", `${fid}.md`)
    if (!existsSync(f)) continue
    const m = /^---\s*\n([\s\S]*?)\n---/.exec(readFileSync(f, "utf8"))
    try { return JSON.parse(m[1]) } catch { return {} }
  }
  return {}
}
const FORMULA_ITEMS = { blender: "skill:blender", filmcraft: "mcp:filmcraft", image: "skill:higgs", capture: "skill:record", voice: "skill:edit", script: "skill:draft", pickup: "skill:produce", review: "skill:produce" }
function itemsFor(fid, header) {
  const needs = [].concat(header.needs ?? []).filter((x) => /^(skill|mcp|agent):/.test(x))
  if (needs.length) return needs
  return [FORMULA_ITEMS[fid.split(".").pop()] ?? "skill:produce"]
}
function fillOrder(p, fid, to) {
  const sets = optAll("set")
  const bad = sets.filter((x) => !x.includes("="))
  if (bad.length) die(`--set takes k=v, got: ${bad.join(", ")}`, 2)
  if (STUB && existsSync(join(STUB, "station.json"))) return readJson(join(STUB, "station.json"))
  const st = stationPath()
  if (!st) die("station.mjs not found (.claude/scripts/station.mjs) — it fills the formula")
  const args = [st, "fill", fid, "--dept", "video", "--repo", brandRepo(p), "--login", actor(), "--project", p.id, "--set", `to=${to}`, ...sets.flatMap((x) => ["--set", x]), "--json"]
  const r = spawnSync("node", args, { encoding: "utf8", maxBuffer: 1 << 26 })
  if (r.status !== 0) die(`station fill failed: ${(r.stderr || r.stdout).slice(-400)}`)
  try { return JSON.parse(r.stdout) } catch { return die(`station fill printed no JSON: ${r.stdout.slice(-300)}`) }
}
function orderCmd(id, fid) {
  const p = load(id)
  const to = opt("to")
  if (!fid || !to) die("usage: order <ID> <formula-id> --to <login> [--set k=v]… [--after ref,ref] [--create]", 2)
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(to)) die(`--to must be a kun login (lowercase letters, digits, hyphens), got "${to}"`, 2)
  const f = fillOrder(p, fid, to)
  if (f.missing?.length) die(`formula ${fid} still needs: ${f.missing.join(", ")} — pass --set <slot>=<value>`)
  if (f.record !== "issue") die(`formula ${fid} is not a work order (record: ${f.record}) — only record=issue formulas become issues`)
  if (!f.prompt) die(`formula ${fid} filled an empty prompt`)
  if (!f.prompt.includes(p.id)) console.error(`produce: warning — the filled prompt does not mention ${p.id}`)
  const header = formulaHeader(fid)
  const label = header.label?.en ?? fid
  const sets = Object.fromEntries(optAll("set").map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]))
  const piece = ["scene", "piece", "flow", "name", "topic"].map((k) => sets[k]).find(Boolean) ?? Object.entries(sets).find(([k]) => k !== "to")?.[1] ?? fid
  const title = `${label}: ${piece} — ${p.title}`
  const after = (opt("after") ?? "").split(",").map((x) => x.trim()).filter(Boolean)
  const items = (opt("items") ? opt("items").split(",").map((x) => x.trim()).filter(Boolean) : itemsFor(fid, header))
  const weight = header.weight ?? ""
  const block = `<!-- kun: repos=${brandRepo(p)}; items=${items.join(",")}; after=${after.join(",")}; film=${p.id}; formula=${fid}; weight=${weight} -->`
  const body = `${f.prompt.trim()}\n\n${block}`
  const labels = ["dept:video", "P2", `for:${to}`]
  const uploads = f.uploads ?? []
  if (COMMISSION.test(f.prompt)) { if (has("create")) die("refusing to create: the filled prompt states a commission or revenue share — a work order never carries those; edit the formula or the --set values"); console.error("produce: warning — the filled prompt states a commission or revenue share; --create would refuse") }
  if (!has("create")) {
    console.log(`DRAFT — nothing created, nothing uploaded.\nfilm issue: ${p.issue ?? "(none yet — run `produce issue " + id + " --create` before --create here)"}\ntitle: ${title}\nlabels: ${labels.join(", ")}\nreferences to upload (${uploads.length}):`)
    for (const u of uploads) console.log(`  ${u.local}${existsSync(u.local) ? "" : "  [ABSENT: would be skipped]"}\n    -> ${u.key}\n    => ${u.url}`)
    return console.log(`\n${body}`)
  }
  if (!p.issue) die(`${id} has no film issue yet — run \`produce issue ${id} --create\` first`)
  const fr = parseRef(p.issue)
  if (!fr) die(`project.json issue "${p.issue}" is not repo#n`)
  for (const u of uploads) {
    if (!existsSync(u.local)) { console.error(`produce: warning — reference ${u.local} is absent; skipped (its link ${u.url} will not resolve)`); continue }
    uploadToCdn(u.local, u.key)
  }
  ensureLabels(fr.repo, labels)
  const url = gh(["issue", "create", "--repo", fr.repo, "--title", title, "--body", body, ...labels.flatMap((l) => ["--label", l])])
  const n = url.split("/").pop()
  ;(p.orders ??= []).push({ issue: `${fr.repo}#${n}`, formula: fid, to, label, createdAt: now(), by: actor() })
  save(p)
  syncFilm(p, `work order #${n} · ${label} · for ${to} · by ${actor()}`)
  console.log(url)
}

// ---- submit --------------------------------------------------------------------------------------
const RECEIPT_MARKER = "<!-- kun:receipt -->" // mirrors src/lib/machine/contract.ts; layout mirrors formatReceipt in tasks.ts
function safeName(name) {
  const base = name.split(/[\\/]/).pop() ?? ""
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^\.+/, "").replace(/\s+/g, " ").trim()
  return clean && clean !== "." && clean !== ".." ? clean : null
}
function formatReceipt({ login, summary, artifacts, hashes, formula, stage, next }) {
  const bullets = (v) => (v.length ? v.map((x) => `- ${x}`).join("\n") : "- none")
  return [
    RECEIPT_MARKER,
    `### Run receipt — ${login}`,
    "",
    "Driver: claude · Model: produce submit · Duration: 0s",
    ...(formula || stage ? [[formula ? `Formula: ${formula}` : "", stage ? `Stage: ${stage}` : ""].filter(Boolean).join(" · ")] : []),
    "",
    "**Summary**",
    summary,
    "",
    "**Commits**",
    bullets([]),
    "",
    "**Artifacts**",
    bullets(artifacts),
    ...(hashes ? ["", "**Hashes (sha256)**", bullets(artifacts.map((a, i) => `${hashes[i]}  ${a}`))] : []),
    ...(next ? ["", "**Next**", next] : []),
    "",
    "Ready for review (`status:review`). Only the CEO closes.",
  ].join("\n")
}
function submitCmd(ref, files) {
  const r = parseRef(ref)
  if (!r || !files.length) die("usage: submit <databayt/repo#n|issue url> <file>… [--summary \"…\"] [--next \"…\"] [--stage s] [--create]", 2)
  const abs = files.map((f) => resolve(f))
  for (const f of abs) if (!existsSync(f) || !statSync(f).isFile()) die(`not a file: ${f}`)
  const view = ghRun(["issue", "view", String(r.n), "--repo", r.repo, "--json", "title,body,state,labels"])
  if (!view.ok) die(`cannot read ${r.ref}: ${view.err}`)
  let info
  try { info = JSON.parse(view.out) } catch { die(`gh printed no JSON for ${r.ref}`) }
  const kun = /<!--\s*kun:([\s\S]*?)-->/i.exec(info.body ?? "")?.[1] ?? ""
  const field = (k) => new RegExp(`(?:^|;)\\s*${k}=([^;]*)`, "i").exec(kun)?.[1]?.trim() || null
  const film = (field("film") || r.repo.split("/").pop()).replace(/[^a-zA-Z0-9._-]/g, "-")
  const plan = abs.map((f) => {
    const name = safeName(basename(f))
    if (!name) die(`file name is empty after cleaning: ${f}`)
    return { file: f, name, key: `work/${film}/${r.n}/${name}`, url: cdnUrl(`work/${film}/${r.n}/${name}`) }
  })
  const hashes = plan.map((x) => sha256Full(x.file))
  const body = formatReceipt({
    login: actor(), summary: opt("summary") || "Submitted from the command line.", artifacts: plan.map((x) => x.url), hashes,
    formula: field("formula"), stage: opt("stage") || field("stage"), next: opt("next"),
  })
  if (!has("create")) {
    console.log(`DRAFT — nothing uploaded, nothing posted.\nissue: ${r.ref}  (${info.state ?? "?"})\nuploads:`)
    for (const x of plan) console.log(`  ${x.file}\n    -> ${x.key}\n    => ${x.url}`)
    return console.log(`then: comment the receipt below on ${r.ref}, remove label status:in-progress, add status:review\n\n${body}`)
  }
  for (const x of plan) uploadToCdn(x.file, x.key)
  gh(["issue", "comment", String(r.n), "--repo", r.repo, "--body", body])
  ensureLabels(r.repo, ["status:review"])
  ghRun(["issue", "edit", String(r.n), "--repo", r.repo, "--remove-label", "status:in-progress"]) // absent label = fine
  gh(["issue", "edit", String(r.n), "--repo", r.repo, "--add-label", "status:review"])
  console.log(JSON.stringify({ issue: r.ref, uploaded: plan.map((x) => x.url), status: "review" }, null, 2))
}

// ---- CDN tier --------------------------------------------------------------------------------
const cdnBase = (p, kit) => `${kit.cdn}/video/${p.id}`
const stableBase = (p, kit) => `${kit.cdn}/video/${slugOf(p)}` // brand first: <brand>/video/<type>/<subject>; never the dated ID
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
const aws = (args) => {
  try { return sh("aws", args) } catch (e) {
    if (e.code === "ENOENT") die("the AWS CLI (aws) is not installed or not on PATH — it uploads to the CDN. Install it (brew install awscli) and run `aws configure`, or hand the files to a machine with CDN keys (or use Submit in the Kun app)")
    throw e
  }
}
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
      const ns = x.key.split("/")[0], k = x.key.slice(ns.length + 1).replace(/\.mp4$/, "") // ns = <brand>, key = video/…
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
  if (has("path")) {
    const r = opt("path", "")
    if (!r || isAbsolute(r) || r.startsWith("~") || r.split("/").includes("..")) die(`--path must be relative to the film folder, with no ".." (got "${r}")`, 2)
    return console.log(refUrl(p.id, r))
  }
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
      const ns = x.key.split("/")[0], k = x.key.slice(ns.length + 1).replace(/\.mp4$/, "") // ns = <brand>
      const r = spawnSync("node", [PUBLISH, "--ns", ns, "--key", k, "--id", `${p.id}/${x.variant}`, x.file], { encoding: "utf8" })
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

// ---- from-reference: a finished video becomes the seed of research + script -----------------------
const fmtTime = (t) => t.replace(",", ".").replace(/^00:/, "").replace(/\.\d+$/, "")
function parseSrt(text) {
  return text.replace(/\r/g, "").split(/\n{2,}/).map((blk) => {
    const l = blk.trim().split("\n")
    const i = l.findIndex((x) => x.includes("-->"))
    if (i < 0) return null
    const [a, b] = l[i].split("-->").map((x) => x.trim())
    return { time: `${fmtTime(a)}–${fmtTime(b)}`, line: l.slice(i + 1).join(" ").replace(/\|/g, "\\|").trim() }
  }).filter((x) => x && x.line)
}
// The reference's own audio becomes the voiceover: 48 kHz mono wav per variant, recorded as the voice source.
function extractVoiceover(p, src, ext, variants) {
  const dir = dirOf(p.id), outDir = join(dir, "07-audio", "voiceover")
  mkdirSync(outDir, { recursive: true })
  const first = join(outDir, `${variants[0].id}.wav`)
  const ex = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", first], { encoding: "utf8" })
  if (ex.status !== 0) die(`voiceover extract failed: ${(ex.stderr || ex.error?.message || "").trim().split("\n").pop()}`)
  const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", first], { encoding: "utf8" })
  const durationSec = Math.round(Number.parseFloat((pr.stdout || "").trim()) * 100) / 100
  if (!Number.isFinite(durationSec) || durationSec <= 0) die(`voiceover has no audio: ${first}`)
  const sha = sha256(first)
  p.voice ??= {}
  for (const v of variants) {
    const f = join(outDir, `${v.id}.wav`)
    if (f !== first) copyFileSync(first, f)
    p.voice[v.id] = { source: `02-research/reference/video${ext}`, file: `07-audio/voiceover/${v.id}.wav`, kind: "source-video", sampleRate: 48000, channels: 1, durationSec, sha, at: now(), by: actor() }
  }
  save(p)
  console.error(`produce: voiceover -> ${variants.map((v) => `07-audio/voiceover/${v.id}.wav`).join(", ")} (${durationSec}s, 48 kHz mono)`)
  return variants.map((v) => ({ variant: v.id, file: `07-audio/voiceover/${v.id}.wav`, durationSec }))
}
function fromReferenceSeed(id, video, fresh = false) {
  const p = load(id)
  const src = resolve(video)
  if (!existsSync(src)) die(`reference video not found: ${src}`)
  const voiceVariants = has("voiceover") ? selectVariants(p) : null // a project with several variants needs --variant <v> or --all
  const dir = dirOf(id), refDir = join(dir, "02-research", "reference")
  mkdirSync(refDir, { recursive: true })
  mkdirSync(join(dir, "03-script"), { recursive: true })
  const ext = (src.match(/\.[^.\/]+$/)?.[0] ?? ".mp4").toLowerCase()
  copyFileSync(src, join(refDir, `video${ext}`))
  console.error(`produce: copied reference -> 02-research/reference/video${ext}`)
  const voiceover = voiceVariants ? extractVoiceover(p, src, ext, voiceVariants) : null
  const fail = (m) => { console.error(`produce: reference transcription failed: ${m}\n  (the copy is kept at ${join(refDir, "video" + ext)})`); process.exit(1) }
  // contact sheet (best effort, never blocks the transcript)
  const cs = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-vf", "fps=1/8,scale=180:-1,tile=8x2", "-frames:v", "1", join(refDir, "contact.png")], { encoding: "utf8" })
  if (cs.status !== 0) console.error(`produce: contact sheet failed: ${(cs.stderr || "").trim().split("\n").pop()}`)
  const tmp = mkdtempSync(join(tmpdir(), "produce-ref-"))
  try {
    const wav = join(tmp, "transcript.wav")
    const ex = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", wav], { encoding: "utf8" })
    if (ex.status !== 0) fail(`audio extract: ${(ex.stderr || ex.error?.message || "").trim()}`)
    const lang = (p.langs?.[0] || "ar")
    const w = spawnSync("mlx_whisper", [wav, "--model", "mlx-community/whisper-large-v3-turbo", "--language", lang, "--output-format", "srt", "--output-dir", refDir], { encoding: "utf8", maxBuffer: 1 << 26 })
    if (w.status !== 0) fail(`mlx_whisper: ${(w.stderr || w.error?.message || "").trim().split("\n").slice(-6).join("\n")}`)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
  const srtFile = join(refDir, "transcript.srt")
  if (!existsSync(srtFile)) fail("no transcript.srt was written")
  const rows = parseSrt(readFileSync(srtFile, "utf8"))
  const md = [`# Reference script — transcribed from ${basename(src)}`, "", ...(voiceover ? [`Voiceover: the video's own audio, ${voiceover.map((v) => v.file).join(", ")} (${voiceover[0].durationSec}s). The picture is planned over this timing.`, ""] : []), `Source: 02-research/reference/video${ext} · transcript: 02-research/reference/transcript.srt · whisper-large-v3-turbo (${p.langs?.[0] || "ar"}) · a machine draft, check it against the audio.`, "", "| # | time | line |", "| --- | --- | --- |", ...rows.map((r, i) => `| ${i + 1} | ${r.time} | ${r.line} |`), ""].join("\n")
  writeFileSync(join(dir, "03-script", "script.md"), md)
  p.stages.research = { status: "seeded", file: "02-research/reference/transcript.srt", at: now() }
  save(p)
  console.error(`produce: seeded 03-script/script.md (${rows.length} lines), research marked "seeded"`)
  if (!fresh) console.log(JSON.stringify({ id, reference: `02-research/reference/video${ext}`, transcript: "02-research/reference/transcript.srt", contact: "02-research/reference/contact.png", lines: rows.length, ...(voiceover ? { voiceover } : {}) }, null, 2))
}

// ---- readiness ---------------------------------------------------------------------------------
function readiness() {
  // A GUI app (Kun) starts us with a bare PATH: look where the tools actually live first.
  const HOMEDIR = process.env.HOME || ""
  process.env.PATH = [`${HOMEDIR}/.local/bin`, "/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", `${HOMEDIR}/.cargo/bin`, process.env.PATH || "/usr/bin:/bin"].join(":")
  const fix = has("fix"), asJson = has("json")
  const rows = [] // {name, level: ok|warn|fail, critical, detail}
  const add = (name, level, detail, critical = true) => rows.push({ name, level, critical, detail })
  const run1 = (c, a, o = {}) => spawnSync(c, a, { encoding: "utf8", timeout: 60000, ...o })
  const first = (r) => ((r.stdout || r.stderr || "").trim().split("\n")[0] || "").slice(0, 100)
  const onPath = (c) => run1("/bin/sh", ["-c", `command -v ${c}`]).stdout.trim()

  let r = run1("ffmpeg", ["-version"])
  add("ffmpeg", r.status === 0 ? "ok" : "fail", r.status === 0 ? first(r) : "not found (brew install ffmpeg)")
  r = run1("blender", ["--version"])
  add("blender", r.status === 0 ? "ok" : "fail", r.status === 0 ? first(r) : "not found (brew install --cask blender)")
  const fc = process.env.FILMCRAFT_CLI || join(homedir(), ".local", "bin", "filmcraft-cli")
  if (!existsSync(fc)) add("filmcraft-cli", "fail", `missing: ${fc}`)
  else {
    let q = run1(fc, ["--version"])
    if (q.status !== 0) q = run1(fc, ["--help"])
    add("filmcraft-cli", q.status === 0 ? "ok" : "fail", q.status === 0 ? `${fc} ${first(q).slice(0, 40)}` : `${fc} exits ${q.status}`)
  }
  const mw = onPath("mlx_whisper")
  add("mlx_whisper", mw ? "ok" : "fail", mw || "not on PATH (uv tool install mlx-whisper)")
  const uv = onPath("uv")
  add("uv", uv ? "ok" : "fail", uv || "not on PATH (brew install uv)")

  // Playwright browsers for the media runtime
  const MEDIA_RT = process.env.MEDIA_RT || join(homedir(), ".local", "share", "databayt", "media")
  const cli = join(MEDIA_RT, "node_modules", "playwright-core", "cli.js")
  const browserState = () => {
    try {
      const pw = createRequire(join(MEDIA_RT, "package.json"))("playwright-core")
      const out = {}
      for (const n of ["webkit", "chromium"]) { const e = pw[n].executablePath(); out[n] = e && existsSync(e) }
      return out
    } catch (e) { return { error: e.message.split("\n")[0] } }
  }
  let bs = browserState()
  if (bs.error) add("playwright browsers", "fail", `${bs.error} (bash ~/.claude/skills/edit/scripts/media.sh setup)`)
  else {
    if (fix && !(bs.webkit && bs.chromium)) {
      console.error("readiness: installing playwright webkit chromium …")
      spawnSync("node", [cli, "install", "webkit", "chromium"], { stdio: ["ignore", 2, 2] }) // progress to stderr: stdout stays JSON
      bs = browserState()
    }
    const missing = ["webkit", "chromium"].filter((n) => !bs[n])
    add("playwright browsers", missing.length ? "fail" : "ok", missing.length ? `missing ${missing.join(", ")} (readiness --fix)` : `webkit + chromium in ${MEDIA_RT}`)
  }

  // disk
  const df = run1("df", ["-k", "/"]).stdout.trim().split("\n").pop().split(/\s+/)
  const freeGb = Number(df[3]) / 1048576
  // ≥ 15 GB is comfortable for renders; 8–15 still works (orange); under 8 a render can fail mid-way (red)
  add("disk free on /", freeGb >= 15 ? "ok" : freeGb >= 8 ? "warn" : "fail", `${freeGb.toFixed(1)} GB (comfortable ≥ 15, minimum 8)`)
  // power
  const pm = run1("pmset", ["-g", "batt"]).stdout
  const pct = Number(/(\d+)%/.exec(pm)?.[1])
  const ac = /AC Power/.test(pm)
  add("power", !ac && pct < 30 ? "warn" : "ok", ac ? `AC${Number.isFinite(pct) ? ` (${pct}%)` : ""}` : `battery ${Number.isFinite(pct) ? pct + "%" : "?"}${pct < 30 ? " — plug in before a render" : ""}`, false)
  // Kun.app freshness
  const app = "/Applications/Kun.app/Contents/MacOS/machine"
  if (!existsSync(app)) add("Kun.app", "warn", "not installed", false)
  else {
    const m = Math.floor(statSync(app).mtimeMs / 1000)
    const g = run1("git", ["-C", join(homedir(), "machine"), "log", "-1", "--format=%ct", "origin/main"])
    const head = Number(g.stdout.trim())
    if (!head) add("Kun.app", "warn", "built " + new Date(m * 1000).toISOString().slice(0, 10) + "; ~/machine origin/main not readable", false)
    else add("Kun.app", m >= head ? "ok" : "warn", m >= head ? "newer than machine origin/main" : `older than machine origin/main by ${((head - m) / 86400).toFixed(1)} d — rebuild`, false)
  }
  // MCP presence
  let servers = null
  try { servers = Object.keys(readJson(join(homedir(), ".claude.json")).mcpServers ?? {}) } catch {}
  for (const n of ["blender", "blender-lab", "filmcraft", "filmcraft-desktop"]) add(`mcp ${n}`, servers === null ? "warn" : servers.includes(n) ? "ok" : "warn", servers === null ? "~/.claude.json unreadable" : servers.includes(n) ? "registered" : "not in ~/.claude.json mcpServers", false)
  // Gemini key — same sources as edit/scripts/media/voice.mjs (env, then kun/.env); value never printed
  let key = !!process.env.GEMINI_API_KEY?.trim()
  if (!key) try { key = /^GEMINI_API_KEY=["']?\S+/m.test(readFileSync(join(KUN_DIR, ".env"), "utf8")) } catch {}
  add("GEMINI_API_KEY", key ? "ok" : "fail", key ? "present" : "absent (env or kun/.env)")

  const okAll = rows.every((x) => !x.critical || x.level === "ok")
  if (asJson) console.log(JSON.stringify({ ok: okAll, rows }, null, 2))
  else {
    const w = Math.max(...rows.map((x) => x.name.length))
    for (const x of rows) console.log(`${x.level === "ok" ? "✓" : x.level === "warn" ? "!" : "✗"} ${x.name.padEnd(w)}  ${x.detail}`)
    console.log(okAll ? "\nready (every critical check passes)" : "\nNOT ready — " + rows.filter((x) => x.critical && x.level !== "ok").map((x) => x.name).join(", "))
  }
  process.exit(okAll ? 0 : 1)
}

// `list [--json] [--repo <brand>]` — every project, newest first, with its next stage: what Machine's
// "Continue" branch lists. A project folder without a readable project.json is skipped.
function listCmd() {
  const repo = opt("repo")
  const out = []
  for (const d of existsSync(HOME) ? readdirSync(HOME) : []) {
    if (d.startsWith("_")) continue
    let p
    try { p = readJson(join(HOME, d, "project.json")) } catch { continue }
    if (repo && p.brand !== repo) continue
    const vm = !!p.markets?.length
    const next = (vm ? STAGES.filter((x) => !PER_VARIANT.includes(x.key)) : STAGES).find((s) => !p.stages?.[s.key])
    out.push({ id: p.id, title: p.title, brand: p.brand, category: p.category, subject: p.subject, version: p.version, status: p.status,
      createdAt: p.createdAt, next: next ? next.key : vm ? "build" : "done", focus: p.focus ?? [], variants: vm ? variantsOf(p).map((v) => v.id) : p.langs ?? [],
      identity: p.identity ?? p.brand, markets: p.markets ?? [], langs: p.langs ?? [], dir: join(HOME, d) })
  }
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  if (has("json")) console.log(JSON.stringify(out, null, 2))
  else for (const x of out) console.log(`${x.id}  [${x.status}]  next: ${x.next}${x.focus.length ? `  focus ${x.focus.join(",")}` : ""}`)
}

// ---- dispatch --------------------------------------------------------------------------------
// `types [--brand b] [--json]` — a brand's film types, what each subject names, the defaults and the URL pattern. Zero tokens.
function typesCmd() {
  const doc = typesDoc()
  if (!doc) die("departments/video/types.json not found", 1)
  const brands = opt("brand") ? [opt("brand")] : Object.keys(doc.brands)
  for (const b of brands) if (!doc.brands[b]) die(`unknown brand ${b}; brands: ${Object.keys(doc.brands).join(", ")}`, 2)
  const out = brands.map((b) => {
    const cdn = loadBrand(b).cdn
    return { brand: b, cdn, pattern: `https://${CDN_HOST}/video/${cdn}/<type>/<subject>/<market>-<lang>/fb-9x16.mp4`, id: `${b}-<type>-<subject>-v<NNN>`,
      types: doc.brands[b].map((t) => ({ id: t, label: doc.types[t].label.en, say: doc.types[t].say.en, what: doc.types[t].hint.en, subject: doc.types[t].subject, defaults: doc.types[t].defaults })) }
  })
  if (has("json")) return console.log(JSON.stringify(opt("brand") ? out[0] : out, null, 2))
  for (const o of out) {
    console.log(`${o.brand}  id ${o.id}\n  url ${o.pattern}`)
    const w = Math.max(...o.types.map((t) => t.id.length)) + 2
    for (const t of o.types) console.log(`  ${t.id.padEnd(w)}${t.label.padEnd(14)}${t.defaults.length} ${t.defaults.ratio} ${t.defaults.platform.padEnd(10)} subject: ${t.subject.hint}`)
  }
}

const [cmd, ...rest] = pos()
const run = {
  init,
  status: () => status(rest[0]),
  set: () => setField(rest[0], rest[1], rest[2]),
  advance: () => advance(rest[0], rest[1]),
  approve: () => approve(rest[0]),
  cost: () => cost(rest[0]),
  issue: () => issue(rest[0]),
  order: () => orderCmd(rest[0], rest[1]),
  submit: () => submitCmd(rest[0], rest.slice(1)),
  ship: () => ship(rest[0]),
  url: () => urlCmd(rest[0]),
  types: typesCmd,
  lock: () => lockCmd(rest[0], rest[1]),
  unlock: () => unlockCmd(rest[0], rest[1]),
  plan: () => planCmd(rest[0]),
  mirror: () => mirrorCmd(rest[0]),
  build: () => build(rest[0]),
  index,
  validate: () => validateFile(rest[0]),
  readiness,
  list: listCmd,
  "from-reference": () => fromReferenceSeed(rest[0], rest[1]),
}[cmd]
if (!run) die("usage: produce <init|list|types|set|status|advance|approve|lock|unlock|plan|mirror|cost|issue|order|submit|url|build|ship|index|validate|readiness|from-reference> …  (see the header of this file)", 2)
run()
