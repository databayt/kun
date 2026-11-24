import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ok = spawnSync("sops", ["--version"]).status === 0 && spawnSync("age-keygen", ["--version"]).status === 0

// a bare remote + two "machines" (clone + own plaintext dir), one shared age key
function world() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mem-"))
  const key = path.join(root, "keys.txt")
  execFileSync("age-keygen", ["-o", key], { stdio: "ignore" })
  const pub = execFileSync("age-keygen", ["-y", key], { encoding: "utf8" }).trim()
  const bare = path.join(root, "remote.git")
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", bare])
  const mk = (name) => {
    const d = path.join(root, name)
    execFileSync("git", ["clone", "-q", bare, d])
    const g = (...a) => execFileSync("git", a, { cwd: d, encoding: "utf8" })
    g("config", "user.email", "t@t.t"); g("config", "user.name", name); g("checkout", "-q", "-B", "main")
    fs.mkdirSync(path.join(d, ".claude/scripts/memory"), { recursive: true })
    fs.copyFileSync(path.join(HERE, "memory.mjs"), path.join(d, ".claude/scripts/memory/memory.mjs"))
    fs.copyFileSync(path.join(HERE, "guard.config.json"), path.join(d, ".claude/scripts/memory/guard.config.json"))
    return { d, g, plain: path.join(root, name + "-plain"),
      run: (...a) => spawnSync("node", [path.join(d, ".claude/scripts/memory/memory.mjs"), ...a], { encoding: "utf8",
        env: { ...process.env, KUN_REPO: d, KUN_PRIVATE_DIR: path.join(root, name + "-plain"), SOPS_AGE_KEY_FILE: key } }) }
  }
  const a = mk("a")
  fs.writeFileSync(path.join(a.d, ".sops.yaml"), `creation_rules:\n  - path_regex: '^\\.claude/memory/private/.*\\.enc$'\n    age: "${pub}"\n`)
  fs.mkdirSync(path.join(a.d, ".claude/memory"), { recursive: true })
  fs.writeFileSync(path.join(a.d, ".claude/memory/revenue.json"), '{"mrr":1234}\n')
  a.g("add", "-A"); a.g("commit", "-qm", "init"); a.g("push", "-q", "origin", "main")
  const b = mk("b"); b.g("pull", "-q", "origin", "main")
  return { a, b, pub, root }
}

test("encrypt -> sync -> other machine decrypts; ciphertext leaks nothing", { skip: !ok }, () => {
  const { a, b } = world()
  let r = a.run("encrypt", path.join(a.d, ".claude/memory/revenue.json")); assert.equal(r.status, 0, r.stderr)
  assert.ok(!fs.existsSync(path.join(a.d, ".claude/memory/revenue.json")))
  assert.equal(fs.readFileSync(path.join(a.plain, "revenue.json"), "utf8"), '{"mrr":1234}\n')
  assert.equal(fs.statSync(path.join(a.plain, "revenue.json")).mode & 0o777, 0o600)
  r = a.run("sync"); assert.equal(r.status, 0, r.stderr + r.stdout)
  const enc = fs.readFileSync(path.join(a.d, ".claude/memory/private/revenue.json.enc"), "utf8")
  assert.doesNotMatch(enc, /1234|mrr/)
  assert.match(a.g("log", "-1", "--format=%s"), /chore\(memory\): sync from/)
  r = b.run("sync"); assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.equal(fs.readFileSync(path.join(b.plain, "revenue.json"), "utf8"), '{"mrr":1234}\n')
})

test("plaintext edit re-encrypts and propagates; new file is added", { skip: !ok }, () => {
  const { a, b } = world()
  a.run("encrypt", path.join(a.d, ".claude/memory/revenue.json")); a.run("sync"); b.run("sync")
  fs.writeFileSync(path.join(b.plain, "revenue.json"), '{"mrr":9}\n')
  fs.mkdirSync(path.join(b.plain, "1on1"), { recursive: true }); fs.writeFileSync(path.join(b.plain, "1on1/x.md"), "hello\n")
  let r = b.run("sync"); assert.equal(r.status, 0, r.stderr)
  r = a.run("sync"); assert.equal(r.status, 0, r.stderr)
  assert.equal(fs.readFileSync(path.join(a.plain, "revenue.json"), "utf8"), '{"mrr":9}\n')
  assert.equal(fs.readFileSync(path.join(a.plain, "1on1/x.md"), "utf8"), "hello\n")
})

test("both sides edited: conflict parked, nothing lost", { skip: !ok }, () => {
  const { a, b } = world()
  a.run("encrypt", path.join(a.d, ".claude/memory/revenue.json")); a.run("sync"); b.run("sync")
  fs.writeFileSync(path.join(a.plain, "revenue.json"), '{"mrr":1}\n'); a.run("sync")
  fs.writeFileSync(path.join(b.plain, "revenue.json"), '{"mrr":2}\n')
  const r = b.run("sync"); assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /CONFLICT/)
  assert.equal(fs.readFileSync(path.join(b.plain, "revenue.json"), "utf8"), '{"mrr":2}\n')
  assert.equal(fs.readFileSync(path.join(b.plain, "revenue.json.theirs"), "utf8"), '{"mrr":1}\n')
})

test("add-recipient re-keys files so the new key can decrypt", { skip: !ok }, () => {
  const { a, root } = world()
  a.run("encrypt", path.join(a.d, ".claude/memory/revenue.json"))
  const k2 = path.join(root, "k2.txt"); execFileSync("age-keygen", ["-o", k2], { stdio: "ignore" })
  const pub2 = execFileSync("age-keygen", ["-y", k2], { encoding: "utf8" }).trim()
  const r = a.run("add-recipient", pub2); assert.equal(r.status, 0, r.stderr)
  assert.match(fs.readFileSync(path.join(a.d, ".sops.yaml"), "utf8"), new RegExp(pub2))
  const out = execFileSync("sops", ["-d", "--input-type", "json", "--output-type", "binary", path.join(a.d, ".claude/memory/private/revenue.json.enc")],
    { encoding: "utf8", env: { ...process.env, SOPS_AGE_KEY_FILE: k2 } })
  assert.equal(out, '{"mrr":1234}\n')
})

test("status runs", { skip: !ok }, () => {
  const { a } = world(); const r = a.run("status"); assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /"encrypted": 0/)
})
