// Tests for the film issue, work orders and submit. Run: node --test .claude/skills/produce/scripts/produce.test.mjs
// No network, no real project: PRODUCE_HOME is a temp folder, and PRODUCE_STUB_DIR (see the header of produce.mjs)
// replaces gh, the CDN uploader and station — gh/upload calls are logged to <dir>/gh.log and <dir>/upload.log,
// station's answer comes from <dir>/station.json.
import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const PRODUCE = join(dirname(fileURLToPath(import.meta.url)), "produce.mjs")
const root = mkdtempSync(join(tmpdir(), "produce-test-"))
const HOME = join(root, "projects"), STUB = join(root, "stub")
mkdirSync(STUB, { recursive: true })
const env = { ...process.env, PRODUCE_HOME: HOME, PRODUCE_STUB_DIR: STUB, KUN_LOGIN: "tester" }
const run = (...args) => spawnSync("node", [PRODUCE, ...args], { encoding: "utf8", env })
const ghLog = () => (existsSync(join(STUB, "gh.log")) ? readFileSync(join(STUB, "gh.log"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [])
const upLog = () => (existsSync(join(STUB, "upload.log")) ? readFileSync(join(STUB, "upload.log"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [])
const project = (id) => JSON.parse(readFileSync(join(HOME, id, "project.json"), "utf8"))

const init = run("init", "--brand", "hogwarts", "--category", "intro", "--subject", "test", "--lang", "ar")
assert.equal(init.status, 0, init.stderr)
const ID = JSON.parse(init.stdout).id
// a request with the public list price in it: the issue may carry it (only commission terms are refused)
const req = join(HOME, ID, "01-brief/request.json")
writeFileSync(req, JSON.stringify({ ...JSON.parse(readFileSync(req, "utf8")), audience: "School owners", objective: "Book a trial at 24 SAR per student", viewing: "mobile-first" }))
const ref = join(root, "script.md")
writeFileSync(ref, "# script")
writeFileSync(join(STUB, "station.json"), JSON.stringify({
  id: "video.order.blender", route: "do", record: "issue", missing: [], redirected_from: null,
  prompt: `## Task\nBuild the classroom scene.\n\n## Context\n- Film: ${ID}\n\n## References\n- Script: https://cdn.databayt.org/work/${ID}/ref/script.md`,
  uploads: [{ local: ref, key: `work/${ID}/ref/script.md`, url: `https://cdn.databayt.org/work/${ID}/ref/script.md` }, { local: join(root, "absent.json"), key: `work/${ID}/ref/absent.json`, url: "https://cdn.databayt.org/x" }],
}))

test("issue draft: body sections, kun block last, list price shown, nothing written", () => {
  const r = run("issue", ID)
  assert.equal(r.status, 0, r.stderr)
  for (const h of ["## Brief", "## Versions", "## Stages", "## Gates", "## Work orders"]) assert.ok(r.stdout.includes(h), h)
  assert.ok(r.stdout.includes("labels: dept:video, P2, film"))
  assert.equal((r.stdout.match(/^- \[[ x]\] \d\d /gm) ?? []).length, 14)
  for (const g of ["script", "look", "version", "publish"]) assert.ok(r.stdout.includes(`] ${g} — `), g)
  assert.ok(r.stdout.split("## Stages")[0].includes("Book a trial at 24 SAR per student"), "the public list price is allowed in the brief")
  assert.equal(r.stdout.trim().split("\n").at(-1), `<!-- kun: repos=kun; items=skill:produce; film=${ID} -->`)
  assert.equal(project(ID).issue, null)
  assert.equal(ghLog().length, 0)
})

test("order refuses without the film issue, and never creates in draft", () => {
  const draft = run("order", ID, "video.order.blender", "--to", "sedon", "--set", "scene=the classroom scene")
  assert.equal(draft.status, 0, draft.stderr)
  assert.ok(draft.stdout.includes("DRAFT"))
  assert.ok(draft.stdout.includes("title: Blender scene: the classroom scene — "))
  assert.ok(draft.stdout.includes("labels: dept:video, P2, for:sedon"))
  assert.ok(draft.stdout.includes("[ABSENT: would be skipped]"))
  assert.ok(draft.stdout.includes(`film=${ID}; formula=video.order.blender; weight=5`))
  assert.ok(draft.stdout.includes("items=skill:blender"))
  assert.equal(ghLog().length, 0)
  assert.equal(upLog().length, 0)
  const create = run("order", ID, "video.order.blender", "--to", "sedon", "--create")
  assert.notEqual(create.status, 0)
  assert.match(create.stderr, /no film issue yet/)
})

test("order refuses missing slots and non-issue formulas", () => {
  writeFileSync(join(STUB, "station.json"), JSON.stringify({ id: "x", prompt: "p", record: "issue", missing: ["scene"], route: "do" }))
  let r = run("order", ID, "video.order.blender", "--to", "sedon")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /needs: scene/)
  writeFileSync(join(STUB, "station.json"), JSON.stringify({ id: "x", prompt: "p", record: "none", missing: [], route: "do" }))
  r = run("order", ID, "video.film.plan", "--to", "sedon")
  assert.match(r.stderr, /not a work order/)
})

test("film issue --create, then order --create, then submit --create (all stubbed)", () => {
  writeFileSync(join(STUB, "station.json"), JSON.stringify({
    id: "video.order.blender", route: "do", record: "issue", missing: [], redirected_from: null,
    prompt: `## Task\nBuild it.\n\n## Context\n- Film: ${ID}`,
    uploads: [{ local: ref, key: `work/${ID}/ref/script.md`, url: `https://cdn.databayt.org/work/${ID}/ref/script.md` }, { local: join(root, "absent.json"), key: `work/${ID}/ref/absent.json`, url: "u" }],
  }))
  let r = run("issue", ID, "--create")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(project(ID).issue, "databayt/kun#100")
  assert.ok(ghLog().some((a) => a[0] === "issue" && a[1] === "create" && a.includes("film")))

  r = run("order", ID, "video.order.blender", "--to", "sedon", "--set", "scene=the classroom scene", "--after", "#5", "--create")
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stderr, /absent/)
  assert.deepEqual(upLog().map((u) => u.key), [`work/${ID}/ref/script.md`])
  const o = project(ID).orders
  assert.equal(o.length, 1)
  assert.equal(o[0].issue, "databayt/kun#101")
  assert.equal(o[0].to, "sedon")
  const edit = ghLog().filter((a) => a[1] === "edit").at(-1)
  assert.ok(edit[edit.indexOf("--body") + 1].includes("- [ ] #101 Blender scene — sedon"))

  // submit: the receipt layout the app and the API read
  const file = join(root, "scene one.blend")
  writeFileSync(file, "blend")
  writeFileSync(join(STUB, "issue-view.json"), JSON.stringify({ title: "t", state: "OPEN", labels: [], body: `x\n<!-- kun: repos=hogwarts; items=skill:blender; film=${ID}; formula=video.order.blender; weight=5 -->` }))
  const draft = run("submit", "databayt/kun#101", file, "--summary", "built it", "--next", "render it")
  assert.equal(draft.status, 0, draft.stderr)
  assert.ok(draft.stdout.includes("DRAFT"))
  const before = upLog().length
  assert.equal(before, 1)
  assert.ok(draft.stdout.includes(`work/${ID}/101/scene one.blend`))
  assert.ok(draft.stdout.includes("<!-- kun:receipt -->"))
  assert.ok(draft.stdout.includes("Formula: video.order.blender"))
  assert.ok(draft.stdout.includes("**Next**\nrender it"))
  assert.ok(/\*\*Hashes \(sha256\)\*\*\n- [0-9a-f]{64}  https:/.test(draft.stdout))
  const made = run("submit", "databayt/kun#101", file, "--summary", "built it", "--create")
  assert.equal(made.status, 0, made.stderr)
  assert.equal(upLog().length, before + 1)
  const calls = ghLog()
  assert.ok(calls.some((a) => a[1] === "comment" && a[a.indexOf("--body") + 1].startsWith("<!-- kun:receipt -->")))
  assert.ok(calls.some((a) => a.includes("--add-label") && a.includes("status:review")))
})

test("advance and approve comment on the film issue; a gh failure never fails them", () => {
  const f = join(HOME, ID, "02-research/product-research.md")
  writeFileSync(f, "r")
  const n = ghLog().length
  let r = run("advance", ID, "research", "--file", f)
  assert.equal(r.status, 0, r.stderr)
  const added = ghLog().slice(n)
  const c = added.find((a) => a[1] === "comment")
  assert.match(c[c.indexOf("--body") + 1], /^advance: research · 02-research\/product-research\.md · sha [0-9a-f]{16} · by tester$/)
  r = run("approve", ID, "--gate", "look", "--version", project(ID).version, "--by", "abdout")
  assert.equal(r.status, 0, r.stderr)
  assert.ok(ghLog().some((a) => a[1] === "comment" && a[a.indexOf("--body") + 1] === `approved: look · ${project(ID).version} · by abdout`))
  assert.equal(project(ID).stages.research.by, "tester")
  // no gh at all: still exits 0
  const noGh = spawnSync(process.execPath, [PRODUCE, "advance", ID, "research", "--file", f], { encoding: "utf8", env: { ...env, PRODUCE_STUB_DIR: "", PATH: "/nonexistent" } })
  assert.equal(noGh.status, 0, noGh.stderr)
  assert.match(noGh.stderr, /gh\) is not installed|spawn|warning/)
})

test("status: contributors and --json with issue and orders", () => {
  const r = run("status", ID)
  assert.match(r.stdout, /contributors:/)
  assert.match(r.stdout, /sedon\s+work order Blender scene/)
  const j = JSON.parse(run("status", ID, "--json").stdout)
  assert.equal(j.issue, "databayt/kun#100")
  assert.equal(j.orders.length, 1)
  assert.ok(j.contributors.some((c) => c.who === "abdout"))
})

test("a prompt with the list price is not refused; one stating a commission is", () => {
  const withPrice = { id: "video.order.script", route: "do", record: "issue", missing: [], prompt: `## Task\nWrite it. Film: ${ID}\n\n## Context\n- Price: 24 SAR per student per year` }
  writeFileSync(join(STUB, "station.json"), JSON.stringify(withPrice))
  let r = run("order", ID, "video.order.script", "--to", "huwaida", "--set", "scene=the whole film")
  assert.equal(r.status, 0, r.stderr)
  assert.ok(r.stdout.includes("24 SAR per student per year"))
  assert.ok(!/refus|warning/.test(r.stderr))
  const n = ghLog().length
  r = run("order", ID, "video.order.script", "--to", "huwaida", "--set", "scene=x", "--create")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(ghLog().length > n, true)
  for (const text of ["Agent keeps a commission of 10%", "عمولة المبيعات", "a revenue share applies", "10% of first-year revenue"]) {
    writeFileSync(join(STUB, "station.json"), JSON.stringify({ ...withPrice, prompt: `## Task\n${text} ${ID}` }))
    const c = ghLog().length
    r = run("order", ID, "video.order.script", "--to", "huwaida", "--set", "scene=x", "--create")
    assert.notEqual(r.status, 0, text)
    assert.match(r.stderr, /commission or revenue share/)
    assert.equal(ghLog().length, c)
  }
})

test("issue --sync ticks the lines of closed work orders (draft shows it too)", () => {
  const orders = project(ID).orders
  const closed = orders[0].issue.split("#").pop()
  writeFileSync(join(STUB, `issue-view-${closed}.json`), JSON.stringify({ state: "CLOSED" }))
  const draft = run("issue", ID)
  assert.ok(draft.stdout.includes(`- [x] #${closed} Blender scene — sedon`), draft.stdout.split("## Work orders")[1])
  const open = orders.find((o) => o.issue.split("#").pop() !== closed)
  if (open) assert.ok(draft.stdout.includes(`- [ ] #${open.issue.split("#").pop()} `))
  const before = ghLog().length
  assert.equal(run("issue", ID, "--sync").status, 0)
  const edit = ghLog().slice(before).filter((a) => a[1] === "edit").at(-1)
  assert.ok(edit[edit.indexOf("--body") + 1].includes(`- [x] #${closed} Blender scene — sedon`))
  assert.equal(project(ID).orders[0].closed, true)
  // a failing gh view keeps the last known state instead of unticking
  writeFileSync(join(STUB, `issue-view-${closed}.json`), "not json")
  assert.ok(run("issue", ID).stdout.includes(`- [x] #${closed} `))
})

test("order pins the film: station fills THAT project, not the first open one", () => {
  const home = join(root, "pin-projects"), stub = join(root, "pin-stub"), fx = join(root, "pin-fx")
  const e = { ...env, PRODUCE_HOME: home, PRODUCE_STUB_DIR: stub, STATION_FIXTURES: fx, STATION_TODAY: "2026-11-23" }
  const sp = (...a) => spawnSync(process.execPath, [PRODUCE, ...a], { encoding: "utf8", env: e })
  const made = sp("init", "--brand", "hogwarts", "--category", "intro", "--subject", "pinned", "--lang", "ar")
  assert.equal(made.status, 0, made.stderr)
  const pid = JSON.parse(made.stdout).id
  mkdirSync(fx, { recursive: true })
  const fxSrc = join(dirname(PRODUCE), "..", "..", "..", "scripts", "station.fixtures", "two-open")
  for (const f of ["argv.json", "brand-kit.json", "issues.json", "markets.json"]) writeFileSync(join(fx, f), readFileSync(join(fxSrc, f)))
  const [first, second] = JSON.parse(readFileSync(join(fxSrc, "projects.json"), "utf8"))
  writeFileSync(join(fx, "projects.json"), JSON.stringify([first, { ...second, id: pid }]))
  const r = sp("order", pid, "video.order.blender", "--to", "sedon", "--set", "scene=the classroom scene")
  assert.equal(r.status, 0, r.stderr)
  assert.ok(r.stdout.includes(`Film: ${pid}`))
  assert.ok(r.stdout.includes(`work/${pid}/ref/`))
  assert.ok(!r.stdout.includes(first.id), "the other open film never leaks in")
})

test("a missing aws or gh gives one friendly line", () => {
  const bin = join(root, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, "gh"), "#!/bin/sh\ncase \"$2\" in view) echo '{\"title\":\"t\",\"body\":\"\",\"state\":\"OPEN\",\"labels\":[]}';; esac\nexit 0\n", { mode: 0o755 })
  const file = join(root, "a.txt")
  writeFileSync(file, "x")
  const e = { ...env, PRODUCE_STUB_DIR: "", PATH: bin }
  const r = spawnSync(process.execPath, [PRODUCE, "submit", "databayt/kun#101", file, "--create"], { encoding: "utf8", env: e })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /produce: the AWS CLI \(aws\) is not installed or not on PATH/)
  assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr)
})

