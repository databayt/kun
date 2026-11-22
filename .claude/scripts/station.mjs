#!/usr/bin/env node
// station.mjs — the department station: a departure board, a switch and a conductor. Zero tokens.
//
//   node .claude/scripts/station.mjs board --dept video [--repo hogwarts] [--login abdout] [--health green|orange|red] [--lang ar|en] --json
//   node .claude/scripts/station.mjs fill <formula-id> --dept video [--repo r] [--login l] [--project <film id>] [--set k=v]… --json
//        (--project, or --set project=<id>, pins the film for every slot, ref and upload; an unknown id reports missing: ["project"])
//   node .claude/scripts/station.mjs match "<text in any language>" --dept video [--repo r] --json
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
const cacheFile = (dept, repo, login) => path.join(HOME, ".claude", "state", `station-issues-${slugify(dept)}-${slugify(repo || "all")}-${slugify(login || "anon")}.json`)
function fetchIssues(dept, repo, login) {
  const week = isoWeek(new Date())
  const sprint = `Sprint ${week.year}-W${String(week.week).padStart(2, "0")}`
  const data = { assigned: [], sprint: [] }
  const assigned = login ? ghJson(["search", "issues", "--owner", "databayt", "--assignee", login, "--label", `dept:${dept}`, "--state", "open", "--json", "number,title,url,repository", "--limit", "20"], 1500) : []
  if (assigned) data.assigned = assigned.map((i) => ({ number: i.number, title: i.title, url: i.url }))
  const list = ghJson(["issue", "list", "--repo", `databayt/${repo || "kun"}`, "--state", "open", "--label", `dept:${dept}`, "--json", "number,title,url,labels,milestone", "--limit", "50"], 1500)
  if (list) data.sprint = list.filter((i) => i.milestone?.title === sprint).map((i) => ({ number: i.number, title: i.title, url: i.url, labels: asList(i.labels).map((l) => l.name) }))
  return data
}
// Stale-while-revalidate: a cache of any age answers at once; an old one is refreshed in the background.
function loadIssues(ctx, dept, repo, login) {
  const empty = { assigned: [], sprint: [] }
  if (ctx.fixtures) return fxJson(ctx, "issues.json") || empty
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
        const local = path.join(proj.dir, spec.ref)
        const exists = ctx.fixtures ? asList(proj.files).includes(spec.ref) : fs.existsSync(local)
        if (exists) {
          const key = `work/${proj.id}/ref/${spec.ref}`
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
  const rd = f.header.redirects
  if (rd && !inputs.set.new && state.project && isOpen(state.project)) {
    const type = inputs.set.film_type || f.header.slots?.film_type?.default
    const ok = rd.if === "open_project" || (rd.if === "open_project_same_type" && (!type || state.project.category === type))
    const target = formulas.find((x) => x.id === rd.to.replace("{stage}", state.project.next_stage))
    if (ok && target && target.id !== f.id) {
      redirected = f.id
      f = target
    }
  }
  const r = makeResolver(ctx, f, inputs, state)
  let body = addConstraints(f.body, asList(pack.constraints))
  body = body.replace(/\{\{(\w+)\}\}/g, (_, n) => r.get(n) ?? `[unfilled: ${n}]`)
  if (state.pinned && !state.project) r.missing.add("project") // a pinned id that is not a known film: say so, never use another
  if (f.header.record !== "issue") body = body.replace(/(^|[\s`(])~\//gm, (_, p) => `${p}${HOME.replace(/\\/g, "/")}/`)
  return { id: f.id, prompt: body, route: f.header.route, record: f.header.record ?? "none", missing: [...r.missing].sort(), redirected_from: redirected, ...(r.uploads.length ? { uploads: r.uploads } : {}) }
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
export function match(ctx, dept, text, repo) {
  const own = deptWords(dept).some((w) => hasPhrase(text, w))
  const other = own ? null : departments().filter((d) => d !== dept).find((d) => deptWords(d).some((w) => hasPhrase(text, w))) ?? null
  if (other) return { id: null, confidence: 0, dept: other }
  const { formulas } = loadFormulas(dept)
  let best = null
  let open = null
  for (const f of formulas) {
    if (repo && f.header.repos && !f.header.repos.includes(repo)) continue
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
  return best ? { id: best.id, confidence: best.confidence, dept: null } : { id: null, confidence: 0, dept: null }
}

// ---- board ---------------------------------------------------------------------------------------
export function board(ctx, dept, input = {}) {
  const t0 = Date.now()
  const repo = input.repo || ""
  const login = input.login || ""
  const health = ["green", "orange", "red"].includes(input.health) ? input.health : "green"
  const res = { department: dept, repo: repo || null, options: [] }
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
    if (h.redirects?.if === "open_project_same_type" && openP.length && ledger.new_label) {
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
    label_ar: c.label?.ar ?? c.label?.en ?? c.f.id,
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
export const unknownStages = (list, stages = STAGE_KEYS) => asList(list).filter((k) => !stages.includes(k))
const slotRefs = (spec) => {
  const s = JSON.stringify(spec)
  const out = new Set([...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
  if (spec.of) out.add(spec.of)
  if (spec.slug) out.add(spec.slug)
  for (const x of asList(spec.mul)) if (!/^-?\d+(\.\d+)?$/.test(String(x))) out.add(String(x))
  return out
}
const slotKind = (s) => ["context", "choice", "json", "argv", "map", "slug", "value", "ask", "ref", "mul"].find((k) => k in s) ?? null
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
    if (!["issue", "none"].includes(h.record)) e('record must be "issue" or "none"')
    if (typeof h.drive !== "number" || h.drive < 0 || h.drive > 1) e("drive must be a number from 0 to 1")
    if (typeof h.weight !== "number") e("weight must be a number")
    if (!h.when || typeof h.when !== "object") e("when must be an object")
    if (!asList(h.triggers?.en).length || !asList(h.triggers?.ar).length) e("triggers need en and ar lists")
    if (new RegExp("fa" + "ble", "i").test(JSON.stringify(h) + f.body)) e("never name the escalate model")
    const heads = [...f.body.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1])
    if (heads.join("|") !== HEADINGS.join("|")) e(`headings must be ${HEADINGS.join(" · ")} in that order (found: ${heads.join(" · ") || "none"})`)
    const declared = h.slots ?? {}
    const used = new Set([...f.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
    for (const u of used) if (!declared[u]) e(`slot {{${u}}} is used but not declared`)
    const refd = new Set(used)
    for (const [n, s] of Object.entries(declared)) for (const r of slotRefs(s)) if (r !== n) refd.add(r)
    for (const [n, s] of Object.entries(declared)) {
      if (!refd.has(n)) e(`slot "${n}" is declared but never used`)
      const k = slotKind(s)
      if (!k) e(`slot "${n}" has no known source (context, choice, json, argv, map, slug, value, ask, ref, mul)`)
      for (const r of slotRefs(s)) if (!declared[r]) e(`slot "${n}" refers to undeclared slot {{${r}}}`)
      if (k === "argv" && !argvAllowed(s.argv.map((a) => (/\{\{\w+\}\}/.test(a) ? "x" : a)))) e(`slot "${n}": argv must be node + a script under the kun repo or ~/.claude`)
      if (k === "json" && !fs.existsSync(path.join(ROOT, s.json))) e(`slot "${n}": ${s.json} does not exist`)
      if (k === "choice" && s.default != null && !s.choice.includes(s.default)) e(`slot "${n}": default is not in the choice list`)
      if (h.record === "issue" && k === "context" && /^(project\.dir|media\.)/.test(s.context)) e(`record issue: slot "${n}" is a local path`)
    }
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
      const re = new RegExp("^" + h.redirects.to.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace("{stage}", "[a-z]+") + "$")
      if (!formulas.some((x) => re.test(x.id))) e(`redirects.to ${h.redirects.to} matches no formula`)
    }
  }
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
const MARK_START = "{/* station:matrix:start */}"
const MARK_END = "{/* station:matrix:end */}"
function page(dept) {
  const table = `${MARK_START}\n${matrix(dept)}\n${MARK_END}`
  const file = path.join(ROOT, "content", "docs", "station.mdx")
  const text = readText(file)
  if (text == null || !text.includes(MARK_START) || !text.includes(MARK_END)) {
    console.log(table)
    return false
  }
  const a = text.indexOf(MARK_START)
  const b = text.indexOf(MARK_END) + MARK_END.length
  fs.writeFileSync(file, text.slice(0, a) + table + text.slice(b))
  console.log(`station: wrote the matrix into content/docs/station.mdx (${loadFormulas(dept).formulas.length} formulas)`)
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
    eq(m.id, null)
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
    eq(o.label_ar, "فيلم جديد")
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
  if (a.test) process.exit(runTests() ? 0 : 1)
  if (a.page) return void page(dept)
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
    if (cmd === "match") return out(a, match(ctx, dept, a._.slice(1).join(" "), a.repo), (r) => `${r.id ?? "none"} (${r.confidence})${r.dept ? ` dept=${r.dept}` : ""}`)
  } catch (e) {
    // never fail loudly: the app reads JSON and treats an empty answer as "nothing to show"
    console.log(JSON.stringify({ error: String(e?.message ?? e), department: dept, options: [] }))
    return
  }
  console.error("usage: station.mjs board|fill|match|lint|--test|--page  (see the header of this file)")
  process.exit(2)
}
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main()
