#!/usr/bin/env node
// memory.mjs — shared org memory, private part encrypted at rest (sops + age) in the public repo.
//   node memory.mjs sync [--no-pull] [--no-push] [--no-commit]
//   node memory.mjs encrypt <path>          move a plaintext private file into encrypted form
//   node memory.mjs status
//   node memory.mjs add-recipient <age1...>
//
// Layout   repo   .claude/memory/private/<rel>.enc   (sops binary mode, one ciphertext per file)
//          local  ~/.kun/memory-private/<rel>        (plaintext, chmod 600, never in git)
// Env      KUN_REPO (default: repo containing this script)  KUN_PRIVATE_DIR (default ~/.kun/memory-private)
//          SOPS_AGE_KEY_FILE (default ~/.config/sops/age/keys.txt)
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
// realpath matters: sops matches path_regex against cwd-relative paths, so symlinked dirs (/var -> /private/var) break it
const REPO = fs.realpathSync(path.resolve(process.env.KUN_REPO || path.join(HERE, "../../..")))
const PLAIN = path.resolve(process.env.KUN_PRIVATE_DIR || path.join(os.homedir(), ".kun/memory-private"))
const PRIV = ".claude/memory/private"
const FACTS = ".claude/memory/facts"
const MEM = ".claude/memory"
const STATE = path.join(PLAIN, ".sync-state.json")
process.env.SOPS_AGE_KEY_FILE ||= path.join(os.homedir(), ".config/sops/age/keys.txt")

const sh = (cmd, args, o = {}) => execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"], ...o })
const git = (...a) => sh("git", a)
const sha = (buf) => createHash("sha256").update(buf).digest("hex")
const log = (...a) => console.log("memory:", ...a)

const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")) } catch { return {} } }
const saveState = (s) => { fs.mkdirSync(PLAIN, { recursive: true, mode: 0o700 }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2), { mode: 0o600 }) }

function walk(dir, pred, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, pred, base, out)
    else if (pred(e.name)) out.push(path.relative(base, p))
  }
  return out
}
const encRels = () => walk(path.join(REPO, PRIV), (n) => n.endsWith(".enc")).map((r) => r.slice(0, -4)).sort()
const plainRels = () => walk(PLAIN, (n) => !n.startsWith(".sync-state") && !n.endsWith(".theirs")).sort()
const encPath = (rel) => path.join(REPO, PRIV, rel + ".enc")
const plainPath = (rel) => path.join(PLAIN, rel)

function encryptFile(plainAbs, rel) {
  const target = `${PRIV}/${rel}.enc`
  const out = sh("sops", ["--config", path.join(REPO, ".sops.yaml"), "-e", "--input-type", "binary", "--output-type", "json", "--filename-override", target, plainAbs])
  fs.mkdirSync(path.dirname(encPath(rel)), { recursive: true })
  fs.writeFileSync(encPath(rel), out)
}
const decryptBuf = (rel) =>
  execFileSync("sops", ["-d", "--input-type", "json", "--output-type", "binary", encPath(rel)], { cwd: REPO, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] })
function writePlain(rel, buf) {
  fs.mkdirSync(path.dirname(plainPath(rel)), { recursive: true, mode: 0o700 })
  fs.writeFileSync(plainPath(rel), buf, { mode: 0o600 })
  fs.chmodSync(plainPath(rel), 0o600)
}

function sync(flags) {
  const state = loadState()
  const host = os.hostname().split(".")[0]
  const report = { updated: [], pushedEdits: [], conflicts: [], added: [] }

  // 1. local edits since last sync
  const edited = new Set(), fresh = new Set()
  for (const rel of plainRels()) {
    const h = sha(fs.readFileSync(plainPath(rel)))
    if (!(rel in state)) fresh.add(rel)
    else if (state[rel] !== h) edited.add(rel)
  }

  // 2. pull (stack concurrent commits, never merge, never force)
  if (!flags.has("--no-pull")) {
    const dirty = git("status", "--porcelain", "--untracked-files=no").trim().length > 0
    try { git("pull", "--rebase", ...(dirty ? ["--autostash"] : []), "origin", "main") }
    catch (e) { throw new Error("git pull --rebase failed; resolve by hand, nothing was pushed:\n" + (e.stderr || e.message)) }
  }

  // 3. reconcile every encrypted file
  const repoRels = new Set(encRels())
  for (const rel of repoRels) {
    const remote = decryptBuf(rel)
    const rh = sha(remote)
    const had = rel in state
    if (edited.has(rel)) {
      if (rh !== state[rel]) { // both sides changed: keep mine, park theirs
        fs.writeFileSync(plainPath(rel) + ".theirs", remote, { mode: 0o600 })
        report.conflicts.push(rel)
        continue
      }
      encryptFile(plainPath(rel), rel)
      state[rel] = sha(fs.readFileSync(plainPath(rel)))
      report.pushedEdits.push(rel)
    } else if (!had || rh !== state[rel] || !fs.existsSync(plainPath(rel))) {
      writePlain(rel, remote)
      state[rel] = rh
      report.updated.push(rel)
    }
  }
  // 4. brand-new local plaintext -> encrypt into the repo
  for (const rel of fresh) {
    if (repoRels.has(rel)) continue
    encryptFile(plainPath(rel), rel)
    state[rel] = sha(fs.readFileSync(plainPath(rel)))
    report.added.push(rel)
  }
  saveState(state)

  // 5. commit ONLY memory paths (explicit pathspecs), push
  let committed = false
  if (!flags.has("--no-commit")) {
    const deleted = git("ls-files", "--deleted", "--", MEM).split("\n").filter(Boolean)
      .filter((f) => !f.startsWith(PRIV) && !f.startsWith(FACTS) && fs.existsSync(encPath(path.relative(MEM, f))))
    const paths = [PRIV, FACTS, ...deleted].filter((p) => fs.existsSync(path.join(REPO, p)) || deleted.includes(p))
    if (paths.length) {
      git("add", "-A", "--", ...paths)
      const pending = git("diff", "--cached", "--name-only", "--", ...paths).trim()
      if (pending) {
        git("commit", "-m", `chore(memory): sync from ${host}`, "--", ...paths)
        committed = true
      }
    }
    if (!flags.has("--no-push") && (committed || git("status", "-sb").split("\n")[0].includes("ahead"))) {
      try { git("push", "origin", "main") }
      catch {
        git("pull", "--rebase", "--autostash", "origin", "main")
        git("push", "origin", "main")
      }
    }
  }
  log(`updated ${report.updated.length}, pushed edits ${report.pushedEdits.length}, new ${report.added.length}, conflicts ${report.conflicts.length}, committed ${committed}`)
  for (const c of report.conflicts) log(`CONFLICT ${c}: remote version saved as ${plainPath(c)}.theirs; merge by hand then sync again`)
  return report
}

