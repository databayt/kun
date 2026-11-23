#!/usr/bin/env node
// station.mjs — the department station: a departure board, a switch and a conductor. Zero tokens.
//
//   node .claude/scripts/station.mjs board --dept video [--repo hogwarts] [--login abdout] [--health green|orange|red] [--lang ar|en] --json
//   node .claude/scripts/station.mjs fill <formula-id> --dept video [--repo r] [--login l] [--project <film id>] [--set k=v]… --json
//        (--project, or --set project=<id>, pins the film for every slot, ref and upload; an unknown id reports missing: ["project"])
//   node .claude/scripts/station.mjs questions <formula-id> --dept video [--repo r] [--set k=v]… [--lang en|ar] --json
//        (the slots still worth asking before Send, in the formula's `order`; --set slots are dropped; no model)
//   node .claude/scripts/station.mjs match "<text in any language>" --dept video [--repo r] --json
//   node .claude/scripts/station.mjs settings --dept video [--repo r] [--project <film>] --json
//        (the settings menu as data: tabs, groups, options, current value per choice, the sentence)
//   node .claude/scripts/station.mjs compose --dept video [--repo r] [--project <film>] [--set <choice>=<value>]… --json
//        (tab picks -> formula, route, record, formula slots, one sentence, keywords, tools; --set carries CHOICE keys)
//   node .claude/scripts/station.mjs stage <stage> --dept video --project <film> --json
//        (one stage's locked spec: current decisions, the questions worth asking, a summary, spec and file links)
//   node .claude/scripts/station.mjs lint [--dept video]       exit 1 and list every error
//   node .claude/scripts/station.mjs --test                    golden cases, deterministic, no network
//   node .claude/scripts/station.mjs --page                    the formula matrix between markers in content/docs/station.mdx
//
// A formula is departments/<dept>/formulas/<id>.md: one JSON header between two `---` lines, then the
// prompt in the fixed frame (Task · Context · References · Constraints · Deliverable) with {{slot}}
// tokens. The pack (departments/<dept>/pack.json) adds the department's `constraints`, the routes and
// the keywords. `board` picks at most three formulas for the home screen (waiting · next · start),
// `fill` turns one into the prompt, `match` maps typed text to a formula, no model anywhere.
//
// Rules this file keeps: Node built-ins only (teammates have the kun clone, no node_modules); macOS and
// Windows; it writes nothing except its own issue cache under ~/.claude/state/; a missing tool, no
// network or no `gh` means empty signals, never an error. STATION_FIXTURES=<dir> replaces every
// external read (produce, issues, markets, the log, the profile) with JSON files in that directory;
// STATION_TODAY=<yyyy-mm-dd> pins the date.

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const SELF = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(SELF), "../..")
const HOME = os.homedir()
const CDN_HOST = "cdn.databayt.org"
const GATES = ["script", "look", "version", "publish"]
const ROLES = ["waiting", "next", "start"]
const HEADINGS = ["Task", "Context", "References", "Constraints", "Deliverable"]
const DONE_STATUS = new Set(["done", "published", "archived", "cancelled", "closed"])
// What the Video ledger (the produce adapter) offers. A pack names its own under `ledger`; a pack whose
// `line` is "produce" and which declares none gets this (so Video needs no change). Any other pack gets
// the "none" adapter: no projects, no stage or gate vocabulary, signals from issues, sprint, drive, habit.
const STAGE_KEYS = ["request", "research", "brief", "script", "storyboard", "assets", "visual", "audio", "edit", "render", "qa", "approval", "cdn", "publish"] // the 14 produce stages
const PER_VARIANT = ["audio", "edit", "render", "qa", "approval", "cdn", "publish"] // mirrors produce.mjs
const PRODUCE_LEDGER = { adapter: "produce", gates: GATES, stages: STAGE_KEYS, new_label: { en: "New film", ar: "فيلم جديد" } }
const NO_LEDGER = { adapter: "none", gates: [], stages: [], new_label: null }
export const ledgerOf = (pack) => {
  const l = pack?.ledger
  if (l && typeof l === "object") {
    const base = l.adapter === "produce" ? PRODUCE_LEDGER : NO_LEDGER
    return { adapter: base.adapter, gates: Array.isArray(l.gates) ? l.gates : base.gates, stages: Array.isArray(l.stages) ? l.stages : base.stages, new_label: l.new_label ?? base.new_label }
  }
  return pack?.line === "produce" ? PRODUCE_LEDGER : NO_LEDGER
}
const DEFAULT_WEIGHTS = { waiting: 5, continue: 3, sprint: 3, drive: 2, due: 2, habit: 1 }
const CACHE_SECS = 300

// ---- small helpers ---------------------------------------------------------------------------
const expand = (p) => (typeof p === "string" ? p.replace(/^~(?=$|[\\/])/, HOME) : p)
const readText = (p) => {
  try {
    return fs.readFileSync(p, "utf8")
  } catch {
    return null
  }
}
const readJson = (p) => {
  const t = readText(p)
  if (t == null) return null
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}
const asList = (v) => (Array.isArray(v) ? v : [])
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) }
}
const slugify = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "piece"
const lineOf = (repo) => ({ hogwarts: "hogwarts", mkan: "mkan", kun: "databayt", databayt: "databayt" })[repo] ?? repo

function makeCtx(over = {}) {
  const fixtures = over.fixtures ?? process.env.STATION_FIXTURES ?? null
  const t = over.today ?? process.env.STATION_TODAY
  return { fixtures: fixtures ? path.resolve(fixtures) : null, today: t ? new Date(`${t}T12:00:00`) : new Date(), produceHome: process.env.PRODUCE_HOME || path.join(HOME, "media", "_projects") }
}
const fxJson = (ctx, name) => (ctx.fixtures ? readJson(path.join(ctx.fixtures, name)) : null)

// ---- Arabic-aware text normalising (match) -----------------------------------------------------
export function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}&]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}
const hasPhrase = (text, phrase) => {
  const t = norm(text)
  const p = norm(phrase)
  if (!p) return false
  if (/[؀-ۿ]/.test(p)) return t.includes(p)
  return ` ${t} `.includes(` ${p} `)
}

// ---- packs and formulas ----------------------------------------------------------------------
export function loadPack(dept) {
  return readJson(path.join(ROOT, "departments", dept, "pack.json"))
}
// A formatter that reads the header as YAML (prettier does, on every Edit) rewrites the object with
// a comma after its last member. That is still the same object, so drop those commas before
// JSON.parse — outside strings only.
export function dropTrailingCommas(src) {
  let out = ""
  let inString = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inString) {
      out += ch
      if (ch === "\\") out += src[++i] ?? ""
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    if (ch === ",") {
      let j = i + 1
      while (j < src.length && /\s/.test(src[j])) j++
      if (src[j] === "}" || src[j] === "]") continue
    }
    out += ch
  }
  return out
}
export function parseFormula(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (!m) throw new Error("no header between two --- lines")
  let header
  try {
    header = JSON.parse(dropTrailingCommas(m[1]))
  } catch (e) {
    throw new Error(`header is not valid JSON: ${e.message}`)
  }
  return { header, body: m[2].replace(/^\s+/, "").replace(/\s+$/, "") }
}
export function loadFormulas(dept) {
  const dir = path.join(ROOT, "departments", dept, "formulas")
  const formulas = []
  const errors = []
  let files = []
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
  } catch {}
  for (const file of files) {
    try {
      const { header, body } = parseFormula(fs.readFileSync(path.join(dir, file), "utf8"))
      formulas.push({ id: header.id, header, body, file })
    } catch (e) {
      errors.push(`${file}: ${e.message}`)
    }
  }
  return { formulas, errors }
}
const departments = () => {
  try {
    return fs.readdirSync(path.join(ROOT, "departments"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return []
  }
}

// ---- argv slot sources: node + a script under the kun repo or ~/.claude, no shell -----------------
const PRODUCE_REL = path.join(".claude", "skills", "produce", "scripts", "produce.mjs")
export function argvAllowed(argv) {
  if (!Array.isArray(argv) || argv.length < 2 || argv[0] !== "node" || argv.some((a) => typeof a !== "string")) return false
  const script = path.resolve(expand(argv[1]))
  if (!script.endsWith(".mjs")) return false
  return [ROOT, path.join(HOME, ".claude")].some((base) => script.startsWith(base + path.sep))
}
function runArgv(ctx, argv, timeout = 8000) {
  if (!argvAllowed(argv)) return null
  if (ctx.fixtures) {
    const map = fxJson(ctx, "argv.json") || {}
    const key = `${path.basename(argv[1])} ${argv.slice(2).join(" ")}`.trim()
    return typeof map[key] === "string" ? map[key] : null
  }
  try {
    const r = spawnSync(process.execPath, [path.resolve(expand(argv[1])), ...argv.slice(2)], { encoding: "utf8", timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
    return r.status === 0 ? r.stdout : null
  } catch {
    return null
  }
}
const produceArgv = (...rest) => {
  const home = path.join(HOME, ".claude", "skills", "produce", "scripts", "produce.mjs")
  const script = fs.existsSync(home) ? "~/.claude/skills/produce/scripts/produce.mjs" : path.join(ROOT, PRODUCE_REL)
  return ["node", script, ...rest]
}

// ---- state: projects, issues, log, profile ------------------------------------------------------
function currentStage(p) {
  if (!p) return null
  const shared = ["request", "research", "brief", "script", "storyboard", "assets", "visual"]
  if (shared.includes(p.next)) return p.next
  const v = (p.focus && p.focus[0]) || (p.variants && p.variants[0])
  for (const k of PER_VARIANT) {
    const s = p.variantStages?.[v]?.[k]
    if (!(s === "done" || s?.status === "done")) return k
  }
  return "publish"
}
function waitingGates(p) {
  const out = []
  const approved = (g) => asList(p.approvals).some((a) => a.gate === g && (!a.version || a.version === p.version))
  const done = (k) => p.stages?.[k]?.status === "done"
  if (done("script") && !approved("script")) out.push("script")
  if (done("visual") && !approved("look")) out.push("look") // the look gate follows the visual stage (produce approve --gate look)
  const vs = Object.values(p.variantStages ?? {})
  if (vs.some((s) => s?.qa === "done" || s?.qa?.status === "done") && !approved("version")) out.push("version")
  if (vs.some((s) => s?.cdn === "done" || s?.cdn?.status === "done") && !approved("publish")) out.push("publish")
  return out
}
function loadProduceProjects(ctx, repo) {
  let list = []
  if (ctx.fixtures) list = asList(fxJson(ctx, "projects.json"))
  else {
    const out = runArgv(ctx, produceArgv("list", "--json", ...(repo ? ["--repo", lineOf(repo)] : [])))
    try {
      list = asList(JSON.parse(out ?? "[]"))
    } catch {
      list = []
    }
    list = list.map((p) => ({ ...(readJson(path.join(ctx.produceHome, p.id, "project.json")) || {}), ...p }))
  }
  if (repo && ctx.fixtures) list = list.filter((p) => p.brand === lineOf(repo))
  return list.map((p) => ({
    ...p,
    variants: asList(p.variants).map((v) => (typeof v === "string" ? v : v.id)),
    locks: p.locks && typeof p.locks === "object" && !Array.isArray(p.locks) ? p.locks : {},
    locked_all: STAGE_KEYS.every((k) => p.locks?.[k]),
    next_stage: currentStage(p),
    waiting: waitingGates(p),
    dir: path.join(ctx.produceHome, p.id ?? ""),
  }))
}
const LEDGERS = { produce: loadProduceProjects, none: () => [] }
function loadProjects(ctx, ledger, repo) {
  return (LEDGERS[ledger?.adapter] ?? LEDGERS.none)(ctx, repo)
}
const isOpen = (p) => !DONE_STATUS.has(p.status)

function ghJson(args, timeout) {
  try {
    const r = spawnSync("gh", args, { encoding: "utf8", timeout, windowsHide: true })
    return r.status === 0 ? JSON.parse(r.stdout || "[]") : null
  } catch {
    return null
  }
}
// An open issue is "for" a login when it is assigned to them on GitHub OR carries the label `for:<login>`
// (a team member may have no GitHub account; `produce order --create` writes that label).
export function pickAssigned(list, login) {
  if (!login) return []
  const who = String(login).toLowerCase()
  const name = (x) => String(x?.login ?? x?.name ?? x ?? "").toLowerCase()
  return asList(list)
    .filter((i) => asList(i.assignees).some((a) => name(a) === who) || asList(i.labels).some((l) => name(l) === `for:${who}`))
    .map((i) => ({ number: i.number, title: i.title, url: i.url }))
}
const cacheFile = (dept, repo, login) => path.join(HOME, ".claude", "state", `station-issues-${slugify(dept)}-${slugify(repo || "all")}-${slugify(login || "anon")}.json`)
function fetchIssues(dept, repo, login) {
  const week = isoWeek(new Date())
  const sprint = `Sprint ${week.year}-W${String(week.week).padStart(2, "0")}`
  const data = { assigned: [], sprint: [] }
  // one call for the department's open issues; assignee and the for:<login> label are both read from it
  const open = login ? ghJson(["search", "issues", "--owner", "databayt", "--label", `dept:${dept}`, "--state", "open", "--json", "number,title,url,labels,assignees", "--limit", "100"], 1500) : []
  if (open) data.assigned = pickAssigned(open, login)
  const list = ghJson(["issue", "list", "--repo", `databayt/${repo || "kun"}`, "--state", "open", "--label", `dept:${dept}`, "--json", "number,title,url,labels,milestone", "--limit", "50"], 1500)
  if (list) data.sprint = list.filter((i) => i.milestone?.title === sprint).map((i) => ({ number: i.number, title: i.title, url: i.url, labels: asList(i.labels).map((l) => l.name) }))
  return data
}
// Stale-while-revalidate: a cache of any age answers at once; an old one is refreshed in the background.
function loadIssues(ctx, dept, repo, login) {
  const empty = { assigned: [], sprint: [] }
  if (ctx.fixtures) {
    const fx = fxJson(ctx, "issues.json") || empty
    const seen = new Set()
    const assigned = [...asList(fx.assigned), ...pickAssigned(fx.open, login)].filter((i) => !seen.has(i.number) && seen.add(i.number))
    return { ...fx, assigned, sprint: asList(fx.sprint) }
  }
  const file = cacheFile(dept, repo, login)
  const c = readJson(file)
  const now = Date.now()
  try {
    if (c && c.data) {
      if (now - (c.tried ?? c.ts ?? 0) > CACHE_SECS * 1000) {
        fs.writeFileSync(file, JSON.stringify({ ...c, tried: now }))
        spawn(process.execPath, [SELF, "refresh-issues", "--dept", dept, ...(repo ? ["--repo", repo] : []), ...(login ? ["--login", login] : [])], { detached: true, stdio: "ignore", windowsHide: true }).unref()
      }
      return c.data
    }
    // no cache yet: answer with empty signals now (the board must stay under 2 s) and fill the cache in the background
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ ts: 0, tried: now, data: empty }))
    spawn(process.execPath, [SELF, "refresh-issues", "--dept", dept, ...(repo ? ["--repo", repo] : []), ...(login ? ["--login", login] : [])], { detached: true, stdio: "ignore", windowsHide: true }).unref()
    return empty
  } catch {
    return empty
  }
}
function loadLog(ctx, dept) {
  const text = ctx.fixtures ? readText(path.join(ctx.fixtures, "log.jsonl")) : readText(path.join(HOME, ".kun", "machine", "station-log.jsonl"))
  const cutoff = ctx.today.getTime() - 14 * 86400000
  const counts = {}
  for (const line of (text ?? "").split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line)
      if ((e.dept && e.dept !== dept) || !e.id) continue
      if (e.ts && new Date(e.ts).getTime() < cutoff) continue
      const d = /^(pick|tap|start)/.test(e.event ?? e.action ?? "pick") ? 1 : /^(dismiss|clear|x)/.test(e.event ?? e.action ?? "") ? -1 : 0
      counts[e.id] = (counts[e.id] ?? 0) + d
    } catch {}
  }
  return counts
}
function loadProfile(ctx, login) {
  if (ctx.fixtures) return fxJson(ctx, "profile.json") || {}
  if (!login || !/^[a-z0-9-]+$/.test(login)) return {}
  return readJson(path.join(ROOT, "machines", `${login}.json`)) || {}
}
const machineOs = (profile) => ({ darwin: "macos", win32: "windows", linux: "linux" })[process.platform] ?? profile.os
const savedLogin = () => readJson(path.join(HOME, ".kun", "machine", "settings.json"))?.login || ""
const latestVideo = (ctx) => {
  if (ctx.fixtures) return (readText(path.join(ctx.fixtures, "latest-video.txt")) ?? "").trim() || null
  const dir = path.join(HOME, ".kun", "machine", "video")
  let best = null
  const walk = (d, depth) => {
    let ents = []
    try {
      ents = fs.readdirSync(d, { withFileTypes: true })
    } catch {}
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory() && depth < 2 && !e.name.startsWith(".")) walk(p, depth + 1)
      else if (/\.(mp4|mov|m4v|webm)$/i.test(e.name)) {
        const m = fs.statSync(p).mtimeMs
        if (!best || m > best.m) best = { p, m }
      }
    }
  }
  walk(dir, 0)
  return best?.p ?? null
}
const engineWeights = () => ({ ...DEFAULT_WEIGHTS, ...(readJson(path.join(ROOT, ".claude", "engine.json"))?.board?.weights ?? {}) })

