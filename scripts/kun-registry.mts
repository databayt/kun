// Builds kun's registry — the shadcn-style registry model (see codebase/scripts/build-registry.mts)
// applied to the engine's own config. Output:
//   public/r/kun/index.json              every item, no contents
//   public/r/kun/<type>/<name>.json      one item
//
// Items: skills (.claude/skills/<name>/ whole dir), agents, rules (.claude/rules-global),
// hooks (.claude/hooks/*.sh), department packs (departments/<dept>/pack.json) and machine
// profiles (machines/<login>.json — depends on its departments' packs).
// An item NEVER embeds file contents: it lists files with a sha256, and `machine` installs by
// copying from the local kun checkout. Nothing that crossed a webview is ever written to disk.
//
// id = "<type>:<name>" (skill:funnel) — names repeat across types (a skill and an agent are
// both called funnel), and ids are what dependencies and the machine's lockfile use.
import { createHash } from "crypto"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "public", "r", "kun")

const TYPES = ["skill", "agent", "rule", "hook", "pack", "machine"] as const
type Type = (typeof TYPES)[number]
const NAME_RE = /^[a-z0-9-]+$/

type RegistryFile = { path: string; target: string; sha256: string }
type RegistryItem = {
  id: string
  name: string
  type: `kun:${Type}`
  title: string
  description: string
  title_ar?: string
  description_ar?: string
  keywords: string[]
  dependencies: string[]
  files: RegistryFile[]
  version: string
}

const sha = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex")
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/")

// Files that are never part of an item.
const SKIP = /(^|\/)(\.DS_Store|__pycache__|node_modules|\.git)(\/|$)|\.pyc$|\.test\.sh$/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name)
    if (SKIP.test(rel(full))) continue
    if (e.isSymbolicLink()) continue // links could point outside the checkout
    if (e.isDirectory()) out.push(...walk(full))
    else if (e.isFile()) out.push(full)
  }
  return out
}

function file(abs: string, target: string): RegistryFile {
  const t = path.posix.normalize(target)
  if (t.startsWith("..") || path.isAbsolute(t)) throw new Error(`target escapes ~/.claude: ${target}`)
  return { path: rel(abs), target: t, sha256: sha(fs.readFileSync(abs)) }
}

function frontmatter(abs: string): Record<string, string> {
  const m = fs.readFileSync(abs, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const out: Record<string, string> = {}
  if (!m) return out
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/)
    if (!kv) continue
    out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim()
  }
  return out
}

// keyword -> items it routes to, from vocabulary.json (spell.order entries name a skill/agent).
function loadKeywords(): Map<string, Set<string>> {
  const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude/vocabulary.json"), "utf8"))
  const map = new Map<string, Set<string>>()
  const add = (id: string, kw: string) => {
    if (!map.has(id)) map.set(id, new Set())
    map.get(id)!.add(kw)
  }
  for (const school of vocab.schools ?? []) {
    for (const spell of school.spells ?? []) {
      add(`skill:${spell.name}`, spell.name)
      for (const o of spell.order ?? []) {
        if (o.type === "skill") add(`skill:${o.name}`, spell.name)
        if (o.type === "familiar") add(`agent:${o.name}`, spell.name)
        if (o.type === "hook") add(`hook:${o.name}`, spell.name)
      }
    }
  }
  return map
}

function make(
  type: Type,
  name: string,
  fm: { title?: string; description?: string; title_ar?: string; description_ar?: string },
  files: RegistryFile[],
  deps: string[],
  kw: Map<string, Set<string>>
): RegistryItem {
  const id = `${type}:${name}`
  return {
    id,
    name,
    type: `kun:${type}`,
    title: fm.title || name,
    description: fm.description || "",
    ...(fm.title_ar ? { title_ar: fm.title_ar } : {}),
    ...(fm.description_ar ? { description_ar: fm.description_ar } : {}),
    keywords: [...(kw.get(id) ?? [])].sort(),
    dependencies: deps,
    files,
    version: sha(files.map((f) => `${f.target}:${f.sha256}`).join("\n")),
  }
}

