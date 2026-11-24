import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const hasSops = spawnSync("sops", ["--version"]).status === 0

function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "guard-"))
  const g = (...a) => execFileSync("git", a, { cwd: d, encoding: "utf8" })
  g("init", "-q"); g("config", "user.email", "t@t.t"); g("config", "user.name", "t")
  fs.mkdirSync(path.join(d, ".claude/scripts/memory"), { recursive: true })
  for (const f of ["guard.mjs", "guard.config.json"]) fs.copyFileSync(path.join(HERE, f), path.join(d, ".claude/scripts/memory", f))
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), text); g("add", rel) }
  const guard = () => spawnSync("node", [path.join(d, ".claude/scripts/memory/guard.mjs")], { cwd: d, encoding: "utf8" })
  return { put, guard }
}
const fakeKey = () => "sk-ant-" + "a1B2c3D4".repeat(4) // built at runtime so this file holds no key-shaped literal

test("clean commit passes", () => {
  const r = repo(); r.put("src/a.ts", "export const a = 1\n")
  assert.equal(r.guard().status, 0)
})
test("secret blocks, value never printed", () => {
  const r = repo(); r.put("src/a.ts", `const k = "${fakeKey()}"\n`)
  const res = r.guard()
  assert.equal(res.status, 1)
  assert.match(res.stderr, /anthropic-key/)
  assert.doesNotMatch(res.stderr, /a1B2c3D4/)
})
test("placeholder and guard:allow pass", () => {
  const r = repo(); r.put("docs/x.md", 'export ANTHROPIC_API_KEY="sk-ant-......"\npassword = "your-password-here"\n' + `k="${fakeKey()}" guard:allow\n`)
  assert.equal(r.guard().status, 0)
})
test("db url with password blocks, placeholder passes", () => {
  const r = repo(); r.put("a.env", "U=postgres://user:s3cretpass@host/db\n")
  assert.equal(r.guard().status, 1)
  const r2 = repo(); r2.put("a.md", "U=postgres://user:<password>@host/db\n")
  assert.equal(r2.guard().status, 0)
})
test("PII warns outside docs, silent in docs", () => {
  const r = repo(); r.put("src/c.ts", "// call +249 912 345 678 or bob@acme.io\n")
  const res = r.guard(); assert.equal(res.status, 0); assert.match(res.stderr, /phone/); assert.match(res.stderr, /email/)
  const r2 = repo(); r2.put("docs/c.md", "call +249 912 345 678\n")
  assert.doesNotMatch(r2.guard().stderr, /phone/)
})
test("plaintext in enforced private path blocks", () => {
  const r = repo(); r.put(".claude/memory/private/crm.json.enc", '{"a":1}\n')
  const res = r.guard(); assert.equal(res.status, 1); assert.match(res.stderr, /PLAINTEXT/)
})
test("sops-shaped file in private path passes", () => {
  const r = repo(); r.put(".claude/memory/private/crm.json.enc", '{"data":"ENC[AES256_GCM,data:abc,iv:x,tag:y,type:str]","sops":{"version":"3"}}\n')
  assert.equal(r.guard().status, 0)
})
test("README in private/ is allowed; legacy pending path only warns", () => {
  const r = repo(); r.put(".claude/memory/private/README.md", "# private\n"); r.put(".claude/memory/crm.json", "{}\n")
  const res = r.guard(); assert.equal(res.status, 0); assert.match(res.stderr, /pending encrypt switch/)
})
test("real sops output is recognised", { skip: !hasSops }, () => {
  const r = repo()
  const keys = path.join(os.tmpdir(), "guard-age-" + process.pid + ".txt")
  execFileSync("age-keygen", ["-o", keys], { stdio: "ignore" })
  const pub = execFileSync("age-keygen", ["-y", keys], { encoding: "utf8" }).trim()
  const plain = path.join(os.tmpdir(), "guard-plain-" + process.pid); fs.writeFileSync(plain, "secret stuff\n")
  const enc = execFileSync("sops", ["-e", "--age", pub, "--input-type", "binary", "--output-type", "json", plain], { encoding: "utf8", cwd: os.tmpdir() })
  r.put(".claude/memory/private/x.md.enc", enc)
  assert.equal(r.guard().status, 0)
  fs.rmSync(keys); fs.rmSync(plain)
})