// ---- source video: from-reference --voiceover, status --json, list --json -------------------------------------
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0 && spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).status === 0
test("from-reference --voiceover: 48 kHz mono wav per variant, voice source in the ledger, transcript kept", { skip: !hasFfmpeg && "ffmpeg not installed" }, () => {
  const home = join(root, "src-projects"), bin = join(root, "src-bin")
  mkdirSync(bin, { recursive: true })
  // a stand-in for mlx_whisper: writes a one-line transcript.srt into --output-dir
  writeFileSync(join(bin, "mlx_whisper"), "#!/bin/sh\nwhile [ $# -gt 0 ]; do [ \"$1\" = \"--output-dir\" ] && d=\"$2\"; shift; done\nprintf '1\\n00:00:00,000 --> 00:00:01,500\\nhello there\\n\\n' > \"$d/transcript.srt\"\n", { mode: 0o755 })
  const e = { ...env, PRODUCE_HOME: home, PATH: `${bin}:${process.env.PATH}` }
  const sp = (...a) => spawnSync(process.execPath, [PRODUCE, ...a], { encoding: "utf8", env: e })
  const video = join(root, "source.mp4")
  const mk = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=3", "-shortest", "-pix_fmt", "yuv420p", video], { encoding: "utf8" })
  assert.equal(mk.status, 0, mk.stderr)

  // one variant: no --variant needed
  const one = JSON.parse(sp("init", "--brand", "hogwarts", "--category", "intro", "--subject", "one", "--lang", "ar", "--markets", "sd").stdout).id
  const r = sp("from-reference", one, video, "--voiceover")
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.deepEqual(out.voiceover.map((v) => [v.variant, v.file]), [["sd-ar", "07-audio/voiceover/sd-ar.wav"]])
  assert.ok(Math.abs(out.voiceover[0].durationSec - 3) < 0.2, String(out.voiceover[0].durationSec))
  const wav = join(home, one, "07-audio/voiceover/sd-ar.wav")
  const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels", "-of", "csv=p=0", wav], { encoding: "utf8" })
  assert.equal(pr.stdout.trim(), "48000,1")
  const p = JSON.parse(readFileSync(join(home, one, "project.json"), "utf8"))
  assert.equal(p.voice["sd-ar"].kind, "source-video")
  assert.equal(p.voice["sd-ar"].source, "02-research/reference/video.mp4")
  assert.equal(p.voice["sd-ar"].sampleRate, 48000)
  assert.equal(p.stages.research.status, "seeded")
  assert.ok(readFileSync(join(home, one, "03-script/script.md"), "utf8").includes("hello there"), "the transcript still seeds the script")
  assert.ok(readFileSync(join(home, one, "03-script/script.md"), "utf8").includes("07-audio/voiceover/sd-ar.wav"), "the script names its voice source")

  // without the flag nothing is extracted
  const plain = JSON.parse(sp("init", "--brand", "hogwarts", "--category", "intro", "--subject", "plain", "--lang", "ar").stdout).id
  const q = sp("from-reference", plain, video)
  assert.equal(q.status, 0, q.stderr)
  assert.equal(JSON.parse(q.stdout).voiceover, undefined)
  assert.equal(existsSync(join(home, plain, "07-audio/voiceover/ar.wav")), false)

  // two variants: --variant picks one, --all writes both, neither is an error that names them
  const two = JSON.parse(sp("init", "--brand", "hogwarts", "--category", "intro", "--subject", "two", "--lang", "ar", "--markets", "sd,sa").stdout).id
  const amb = sp("from-reference", two, video, "--voiceover")
  assert.notEqual(amb.status, 0)
  assert.match(amb.stderr, /--variant <v> or --all/)
  assert.equal(existsSync(join(home, two, "02-research/reference/video.mp4")), false, "nothing is copied before the variant is known")
  const pick = sp("from-reference", two, video, "--voiceover", "--variant", "sa-ar")
  assert.equal(pick.status, 0, pick.stderr)
  assert.equal(existsSync(join(home, two, "07-audio/voiceover/sa-ar.wav")), true)
  assert.equal(existsSync(join(home, two, "07-audio/voiceover/sd-ar.wav")), false)
  const all = sp("from-reference", two, video, "--voiceover", "--all")
  assert.equal(all.status, 0, all.stderr)
  assert.equal(existsSync(join(home, two, "07-audio/voiceover/sd-ar.wav")), true)

  // a file with no audio is refused, not recorded
  const silent = join(root, "silent.mp4")
  spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-pix_fmt", "yuv420p", silent])
  const none = sp("from-reference", plain, silent, "--voiceover")
  assert.notEqual(none.status, 0)
})