function encryptCmd(arg) {
  if (!arg) throw new Error("usage: memory.mjs encrypt <path>")
  const abs = fs.realpathSync(path.resolve(arg))
  const memAbs = path.join(REPO, MEM)
  if (!abs.startsWith(memAbs + path.sep)) throw new Error(`path must be inside ${MEM}/`)
  let rel = path.relative(memAbs, abs)
  if (rel.startsWith("private/")) throw new Error("already inside private/")
  const buf = fs.readFileSync(abs)
  writePlain(rel, buf)
  encryptFile(plainPath(rel), rel)
  const st = loadState(); st[rel] = sha(buf); saveState(st)
  fs.unlinkSync(abs)
  log(`encrypted ${rel} -> ${PRIV}/${rel}.enc ; plaintext now at ${plainPath(rel)} ; repo copy removed from the working tree (sync commits the removal)`)
}

function status() {
  const state = loadState()
  const enc = encRels()
  const edited = [], fresh = [], missing = []
  for (const rel of plainRels()) {
    if (!(rel in state)) fresh.push(rel)
    else if (state[rel] !== sha(fs.readFileSync(plainPath(rel)))) edited.push(rel)
  }
  for (const rel of enc) if (!fs.existsSync(plainPath(rel))) missing.push(rel)
  const cfg = JSON.parse(fs.readFileSync(path.join(HERE, "guard.config.json"), "utf8"))
  const pend = git("ls-files", "--", MEM, ".claude/state").split("\n").filter(Boolean).filter((f) => cfg.pending.some((r) => new RegExp(r).test(f)))
  const hasKey = fs.existsSync(process.env.SOPS_AGE_KEY_FILE)
  console.log(JSON.stringify({ repo: REPO, plainDir: PLAIN, ageKey: hasKey, encrypted: enc.length, notYetDecrypted: missing, localEdits: edited, localNew: fresh, legacyPlaintextTracked: pend.length }, null, 2))
}

function addRecipient(key) {
  if (!/^age1[a-z0-9]{50,}$/.test(key || "")) throw new Error("usage: memory.mjs add-recipient <age1... public key>")
  const f = path.join(REPO, ".sops.yaml")
  let y = fs.readFileSync(f, "utf8")
  let changed = false
  y = y.replace(/^(\s*age:\s*)"([^"]*)"/gm, (m, p, list) => {
    const keys = list.split(",").map((s) => s.trim()).filter(Boolean)
    if (keys.includes(key)) return m
    changed = true
    return `${p}"${[...keys, key].join(",")}"`
  })
  if (!changed) { log("recipient already present (or no age rule found)"); return }
  fs.writeFileSync(f, y)
  for (const rel of encRels()) sh("sops", ["--config", f, "updatekeys", "-y", encPath(rel)])
  log(`added recipient and re-keyed ${encRels().length} files. Commit .sops.yaml + ${PRIV}/ (sync does it).`)
}

const [cmd, ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith("--")))
const args = rest.filter((a) => !a.startsWith("--"))
try {
  if (cmd === "sync") sync(flags)
  else if (cmd === "encrypt") encryptCmd(args[0])
  else if (cmd === "status") status()
  else if (cmd === "add-recipient") addRecipient(args[0])
  else { console.error("usage: memory.mjs sync|encrypt <path>|status|add-recipient <age1...>"); process.exit(2) }
} catch (e) {
  console.error("memory: " + (e.message || e)); process.exit(1)
}