function build(): RegistryItem[] {
  const kw = loadKeywords()
  const items: RegistryItem[] = []
  const push = (i: RegistryItem) => {
    // names double as ids in the machine's lockfile and IPC: lowercase, digits, dash only
    if (!NAME_RE.test(i.name)) return console.warn(`skipped ${i.id}: name must match ${NAME_RE}`)
    items.push(i)
  }
  const claude = path.join(ROOT, ".claude")

  // skills — the whole directory, installed to ~/.claude/skills/<name>/
  const skillsDir = path.join(claude, "skills")
  for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    const skillMd = path.join(skillsDir, d.name, "SKILL.md")
    if (!d.isDirectory() || !fs.existsSync(skillMd)) continue
    const files = walk(path.join(skillsDir, d.name)).map((f) =>
      file(f, `skills/${path.relative(skillsDir, f).split(path.sep).join("/")}`)
    )
    push(make("skill", d.name, { title: d.name, description: frontmatter(skillMd).description }, files, [], kw))
  }

  // agents — ~/.claude/agents/<name>.md (_index.md is the roster, not an agent)
  const agentsDir = path.join(claude, "agents")
  for (const f of fs.readdirSync(agentsDir).sort()) {
    if (!f.endsWith(".md") || f.startsWith("_")) continue
    const abs = path.join(agentsDir, f)
    push(make("agent", f.slice(0, -3), { description: frontmatter(abs).description }, [file(abs, `agents/${f}`)], [], kw))
  }

  // rules — the global ones setup.sh ships to ~/.claude/rules
  const rulesDir = path.join(claude, "rules-global")
  for (const f of fs.readdirSync(rulesDir).sort()) {
    if (!f.endsWith(".md")) continue
    const abs = path.join(rulesDir, f)
    const first = fs.readFileSync(abs, "utf8").split("\n").find((l) => l.startsWith("# ")) ?? ""
    push(make("rule", f.slice(0, -3), { title: first.replace(/^#\s*/, ""), description: frontmatter(abs).description }, [file(abs, `rules/${f}`)], [], kw))
  }

  // hooks — ~/.claude/hooks/<name>.sh
  const hooksDir = path.join(claude, "hooks")
  for (const f of fs.readdirSync(hooksDir).sort()) {
    if (!f.endsWith(".sh") || f.endsWith(".test.sh")) continue
    const abs = path.join(hooksDir, f)
    const comment = fs.readFileSync(abs, "utf8").split("\n").find((l) => /^#\s+\S/.test(l) && !l.startsWith("#!"))
    push(make("hook", f.slice(0, -3), { description: comment?.replace(/^#\s*/, "") }, [file(abs, `hooks/${f}`)], [], kw))
  }

  // packs — departments/<dept>/pack.json lists other items; installing it installs them all
  const depsDir = path.join(ROOT, "departments")
  const known = new Set(items.map((i) => i.id))
  for (const d of fs.readdirSync(depsDir, { withFileTypes: true })) {
    const packJson = path.join(depsDir, d.name, "pack.json")
    if (!d.isDirectory() || !fs.existsSync(packJson)) continue
    const pack = JSON.parse(fs.readFileSync(packJson, "utf8"))
    for (const id of pack.items as string[]) {
      if (!known.has(id)) throw new Error(`pack ${pack.name} lists unknown item ${id}`)
    }
    const files = [packJson, path.join(depsDir, d.name, pack.prompt ?? "prompt.md")]
      .filter((f) => fs.existsSync(f))
      .map((f) => file(f, `departments/${d.name}/${path.basename(f)}`))
    push(make("pack", pack.name, { title: pack.title, description: pack.description, title_ar: pack.title_ar, description_ar: pack.description_ar }, files, pack.items, kw))
  }

  // machines — machines/<login>.json; installing one installs its departments' packs
  const machinesDir = path.join(ROOT, "machines")
  if (fs.existsSync(machinesDir)) {
    for (const f of fs.readdirSync(machinesDir).sort()) {
      if (!f.endsWith(".json")) continue
      const abs = path.join(machinesDir, f)
      const m = JSON.parse(fs.readFileSync(abs, "utf8"))
      if (m.login !== f.slice(0, -5)) throw new Error(`machine ${f}: login must match the file name`)
      const deps = (m.departments as string[]).map((d) => `pack:${d}`)
      push(
        make(
          "machine",
          m.login,
          { title: m.name, description: `${m.os} machine · ${(m.departments as string[]).join(", ")} · code ${m.access?.code ?? "read"}` },
          [file(abs, `machines/${f}`)],
          deps,
          kw
        )
      )
    }
  }

  // every dependency must resolve
  const ids = new Set(items.map((i) => i.id))
  for (const i of items) for (const dep of i.dependencies) if (!ids.has(dep)) throw new Error(`${i.id} depends on missing ${dep}`)
  return items
}

function write(p: string, data: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const body = JSON.stringify(data, null, 2) + "\n"
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === body) return
  fs.writeFileSync(p, body)
}

const items = build()
fs.rmSync(OUT, { recursive: true, force: true }) // drop items that no longer exist
for (const i of items) write(path.join(OUT, i.type.slice(4), `${i.name}.json`), i)
write(path.join(OUT, "index.json"), {
  $schema: "kun-registry-v1",
  name: "kun",
  homepage: "https://kun.databayt.org",
  items,
})
const count = Object.fromEntries(TYPES.map((t) => [t, items.filter((i) => i.id.startsWith(t + ":")).length]))
console.log(`kun registry: ${items.length} items`, count)