// ---- slots -----------------------------------------------------------------------------------
const getPath = (obj, p) => {
  let cur = obj
  for (const k of String(p).split(".")) {
    if (cur == null) return undefined
    cur = cur[k]
  }
  return cur
}
const scalar = (v) => (v == null || typeof v === "object" ? (Array.isArray(v) ? v.join(", ") : null) : String(v))

// A choice slot may carry `options: [{ value, label?, sets }]`: picking an option sets other slots.
// matchOption: the option whose sets all equal what `read(slot)` gives, else the first.
function matchOption(options, read) {
  const hit = options.find((o) => o.sets && Object.entries(o.sets).every(([k, v]) => read(k) === String(v)))
  return hit ?? options[0] ?? null
}
// expandSets: apply the chosen option's sets to the other slots; an explicit --set of those slots wins.
function expandSets(f, set) {
  const out = { ...set }
  for (const [n, s] of Object.entries(f.header.slots ?? {})) {
    if (!Array.isArray(s.options) || set[n] === undefined || set[n] === "") continue
    const hit = s.options.find((o) => o.value === String(set[n]))
    for (const [k, v] of Object.entries(hit?.sets ?? {})) if (set[k] === undefined || set[k] === "") out[k] = String(v)
  }
  return out
}
// ---- company brief, brand kit, exec ------------------------------------------------------------------
// departments/_shared/company.md (generated by company-brief.mjs): `company.<first word of a heading>` reads that section as one line.
export function companySection(ctx, key) {
  const text = (ctx.fixtures ? readText(path.join(ctx.fixtures, "company.md")) : null) ?? readText(path.join(ROOT, "departments", "_shared", "company.md")) ?? ""
  const parts = text.split(/^## /m).slice(1)
  for (const part of parts) {
    const [head, ...body] = part.split("\n")
    if (head.trim().toLowerCase().split(/\s+/)[0] === key) return body.filter((l) => l.trim() && !l.startsWith("<!--")).join(" ").replace(/\s+/g, " ").trim() || null
  }
  return null
}
// brand slot: {"brand": "{{brand}}", "field": "logo|fonts|palette|voice|direction"} reads content/media/brand-kit.json -> production.<identity>.
// The identity is the open film's own (a film can wear another brand's face), else the slot's value, lowercased.
export const BRAND_FIELDS = ["logo", "fonts", "palette", "voice", "direction"]
const stripTodo = (t) => String(t ?? "").replace(/\s*\(blueprint[^)]*\)/gi, "").split(/(?<=[.;])\s+/).filter((x) => !/TODO/.test(x)).join(" ").replace(/[.;]\s*$/, "").trim()
const fontName = (f) => String(f).replace(/\.(ttf|otf|woff2?)$/i, "")
export function brandField(kit, identity, field, { link = false } = {}) {
  const b = kit?.production?.[identity]
  if (!b || b.status === "draft") return null
  if (field === "logo") return b.logo ? (link ? `https://github.com/databayt/kun/blob/main/${b.logo}` : path.join(ROOT, b.logo)) : null
  if (field === "fonts") {
    const f = b.fonts ?? {}
    const rows = [["Arabic headline", f.arabicHeadline], ["Arabic body", f.arabicBody], ["Latin", f.latin]].filter(([, v]) => v)
    return rows.length ? rows.map(([k, v]) => `${k} ${fontName(v)}`).join(" · ") : null
  }
  if (field === "palette") {
    const v = b.video ?? {}
    const rows = [["canvas", v.canvas], ["ink", v.ink], ["accent", v.accent], ["soft accent", v.accentSoft], ["caption background", v.captionBg], ["caption ink", v.captionInk]].filter(([, x]) => x)
    return rows.length ? rows.map(([k, x]) => `${k} ${x}`).join(" · ") : null
  }
  if (field === "voice") {
    const note = stripTodo(b.produce?.voiceNote)
    return b.voice ? `${b.voice}${note ? ` (${note})` : ""}` : null
  }
  if (field === "direction") return stripTodo(b.produce?.direction) || null
  return null
}
// exec slot: {"exec": "<id>", "with": {param: "{{slot}}"}}. The command is FIXED here, by id; a formula can only
// name an id and fill its parameters (letters, digits, dot, dash, underscore). No shell, node + a script under kun or ~/.claude.
const identOk = (v) => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v)
export function compactProjects(out) {
  let list = []
  try {
    list = asList(JSON.parse(out ?? "[]"))
  } catch {}
  const open = list.filter((p) => !DONE_STATUS.has(p.status)).slice(0, 5)
  if (!open.length) return "none open"
  return open.map((p) => `${p.id} (${[p.category, p.status, `next ${p.next}`, asList(p.variants).join("+")].filter(Boolean).join(", ")})`).join("; ")
}
export function compactStatus(out) {
  let j = null
  try {
    j = JSON.parse(out ?? "null")
  } catch {}
  if (!j?.id) return null
  const done = asList(j.stage_list).filter((s) => s.done).map((s) => s.key)
  return `${j.id}: ${done.length}/14 stages done (${done.join(", ") || "none"}); next ${j.next}`
}
export const EXEC = {
  projects: { params: ["line"], argv: (a) => produceArgv("list", "--json", "--repo", a.line), compact: compactProjects },
  status: { params: ["project"], argv: (a) => produceArgv("status", a.project, "--json"), compact: compactStatus },
}
export function execSlot(ctx, spec, params) {
  const e = EXEC[spec.exec]
  if (!e || !e.params.every((k) => identOk(params[k]))) return null
  const out = runArgv(ctx, e.argv(params))
  return out == null ? null : e.compact(out)
}

function makeResolver(ctx, f, inputs, state) {
  const memo = new Map()
  const missing = new Set()
  const uploads = []
  const slots = f.header.slots ?? {}
  const proj = state.project
  const tpl = (str, stack) => {
    let bad = false
    const out = String(str).replace(/\{\{(\w+)\}\}/g, (_, n) => {
      const v = get(n, stack)
      if (v == null) bad = true
      return v ?? ""
    })
    return bad ? null : out
  }
  const context = (key, spec) => {
    if (key === "repo") return inputs.repo
    if (key === "login") return inputs.login
    if (key === "today") return dayStr(ctx.today)
    if (key === "media.latest_video") return latestVideo(ctx)
    if (key.startsWith("company.")) return companySection(ctx, key.slice(8))
    if (key.startsWith("project.")) {
      if (!proj) return null
      const k = key.slice(8)
      if (k === "variants") return proj.variants.join(", ")
      if (k.startsWith("focus.")) return scalar((proj.focus ?? [])[Number(k.slice(6))] ?? (k === "focus.0" ? proj.variants[0] : null))
      return scalar(proj[k])
    }
    return null
  }
  const resolveSpec = (name, spec, stack) => {
    let v = null
    if (spec.context) v = context(spec.context, spec)
    else if (spec.choice) v = spec.default_by_repo?.[inputs.repo] ?? spec.default ?? spec.choice[0]
    else if (Array.isArray(spec.options)) v = matchOption(spec.options, (k) => get(k, stack))?.value ?? null
    else if (spec.json) {
      const fixture = ctx.fixtures ? fxJson(ctx, path.basename(spec.json)) : null
      const data = fixture ?? readJson(path.join(ROOT, spec.json))
      const p = tpl(spec.path, stack)
      if (data && p) v = scalar(getPath(data, p))
    } else if (spec.argv) {
      const args = spec.argv.map((a) => tpl(a, stack))
      if (args.every((a) => a != null)) {
        const out = runArgv(ctx, args)
        if (out != null) {
          if (spec.regex) v = new RegExp(spec.regex).exec(out)?.[1] ?? null
          else if (spec.pick) {
            try {
              v = scalar(getPath(JSON.parse(out), spec.pick))
            } catch {}
          } else v = out.trim() || null
        }
      }
    } else if (spec.brand) {
      const id = tpl(spec.brand, stack)
      const identity = (proj?.identity || id || "").toLowerCase()
      const fixture = ctx.fixtures ? fxJson(ctx, "brand-kit.json") : null
      const kit = fixture?.production ? fixture : readJson(path.join(ROOT, "content", "media", "brand-kit.json"))
      if (identity) v = brandField(kit, identity, spec.field, { link: f.header.record === "issue" })
    } else if (spec.exec) {
      const params = {}
      for (const [k, t] of Object.entries(spec.with ?? {})) params[k] = tpl(t, stack)
      v = execSlot(ctx, spec, params)
    } else if (spec.mul) {
      const nums = spec.mul.map((x) => (/^-?\d+(\.\d+)?$/.test(String(x)) ? Number(x) : Number(get(String(x), stack))))
      if (nums.length && nums.every((n) => Number.isFinite(n))) v = String(Math.round(nums.reduce((a, b) => a * b, 1) * 100) / 100)
    } else if (spec.map) {
      const k = get(spec.of, stack)
      v = k == null ? null : spec.map[k] ?? null
    } else if (spec.slug) {
      const k = get(spec.slug, stack)
      v = k == null ? null : slugify(k)
    } else if (spec.value) v = tpl(spec.value, stack)
    else if (spec.ref) {
      if (proj) {
        const refPath = tpl(spec.ref, stack)
        const local = refPath ? path.join(proj.dir, refPath) : null
        const exists = !local ? false : ctx.fixtures ? asList(proj.files).includes(refPath) : fs.existsSync(local)
        if (exists) {
          const key = `work/${proj.id}/ref/${refPath}`
          v = `https://${CDN_HOST}/${key}`
          uploads.push({ local, key, url: v })
        }
      }
    }
    if ((v == null || v === "") && spec.default != null && !spec.choice) v = spec.default
    return v
  }
  const get = (name, stack = []) => {
    if (memo.has(name)) return memo.get(name)
    if (stack.includes(name)) return null
    let v = null
    if (inputs.set[name] !== undefined && inputs.set[name] !== "") v = String(inputs.set[name])
    else if (slots[name]) v = resolveSpec(name, slots[name], [...stack, name])
    if (v == null || v === "") {
      missing.add(name)
      v = null
    }
    memo.set(name, v)
    return v
  }
  return { get, missing, uploads }
}

// ---- state for one ticket ------------------------------------------------------------------------
function loadState(ctx, dept, inputs) {
  const pin = inputs.project || inputs.set.project || ""
  // a pinned film is looked up across every repo; an unknown id never falls back to another project
  const all = loadProjects(ctx, ledgerOf(loadPack(dept)), pin ? "" : inputs.repo)
  const open = all.filter(isOpen)
  const project = pin ? all.find((p) => p.id === pin) || null : open[0] || null
  return { projects: all, open, project, pinned: pin || null }
}