test("status --json: stage list, variant grid, gates, next, urls, and the shot-list and asset-manifest paths", () => {
  const home = join(root, "st-projects")
  const e = { ...env, PRODUCE_HOME: home }
  const sp = (...a) => spawnSync(process.execPath, [PRODUCE, ...a], { encoding: "utf8", env: e })
  const id = JSON.parse(sp("init", "--brand", "hogwarts", "--identity", "balqalam", "--category", "intro", "--subject", "strip", "--lang", "ar", "--markets", "sd").stdout).id
  const j = JSON.parse(sp("status", id, "--json").stdout)
  // the original keys survive
  for (const k of ["id", "title", "status", "version", "issue", "orders", "stages", "gates", "contributors"]) assert.ok(k in j, k)
  assert.equal(j.stage_list.length, 14)
  assert.deepEqual(j.stage_list.map((s) => s.key), ["request", "research", "brief", "script", "storyboard", "assets", "visual", "audio", "edit", "render", "qa", "approval", "cdn", "publish"])
  assert.deepEqual([j.stage_list[0].status, j.stage_list[1].status], ["done", "todo"])
  assert.equal(j.stage_list.find((s) => s.key === "render").per_variant, true)
  assert.equal(j.identity, "balqalam")
  assert.deepEqual(j.variants.map((v) => [v.id, v.market, v.lang]), [["sd-ar", "sd", "ar"]])
  assert.deepEqual(Object.keys(j.variants[0].stages), ["audio", "edit", "render", "qa", "approval", "cdn", "publish"])
  assert.equal(j.variants[0].stages.render, "todo")
  assert.equal(j.next, "research")
  assert.deepEqual(Object.keys(j.gates), ["script", "look", "version", "publish"])
  assert.equal(j.urls.length, 1)
  assert.match(j.urls[0].url, /^https:\/\/cdn\.databayt\.org\/video\/hogwarts\/intro\/sd-ar\/fb-9x16\.mp4/)
  assert.equal(j.paths.shot_list, join(home, id, "04-storyboard/shot-list.json"))
  assert.equal(j.paths.asset_manifest, join(home, id, "05-assets/asset-manifest.json"))
  assert.deepEqual([j.files.shot_list, j.files.asset_manifest, j.files.script], [true, false, false])
  // advancing a variant stage shows in the grid
  const f = join(home, id, "02-research/product-research.md")
  writeFileSync(f, "r")
  assert.equal(sp("advance", id, "research", "--file", f).status, 0)
  assert.equal(JSON.parse(sp("status", id, "--json").stdout).next, "brief")
})

