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