// ---- fill ----------------------------------------------------------------------------------------
function addConstraints(body, lines) {
  const marks = [...body.matchAll(/^## Constraints\s*$/gm)]
  if (!marks.length || !lines.length) return body
  const start = marks[0].index
  const next = body.indexOf("\n## ", start + 5)
  const end = next < 0 ? body.length : next
  const section = body.slice(start, end).replace(/\s+$/, "")
  const extra = lines.filter((l) => !section.includes(l)).map((l) => `- ${l}`)
  return body.slice(0, start) + [section, ...extra].join("\n") + "\n" + body.slice(end).replace(/^\n*/, "\n")
}
export function fill(ctx, dept, id, input = {}) {
  const inputs = { repo: input.repo || "", login: input.login || (ctx.fixtures ? "" : process.env.KUN_LOGIN || savedLogin()), set: input.set || {}, project: input.project || "" }
  const pack = loadPack(dept) || {}
  const { formulas } = loadFormulas(dept)
  let f = formulas.find((x) => x.id === id)
  if (!f) return { id, prompt: "", route: pack.defaultRoute ?? "plan", record: "none", missing: [`formula ${id}`], redirected_from: null }
  const state = loadState(ctx, dept, inputs)
  let redirected = null
  // `redirects` is one {to, if} or a list; the first entry whose condition holds (and whose target exists) wins.
  // `new` is reserved: a new-film request is never handed to another formula, and it is never a slot.
  const rd = f.header.redirects
  if (rd && !inputs.set.new && state.project && isOpen(state.project)) {
    const type = inputs.set.film_type || f.header.slots?.film_type?.default
    for (const r of Array.isArray(rd) ? rd : [rd]) {
      const ok = r.if === "open_project" || (r.if === "open_project_same_type" && (!type || state.project.category === type)) || (r.if === "all_locked" && state.project.locked_all === true)
      const target = formulas.find((x) => x.id === r.to.replace("{stage}", state.project.next_stage))
      if (ok && target && target.id !== f.id) {
        redirected = f.id
        f = target
        break
      }
    }
  }
  inputs.set = expandSets(f, inputs.set)
  const r = makeResolver(ctx, f, inputs, state)
  let body = addConstraints(f.body, asList(pack.constraints))
  body = body.replace(/\{\{(\w+)\}\}/g, (_, n) => r.get(n) ?? `[unfilled: ${n}]`)
  if (state.pinned && !state.project) r.missing.add("project") // a pinned id that is not a known film: say so, never use another
  if (f.header.record !== "issue") body = body.replace(/(^|[\s`(])~\//gm, (_, p) => `${p}${HOME.replace(/\\/g, "/")}/`)
  return { id: f.id, prompt: body, route: f.header.route, record: f.header.record ?? "none", missing: [...r.missing].sort(), redirected_from: redirected, ...(englishOnly(pack) ? { lang: "en" } : {}), ...(f.header.model ? { model: f.header.model } : {}), ...(f.header.effort ? { effort: f.header.effort } : {}), ...(r.uploads.length ? { uploads: r.uploads } : {}) }
}

// ---- questions: what to ask before Send; no model, no network ---------------------------------------
// One entry per slot the person can still change, in the formula's `order` (header field, a list of slot
// names; when present it is also the whole list: slots it leaves out keep their defaults), else in
// header slot order. choice -> "choice", ask -> "ask", the `market` choice that market-derived slots
// read ({{market}}) -> "market" with options from content/media/markets.json. Everything else
// (context, map, json, argv, slug, value, ref, mul) and anything already in --set is skipped.
const humanise = (n) => n.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
const LANG_NAME = { ar: { en: "Arabic", ar: "العربية" }, en: { en: "English", ar: "الإنجليزية" } }
export function marketOptions(ctx) {
  const data = (ctx.fixtures ? fxJson(ctx, "markets.json") : null) ?? readJson(path.join(ROOT, "content", "media", "markets.json")) ?? {}
  return Object.entries(data)
    .filter(([, v]) => v && typeof v === "object" && v.name)
    .map(([value, v]) => {
      const langs = asList(v.langs)
      const price = v.price != null && v.currency ? `${v.price} ${v.currency}` : null
      const l = (lang) => [v.name?.[lang] ?? v.name?.en ?? value, langs.map((x) => LANG_NAME[x]?.[lang] ?? x).join(" + ") || null, price ? (lang === "ar" ? `${price} للطالب سنويًا` : `${price} per student per year`) : null].filter(Boolean).join(" · ")
      return { value, label: { en: l("en"), ar: l("ar") } }
    })
}
// A pack with `"lang": "en"` works in English: every client that reads `ar` gets the English text (the headers keep their
// ar keys for the other departments and the app chrome). The video department is one.
const englishOnly = (pack) => pack?.lang === "en"
const enQuestions = (r) => ({
  ...r,
  lang: "en",
  intro: r.intro ? { en: r.intro.en, ar: r.intro.en } : r.intro,
  questions: r.questions.map((x) => ({ ...x, q: { en: x.q.en, ar: x.q.en }, options: x.options.map((o) => ({ ...o, label: { en: o.label.en, ar: o.label.en } })) })),
})
export function questions(ctx, dept, id, input = {}) {
  const r = questionsRaw(ctx, dept, id, input)
  return englishOnly(loadPack(dept)) && !r.error ? enQuestions(r) : r
}
function questionsRaw(ctx, dept, id, input = {}) {
  const inputs = { repo: input.repo || "", login: input.login || (ctx.fixtures ? "" : process.env.KUN_LOGIN || savedLogin()), set: input.set || {}, project: input.project || "" }
  const { formulas } = loadFormulas(dept)
  const f = formulas.find((x) => x.id === id)
  if (!f) return { id, questions: [], error: `formula ${id}` }
  const slots = f.header.slots ?? {}
  inputs.set = expandSets(f, inputs.set)
  const r = makeResolver(ctx, f, inputs, loadState(ctx, dept, inputs))
  const marketRead = Object.values(slots).some((s) => slotRefs(s).has("market"))
  const names = Array.isArray(f.header.order) ? f.header.order : Object.keys(slots)
  const list = []
  for (const name of names) {
    const s = slots[name]
    if (!s || (inputs.set[name] !== undefined && inputs.set[name] !== "")) continue
    const kind = "choice" in s || Array.isArray(s.options) ? (name === "market" && marketRead ? "market" : "choice") : "ask" in s ? "ask" : null
    if (!kind) continue
    const q = s.q && s.q.en && s.q.ar ? { en: s.q.en, ar: s.q.ar } : kind === "ask" ? { en: humanise(String(s.ask)), ar: humanise(String(s.ask)) } : { en: `${humanise(name)}?`, ar: `${humanise(name)}؟` }
    let options = []
    let def = null
    if (kind === "market") options = marketOptions(ctx)
    else if (Array.isArray(s.options)) options = s.options.map((o) => ({ value: o.value, label: { en: o.label?.en ?? o.value, ar: o.label?.ar ?? o.value }, ...(o.sets ? { sets: o.sets } : {}) }))
    else if (kind === "choice") options = s.choice.map((v, i) => ({ value: v, label: { en: v, ar: asList(s.choice_ar)[i] ?? v } }))
    if (Array.isArray(s.options)) def = matchOption(s.options, (k) => { const t = slots[k]; return t?.default_by_repo?.[inputs.repo] ?? t?.default ?? t?.choice?.[0] })?.value ?? null
    else if (kind !== "ask") def = s.default_by_repo?.[inputs.repo] ?? s.default ?? s.choice[0]
    list.push({ slot: name, kind, q, options, default: def, current: r.get(name) })
  }
  const fillText = (t) => String(t).replace(/\{\{(\w+)\}\}/g, (_, n) => r.get(n) ?? `[unfilled: ${n}]`)
  const intro = f.header.intro ? { en: fillText(f.header.intro.en), ar: fillText(f.header.intro.ar) } : null
  return { id: f.id, intro, questions: list }
}

// ---- settings / compose / stage ------------------------------------------------------------------------
// The Video department's settings menu (departments/<dept>/settings.json) and its 14 stages (stages.json) as data,
// for the app. Zero tokens: the standard choices only, no model.
const deptJson = (dept, name) => readJson(path.join(ROOT, "departments", dept, name))
const uniq = (list) => [...new Set(list)]
const pad2 = (n) => String(n).padStart(2, "0")
const tabKeys = (doc) => uniq(asList(doc.tabs).flatMap((t) => asList(t.keys)))
// English-only pack: every `ar` mirrors `en`.
const bi = (pack, o) => (o == null ? null : englishOnly(pack) ? { en: o.en, ar: o.en } : { en: o.en, ar: o.ar ?? o.en })
const cdnRef = (film, rel) => `https://${CDN_HOST}/work/${film}/ref/${rel}`
// The locked spec of one stage: the film's own 00-plan folder, or the fixture's specs/ folder.
function specFile(ctx, proj, key) {
  const name = `${pad2(STAGE_KEYS.indexOf(key) + 1)}-${key}.spec.json`
  return ctx.fixtures ? path.join(ctx.fixtures, "specs", name) : path.join(proj.dir, "00-plan", name)
}
const readSpec = (ctx, proj, key) => (proj ? readJson(specFile(ctx, proj, key)) : null)
const findOption = (choice, value) => asList(choice?.options).find((o) => o.value === value)

export function settings(ctx, dept, input = {}) {
  const doc = deptJson(dept, "settings.json")
  if (!doc) return { error: "no settings" }
  const pack = loadPack(dept) || {}
  const L = (o) => bi(pack, o)
  let proj = null
  if (input.project) {
    proj = loadState(ctx, dept, { repo: input.repo || "", set: {}, project: input.project }).project
    if (!proj) return { error: `unknown film ${input.project}` }
  }
  const current = (key, choice) => readSpec(ctx, proj, choice.stage)?.decisions?.[key] ?? choice.default
  const tabs = asList(doc.tabs).map((t) => {
    const base = { id: t.id, label: L(t.label) }
    if (!t.keys) return { ...base, source: t.source ?? null }
    return {
      ...base,
      groups: t.keys.filter((k) => doc.choices?.[k]).map((k) => {
        const c = doc.choices[k]
        return {
          key: k,
          label: L(c.label),
          q: L(c.q),
          stage: c.stage,
          default: c.default,
          current: current(k, c),
          options: asList(c.options).map((o) => ({ value: o.value, label: L(o.label), say: L(o.say), hint: L(o.hint), when: o.when ?? null })),
        }
      }),
    }
  })
  return { dept, lang: englishOnly(pack) ? "en" : null, project: proj?.id ?? null, tabs, sentence: L(doc.sentence) }
}

export function compose(ctx, dept, input = {}) {
  const doc = deptJson(dept, "settings.json")
  if (!doc) return { error: "no settings" }
  const pack = loadPack(dept) || {}
  const choices = doc.choices ?? {}
  const given = input.set || {}
  const proj = input.project ? loadState(ctx, dept, { repo: input.repo || "", set: {}, project: input.project }).project : null
  if (input.project && !proj) return { error: `unknown film ${input.project}` }
  // With a film only `when: "film"` kinds are eligible and there is no default kind; without one, the new-film kinds.
  const eligible = (key, o) => key !== "kind" || (proj ? o.when === "film" : o.when !== "film")
  const unknown = []
  const picks = {}
  const chosen = {}
  for (const [k, v] of Object.entries(given)) {
    const o = choices[k] ? asList(choices[k].options).find((x) => x.value === String(v) && eligible(k, x)) : null
    if (!o) unknown.push(`${k}=${v}`)
  }
  for (const k of tabKeys(doc)) {
    const c = choices[k]
    if (!c) continue
    const asked = given[k] === undefined ? null : asList(c.options).find((x) => x.value === String(given[k]) && eligible(k, x))
    const o = asked ?? (k === "kind" && proj ? null : findOption(c, c.default))
    if (o) {
      picks[k] = o.value
      chosen[k] = o
    }
  }
  const kindOpt = chosen.kind ?? null
  const set = {}
  for (const o of Object.values(chosen)) for (const [k, v] of Object.entries(o.sets ?? {})) set[k] = String(v)
  const lineKeys = asList(doc.line?.keys).filter((k) => chosen[k])
  if (doc.line?.slot && lineKeys.length) set[doc.line.slot] = lineKeys.map((k) => chosen[k].line ?? `${k} ${chosen[k].value}`).join(" · ")
  if (proj) set.project = proj.id
  const formula = kindOpt?.formula ?? null
  if (formula && !proj) set.new = "1"
  const sentence = {}
  for (const lang of ["en", "ar"]) {
    const tpl = (englishOnly(pack) ? doc.sentence?.en : doc.sentence?.[lang]) ?? ""
    const say = (k) => (chosen[k] ? (englishOnly(pack) ? chosen[k].say?.en : chosen[k].say?.[lang]) ?? chosen[k].say?.en ?? "" : "")
    sentence[lang] = tpl
      .split(" · ")
      .map((seg) => {
        const holes = [...seg.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
        if (holes.length && holes.every((h) => !say(h))) return ""
        return seg.replace(/\{(\w+)\}/g, (_, h) => say(h)).replace(/\s+/g, " ").trim()
      })
      .filter(Boolean)
      .join(" · ")
  }
  const hdr = formula ? loadFormulas(dept).formulas.find((x) => x.id === formula)?.header : null
  const picked = Object.values(chosen)
  const missing = formula ? fill(ctx, dept, formula, { repo: input.repo, login: input.login, set, project: proj?.id ?? "" }).missing : []
  return {
    formula,
    route: hdr?.route ?? null,
    record: hdr ? hdr.record ?? "none" : null,
    picks,
    set,
    sentence,
    keywords: uniq(picked.flatMap((o) => asList(o.keywords))),
    tools: uniq(picked.flatMap((o) => asList(o.tools))),
    workflow: kindOpt?.workflow ?? null,
    missing,
    unknown,
  }
}

export function stage(ctx, dept, key, input = {}) {
  const st = deptJson(dept, "stages.json")
  const doc = deptJson(dept, "settings.json")
  if (!st || !doc) return { error: "no stages" }
  const def = asList(st.stages).find((x) => x.key === key)
  if (!def) return { error: `unknown stage ${key}` }
  if (!input.project) return { error: "stage needs --project <film>" }
  const pack = loadPack(dept) || {}
  const L = (o) => bi(pack, o)
  const proj = loadState(ctx, dept, { repo: input.repo || "", set: {}, project: input.project }).project
  if (!proj) return { error: `unknown film ${input.project}` }
  const specPath = specFile(ctx, proj, key)
  const spec = readJson(specPath)
  const lock = proj.locks?.[key] ?? null
  const decisions = spec?.decisions ?? {}
  const current = {}
  const questions = []
  const summary = []
  const tabOf = (k) => asList(doc.tabs).find((t) => asList(t.keys).includes(k))
  for (const k of asList(def.owns)) {
    const c = doc.choices?.[k]
    if (!c) continue
    const cur = decisions[k] ?? c.default
    current[k] = cur
    const opts = asList(c.options)
    const shown = findOption(c, cur)
    const label = shown ? L(shown.label).en : String(cur)
    if (opts.length >= 2 && opts.length <= 4) {
      const first = shown ? [shown] : [{ value: cur, label: { en: String(cur) } }]
      const rest = opts.filter((o) => o.value !== cur)
      questions.push({
        key: k,
        question: L(c.q).en,
        header: L(c.label).en.slice(0, 12),
        multiSelect: false,
        // The wizard takes 4 options at most: a typed value that is not an option still comes first.
        options: [...first, ...rest].slice(0, 4).map((o) => ({ value: o.value, label: L(o.label).en, description: L(o.hint)?.en ?? "" })),
      })
      summary.push(`${L(c.label).en}: ${label}`)
    } else summary.push(`${L(c.label).en}: ${label} (change it in the ${tabOf(k) ? L(tabOf(k).label).en : "settings"} tab)`)
  }
  const toolId = spec?.tool ?? def.tool
  const tool = st.tools?.[toolId]
  const toolLabel = tool?.label ?? toolId
  summary.push(`Tool: ${toolLabel}`)
  const file = def.file && !String(def.file).startsWith("(") ? def.file : null
  if (file) summary.push(`Output: ${file}`)
  const nn = pad2(def.n)
  return {
    film: proj.id,
    stage: key,
    n: def.n,
    group: def.group,
    label: L(def.label),
    ask: def.ask,
    gate: def.gate ?? null,
    done: proj.stages?.[key]?.status === "done",
    locked: !!lock,
    lock,
    current,
    tool: toolId,
    tool_label: toolLabel,
    lane: spec?.lane ?? def.lane,
    summary,
    questions,
    spec: fs.existsSync(specPath) ? specPath : null,
    spec_url: fs.existsSync(specPath) ? cdnRef(proj.id, `00-plan/${nn}-${key}.spec.json`) : null,
    file,
    // 08-render is never mirrored (masters ship to the video tier), so the render master has no work/ link
    file_url: file && !file.startsWith("08-render/") ? cdnRef(proj.id, file) : null,
  }
}

// Pure checks over the two data files. ctxInfo carries what they are checked against, so tests can pass small docs.
//   lintSettings: { formulas: [{id, header}], vocab: Set, skills: Set, tools: Set|null }
//   lintStages:   { settings, lanes: Set, formulaIds: Set }
export function lintSettings(doc, ctxInfo = {}) {
  const errors = []
  const e = (m) => errors.push(`settings.json: ${m}`)
  const choices = doc?.choices ?? {}
  const keys = Object.keys(choices)
  const formulas = asList(ctxInfo.formulas)
  const byId = new Map(formulas.map((f) => [f.id, f]))
  const slotNames = new Set(formulas.flatMap((f) => Object.keys(f.header?.slots ?? {})))
  const bil = (o) => o && typeof o.en === "string" && o.en && typeof o.ar === "string" && o.ar
  if (new RegExp("fa" + "ble", "i").test(JSON.stringify(doc ?? {}))) e("never name the escalate model")
  for (const t of asList(doc?.tabs)) {
    if (!t.id) e("a tab has no id")
    if (!bil(t.label)) e(`tab ${t.id}: label needs en and ar`)
    if (!t.keys && !t.source) e(`tab ${t.id}: needs keys or source`)
    for (const k of asList(t.keys)) if (!choices[k]) e(`tab ${t.id}: key "${k}" is not a choice`)
  }
  if (typeof doc?.line?.slot !== "string") e("line.slot must be a string")
  for (const k of asList(doc?.line?.keys)) if (!choices[k]) e(`line.keys: "${k}" is not a choice`)
  for (const m of String(doc?.sentence?.en ?? "").matchAll(/\{(\w+)\}/g)) if (!choices[m[1]]) e(`sentence.en: {${m[1]}} is not a choice`)
  for (const k of keys) {
    const c = choices[k]
    const at = (m) => e(`choice ${k}: ${m}`)
    if (!bil(c.label)) at("label needs en and ar")
    if (!bil(c.q)) at("q needs en and ar")
    if (!STAGE_KEYS.includes(c.stage)) at(`stage "${c.stage}" is not one of the 14 stages`)
    const opts = asList(c.options)
    if (!opts.length) at("no options")
    if (!opts.some((o) => o.value === c.default)) at(`default "${c.default}" is not an option value`)
    const seen = new Set()
    for (const o of opts) {
      const oa = (m) => e(`choice ${k}.${o.value}: ${m}`)
      if (seen.has(o.value)) oa("duplicate value")
      seen.add(o.value)
      if (!bil(o.label)) oa("label needs en and ar")
      if (!bil(o.say)) oa("say needs en and ar")
      if (o.when !== undefined && !["new", "film"].includes(o.when)) oa('when must be "new" or "film"')
      if (o.formula !== undefined) {
        const f = byId.get(o.formula)
        if (!f) oa(`formula ${o.formula} is not a formula of this department`)
        else {
          const phrases = asList(f.header?.triggers?.en).map((x) => String(x).toLowerCase())
          const say = String(o.say?.en ?? "").toLowerCase()
          if (!phrases.some((p) => say.includes(p))) oa(`say.en must contain a trigger of ${o.formula} (${phrases.join(" | ")})`)
        }
      }
      for (const sk of Object.keys(o.sets ?? {})) if (sk !== "new" && !slotNames.has(sk)) oa(`sets "${sk}" is no formula's slot`)
      if (ctxInfo.vocab || ctxInfo.skills) for (const kw of asList(o.keywords)) if (!ctxInfo.vocab?.has(kw) && !ctxInfo.skills?.has(kw)) oa(`keyword "${kw}" is neither a spell nor a skill`)
      if (ctxInfo.tools) for (const tl of asList(o.tools)) if (!ctxInfo.tools.has(tl)) oa(`tool "${tl}" is not in stages.json tools`)
    }
  }
  return errors
}

export function lintStages(doc, ctxInfo = {}) {
  const errors = []
  const e = (m) => errors.push(`stages.json: ${m}`)
  const stages = asList(doc?.stages)
  const tools = doc?.tools ?? {}
  const choices = ctxInfo.settings?.choices ?? {}
  if (new RegExp("fa" + "ble", "i").test(JSON.stringify(doc ?? {}))) e("never name the escalate model")
  if (stages.map((s) => s.key).join("|") !== STAGE_KEYS.join("|")) e(`stage keys must be ${STAGE_KEYS.join(", ")} in that order`)
  const laneOk = (lane) => (ctxInfo.lanes ? ctxInfo.lanes.has(lane) : true) && lane !== "escalate"
  stages.forEach((s, i) => {
    const at = (m) => e(`stage ${s.key}: ${m}`)
    if (s.n !== i + 1) at(`n must be ${i + 1}`)
    if (!["script", "agent"].includes(s.ask)) at('ask must be "script" or "agent"')
    if (s.gate !== null && !GATES.includes(s.gate)) at(`gate must be null or one of ${GATES.join(", ")}`)
    if (!laneOk(s.lane)) at(`lane "${s.lane}" is not a usable lane (a key of engine.json lanes, never escalate)`)
    if (!tools[s.tool]) at(`tool "${s.tool}" is not in tools`)
    for (const id of Object.values(s.pieces ?? {}).flat()) if (!tools[id]) at(`pieces: "${id}" is not in tools`)
    for (const k of asList(s.owns)) {
      if (!choices[k]) at(`owns "${k}", which is no choice in settings.json`)
      else if (choices[k].stage !== s.key) at(`owns "${k}", but that choice belongs to stage ${choices[k].stage}`)
    }
  })
  for (const [k, c] of Object.entries(choices)) {
    const owner = stages.find((s) => s.key === c.stage)
    if (owner && !asList(owner.owns).includes(k)) e(`choice ${k} says stage ${c.stage}, which does not own it`)
  }
  for (const [id, tl] of Object.entries(tools)) {
    if (!laneOk(tl.lane)) e(`tool ${id}: lane "${tl.lane}" is not a usable lane (a key of engine.json lanes, never escalate)`)
    if (tl.order !== undefined && ctxInfo.formulaIds && !ctxInfo.formulaIds.has(tl.order)) e(`tool ${id}: order ${tl.order} is not a formula`)
    if (tl.staged === true && !tl.price) e(`tool ${id}: a staged tool needs a price`)
  }
  return errors
}
function lintData(dept) {
  const errors = []
  const sFile = path.join(ROOT, "departments", dept, "settings.json")
  const tFile = path.join(ROOT, "departments", dept, "stages.json")
  const hasS = fs.existsSync(sFile)
  const hasT = fs.existsSync(tFile)
  if (!hasS && !hasT) return errors
  const settingsDoc = hasS ? readJson(sFile) : null
  const stagesDoc = hasT ? readJson(tFile) : null
  if (hasS && !settingsDoc) errors.push("settings.json is not valid JSON")
  if (hasT && !stagesDoc) errors.push("stages.json is not valid JSON")
  const { formulas } = loadFormulas(dept)
  const vocab = new Set(asList(readJson(path.join(ROOT, ".claude", "vocabulary.json"))?.schools).flatMap((sc) => asList(sc.spells).map((x) => x.name)))
  let skills = new Set()
  try {
    skills = new Set(fs.readdirSync(path.join(ROOT, ".claude", "skills"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name))
  } catch {}
  const lanes = new Set(Object.keys(readJson(path.join(ROOT, ".claude", "engine.json"))?.lanes ?? {}).filter((k) => !k.startsWith("$")))
  if (settingsDoc) errors.push(...lintSettings(settingsDoc, { formulas, vocab, skills, tools: stagesDoc ? new Set(Object.keys(stagesDoc.tools ?? {})) : null }))
  if (stagesDoc) errors.push(...lintStages(stagesDoc, { settings: settingsDoc, lanes, formulaIds: new Set(formulas.map((f) => f.id)) }))
  return errors
}

// ---- match ---------------------------------------------------------------------------------------
const DEPT_WORDS = {
  sales: ["sales", "مبيعات", "المبيعات"],
  marketing: ["marketing", "تسويق", "التسويق"],
  image: ["image", "images", "صوره", "الصوره", "صور"],
  tech: ["tech", "تقنيه", "التقنيه"],
  support: ["support", "دعم", "الدعم"],
  business: ["business", "اعمال", "الاعمال"],
  rnd: ["rnd", "r&d", "بحث وتطوير"],
  video: ["video", "فيديو", "الفيديو"],
}
function deptWords(d) {
  const p = loadPack(d) || {}
  const k = p.keywords ?? {}
  return [...new Set([d, ...asList(DEPT_WORDS[d]), ...asList(k.en), ...asList(k.ar)])]
}
// A hand-over sentence: "give|hand|assign|send <piece> to <login>" or "اعط|أعط|سلّم|سلم|كلّف <piece> لـ|ل|إلى <login>".
const HAND_EN = /\b(?:give|hand|assign|send)\s+(.+?)\s+to\s+@?([^\s.!?]+)\s*[.!?]*$/i
const HAND_AR = /(?:[اأإآ]عط|سل\u0651?م|كل\u0651?ف)\s+(.+?)\s+(?:ل\u0640?|[إا]لى)\s*@?([^\s.!؟?]+)\s*[.!؟?]*$/
// The words of the piece choose the work order: the formula whose id ends `.order.<kind>` in the department.
const HAND_KINDS = [
  ["blender", ["blender", "scene", "3d", "بلندر", "مشهد", "ثلاثي"]],
  ["filmcraft", ["filmcraft", "assembly", "assemble", "timeline", "تجميع"]],
  ["image", ["image", "picture", "still", "illustration", "صوره", "صورة"]],
  ["script", ["script", "سكربت", "نص"]],
  ["voice", ["voice", "voiceover", "narration", "تعليق", "صوت"]],
  ["capture", ["capture", "screen", "phone", "recording", "تصوير", "شاشه"]],
  ["review", ["review", "check", "مراجعه", "راجع", "فحص"]],
  ["call", ["call", "visit", "اتصال", "مكالمه", "زياره", "زيارة"]],
]
export function handOver(text) {
  const m = HAND_EN.exec(String(text).trim()) || HAND_AR.exec(String(text).trim())
  if (!m) return null
  const piece = m[1].trim().replace(/[.!?؟]+$/, "")
  const login = /^[a-z0-9][a-z0-9_-]*$/i.test(m[2]) ? m[2].toLowerCase() : null
  // the first keyword in the piece wins ("the script for scene two" is a script), then the most keywords
  const np = norm(piece)
  const kind = HAND_KINDS.map(([k, words]) => {
    const hits = words.filter((w) => hasPhrase(piece, w))
    return [k, hits.length, Math.min(...hits.map((w) => np.indexOf(norm(w))).filter((i) => i >= 0), Infinity)]
  }).filter(([, n]) => n).sort((x, y) => x[2] - y[2] || y[1] - x[1])[0]?.[0]
  return kind ? { kind, piece, to: login } : null
}
function matchIn(ctx, dept, text, repo) {
  const { formulas } = loadFormulas(dept)
  const scoped = (f) => !(repo && f.header.repos && !f.header.repos.includes(repo))
  const ho = handOver(text)
  if (ho) {
    const f = formulas.find((x) => scoped(x) && x.header.record === "issue" && x.id.endsWith(`.order.${ho.kind}`))
    if (f) {
      const set = {}
      if (ho.to) set.to = ho.to
      const slots = f.header.slots ?? {}
      for (const k of ["scene", "flow"]) if (slots[k]?.ask) set[k] = ho.piece
      if (slots.action?.choice) {
        const c = slots.action.choice.find((x) => hasPhrase(ho.piece, x) || hasPhrase(ho.piece, x.split(" ")[0]))
        if (c) set.action = c
      }
      return { id: f.id, confidence: ho.to ? 0.92 : 0.75, set }
    }
  }
  let best = null
  let open = null
  for (const f of formulas) {
    if (!scoped(f)) continue
    if (f.header.when?.stage_in) {
      open = open ?? loadState(ctx, dept, { repo, set: {} }).open
      if (!open.some((p) => f.header.when.stage_in.includes(p.next_stage))) continue
    }
    const trig = [...asList(f.header.triggers?.en), ...asList(f.header.triggers?.ar)]
    const hits = trig.filter((t) => hasPhrase(text, t))
    if (!hits.length) continue
    const top = hits.map((t) => norm(t)).sort((a, b) => b.length - a.length)[0]
    const words = top.split(" ").length
    const conf = clamp(0.5 + words * 0.15 + top.length / 100 + (hits.length - 1) * 0.05, 0, 0.99)
    const score = words * 100 + top.length
    if (!best || score > best.score) best = { id: f.id, confidence: Math.round(conf * 100) / 100, score }
  }
  return best ? { id: best.id, confidence: best.confidence, set: {} } : { id: null, confidence: 0, set: {} }
}
// Text that names another department is matched against THAT department's formulas: the answer carries
// its best id and confidence together with `dept` (id null when nothing there matches).
export function match(ctx, dept, text, repo) {
  const own = deptWords(dept).some((w) => hasPhrase(text, w))
  const other = own ? null : departments().filter((d) => d !== dept).find((d) => deptWords(d).some((w) => hasPhrase(text, w))) ?? null
  const r = matchIn(ctx, other ?? dept, text, repo)
  return { id: r.id, confidence: r.confidence, dept: other, set: r.set }
}

// ---- board ---------------------------------------------------------------------------------------
export function board(ctx, dept, input = {}) {
  const t0 = Date.now()
  const repo = input.repo || ""
  const login = input.login || ""
  const health = ["green", "orange", "red"].includes(input.health) ? input.health : "green"
  const res = { department: dept, repo: repo || null, ...(englishOnly(loadPack(dept)) ? { lang: "en" } : {}), options: [] }
  const profile = loadProfile(ctx, login)
  if (asList(profile.departments).length && !profile.departments.includes(dept)) return res
  const { formulas } = loadFormulas(dept)
  const ledger = ledgerOf(loadPack(dept))
  const weights = engineWeights()
  const state = loadState(ctx, dept, { repo, login, set: {} })
  const openP = state.open
  const waiting = new Set(openP.flatMap((p) => p.waiting))
  const waitingProject = (g) => openP.find((p) => p.waiting.includes(g))
  const issues = loadIssues(ctx, dept, repo, login)
  const log = loadLog(ctx, dept)
  const hidden = new Set(asList(profile.hidden))
  const myOs = machineOs(profile)
  const wd = ctx.today.getDay()

  const cands = []
  const lastResort = []
  for (const f of formulas) {
    const h = f.header
    if (h.board !== true) continue
    if (repo && h.repos && !h.repos.includes(repo)) continue
    if (hidden.has(h.id) || hidden.has(`formula:${h.id}`)) continue
    if (h.os && myOs && !h.os.includes(myOs)) continue
    if (health === "red" && asList(h.needs).includes("tools")) continue
    const w = h.when ?? {}
    if (w.project === "open" && !openP.length) continue
    if (w.gate && !waiting.has(w.gate)) continue
    if (w.assigned && !asList(issues.assigned).length) continue
    if (w.min_variants && !openP.some((p) => p.variants.length >= w.min_variants)) continue
    if (w.stage_in && !openP.some((p) => w.stage_in.includes(p.next_stage))) continue

    const sig = {}
    const why = []
    const set = {}
    if (w.gate) {
      sig.waiting = 1
      const p = waitingProject(w.gate)
      why.push(`waiting: ${w.gate} gate`)
      if (p) set.project = p.id
      set.gate = w.gate
    }
    if (w.assigned) {
      sig.waiting = 1
      const i = issues.assigned[0]
      why.push(`waiting: work order #${i.number}`)
      set.issue_url = i.url
    }
    if (w.project === "open" && !w.gate && !w.assigned) {
      sig.continue = 1
      why.push(`continue: open project ${openP[0].id}`)
      set.project = openP[0].id
    }
    const si = asList(issues.sprint).find((i) => asList(i.labels).includes(`formula:${h.id}`) || [...asList(h.triggers?.en), ...asList(h.triggers?.ar)].some((t) => hasPhrase(i.title, t)))
    if (si) {
      sig.sprint = 1
      why.push(`sprint: #${si.number}`)
    }
    sig.drive = clamp(Number(h.drive) || 0, 0, 1)
    if (sig.drive) why.push(`drive ${sig.drive}`)
    if (h.due?.weekdays?.includes(wd)) {
      sig.due = 1
      why.push("due today")
    }
    const hb = clamp((log[h.id] ?? 0) / 3, 0, 1)
    if (hb) {
      sig.habit = hb
      why.push("habit")
    }
    let score = Object.entries(sig).reduce((s, [k, v]) => s + (weights[k] ?? 0) * v, 0)
    if (health === "orange" && h.health_boost) {
      score += weights.due
      why.push("tools are orange")
    }
    // the new film never duplicates "Continue production": with a film open it becomes the generic "New film"
    let label = h.label
    if ([].concat(h.redirects ?? []).some((r) => r?.if === "open_project_same_type") && openP.length && ledger.new_label) {
      set.new = "1"
      label = ledger.new_label ?? label
    }
    const cand = { f, score, why, set, label, role: ROLES.includes(h.role) ? h.role : "next" }
    if (h.health_only && health === "green") lastResort.push(cand)
    else cands.push(cand)
  }
  const byScore = (a, b) => b.score - a.score || a.f.id.localeCompare(b.f.id)
  cands.sort(byScore)
  const chosen = []
  for (const role of ROLES) {
    let pick = null
    if (role === "start" && health === "red") pick = cands.find((c) => c.f.header.health_boost && c.role === "start")
    pick = pick ?? cands.find((c) => c.role === role && !chosen.includes(c))
    if (pick) chosen.push(pick)
  }
  for (const c of cands) if (chosen.length < 3 && !chosen.includes(c) && !(health === "red" && c.role === "start")) chosen.push(c)
  for (const c of lastResort.sort(byScore)) if (chosen.length < 3 && !(health === "red" && c.role === "start")) chosen.push(c)
  chosen.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || byScore(a, b))
  res.options = chosen.slice(0, 3).map((c) => ({
    role: c.role,
    id: c.f.id,
    label_en: c.label?.en ?? c.f.id,
    label_ar: englishOnly(loadPack(dept)) ? (c.label?.en ?? c.f.id) : (c.label?.ar ?? c.label?.en ?? c.f.id),
    icon: c.f.header.icon ?? "Circle",
    route: c.f.header.route,
    record: c.f.header.record ?? "none",
    score: Math.round(c.score * 100) / 100,
    why: c.why,
    set: c.set,
  }))
  res.ms = Date.now() - t0
  return res
}

// ---- lint ----------------------------------------------------------------------------------------
const LOCAL_PATH = /(^|[\s`'"(])(~\/|\/Users\/|\/home\/|[A-Za-z]:\\|file:\/\/)/
// What a formula's `record` may say: none (nothing is recorded), issue (a work order: one issue for one person),
// film (accepting this plan creates the film issue and its first work orders; no `to` slot, no submit line).
export const RECORDS = ["none", "issue", "film"]
export const unknownStages = (list, stages = STAGE_KEYS) => asList(list).filter((k) => !stages.includes(k))
const slotRefs = (spec) => {
  const s = JSON.stringify(spec)
  const out = new Set([...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
  if (spec.of) out.add(spec.of)
  if (spec.slug) out.add(spec.slug)
  for (const x of asList(spec.mul)) if (!/^-?\d+(\.\d+)?$/.test(String(x))) out.add(String(x))
  return out
}
const slotKind = (s) => ["context", "choice", "options", "json", "argv", "brand", "exec", "map", "slug", "value", "ask", "ref", "mul"].find((k) => k in s) ?? null
export const MODELS = ["opus", "sonnet", "haiku"]
export const EFFORTS = ["low", "medium", "high", "xhigh"]
// Optional question/model header fields: q (per slot, en + ar), choice_ar (per choice slot), order, model, effort.
export function lintExtras(h) {
  const errs = []
  const declared = h.slots ?? {}
  for (const [n, s] of Object.entries(declared)) {
    if (s.q !== undefined && !(s.q && typeof s.q.en === "string" && s.q.en.trim() && typeof s.q.ar === "string" && s.q.ar.trim())) errs.push(`slot "${n}": q needs en and ar strings`)
    if (s.options !== undefined) {
      const o = s.options
      if (!Array.isArray(o) || !o.length) errs.push(`slot "${n}": options must be a non-empty list`)
      else {
        const vals = new Set()
        for (const x of o) {
          if (!x || typeof x.value !== "string" || !x.value.trim()) errs.push(`slot "${n}": every option needs a string value`)
          else if (vals.has(x.value)) errs.push(`slot "${n}": duplicate option value "${x.value}"`)
          else vals.add(x.value)
          if (x?.label !== undefined && !(typeof x.label?.en === "string" && x.label.en.trim() && typeof x.label?.ar === "string" && x.label.ar.trim())) errs.push(`slot "${n}": option "${x.value}" label needs en and ar strings`)
          if (x?.sets !== undefined) {
            if (!x.sets || typeof x.sets !== "object" || Array.isArray(x.sets)) errs.push(`slot "${n}": option "${x.value}" sets must be an object`)
            else for (const [k, v] of Object.entries(x.sets)) {
              if (!declared[k] || k === n) errs.push(`slot "${n}": option "${x.value}" sets unknown slot "${k}"`)
              else if (Array.isArray(declared[k].choice) && !declared[k].choice.includes(String(v))) errs.push(`slot "${n}": option "${x.value}" sets ${k} to "${v}", not in its choice list`)
            }
          }
        }
      }
    }
    if (s.choice_ar !== undefined && !(Array.isArray(s.choice) && Array.isArray(s.choice_ar) && s.choice_ar.length === s.choice.length && s.choice_ar.every((x) => typeof x === "string"))) errs.push(`slot "${n}": choice_ar must match the choice list one to one`)
  }
  if (h.intro !== undefined && !(h.intro && typeof h.intro.en === "string" && h.intro.en.trim() && typeof h.intro.ar === "string" && h.intro.ar.trim())) errs.push("intro needs en and ar strings")
  if (h.order !== undefined) {
    if (!Array.isArray(h.order)) errs.push("order must be a list of slot names")
    else for (const n of h.order) if (!declared[n]) errs.push(`order: unknown slot "${n}"`)
  }
  if (h.model !== undefined && !MODELS.includes(h.model)) errs.push(`model must be one of ${MODELS.join(", ")}`)
  if (h.effort !== undefined && !EFFORTS.includes(h.effort)) errs.push(`effort must be one of ${EFFORTS.join(", ")}`)
  return errs
}
export function lint(dept) {
  const errors = []
  const pack = loadPack(dept)
  if (!pack) return [`departments/${dept}/pack.json missing or invalid`]
  const routes = new Set(asList(pack.routes).map((r) => r.id))
  const ledger = ledgerOf(pack)
  const { formulas, errors: parseErrors } = loadFormulas(dept)
  errors.push(...parseErrors)
  if (!formulas.length) errors.push(`${dept}: no formulas found`)
  for (const l of asList(pack.constraints)) if (typeof l !== "string" || !l.trim()) errors.push("pack.constraints must be non-empty strings")
  if (/^## Task/m.test(pack.formula?.en ?? "") === false) errors.push("pack.formula.en must be the frame (## Task first)")
  const seen = new Set()
  for (const f of formulas) {
    const h = f.header
    const e = (m) => errors.push(`${f.file}: ${m}`)
    if (typeof h.id !== "string" || !h.id.startsWith(`${dept}.`)) e(`id must start with "${dept}."`)
    else if (h.id + ".md" !== f.file) e(`id ${h.id} does not match the file name`)
    if (seen.has(h.id)) e(`duplicate id ${h.id}`)
    seen.add(h.id)
    if (!h.label?.en || !h.label?.ar) e("label needs en and ar")
    if (typeof h.icon !== "string" || !h.icon) e("icon missing")
    if (!routes.has(h.route)) e(`route "${h.route}" is not in the pack's routes (${[...routes].join(", ")})`)
    if (h.gate !== null && !ledger.gates.includes(h.gate)) e(`gate must be null${ledger.gates.length ? ` or one of ${ledger.gates.join(", ")}` : ` (the ${dept} ledger has no gates)`}`)
    if (!ROLES.includes(h.role)) e(`role must be one of ${ROLES.join(", ")}`)
    if (typeof h.board !== "boolean") e("board must be true or false")
    if (!RECORDS.includes(h.record)) e(`record must be one of ${RECORDS.join(", ")}`)
    if (typeof h.drive !== "number" || h.drive < 0 || h.drive > 1) e("drive must be a number from 0 to 1")
    if (typeof h.weight !== "number") e("weight must be a number")
    if (!h.when || typeof h.when !== "object") e("when must be an object")
    if (!asList(h.triggers?.en).length || !asList(h.triggers?.ar).length) e("triggers need en and ar lists")
    if (new RegExp("fa" + "ble", "i").test(JSON.stringify(h) + f.body)) e("never name the escalate model")
    const heads = [...f.body.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1])
    if (heads.join("|") !== HEADINGS.join("|")) e(`headings must be ${HEADINGS.join(" · ")} in that order (found: ${heads.join(" · ") || "none"})`)
    const declared = h.slots ?? {}
    const used = new Set([...(f.body + " " + JSON.stringify(h.intro ?? {})).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
    for (const u of used) if (!declared[u]) e(`slot {{${u}}} is used but not declared`)
    const refd = new Set(used)
    for (const [n, s] of Object.entries(declared)) for (const r of slotRefs(s)) if (r !== n) refd.add(r)
    for (const [n, s] of Object.entries(declared)) {
      if (!refd.has(n) && !(Array.isArray(s.options) && s.options.some((o) => o.sets))) e(`slot "${n}" is declared but never used`)
      const k = slotKind(s)
      if (!k) e(`slot "${n}" has no known source (context, choice, options, json, argv, brand, exec, map, slug, value, ask, ref, mul)`)
      for (const r of slotRefs(s)) if (!declared[r]) e(`slot "${n}" refers to undeclared slot {{${r}}}`)
      if (k === "argv" && !argvAllowed(s.argv.map((a) => (/\{\{\w+\}\}/.test(a) ? "x" : a)))) e(`slot "${n}": argv must be node + a script under the kun repo or ~/.claude`)
      if (k === "brand" && !BRAND_FIELDS.includes(s.field)) e(`slot "${n}": brand needs a field, one of ${BRAND_FIELDS.join(", ")}`)
      if (k === "exec") {
        const x = EXEC[s.exec]
        if (!x) e(`slot "${n}": exec "${s.exec}" is not allow-listed (${Object.keys(EXEC).join(", ")})`)
        else {
          const given = Object.keys(s.with ?? {})
          if (x.params.some((q) => !given.includes(q)) || given.some((q) => !x.params.includes(q))) e(`slot "${n}": exec "${s.exec}" takes exactly: ${x.params.join(", ")}`)
        }
      }
      if (k === "json" && !fs.existsSync(path.join(ROOT, s.json))) e(`slot "${n}": ${s.json} does not exist`)
      if (k === "choice" && s.default != null && !s.choice.includes(s.default)) e(`slot "${n}": default is not in the choice list`)
      if (h.record === "issue" && k === "context" && /^(project\.dir|media\.)/.test(s.context)) e(`record issue: slot "${n}" is a local path`)
    }
    for (const m of lintExtras(h)) e(m)
    if (h.record === "issue" && LOCAL_PATH.test(f.body)) e("record issue: the body names a local path; use links")
    if (h.record === "issue") {
      // submit: "cdn" (default) = files go to work/<project>/<issue>/<file>; "comment" = the result is a reply on the issue
      if (h.submit === "comment") {
        if (!/reply on this issue/i.test(f.body.split("## Deliverable")[1] ?? "")) e('record issue: Deliverable must say "Reply on this issue" (submit: comment)')
      } else if (!/work\/\{\{project\}\}\/<issue number>\//.test(f.body)) e("record issue: Deliverable must say where to submit (work/<film>/<issue>/<file>)")
      if (h.submit !== undefined && !["cdn", "comment"].includes(h.submit)) e('submit must be "cdn" or "comment"')
      if (!declared.to) e('record issue: a work order needs a "to" slot (the assignee)')
    }
    if (ledger.adapter === "none") for (const [n, s] of Object.entries(declared)) if (/^project\./.test(s.context ?? "")) e(`slot "${n}": the ${dept} ledger has no projects`)
    if (h.when?.stage_in !== undefined) {
      if (!Array.isArray(h.when.stage_in) || !h.when.stage_in.length) e("when.stage_in must be a non-empty list of stage keys")
      else for (const k of unknownStages(h.when.stage_in, ledger.stages)) e(`when.stage_in: unknown stage "${k}" (${ledger.stages.join(", ")})`)
    }
    if (h.redirects) {
      for (const rr of Array.isArray(h.redirects) ? h.redirects : [h.redirects]) {
        const re = new RegExp("^" + String(rr?.to).replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace("{stage}", "[a-z]+") + "$")
        if (!formulas.some((x) => re.test(x.id))) e(`redirects.to ${rr?.to} matches no formula`)
      }
    }
  }
  errors.push(...lintData(dept))
  for (const q of asList(pack.quickActions)) if (q.id && !seen.has(q.id)) errors.push(`pack.quickActions: id ${q.id} is not a formula`)
  const boardRoles = new Set(formulas.filter((f) => f.header.board).map((f) => f.header.role))
  for (const r of ROLES) if (!boardRoles.has(r)) errors.push(`no board formula with role "${r}"`)
  return errors
}

// ---- the formula matrix page ----------------------------------------------------------------------
export function matrix(dept) {
  const { formulas } = loadFormulas(dept)
  const rows = ["| Id | Label | Route | Role | Gate | Record | Board | Weight | Drive |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
  for (const f of formulas) {
    const h = f.header
    rows.push(`| \`${h.id}\` | ${h.label?.en} · ${h.label?.ar} | ${h.route} | ${h.role} | ${h.gate ?? "—"} | ${h.record} | ${h.board ? "yes" : "—"} | ${h.weight} | ${h.drive} |`)
  }
  return rows.join("\n")
}
// One sub-table per department that has a formulas/ folder, Video first.
export function matrixAll() {
  const depts = departments().filter((d) => fs.existsSync(path.join(ROOT, "departments", d, "formulas"))).sort((a, b) => (a === "video" ? -1 : b === "video" ? 1 : a.localeCompare(b)))
  return depts.map((d) => `### ${loadPack(d)?.title ?? d}\n\n${matrix(d)}`).join("\n\n")
}
const MARK_START = "{/* station:matrix:start */}"
const MARK_END = "{/* station:matrix:end */}"
function page() {
  const table = `${MARK_START}\n${matrixAll()}\n${MARK_END}`
  const file = path.join(ROOT, "content", "docs", "station.mdx")
  const text = readText(file)
  if (text == null || !text.includes(MARK_START) || !text.includes(MARK_END)) {
    console.log(table)
    return false
  }
  const a = text.indexOf(MARK_START)
  const b = text.indexOf(MARK_END) + MARK_END.length
  fs.writeFileSync(file, text.slice(0, a) + table + text.slice(b))
  console.log(`station: wrote the matrix into content/docs/station.mdx (${departments().filter((d) => fs.existsSync(path.join(ROOT, "departments", d, "formulas"))).length} departments)`)
  return true
}

// ---- tests ---------------------------------------------------------------------------------------
function runTests() {
  const FX = path.join(ROOT, ".claude", "scripts", "station.fixtures")
  const mk = (name) => makeCtx({ fixtures: path.join(FX, name), today: "2026-11-23" }) // a Monday
  let pass = 0
  const fails = []
  const t = (name, fn) => {
    try {
      const r = fn()
      if (r === false) throw new Error("false")
      pass++
      console.log(`  ok  ${name}`)
    } catch (e) {
      fails.push(name)
      console.log(`  FAIL ${name}: ${e.message}`)
    }
  }
  const eq = (a, b, m) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? "expected"} ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
  }
  const ok = (c, m) => {
    if (!c) throw new Error(m)
  }
  const sd = JSON.parse(fs.readFileSync(path.join(FX, "none", "markets.json"), "utf8")).sd

  t("lint: every formula is valid", () => eq(lint("video"), []))
  t("lint: q, order, model, effort are validated (no escalate model)", () => {
    eq(lintExtras({ slots: { a: { ask: "x", q: { en: "A?", ar: "أ؟" } } }, order: ["a"], model: "opus", effort: "high" }), [])
    ok(lintExtras({ slots: { a: { ask: "x", q: { en: "A?" } } } }).length === 1, "q needs ar")
    ok(lintExtras({ slots: { a: { ask: "x" } }, order: ["b"] }).length === 1, "order names a known slot")
    ok(lintExtras({ slots: {}, model: "fa" + "ble" }).length === 1, "that model is refused")
    ok(lintExtras({ slots: {}, effort: "max" }).length === 1, "effort is low to xhigh")
  })
  t("questions: film.plan asks audience, market, cut in order, with the intro", () => {
    const r = questions(mk("none"), "video", "video.film.plan", { repo: "hogwarts" })
    eq(r.questions.map((x) => x.slot), ["audience", "market", "cut"])
    eq(r.questions[1].kind, "market")
    ok(r.questions.every((x) => x.q.en && x.q.ar), "q in both languages")
    eq(r.questions[0].default, "school owners and principals")
    eq(r.intro.en, "An intro film for Balqalam, made from real app screens. Three quick questions to shape it.")
    eq(r.intro.ar, r.intro.en, "the video department works in English: ar carries the English text")
    eq(r.lang, "en")
    eq(questions(mk("none"), "video", "video.order.blender", { repo: "hogwarts" }).intro, null)
  })
  t("questions: cut options carry sets; default is the one matching the slot defaults", () => {
    const c = questions(mk("none"), "video", "video.film.plan", { repo: "hogwarts" }).questions[2]
    eq(c.options.length, 4)
    eq(c.options[1].sets, { platform: "Instagram", format: "vertical 9:16, mobile", length: "about 1:00" })
    ok(c.options.every((o) => o.label.en && o.label.ar), "labels")
    eq([c.default, c.current], ["film-2min-facebook", "film-2min-facebook"])
  })
  t("fill: cut sets expand; an explicit --set beats them", () => {
    const f = fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", set: { new: "1", cut: "reel-1min-instagram" } })
    ok(/Instagram · vertical 9:16, mobile · about 1:00/.test(f.prompt), "reel sets")
    eq(f.missing.includes("cut"), false)
    const g = fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", set: { new: "1", cut: "reel-1min-instagram", length: "about 0:30" } })
    ok(/Instagram · vertical 9:16, mobile · about 0:30/.test(g.prompt), "explicit length wins")
    const q = questions(mk("none"), "video", "video.film.plan", { repo: "hogwarts", set: { cut: "film-2min-youtube" } })
    ok(!q.questions.some((x) => x.slot === "cut"), "answered cut is dropped")
  })
  t("lint: options, sets and intro are validated; a selector with sets may be unused in the body", () => {
    eq(lintExtras({ slots: { p: { choice: ["a", "b"] }, c: { options: [{ value: "x", label: { en: "X", ar: "س" }, sets: { p: "b" } }] } }, intro: { en: "i", ar: "ا" } }), [])
    ok(lintExtras({ slots: { c: { options: [{ value: "x", sets: { nope: "1" } }] } } }).length === 1, "unknown set slot")
    ok(lintExtras({ slots: { p: { choice: ["a"] }, c: { options: [{ value: "x", sets: { p: "z" } }] } } }).length === 1, "set value not in choice")
    ok(lintExtras({ slots: {}, intro: { en: "i" } }).length === 1, "intro needs ar")
  })
  t("questions: market options carry sd and sa with price; --set drops a slot", () => {
    const m = questions(mk("none"), "video", "video.film.plan", { repo: "hogwarts" }).questions[1]
    ok(m.options.some((o) => o.value === "sd") && m.options.some((o) => o.value === "sa"), "sd and sa")
    ok(/Saudi/.test(m.options.find((o) => o.value === "sa").label.en) && /SAR/.test(m.options.find((o) => o.value === "sa").label.en), "Saudi label")
    eq(m.current, "sd")
    const r = questions(mk("none"), "video", "video.film.plan", { repo: "hogwarts", set: { audience: "teachers", market: "sa" } })
    ok(!r.questions.some((x) => x.slot === "audience" || x.slot === "market"), "set slots are dropped")
  })
  t("questions: ask slots are free text; --set market re-fills price and currency", () => {
    const o = questions(mk("none"), "video", "video.order.blender", { repo: "hogwarts" }).questions
    eq(o.map((x) => [x.slot, x.kind, x.options.length]), [["scene", "ask", 0], ["to", "ask", 0]])
    const f = fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", set: { market: "sa" } })
    ok(/24 SAR/.test(f.prompt), "SAR price")
    eq([f.model, f.effort], ["opus", "high"])
  })
  t("board, no project: start is the new film; at most three options in role order", () => {
    const b = board(mk("none"), "video", { repo: "hogwarts", login: "abdout" })
    eq(b.options.find((o) => o.role === "start")?.id, "video.film.plan")
    ok(b.options.length >= 1 && b.options.length <= 3, "0-3 options")
    const order = b.options.map((o) => ROLES.indexOf(o.role))
    eq(order, [...order].sort((x, y) => x - y), "role order")
    ok(b.options.every((o) => o.id && o.label_en && o.label_ar && o.icon && o.route && o.record && Array.isArray(o.why) && o.set), "option fields")
    ok(b.ms < 2000, "under 2 s")
  })
  t("board, film waiting at the script gate: waiting is the script review", () => {
    const b = board(mk("script-gate"), "video", { repo: "hogwarts", login: "abdout" })
    eq(b.options[0].role, "waiting")
    eq(b.options[0].id, "video.gate.script")
    ok(b.options[0].score >= 5, "waiting weight")
    eq(b.options[0].set.project, "hogwarts-demo-v001")
    ok(b.options.some((o) => o.id === "video.film.continue"), "continue is offered")
  })
  t("board, a work order assigned to the login: waiting is the pickup", () => {
    const b = board(mk("assigned"), "video", { repo: "hogwarts", login: "sedon" })
    eq(b.options[0].id, "video.order.pickup")
    ok(b.options[0].set.issue_url.startsWith("https://github.com/"), "issue link")
  })
  t("board --health red: tools check holds the start slot, nothing needs tools", () => {
    const b = board(mk("script-gate"), "video", { repo: "hogwarts", login: "abdout", health: "red" })
    eq(b.options.filter((o) => o.role === "start")[0].id, "video.tools.check")
    ok(!b.options.some((o) => ["video.film.continue", "video.reel.footage", "video.versions.fanout"].includes(o.id)), "no tool formula")
  })
  t("board, the profile hides a formula", () => {
    const ctx = mk("hidden")
    const b = board(ctx, "video", { repo: "hogwarts", login: "abdout" })
    ok(!b.options.some((o) => o.id === "video.film.plan"), "hidden formula is gone")
  })
  t("fill video.film.plan, hogwarts + sd: five headings in order, price from markets.json, no token left", () => {
    const r = fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout", set: { market: "sd" } })
    const heads = [...r.prompt.matchAll(/^## (.+)$/gm)].map((m) => m[1])
    eq(heads, HEADINGS)
    ok(r.prompt.includes(`${sd.price} ${sd.currency}`), "price and currency")
    ok(!r.prompt.includes("{{"), "no token")
    eq(r.missing, [])
    eq(r.route, "plan")
    ok(r.prompt.includes("Stop at every human gate"), "pack constraints appended")
    ok(r.prompt.startsWith("## Task"), "starts at Task")
  })
  t("fill a work order: no local path in References, links only, record issue", () => {
    const r = fill(mk("script-gate"), "video", "video.order.blender", { repo: "hogwarts", login: "abdout", set: { to: "sedon", scene: "classroom scene" } })
    eq(r.record, "issue")
    eq(r.missing, [])
    ok(r.prompt.includes("for sedon · ordered by abdout"), "assignee and orderer")
    const refs = r.prompt.split("## References")[1].split("## Constraints")[0]
    ok(!LOCAL_PATH.test(refs), "no local path")
    ok(/https:\/\/cdn\.databayt\.org\/work\//.test(refs), "CDN links")
    ok(r.prompt.includes("work/hogwarts-demo-v001/<issue number>/"), "where to submit")
    ok(Array.isArray(r.uploads) && r.uploads.length >= 2, "uploads listed for the app")
  })
  t("fill --project pins the film for context, refs, uploads and redirects; an unknown id is missing, never another film", () => {
    const ctx = mk("two-open")
    const base = { repo: "hogwarts", login: "abdout", set: { to: "sedon", scene: "x" } }
    const open = fill(ctx, "video", "video.order.blender", base) // unpinned: the first open film
    ok(open.prompt.includes("Film: hogwarts-first-v001"), "unpinned = first open")
    for (const how of [{ project: "hogwarts-second-v002" }, { set: { ...base.set, project: "hogwarts-second-v002" } }]) {
      const r = fill(ctx, "video", "video.order.blender", { ...base, ...how })
      ok(r.prompt.includes("Film: hogwarts-second-v002"), "context value")
      ok(r.prompt.includes("work/hogwarts-second-v002/ref/03-script/script.md"), "ref link")
      ok(!r.prompt.includes("hogwarts-first-v001"), "nothing from the other film")
      ok(r.uploads.length >= 1 && r.uploads.every((u) => u.key.startsWith("work/hogwarts-second-v002/") && u.local.includes("hogwarts-second-v002")), "uploads")
      eq(r.missing, [])
    }
    const rd = fill(ctx, "video", "video.film.continue", { repo: "hogwarts", login: "abdout", project: "hogwarts-second-v002" })
    eq(rd.id, "video.stage.assets", "redirect follows the pinned film's stage")
    const bad = fill(ctx, "video", "video.order.blender", { ...base, project: "hogwarts-nope-v009" })
    ok(bad.missing.includes("project"), "unknown id reported")
    ok(!bad.prompt.includes("hogwarts-first-v001") && !bad.prompt.includes("hogwarts-second-v002"), "no other film used")
  })
  t("fill: an unfillable slot is reported, never silent", () => {
    const r = fill(mk("script-gate"), "video", "video.order.blender", { repo: "hogwarts", login: "abdout" })
    ok(r.missing.includes("scene") && r.missing.includes("to"), "scene and to are missing")
    ok(r.prompt.includes("[unfilled: scene]"), "visible marker")
  })
  t("fill video.film.continue redirects to the current stage's formula", () => {
    const r = fill(mk("script-gate"), "video", "video.film.continue", { repo: "hogwarts", login: "abdout" })
    eq(r.redirected_from, "video.film.continue")
    eq(r.id, "video.stage.storyboard")
    ok(r.prompt.includes("hogwarts-demo-v001"), "project id")
    ok(/\.mjs advance hogwarts-demo-v001 storyboard/.test(r.prompt), "advance command")
  })
  t("fill video.film.plan with a same-type film already open redirects; --set new=1 does not", () => {
    const a = fill(mk("script-gate"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout" })
    eq(a.redirected_from, "video.film.plan")
    const b = fill(mk("script-gate"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout", set: { new: "1" } })
    eq(b.redirected_from, null)
  })
  t("fill a gate formula without a login reports it", () => {
    const r = fill(mk("script-gate"), "video", "video.gate.script", { repo: "hogwarts" })
    ok(r.missing.includes("login"), "login missing")
  })
  t("match: Arabic request for an intro video goes to the new film", () => {
    const m = match(mk("none"), "video", "فيديو تعريفي لهوغورتس السودان", "hogwarts")
    eq(m.id, "video.film.plan")
    ok(m.confidence >= 0.7, "confidence")
    eq(m.dept, null)
  })
  t("match: a text that names another department sets dept", () => {
    const m = match(mk("none"), "video", "write a sales proposal for a school", "hogwarts")
    eq(m.dept, "sales")
    eq(m.id, "sales.proposal.write") // the other department's own formula, since 2026-11-22
    const a = match(mk("none"), "video", "اعمل عرض مبيعات لمدرسة", "hogwarts")
    eq(a.dept, "sales")
  })
  t("match: a stage word reaches its stage; nonsense matches nothing", () => {
    eq(match(mk("none"), "video", "run the qa stage please", "").id, "video.stage.qa")
    eq(match(mk("none"), "video", "zzz qqq", "").id, null)
  })
  t("argv sources: only node + a script under the kun repo or ~/.claude", () => {
    ok(argvAllowed(["node", "~/.claude/skills/produce/scripts/produce.mjs", "list"]), "produce is allowed")
    ok(!argvAllowed(["bash", "-c", "ls"]), "bash is not")
    ok(!argvAllowed(["node", "/tmp/x.mjs"]), "a script elsewhere is not")
    ok(!argvAllowed(["node", "~/.claude/../x.mjs"]), "a path out of ~/.claude is not")
  })
  t("every order names the person it is for and who ordered it", () => {
    for (const k of ["blender", "capture", "script", "voice", "review"]) {
      const r = fill(mk("script-gate"), "video", `video.order.${k}`, { repo: "hogwarts", login: "abdout", set: { to: "sedon", scene: "x", flow: "x" } })
      ok(r.prompt.includes("for sedon · ordered by abdout"), `${k}: assignee and orderer`)
      ok(!r.missing.includes("to") && !r.missing.includes("login"), `${k}: to and login filled`)
    }
  })
  t("board: the fan-out is absent while the film is at visual, present at edit", () => {
    const v = board(mk("visual"), "video", { repo: "hogwarts", login: "abdout" })
    ok(!v.options.some((o) => o.id === "video.versions.fanout"), "absent at visual")
    const e = board(mk("edit"), "video", { repo: "hogwarts", login: "abdout" })
    ok(e.options.some((o) => o.id === "video.versions.fanout"), "present at edit")
    eq(match(mk("visual"), "video", "all versions", "hogwarts").id, null)
    eq(match(mk("edit"), "video", "all versions", "hogwarts").id, "video.versions.fanout")
  })
  t("lint rejects an unknown stage key in when.stage_in", () => {
    eq(unknownStages(["audio", "nonsense"]), ["nonsense"], "unknown stage found")
    const f = loadFormulas("video").formulas.find((x) => x.id === "video.versions.fanout")
    eq(unknownStages(f.header.when.stage_in), [], "shipped keys are valid")
    ok(!f.header.when.stage_in.includes("visual"), "per-variant stages only")
  })
  t("board: no weekly tools check (a Sunday, green); orange offers it; red holds the start slot", () => {
    const sun = makeCtx({ fixtures: path.join(FX, "none"), today: "2026-11-22" })
    ok(!board(sun, "video", { repo: "hogwarts", login: "abdout" }).options.some((o) => o.id === "video.tools.check"), "not on green")
    const org = board(mk("script-gate"), "video", { repo: "hogwarts", login: "abdout", health: "orange" })
    eq(org.options.find((o) => o.role === "start")?.id, "video.tools.check")
  })
  t("board: with a film open the start option is New film carrying set.new; without one it keeps its label", () => {
    const o = board(mk("script-gate"), "video", { repo: "hogwarts", login: "abdout" }).options.find((x) => x.id === "video.film.plan")
    ok(o, "offered")
    eq(o.label_en, "New film")
    eq(o.label_ar, "New film", "the video department works in English")
    eq(o.set.new, "1")
    const n = board(mk("none"), "video", { repo: "hogwarts", login: "abdout" }).options.find((x) => x.id === "video.film.plan")
    eq(n.label_en, "Intro film")
    ok(n.set.new === undefined, "no new flag")
    eq(fill(mk("script-gate"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout", set: { new: "1" } }).redirected_from, null)
  })
  // ---- sales: the second department on the contract (invented ids, no customer data) ----
  const sa = JSON.parse(fs.readFileSync(path.join(FX, "sales-none", "markets.json"), "utf8")).sa
  t("lint: both departments pass, and plain lint covers every department with formulas", () => {
    eq(lint("sales"), [])
    eq(lint("video"), [])
    const withFormulas = departments().filter((d) => fs.existsSync(path.join(ROOT, "departments", d, "formulas")))
    ok(withFormulas.includes("sales") && withFormulas.includes("video"), "both found")
  })
  t("ledger: video keeps produce, sales declares none", () => {
    eq(ledgerOf(loadPack("video")).adapter, "produce")
    eq(ledgerOf(loadPack("sales")).adapter, "none")
    eq(ledgerOf(loadPack("sales")).gates, [])
    eq(ledgerOf({}).adapter, "none")
  })
  t("board, sales with no issues: three next/start options, best drive first within a role", () => {
    const b = board(mk("sales-none"), "sales", { login: "abdout" })
    eq(b.options.length, 3)
    ok(b.options.every((o) => o.role === "next" || o.role === "start"), "no waiting without an order")
    eq(b.options.map((o) => o.id), ["sales.followup.today", "sales.reply.log", "sales.quote.school"])
    const order = b.options.map((o) => ROLES.indexOf(o.role))
    eq(order, [...order].sort((x, y) => x - y), "role order")
    const next = b.options.filter((o) => o.role === "next").map((o) => o.score)
    eq(next, [...next].sort((x, y) => y - x), "score order inside a role")
    ok(b.options.every((o) => o.why.some((w) => w.startsWith("drive"))), "drive explains each")
    ok(b.options.every((o) => o.id && o.label_en && o.label_ar && o.icon && o.route && o.record && Array.isArray(o.why) && o.set), "option fields")
  })
  t("board, sales with an open issue assigned to the login: waiting is the pickup", () => {
    const b = board(mk("sales-assigned"), "sales", { login: "ali" })
    eq(b.options[0].role, "waiting")
    eq(b.options[0].id, "sales.order.pickup")
    ok(b.options[0].set.issue_url.startsWith("https://github.com/"), "issue link")
    ok(b.options[0].score >= 5, "waiting weight")
    ok(b.options.length <= 3, "at most three")
  })
  t("fill sales.quote.school: 48 students in the Saudi market, total from markets.json, five headings", () => {
    const r = fill(mk("sales-none"), "sales", "sales.quote.school", { login: "abdout", set: { students: "48", market: "sa" } })
    const heads = [...r.prompt.matchAll(/^## (.+)$/gm)].map((m) => m[1])
    eq(heads, HEADINGS)
    const total = Math.round(sa.price * 48 * 100) / 100
    ok(r.prompt.includes(`${total} ${sa.currency}`), "total = price x students")
    ok(r.prompt.includes(`${sa.price} ${sa.currency} per student`), "unit price")
    ok(r.prompt.includes(`${total * 0.5} ${sa.currency} at signing`), "signing share")
    eq(r.missing, ["record_id"])
    ok(r.prompt.includes("[unfilled: record_id]"), "the asked slot is visible, not silent")
    ok(!r.prompt.replace("[unfilled: record_id]", "").includes("{{"), "no other token left")
    ok(r.prompt.includes("explicit yes") || r.prompt.includes("Nothing is sent"), "pack constraints appended")
    eq(r.route, "do")
    eq(r.record, "none")
  })
  t("fill sales.quote.school: the total follows the market (no hardcoded figure)", () => {
    const rw = JSON.parse(fs.readFileSync(path.join(FX, "sales-none", "markets.json"), "utf8")).rw
    const r = fill(mk("sales-none"), "sales", "sales.quote.school", { set: { students: "10", market: "rw", record_id: "crm-000" } })
    ok(r.prompt.includes(`${Math.round(rw.price * 10 * 100) / 100} ${rw.currency}`), "10 students in rw")
    eq(r.missing, [])
  })
  t("match: an Arabic follow-up phrase goes to the follow-up formula", () => {
    const m = match(mk("sales-none"), "sales", "من أتابع اليوم؟", "")
    eq(m.id, "sales.followup.today")
    ok(m.confidence >= 0.7, "confidence")
    eq(match(mk("sales-none"), "sales", "عرض سعر لمدرسة", "").id, "sales.quote.school")
    eq(match(mk("sales-none"), "sales", "اقترح مدارس نتواصل معها", "").id, "sales.leads.find")
    eq(match(mk("sales-none"), "sales", "zzz qqq", "").id, null)
  })
  t("a sales work order has no local path, names its assignee, records to an issue", () => {
    const r = fill(mk("sales-none"), "sales", "sales.order.call", { login: "abdout", set: { to: "ali", record_id: "crm-000" } })
    eq(r.record, "issue")
    eq(r.missing, [])
    ok(r.prompt.includes("for ali · ordered by abdout"), "assignee and orderer")
    ok(!LOCAL_PATH.test(r.prompt), "no local path")
    ok(!("uploads" in r), "nothing to upload")
    ok(/Reply on this issue/.test(r.prompt.split("## Deliverable")[1]), "says where to reply")
    ok(r.prompt.includes("crm-000"), "the CRM record id is the only reference to the school")
    const lacking = fill(mk("sales-none"), "sales", "sales.order.call", { login: "abdout" })
    ok(lacking.missing.includes("to") && lacking.missing.includes("record_id"), "to and record id are asked")
  })
  t("record: film is a valid record, carried by lint, board, fill and the page", () => {
    eq(RECORDS, ["none", "issue", "film"])
    eq(loadFormulas("video").formulas.find((f) => f.id === "video.film.plan").header.record, "film")
    eq(fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout" }).record, "film")
    eq(board(mk("none"), "video", { repo: "hogwarts", login: "abdout" }).options.find((o) => o.id === "video.film.plan").record, "film")
    ok(/video\.film\.plan` \|[^\n]*\| film \|/.test(matrix("video")), "the matrix shows film")
    eq(lint("video"), [], "film needs no to slot and no submit line")
  })
  t("orders by label: for:<login> counts like an assignee, in any department", () => {
    eq(board(mk("order-label"), "video", { repo: "hogwarts", login: "sedon" }).options[0].id, "video.order.pickup")
    ok(!board(mk("order-label"), "video", { repo: "hogwarts", login: "ali" }).options.some((o) => o.id === "video.order.pickup"), "someone else's label is not mine")
    eq(board(mk("order-assignee"), "video", { repo: "hogwarts", login: "sedon" }).options[0].id, "video.order.pickup")
    const b = board(mk("sales-label"), "sales", { login: "ali" })
    eq(b.options[0].id, "sales.order.pickup")
    ok(b.options[0].set.issue_url.endsWith("/issues/51"), "the labelled issue")
    eq(pickAssigned([{ number: 1, labels: ["for:sedon"] }, { number: 2, assignees: [{ login: "SEDON" }] }, { number: 3, labels: ["for:ali"] }], "sedon").map((i) => i.number), [1, 2])
  })
  t("look gate: a film with the visual stage done and no look approval shows the look review waiting", () => {
    const b = board(mk("look-gate"), "video", { repo: "hogwarts", login: "abdout" })
    eq(b.options[0].role, "waiting")
    eq(b.options[0].id, "video.gate.look")
    eq(b.options[0].set.gate, "look")
    ok(!board(mk("edit"), "video", { repo: "hogwarts", login: "abdout" }).options.some((o) => o.id === "video.gate.look"), "an approved look is not waiting")
    const r = fill(mk("look-gate"), "video", "video.gate.look", { repo: "hogwarts", login: "abdout" })
    ok(r.prompt.includes("approve hogwarts-demo-v001 --gate look"), "the look approve command")
    eq(r.missing, [])
  })
  t("match: a hand-over sentence picks the work order and returns the captured values", () => {
    const m = match(mk("none"), "video", "give the classroom scene to sedon", "hogwarts")
    eq(m.id, "video.order.blender")
    eq(m.set, { to: "sedon", scene: "the classroom scene" })
    ok(m.confidence >= 0.9, "confidence")
    eq(match(mk("none"), "video", "assign the voiceover to Ali", "hogwarts").id, "video.order.voice")
    eq(match(mk("none"), "video", "hand the script for scene two to ali", "hogwarts").id, "video.order.script")
    const c = match(mk("none"), "video", "send the phone capture of attendance to sedon", "hogwarts")
    eq(c.id, "video.order.capture")
    eq(c.set.flow, "the phone capture of attendance")
    eq(match(mk("none"), "video", "give the review of the render to ali", "hogwarts").id, "video.order.review")
    const ar = match(mk("none"), "video", "اعط مشهد الفصل لـsedon", "hogwarts")
    eq(ar.id, "video.order.blender")
    eq(ar.set.to, "sedon")
    eq(ar.set.scene, "مشهد الفصل")
    eq(match(mk("none"), "video", "سلّم السكربت إلى ali", "hogwarts").id, "video.order.script")
    const call = match(mk("sales-none"), "sales", "give the visit to ali", "")
    eq(call.id, "sales.order.call")
    eq(call.set, { to: "ali", action: "visit" })
    eq(match(mk("none"), "video", "send someone to visit", "").id, null, "no piece, no hand-over")
  })
  t("match: text naming another department is matched in that department, with dept set", () => {
    const m = match(mk("none"), "video", "sales quote a school for 48 students", "")
    eq(m.dept, "sales")
    eq(m.id, "sales.quote.school")
    ok(m.confidence > 0.5, "confidence")
    const n = match(mk("none"), "video", "sales zzz qqq", "")
    eq(n.dept, "sales")
    eq(n.id, null)
    eq(match(mk("none"), "video", "فيديو تعريفي", "").dept, null)
  })
  t("--page: one sub-table per department that has formulas", () => {
    const all = matrixAll()
    ok(/### Video/.test(all) && /### Sales/.test(all), "a heading per department")
    for (const d of ["video", "sales"]) for (const f of loadFormulas(d).formulas) ok(all.includes("`" + f.id + "`"), `${f.id} in the page`)
    ok(all.indexOf("### Video") < all.indexOf("### Sales"), "Video first")
  })
  t("exec: the plan formula reads the open projects at fill time, from a fixed allow-listed command", () => {
    const r = fill(mk("script-gate"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout", set: { new: "1" } })
    ok(r.prompt.includes("Open projects (hogwarts line): hogwarts-demo-v001 (intro, in-production, next storyboard, sd-ar+sd-en)"), "compact projects line")
    eq(r.missing, [])
    ok(fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout" }).prompt.includes("Open projects (hogwarts line): none open"), "no projects, no output: the default")
    const ctx = mk("script-gate")
    eq(execSlot(ctx, { exec: "projects" }, { line: "hogwarts" })?.startsWith("hogwarts-demo-v001"), true)
    eq(execSlot(ctx, { exec: "rm" }, { line: "hogwarts" }), null, "an id that is not allow-listed never runs")
    eq(execSlot(ctx, { exec: "projects" }, { line: "x; rm -rf ~" }), null, "a parameter with shell characters never runs")
    eq(execSlot(ctx, { exec: "projects" }, {}), null, "a missing parameter never runs")
    eq(Object.keys(EXEC), ["projects", "status"])
    eq(compactProjects("[]"), "none open")
    eq(compactProjects("not json"), "none open")
    eq(compactProjects(JSON.stringify([{ id: "a", status: "done" }, { id: "b", category: "intro", status: "draft", next: "brief", variants: ["sd-ar"] }])), "b (intro, draft, next brief, sd-ar)")
    eq(compactStatus(JSON.stringify({ id: "a", next: "script", stage_list: [{ key: "request", done: true }, { key: "script", done: false }] })), "a: 1/14 stages done (request); next script")
  })
  t("lint: an exec slot must name an allow-listed id with exactly its parameters; a brand slot needs a known field", () => {
    const f = loadFormulas("video").formulas.find((x) => x.id === "video.film.plan")
    eq(f.header.slots.projects, { exec: "projects", with: { line: "{{line}}" }, default: "none open" })
    ok(!Object.keys(EXEC).includes("sh"), "no shell entry")
    eq(BRAND_FIELDS, ["logo", "fonts", "palette", "voice", "direction"])
  })
  t("brand: logo, fonts, palette, voice fill from brand-kit.json production.<identity>; links in an order, a path elsewhere", () => {
    const kit = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "media", "brand-kit.json"), "utf8"))
    const b = kit.production.balqalam.video
    eq(brandField(kit, "balqalam", "palette"), `canvas ${b.canvas} · ink ${b.ink} · accent ${b.accent} · soft accent ${b.accentSoft} · caption background ${b.captionBg} · caption ink ${b.captionInk}`)
    ok(/^Arabic headline thmanyah-serif-display-900 · Arabic body thmanyah-sans-500 · Latin Geist$/.test(brandField(kit, "balqalam", "fonts")), "fonts without the file extension")
    eq(brandField(kit, "balqalam", "voice"), "house-ar")
    eq(brandField(kit, "balqalam", "logo", { link: true }), "https://github.com/databayt/kun/blob/main/public/brands/hogwarts.png")
    eq(brandField(kit, "balqalam", "logo"), path.join(ROOT, "public/brands/hogwarts.png"))
    ok(!/TODO/.test(brandField(kit, "hogwarts", "voice") + brandField(kit, "hogwarts", "direction")), "TODO text is never passed on")
    eq(brandField(kit, "nobody", "palette"), null)
    eq(brandField({ production: { x: { status: "draft", logo: "a.png" } } }, "x", "logo"), null, "a draft identity is never guessed")
    const o = fill(mk("script-gate"), "video", "video.order.blender", { repo: "hogwarts", login: "abdout", set: { to: "sedon", scene: "classroom scene" } })
    eq(o.missing, [])
    ok(o.prompt.includes("- Palette: canvas #faf9f5") && o.prompt.includes("accent #d97757"), "palette in the order")
    ok(o.prompt.includes("- Logo: https://github.com/databayt/kun/blob/main/public/brands/hogwarts.png"), "a link, not a local path, in an issue")
    ok(!LOCAL_PATH.test(o.prompt.split("## References")[1].split("## Constraints")[0]), "no local path")
    ok(/Per shot, set the camera, the lens/.test(o.prompt), "camera, lens, light per shot")
    eq([o.model, o.effort], ["sonnet", "medium"])
    eq(fill(mk("none"), "video", "video.order.blender", { repo: "hogwarts", set: { brand: "Mkan", to: "x", scene: "y" } }).prompt.includes("accent #e05638"), true, "the brand slot follows the identity")
  })
  t("video.order.filmcraft: assembles over the source voiceover, brand slots filled, an issue order on sonnet", () => {
    const r = fill(mk("script-gate"), "video", "video.order.filmcraft", { repo: "hogwarts", login: "abdout", set: { to: "sedon", scene: "the whole film" } })
    eq(r.record, "issue")
    eq(r.missing, [])
    eq([r.model, r.effort], ["sonnet", "medium"])
    ok(r.prompt.includes("Voiceover (the timing master): https://cdn.databayt.org/work/hogwarts-demo-v001/ref/07-audio/voiceover/sd-ar.wav"), "the focus variant's voiceover")
    ok(/`filmcraft` MCP/.test(r.prompt) && r.prompt.includes("Voice: house-ar"), "mcp + voice")
    ok(r.uploads.some((u) => u.key.endsWith("07-audio/voiceover/sd-ar.wav")), "the voiceover is uploaded for the person")
    ok(r.prompt.includes("work/hogwarts-demo-v001/<issue number>/"), "where to submit")
  })
  t("video.order.image: a ChatGPT-seat prompt with the palette and a 1088x1920 size, saved to 05-assets/images", () => {
    const r = fill(mk("script-gate"), "video", "video.order.image", { repo: "hogwarts", login: "abdout", set: { to: "sedon", scene: "the principal's desk at 7 am", style: "cinematic" } })
    eq(r.record, "issue")
    eq(r.missing, [])
    eq([r.model, r.effort], ["sonnet", "medium"])
    ok(r.prompt.includes("1088×1920") && r.prompt.includes("Documentary photography"), "size and style")
    ok(/Palette \(use these hex values\): canvas #faf9f5/.test(r.prompt), "palette hex in the prompt")
    ok(r.prompt.includes("05-assets/images/the-principal-s-desk-at-7-am.png"), "the save path")
    ok(/human-in-the-loop/.test(r.prompt), "the seat is a person")
    eq(questions(mk("script-gate"), "video", "video.order.image", { repo: "hogwarts" }).questions.map((x) => x.slot), ["scene", "to", "style"])
  })
  t("match: a hand-over of an image or an assembly picks the new orders", () => {
    eq(match(mk("none"), "video", "give the picture of the principal's desk to sedon", "hogwarts").id, "video.order.image")
    eq(match(mk("none"), "video", "give the filmcraft assembly to sedon", "hogwarts").id, "video.order.filmcraft")
    eq(match(mk("none"), "video", "give the classroom scene to sedon", "hogwarts").id, "video.order.blender", "blender still wins its own words")
  })
  t("company: the plan's Why this film comes from departments/_shared/company.md, within 40 lines", () => {
    const text = fs.readFileSync(path.join(ROOT, "departments", "_shared", "company.md"), "utf8")
    ok(text.trimEnd().split("\n").length <= 40, "40 lines or fewer")
    for (const k of ["Drive", "North Star", "Sprint", "Pilot", "Price"]) ok(text.includes(`## ${k === "Drive" ? "The Drive" : k}`), k)
    ok(/Al-Ibda/.test(text) && /24 SAR/.test(text) && /6\.4 USD/.test(text), "pilot and price")
    const r = fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts" })
    ok(r.prompt.includes("- Why this film: A film earns its place"), "context line")
    eq(companySection(mk("none"), "nothing"), null)
  })
  t("English only: the video pack asks, labels and fills in English; other departments keep ar", () => {
    eq(loadPack("video").lang, "en")
    const q = questions(mk("none"), "video", "video.film.plan", { repo: "hogwarts" })
    eq(q.lang, "en")
    ok(q.questions.every((x) => x.q.ar === x.q.en && x.options.every((o) => o.label.ar === o.label.en)), "ar carries the English text")
    eq(board(mk("none"), "video", { repo: "hogwarts", login: "abdout" }).options.every((o) => o.label_ar === o.label_en), true)
    eq(fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts" }).lang, "en")
    const forbidden = /person's (own )?language|in their (own )?language|if they wrote Arabic/i
    for (const f of loadFormulas("video").formulas) ok(!forbidden.test(f.body), `${f.id} still says the person's language`)
    for (const file of ["departments/video/prompt.md", "departments/_shared/ask.md"]) ok(!forbidden.test(fs.readFileSync(path.join(ROOT, file), "utf8")), file)
    ok(/Reply in English/.test(loadFormulas("video").formulas.find((x) => x.id === "video.film.plan").body), "plan constraint")
    ok(!/[\u0600-\u06FF]/.test(fs.readFileSync(path.join(ROOT, "departments/_shared/ask.md"), "utf8")), "ask.md is English")
    ok(questions(mk("sales-none"), "sales", "sales.quote.school", {}).lang === undefined, "sales is untouched")
  })
  t("source: the plan formula takes a source video and plans over its timing", () => {
    const body = loadFormulas("video").formulas.find((x) => x.id === "video.film.plan").body
    ok(body.includes("If a source video is given, it is the script and the voiceover; plan the picture over its timing."), "reference line")
    ok(body.includes("Write the plan in your reply only; do not write a plan file."), "no plan file")
    ok(/from-reference <ID> \{\{source\}\} --voiceover/.test(body), "turn 2 first step")
    const r = fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", set: { source: "/tmp/a.mp4" } })
    ok(r.prompt.includes("- Source video: /tmp/a.mp4") && r.prompt.includes("from-reference <ID> /tmp/a.mp4 --voiceover"), "source filled")
    ok(fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts" }).prompt.includes("- Source video: none"), "optional: none by default")
    eq(fill(mk("none"), "video", "video.film.plan", { repo: "hogwarts", project: "hogwarts-nope-v009" }).missing, ["project"], "a pinned project that is unknown is reported")
  })
  // ---- settings, compose, stage, the new lint ----
  t("settings: tabs in file order, ar mirrors en, current is the default without a film", () => {
    const r = settings(mk("none"), "video", { repo: "hogwarts" })
    eq(r.tabs.map((x) => x.id), ["film", "kind", "audience", "format", "style", "stages"])
    eq(r.tabs[0].source, "ledger")
    eq(r.project, null)
    for (const g of r.tabs.flatMap((x) => x.groups ?? [])) {
      eq(g.current, g.default, g.key)
      ok(g.label.ar === g.label.en && g.q.ar === g.q.en && g.options.every((o) => o.label.ar === o.label.en && o.say.ar === o.say.en), `${g.key} mirrors en`)
    }
    eq(r.sentence.ar, r.sentence.en)
    eq(r.tabs[1].groups[0].options[0].when, "new")
    eq(r.tabs[3].groups[0].options[0].hint === null || typeof r.tabs[3].groups[0].options[0].hint === "object", true)
    eq(settings(mk("none"), "sales", {}).error, "no settings")
  })
  t("settings --project reads the film's locked decisions", () => {
    const r = settings(mk("locked"), "video", { project: "hogwarts-locked-v001" })
    eq(r.project, "hogwarts-locked-v001")
    eq(r.tabs[4].groups.find((g) => g.key === "look").current, "3D")
    eq(r.tabs[4].groups.find((g) => g.key === "voice").current, "stock")
    ok(settings(mk("locked"), "video", { project: "nope" }).error, "unknown film")
  })
  t("compose: the defaults give the film plan, the exact settings line and the sentence", () => {
    const r = compose(mk("none"), "video", { repo: "hogwarts" })
    eq([r.formula, r.route, r.record, r.set.new], ["video.film.plan", "plan", "film", "1"])
    eq(r.set.settings, "1080p · 30 fps · version sd-ar · look mixed · voice stock voice · captions burned in · music brand bed")
    eq(r.sentence.en, "Intro film · school owners · Sudan Arabic · Facebook 9:16 · 2:00 · real screens + 3D · stock voice")
    eq(r.sentence.ar, r.sentence.en)
    eq([r.workflow, r.unknown], ["film-line", []])
    eq(r.missing, [])
  })
  t("compose: kind, ratio and bad keys", () => {
    const ctx = mk("none")
    eq(compose(ctx, "video", { repo: "hogwarts", set: { kind: "reel" } }).formula, "video.reel.footage")
    eq(compose(ctx, "video", { repo: "hogwarts", set: { ratio: "16:9" } }).set.format, "horizontal 16:9, desktop")
    const bad = compose(ctx, "video", { repo: "hogwarts", set: { nope: "1", ratio: "7:7", kind: "versions" } })
    eq(bad.unknown.length, 3)
    eq([bad.picks.ratio, bad.formula], ["9:16", "video.film.plan"], "defaults apply; a film kind is not eligible without a film")
  })
  t("compose --project: no kind means no formula; versions fan out", () => {
    const ctx = mk("locked")
    const a = compose(ctx, "video", { repo: "hogwarts", project: "hogwarts-locked-v001" })
    eq([a.formula, a.set.project, a.record, a.route], [null, "hogwarts-locked-v001", null, null])
    eq(a.missing, [])
    ok(a.picks.kind === undefined && a.set.new === undefined, "no kind, no new")
    const b = compose(ctx, "video", { repo: "hogwarts", project: "hogwarts-locked-v001", set: { kind: "versions" } })
    eq(b.formula, "video.versions.fanout")
    eq(compose(ctx, "video", { project: "hogwarts-locked-v001", set: { kind: "reel" } }).unknown, ["kind=reel"])
  })
  t("fill: new=1 skips redirects even with a same-type film open; without it the redirect fires", () => {
    const a = fill(mk("script-gate"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout" })
    eq(a.redirected_from, "video.film.plan")
    const b = fill(mk("script-gate"), "video", "video.film.plan", { repo: "hogwarts", login: "abdout", set: { new: "1" } })
    eq([b.redirected_from, b.id], [null, "video.film.plan"])
    ok(!b.prompt.includes('"new"') && !b.missing.includes("new"), "new is never a slot")
  })
  t("stage: a locked stage shows current decisions, questions and a summary", () => {
    const r = stage(mk("locked"), "video", "visual", { project: "hogwarts-locked-v001" })
    eq([r.locked, r.current.look, r.current.threed, r.n, r.ask, r.gate], [true, "3D", "order", 7, "agent", "look"])
    const q = r.questions.find((x) => x.key === "look")
    eq([q.options[0].value, q.options[0].label, q.header, q.multiSelect], ["3D", "3D", "Look", false])
    ok(r.summary.some((l) => l.startsWith("Look:")), "Look: line")
    ok(r.summary.some((l) => l.startsWith("Tool:")) && r.summary.at(-1) === "Output: 06-production/visual-manifest.json", "tool and output")
    eq(r.spec_url, "https://cdn.databayt.org/work/hogwarts-locked-v001/ref/00-plan/07-visual.spec.json")
    eq(r.file_url, "https://cdn.databayt.org/work/hogwarts-locked-v001/ref/06-production/visual-manifest.json")
    ok(r.spec && r.spec.endsWith("07-visual.spec.json"), "spec path")
  })
  t("stage: more than four options is a summary line, not a question; unknown stage is an error", () => {
    const r = stage(mk("locked"), "video", "request", { project: "hogwarts-locked-v001" })
    ok(!r.questions.some((x) => x.key === "version"), "no version question")
    ok(r.summary.some((l) => l.startsWith("Version:") && l.endsWith("(change it in the Audience tab)")), "summary line")
    ok(r.questions.some((x) => x.key === "audience"), "audience is a question")
    eq([r.spec, r.spec_url], [null, null])
    ok(stage(mk("locked"), "video", "nope", { project: "hogwarts-locked-v001" }).error, "unknown stage")
    ok(stage(mk("locked"), "video", "visual", { project: "nope" }).error, "unknown film")
    eq(stage(mk("locked"), "video", "approval", { project: "hogwarts-locked-v001" }).file_url, null)
  })
  t("stage: an unlocked film reports defaults", () => {
    const r = stage(mk("script-gate"), "video", "visual", { project: "hogwarts-demo-v001" })
    eq([r.locked, r.lock, r.current.look], [false, null, "mixed"])
  })
  t("redirect list: all_locked hands over to the run formula, otherwise to the stage formula", () => {
    const { formulas } = loadFormulas("video")
    const cont = formulas.find((x) => x.id === "video.film.continue")
    const hasList = Array.isArray(cont?.header.redirects) && cont.header.redirects.some((r) => r.if === "all_locked") && formulas.some((x) => x.id === "video.film.run")
    if (!hasList) console.log("  skip redirect list: video.film.continue / video.film.run are not on disk yet")
    else {
      eq(fill(mk("locked"), "video", "video.film.continue", { repo: "hogwarts", login: "abdout" }).id, "video.film.run")
      eq(fill(mk("script-gate"), "video", "video.film.continue", { repo: "hogwarts", login: "abdout" }).id, "video.stage.storyboard")
    }
    ok(mk("locked") && loadProduceProjects(mk("locked"), "hogwarts")[0].locked_all === true, "locked_all")
    eq(loadProduceProjects(mk("script-gate"), "hogwarts")[0].locks, {})
  })
  const miniFormulas = [{ id: "video.a", header: { triggers: { en: ["make a thing"] }, slots: { s1: {} } } }]
  const miniSettings = () => ({
    tabs: [{ id: "k", label: { en: "K", ar: "ك" }, keys: ["kind"] }],
    sentence: { en: "{kind}", ar: "{kind}" },
    line: { slot: "settings", keys: ["kind"] },
    choices: { kind: { label: { en: "K", ar: "ك" }, q: { en: "?", ar: "؟" }, stage: "request", default: "a", options: [{ value: "a", label: { en: "A", ar: "أ" }, say: { en: "Make a thing now", ar: "أ" }, formula: "video.a", sets: { s1: "x" } }] } },
  })
  t("lintSettings: a clean doc passes; unknown formula, stray sets key, bad stage, bad default are caught", () => {
    const info = { formulas: miniFormulas, vocab: new Set(["produce"]), skills: new Set(["shoot"]), tools: new Set(["t1"]) }
    eq(lintSettings(miniSettings(), info), [])
    const d = (fn) => { const x = miniSettings(); fn(x.choices.kind); return lintSettings(x, info) }
    ok(d((c) => (c.options[0].formula = "video.zzz")).length === 1, "unknown formula")
    ok(d((c) => (c.options[0].sets = { typo: "1" })).length === 1, "sets key is no slot")
    ok(d((c) => (c.options[0].sets = { new: "1" })).length === 0, "new is allowed")
    ok(d((c) => (c.options[0].say.en = "unrelated")).length === 1, "say must contain a trigger")
    ok(d((c) => (c.stage = "nope")).length === 1, "bad stage")
    ok(d((c) => (c.default = "z")).length === 1, "bad default")
    ok(d((c) => (c.options[0].keywords = ["nothing"])).length === 1, "unknown keyword")
    ok(d((c) => (c.options[0].tools = ["nothing"])).length === 1, "unknown tool")
    ok(d((c) => (c.options[0].when = "later")).length === 1, "bad when")
    ok(d((c) => c.options.push({ ...c.options[0] })).length >= 1, "duplicate value")
    const x = miniSettings()
    x.tabs[0].keys = ["ghost"]
    ok(lintSettings(x, info).length === 1, "tab key that is no choice")
  })
  const miniStages = () => ({
    stages: STAGE_KEYS.map((k, i) => ({ key: k, n: i + 1, ask: "script", gate: null, lane: "script", tool: "produce", owns: k === "request" ? ["kind"] : [] })),
    tools: { produce: { lane: "script" } },
  })
  const stageInfo = { settings: miniSettings(), lanes: new Set(["script", "build", "escalate"]), formulaIds: new Set(["video.a"]) }
  t("lintStages: a clean doc passes; missing stage, escalate lane, staged tool without price are caught", () => {
    eq(lintStages(miniStages(), stageInfo), [])
    const d = (fn) => { const x = miniStages(); fn(x); return lintStages(x, stageInfo) }
    ok(d((x) => x.stages.pop()).length >= 1, "missing stage key")
    ok(d((x) => (x.stages[1].lane = "escalate")).length === 1, "escalate lane")
    ok(d((x) => (x.tools.produce.lane = "escalate")).length === 1, "escalate tool lane")
    ok(d((x) => (x.tools.produce.staged = true)).length === 1, "staged without price")
    ok(d((x) => (x.tools.produce.order = "video.nope")).length === 1, "order is no formula")
    ok(d((x) => (x.stages[0].owns = [])).length === 1, "a choice nobody owns")
    ok(d((x) => (x.stages[2].tool = "ghost")).length === 1, "unknown tool")
    ok(d((x) => (x.stages[0].ask = "model")).length === 1, "bad ask")
    ok(d((x) => (x.stages[0].gate = "maybe")).length === 1, "bad gate")
    ok(d((x) => (x.stages[3].n = 9)).length === 1, "n out of order")
  })
  t("parity: STAGE_KEYS equals the STAGES table of produce.mjs", () => {
    const text = fs.readFileSync(path.join(ROOT, ".claude", "skills", "produce", "scripts", "produce.mjs"), "utf8")
    const table = text.slice(text.indexOf("export const STAGES = ["))
    const keys = [...table.slice(0, table.indexOf("].map(")).matchAll(/^\s*\["([a-z]+)",/gm)].map((m) => m[1])
    eq(keys, STAGE_KEYS)
    const st = readJson(path.join(ROOT, "departments", "video", "stages.json"))
    eq(st.stages.map((x) => x.key), STAGE_KEYS)
  })
  t("norm: Arabic forms fold together", () => eq(norm("إنتاج  فيديو"), norm("انتاج فيديو")))
  console.log(`station: ${pass} passed, ${fails.length} failed`)
  return fails.length === 0
}

// ---- cli -------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { _: [], set: {} }
  const val = new Set(["dept", "repo", "login", "health", "lang", "project"])
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x === "--set") {
      const kv = argv[++i] ?? ""
      const k = kv.indexOf("=")
      if (k > 0) a.set[kv.slice(0, k)] = kv.slice(k + 1)
    } else if (x.startsWith("--") && val.has(x.slice(2))) a[x.slice(2)] = argv[++i]
    else if (x.startsWith("--")) a[x.slice(2)] = true
    else a._.push(x)
  }
  return a
}
function out(a, obj, human) {
  if (a.json) console.log(JSON.stringify(obj, null, 2))
  else console.log(human(obj))
}
function main() {
  const a = parseArgs(process.argv.slice(2))
  const cmd = a._[0]
  const ctx = makeCtx()
  const dept = a.dept || "video"
  if (a.test || cmd === "selftest") process.exit(runTests() ? 0 : 1)
  if (a.page) return void page()
  if (cmd === "refresh-issues") {
    const data = fetchIssues(dept, a.repo || "", a.login || "")
    const file = cacheFile(dept, a.repo, a.login)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), tried: Date.now(), data }))
    return
  }
  if (cmd === "lint") {
    const depts = a.dept ? [a.dept] : departments().filter((d) => fs.existsSync(path.join(ROOT, "departments", d, "formulas")))
    let bad = 0
    for (const d of depts) {
      const errs = lint(d)
      bad += errs.length
      for (const e of errs) console.error(`station lint (${d}): ${e}`)
      if (!errs.length) console.log(`station lint (${d}): ${loadFormulas(d).formulas.length} formulas ok`)
    }
    process.exit(bad ? 1 : 0)
  }
  try {
    if (cmd === "board") return out(a, board(ctx, dept, { repo: a.repo, login: a.login, health: a.health, lang: a.lang }), (r) => r.options.map((o) => `${o.role.padEnd(8)}${o.id.padEnd(26)}${o.score}  ${o.why.join(", ")}`).join("\n"))
    if (cmd === "fill") return out(a, fill(ctx, dept, a._[1], { repo: a.repo, login: a.login, set: a.set, project: a.project }), (r) => r.prompt + (r.missing.length ? `\n\n(missing: ${r.missing.join(", ")})` : ""))
    if (cmd === "questions") return out(a, questions(ctx, dept, a._[1], { repo: a.repo, login: a.login, set: a.set, project: a.project }), (r) => r.questions.map((x) => `${x.slot} [${x.kind}] ${x.q.en} (current: ${x.current ?? "-"})`).join("\n"))
    if (cmd === "settings") return out(a, settings(ctx, dept, { repo: a.repo, project: a.project }), (r) => (r.error ? r.error : r.tabs.map((t) => t.id).join(" · ")))
    if (cmd === "compose") return out(a, compose(ctx, dept, { repo: a.repo, login: a.login, set: a.set, project: a.project }), (r) => (r.error ? r.error : `${r.formula ?? "no formula"}\n${r.sentence.en}`))
    if (cmd === "stage") return out(a, stage(ctx, dept, a._[1], { repo: a.repo, project: a.project }), (r) => (r.error ? r.error : r.summary.join("\n")))
    if (cmd === "match") return out(a, match(ctx, dept, a._.slice(1).join(" "), a.repo), (r) => `${r.id ?? "none"} (${r.confidence})${r.dept ? ` dept=${r.dept}` : ""}`)
  } catch (e) {
    // never fail loudly: the app reads JSON and treats an empty answer as "nothing to show"
    console.log(JSON.stringify({ error: String(e?.message ?? e), department: dept, options: [] }))
    return
  }
  console.error("usage: station.mjs board|fill|questions|match|settings|compose|stage|lint|selftest|--page  (see the header of this file)")
  process.exit(2)
}
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main()