test("list --json: an array, newest first, filtered by --repo, empty when there are none", () => {
  const empty = JSON.parse(spawnSync(process.execPath, [PRODUCE, "list", "--json"], { encoding: "utf8", env: { ...env, PRODUCE_HOME: join(root, "nothing-here") } }).stdout)
  assert.deepEqual(empty, [])
  const home = join(root, "st-projects")
  const sp = (...a) => spawnSync(process.execPath, [PRODUCE, ...a], { encoding: "utf8", env: { ...env, PRODUCE_HOME: home } })
  const all = JSON.parse(sp("list", "--json").stdout)
  assert.ok(all.length >= 1)
  for (const k of ["id", "title", "brand", "category", "version", "status", "next", "focus", "variants", "identity", "dir"]) assert.ok(k in all[0], k)
  assert.equal(JSON.parse(sp("list", "--json", "--repo", "hogwarts").stdout).length, all.length)
  assert.deepEqual(JSON.parse(sp("list", "--json", "--repo", "mkan").stdout), [])
})

// ---- lock / plan / mirror ----------------------------------------------------------------------
const lockHome = join(root, "lock-projects")
const lockStub = join(root, "lock-stub")
const lenv = { ...env, PRODUCE_HOME: lockHome, PRODUCE_STUB_DIR: lockStub }
const lp = (...a) => spawnSync(process.execPath, [PRODUCE, ...a], { encoding: "utf8", env: lenv })
const lockUp = () => (existsSync(join(lockStub, "upload.log")) ? readFileSync(join(lockStub, "upload.log"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [])
const newFilm = (subject) => JSON.parse(lp("init", "--brand", "hogwarts", "--category", "intro", "--subject", subject, "--lang", "ar").stdout).id
const lproject = (id) => JSON.parse(readFileSync(join(lockHome, id, "project.json"), "utf8"))
const ljson = (id, rel) => JSON.parse(readFileSync(join(lockHome, id, rel), "utf8"))
const KEYS = ["request", "research", "brief", "script", "storyboard", "assets", "visual", "audio", "edit", "render", "qa", "approval", "cdn", "publish"]

test("lock --all: 14 specs, plan, 14 locks with source default", () => {
  const id = newFilm("lockall")
  const r = lp("lock", id, "--all", "--json", "--no-sync")
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.plan.locked_all, true)
  assert.equal(out.locked.length, 14)
  const files = KEYS.map((k, i) => `00-plan/${String(i + 1).padStart(2, "0")}-${k}.spec`)
  for (const f of files) for (const ext of ["json", "md"]) assert.ok(existsSync(join(lockHome, id, `${f}.${ext}`)), `${f}.${ext}`)
  for (const f of ["plan.json", "plan.md"]) assert.ok(existsSync(join(lockHome, id, "00-plan", f)), f)
  const locks = lproject(id).locks
  assert.equal(Object.keys(locks).length, 14)
  for (const k of KEYS) assert.equal(locks[k].source, "default", k)
  assert.equal(locks.request.backfill, true) // request was done before it was locked
  const plan = ljson(id, "00-plan/plan.json")
  assert.equal(plan.steps.length, 14)
  assert.equal(plan.locked_all, true)
  const md = readFileSync(join(lockHome, id, "00-plan/07-visual.spec.md"), "utf8")
  assert.match(md, /^# 07 Visual — /)
  assert.match(md, /^- Look: /m)
  assert.ok(md.includes(`https://cdn.databayt.org/work/${id}/ref/06-production/visual-manifest.json`))
  assert.match(readFileSync(join(lockHome, id, "00-plan/plan.md"), "utf8"), /\| # \| Stage \| Tool \| Lane \| Output \| Gate \| Locked \|/)
  // repeating is a no-op for an unchanged spec
  const before = lproject(id).locks
  assert.deepEqual(JSON.parse(lp("lock", id, "--all", "--json", "--no-sync").stdout).locks, before)
})

test("lock --all --plan: picks, stage decisions, plan.input.json", () => {
  const id = newFilm("lockplan")
  const pf = join(root, "plan-in.json")
  writeFileSync(pf, JSON.stringify({ picks: { look: "3D" }, stages: { script: { decisions: { structure: "walkthrough" }, notes: "n" } }, cost: ["Veo: 4 clips"] }))
  const r = lp("lock", id, "--all", "--plan", pf, "--no-sync")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(ljson(id, "00-plan/07-visual.spec.json").decisions.look, "3D")
  const sc = ljson(id, "00-plan/04-script.spec.json")
  assert.equal(sc.decisions.structure, "walkthrough")
  assert.equal(sc.source, "plan")
  assert.equal(sc.notes, "n")
  assert.ok(existsSync(join(lockHome, id, "00-plan/plan.input.json")))
  assert.deepEqual(ljson(id, "00-plan/plan.json").cost, ["Veo: 4 clips"])
  assert.match(readFileSync(join(lockHome, id, "00-plan/plan.md"), "utf8"), /Veo: 4 clips/)
})

test("lock <stage> --set / --spec", () => {
  const id = newFilm("lockset")
  assert.equal(lp("lock", id, "--all", "--no-sync").status, 0)
  const sha0 = lproject(id).locks.audio.sha
  const r = lp("lock", id, "audio", "--set", "voice=none", "--no-sync")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(ljson(id, "00-plan/08-audio.spec.json").decisions.voice, "none")
  assert.notEqual(lproject(id).locks.audio.sha, sha0)
  assert.equal(lproject(id).locks.audio.source, "set")
  const bad = lp("lock", id, "audio", "--set", "look=3D", "--no-sync")
  assert.notEqual(bad.status, 0)
  assert.match(bad.stderr, /does not own/)
  const sf = join(root, "spec-in.json")
  writeFileSync(sf, JSON.stringify({ stage: "script", decisions: { structure: "x" } }))
  assert.notEqual(lp("lock", id, "visual", "--spec", sf, "--no-sync").status, 0)
  writeFileSync(sf, JSON.stringify({ stage: "visual", decisions: { look: "3D", extra: "kept" }, tool: "blender", notes: "hi" }))
  assert.equal(lp("lock", id, "visual", "--spec", sf, "--no-sync").status, 0)
  const sv = ljson(id, "00-plan/07-visual.spec.json")
  assert.equal(sv.source, "spec")
  assert.equal(sv.decisions.extra, "kept")
  assert.equal(lproject(id).locks.visual.source, "spec")
  writeFileSync(sf, JSON.stringify({ stage: "visual", tool: "no-such-tool" }))
  assert.notEqual(lp("lock", id, "visual", "--spec", sf, "--no-sync").status, 0)
})

test("lock --all keeps what a stage already decided; a plan's unknown tool falls back to the stage's own", () => {
  const id = newFilm("lockkeep")
  assert.equal(lp("lock", id, "--all", "--no-sync").status, 0)
  assert.equal(lp("lock", id, "audio", "--set", "voice=none", "--no-sync").status, 0)
  assert.equal(lp("lock", id, "--all", "--no-sync").status, 0)
  assert.equal(ljson(id, "00-plan/08-audio.spec.json").decisions.voice, "none")
  const pf = join(root, "plan-badtool.json")
  writeFileSync(pf, JSON.stringify({ stages: { visual: { tool: "Blender 5", decisions: { look: "3D" } } } }))
  const r = lp("lock", id, "--all", "--plan", pf, "--no-sync")
  assert.equal(r.status, 0)
  assert.match(r.stderr, /unknown tool/)
  const sv = ljson(id, "00-plan/07-visual.spec.json")
  assert.equal(sv.tool, "blender")
  assert.equal(sv.decisions.look, "3D")
  assert.equal(ljson(id, "00-plan/08-audio.spec.json").decisions.voice, "none")
})

test("advance refuses a heavy stage with no lock, passes after lock, --force bypasses", () => {
  const id = newFilm("lockgate")
  const f = join(lockHome, id, "06-production/visual-manifest.json")
  writeFileSync(f, "{}")
  assert.equal(lp("approve", id, "--gate", "script", "--version", "V001", "--by", "tester", "--no-sync").status, 0)
  const r = lp("advance", id, "visual", "--file", f)
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /not locked.*produce lock/)
  assert.equal(lp("lock", id, "visual", "--no-sync").status, 0)
  assert.equal(lp("advance", id, "visual", "--file", f).status, 0)
  const f2 = join(lockHome, id, "07-audio/audio-package.json")
  writeFileSync(f2, "{}")
  assert.notEqual(lp("advance", id, "audio", "--file", f2).status, 0)
  assert.equal(lp("advance", id, "audio", "--file", f2, "--force").status, 0)
})

test("unlock drops the lock, keeps the specs, and the plan is no longer locked_all", () => {
  const id = newFilm("lockun")
  lp("lock", id, "--all", "--no-sync")
  const r = lp("unlock", id, "visual", "--json", "--no-sync")
  assert.equal(r.status, 0, r.stderr)
  assert.equal("visual" in lproject(id).locks, false)
  assert.ok(existsSync(join(lockHome, id, "00-plan/07-visual.spec.json")))
  assert.equal(ljson(id, "00-plan/plan.json").locked_all, false)
  assert.equal(JSON.parse(r.stdout).plan.locked_all, false)
  assert.equal(ljson(id, "00-plan/plan.json").steps.find((s) => s.stage === "visual").locked, false)
})

test("status --json: spec fields per stage, locks and plan", () => {
  const id = newFilm("lockstatus")
  assert.equal(JSON.parse(lp("status", id, "--json").stdout).plan, null)
  lp("lock", id, "--all", "--no-sync")
  const j = JSON.parse(lp("status", id, "--json").stdout)
  for (const s of j.stage_list) for (const k of ["dir", "spec", "spec_url", "file_url", "locked"]) assert.ok(k in s, `${s.key}.${k}`)
  const v = j.stage_list.find((s) => s.key === "visual")
  assert.equal(v.dir, "06-production")
  assert.equal(v.spec, join(lockHome, id, "00-plan/07-visual.spec.json"))
  assert.equal(v.spec_url, `https://cdn.databayt.org/work/${id}/ref/00-plan/07-visual.spec.json`)
  assert.equal(v.file_url, `https://cdn.databayt.org/work/${id}/ref/06-production/visual-manifest.json`)
  assert.equal(v.locked, true)
  assert.equal(j.stage_list.find((s) => s.key === "cdn").file_url, null)
  assert.equal(Object.keys(j.locks).length, 14)
  assert.equal(j.plan.locked_all, true)
  assert.equal(j.plan.url, `https://cdn.databayt.org/work/${id}/ref/00-plan/plan.md`)
})

test("url --path: the one mapping rule, and bad paths refused", () => {
  const id = newFilm("lockurl")
  const r = lp("url", id, "--path", "03-script/script.md")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout.trim(), `https://cdn.databayt.org/work/${id}/ref/03-script/script.md`)
  for (const bad of ["../x", "/etc/passwd", "~/x", "a/../../b"]) assert.notEqual(lp("url", id, "--path", bad).status, 0, bad)
})

test("mirror: draft uploads nothing; --create uploads, writes index.json; fonts and 08-render skipped", () => {
  const id = newFilm("lockmirror")
  const d = join(lockHome, id)
  writeFileSync(join(d, "03-script/script.md"), "# s")
  writeFileSync(join(d, "03-script/brand.ttf"), "font")
  writeFileSync(join(d, "08-render/masters/master.mp4"), "mp4")
  const before = lockUp().length
  const draft = lp("mirror", id, "--stage", "script")
  assert.equal(draft.status, 0, draft.stderr)
  assert.match(draft.stdout, /DRAFT/)
  assert.ok(draft.stdout.includes(`https://cdn.databayt.org/work/${id}/ref/03-script/script.md`))
  assert.match(draft.stdout, /brand\.ttf — fonts/)
  assert.equal(lockUp().length, before)
  assert.equal(existsSync(join(d, "03-script/index.json")), false)
  const all = lp("mirror", id)
  assert.match(all.stdout, /08-render\/masters\/master\.mp4 — masters/)
  const r = lp("mirror", id, "--stage", "script", "--create")
  assert.equal(r.status, 0, r.stderr)
  const ups = lockUp().slice(before)
  assert.deepEqual(ups.map((u) => u.key).sort(), [`work/${id}/ref/03-script/index.json`, `work/${id}/ref/03-script/script.md`])
  const idx = ljson(id, "03-script/index.json")
  assert.equal(idx.film, id)
  assert.equal(idx.stage, "script")
  assert.deepEqual(idx.files.map((f) => f.path), ["03-script/script.md"])
  assert.equal(idx.files[0].bytes, 3)
  assert.equal(ups.some((u) => /brand\.ttf|08-render/.test(u.key)), false)
})

test("issue draft with locks: still 14 stage lines, a Plan section, the kun comment last", () => {
  const id = newFilm("lockissue")
  let r = lp("issue", id)
  assert.equal((r.stdout.match(/^- \[[ x]\] \d\d /gm) ?? []).length, 14)
  assert.ok(r.stdout.includes("## Plan"))
  assert.ok(r.stdout.includes("locked: 0 of 14"))
  assert.match(r.stdout, /^- \[ \] 07 visual → `06-production\/visual-manifest\.json` · open$/m)
  lp("lock", id, "--all", "--no-sync")
  r = lp("issue", id)
  assert.equal((r.stdout.match(/^- \[[ x]\] \d\d /gm) ?? []).length, 14)
  assert.ok(r.stdout.includes("locked: 14 of 14"))
  assert.match(r.stdout, /^- \[ \] 07 visual → .* · locked by tester$/m)
  assert.ok(r.stdout.indexOf("## Plan") < r.stdout.indexOf("## Work orders"))
  assert.equal(r.stdout.trim().split("\n").at(-1), `<!-- kun: repos=kun; items=skill:produce; film=${id} -->`)
})
