#!/usr/bin/env node
// video-tools — the paid tools of the Video line are each person's own opt-in. Free tools are the default;
// a paid tool (departments/video/stages.json, `paid: true`) is used only when it is set up on this machine.
// Plain Node ESM, no dependencies. `list` and `status` cost zero tokens and change nothing.
//
//   node .claude/scripts/video-tools.mjs list [--json]
//        every paid tool: id, label, price, signup and status (ready | not set up)
//   node .claude/scripts/video-tools.mjs status <tool> [--json]      exit 0 when ready, 1 when not set up
//   node .claude/scripts/video-tools.mjs setup <tool> [--no-open] [--dry-run]
//        the quick fix: (1) open the signup page, (2) a tool with a `key`: read it from stdin (a terminal prompts
//        without echo) into the macOS Keychain (service databayt, account <KEY>, the store credentials.sh uses),
//        (3) a tool with an `mcp`: `claude mcp add`, the OAuth sign-in finishes on the first use (/mcp),
//        (4) record the opt-in in ~/.kun/machine/paid-tools.json. The key is never printed or logged.
//   node .claude/scripts/video-tools.mjs remove <tool> [--forget-key]
//        `claude mcp remove`, drop the opt-in record; the key leaves the Keychain only with --forget-key
//   node .claude/scripts/video-tools.mjs --test                      unit tests of the pure parts (no network, no Keychain writes)
//
// ready = the tool's key is in the Keychain, and/or its MCP name is in `claude mcp list`, and/or (a CLI tool) its
// status command exits 0. VIDEO_TOOLS_HOME overrides ~/.kun/machine (tests).

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const STAGES = path.join(HERE, "..", "..", "departments", "video", "stages.json")
const SERVICE = "databayt"
const optInFile = () => path.join(process.env.VIDEO_TOOLS_HOME || path.join(os.homedir(), ".kun", "machine"), "paid-tools.json")

// ---- pure parts ------------------------------------------------------------------------------------
export function paidTools(doc) {
  return Object.entries(doc?.tools ?? {}).filter(([, t]) => t.paid === true).map(([id, t]) => ({ id, label: t.label, price: t.price, setup: t.setup ?? {} }))
}
// `claude mcp list` prints `name: url - status`; the name is everything before the first ": ".
export function parseMcpList(text) {
  return new Set(String(text).split("\n").map((l) => /^([A-Za-z0-9_.-]+): /.exec(l)?.[1]).filter(Boolean))
}
export function mcpAddArgv(id, mcp) {
  return ["mcp", "add", "--transport", mcp.transport || "http", ...(mcp.scope ? ["--scope", mcp.scope] : []), id, mcp.url]
}
export const keychainAddArgv = (key) => ["add-generic-password", "-U", "-s", SERVICE, "-a", key, "-w"] // the value is appended by the caller
export const keychainFindArgv = (key) => ["find-generic-password", "-s", SERVICE, "-a", key, "-w"]
export function isReady(tool, probes) {
  const s = tool.setup
  return !!((s.key && probes.key(s.key)) || (s.mcp && probes.mcp(tool.id)) || (s.cli && probes.cli(s.cli.status)))
}
export function rowOf(tool, probes) {
  return { id: tool.id, label: tool.label, price: tool.price, signup: tool.setup.signup ?? null, status: isReady(tool, probes) ? "ready" : "not set up" }
}

// ---- probes (the real machine) ---------------------------------------------------------------------
let _mcp = null
function realProbes() {
  return {
    key: (k) => spawnSync("security", keychainFindArgv(k), { stdio: ["ignore", "ignore", "ignore"] }).status === 0, // the value is discarded
    mcp: (id) => {
      if (_mcp === null) {
        const r = spawnSync("claude", ["mcp", "list"], { encoding: "utf8", timeout: 60000 })
        _mcp = r.error || r.status !== 0 ? new Set() : parseMcpList(r.stdout)
      }
      return _mcp.has(id)
    },
    cli: (argv) => {
      const r = spawnSync(argv[0], argv.slice(1), { stdio: ["ignore", "ignore", "ignore"], timeout: 30000 })
      return !r.error && r.status === 0
    },
  }
}

const readOptIns = () => { try { return JSON.parse(fs.readFileSync(optInFile(), "utf8")) } catch { return {} } }
function writeOptIns(o) {
  fs.mkdirSync(path.dirname(optInFile()), { recursive: true })
  fs.writeFileSync(optInFile(), JSON.stringify(o, null, 2) + "\n")
}
const who = () => process.env.KUN_LOGIN || process.env.USER || "unknown"

function loadTools() {
  let doc
  try { doc = JSON.parse(fs.readFileSync(STAGES, "utf8")) } catch (e) { fail(`cannot read ${STAGES}: ${e.message}`) }
  return paidTools(doc)
}
function fail(msg, code = 1) { console.error(`video-tools: ${msg}`); process.exit(code) }
function pick(tools, id) {
  const t = tools.find((x) => x.id === id)
  if (!t) fail(`"${id}" is not a paid tool. Paid tools: ${tools.map((x) => x.id).join(", ")}`, 2)
  return t
}

// ---- commands --------------------------------------------------------------------------------------
function list(tools, json) {
  const p = realProbes()
  const rows = tools.map((t) => rowOf(t, p))
  if (json) return console.log(JSON.stringify(rows, null, 2))
  const w = (k) => Math.max(...rows.map((r) => String(r[k]).length))
  for (const r of rows) console.log(`${r.id.padEnd(w("id"))}  ${r.status.padEnd(10)}  ${r.price.padEnd(w("price"))}  ${r.signup}`)
}
function status(tool, json) {
  const r = rowOf(tool, realProbes())
  if (json) console.log(JSON.stringify({ ...r, optIn: readOptIns()[tool.id] ?? null }, null, 2))
  else console.log(`${r.id}: ${r.status}`)
  process.exit(r.status === "ready" ? 0 : 1)
}
async function readSecret(prompt) {
  if (!process.stdin.isTTY) {
    const chunks = []
    for await (const c of process.stdin) chunks.push(c)
    return Buffer.concat(chunks).toString("utf8").trim()
  }
  process.stderr.write(prompt)
  return await new Promise((resolve) => {
    let v = ""
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")
    const on = (c) => {
      for (const ch of c) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off("data", on)
          process.stderr.write("\n")
          return resolve(v.trim())
        }
        if (ch === "\u0003") process.exit(130)
        if (ch === "\u007f") v = v.slice(0, -1)
        else v += ch
      }
    }
    process.stdin.on("data", on)
  })
}
async function setup(tool, flags) {
  const s = tool.setup
  const dry = flags.has("--dry-run")
  const say = (m) => console.log(dry ? `[dry run] ${m}` : m)
  say(`${tool.label} (${tool.price})`)
  if (s.signup) {
    say(`1. open ${s.signup}${flags.has("--no-open") ? " (skipped, --no-open)" : ""}`)
    if (!dry && !flags.has("--no-open")) spawnSync("open", [s.signup], { stdio: "ignore" })
  }
  if (s.key) {
    say(`2. store ${s.key} in the Keychain (service ${SERVICE}, account ${s.key}); the value is read from stdin and never printed`)
    if (!dry) {
      const v = await readSecret(`${s.key}: `)
      if (!v) fail("no key was given; nothing stored", 2)
      const r = spawnSync("security", [...keychainAddArgv(s.key), v], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" })
      if (r.status !== 0) fail(`the Keychain refused the key (security exit ${r.status})`)
    }
  }
  if (s.mcp) {
    const argv = mcpAddArgv(tool.id, s.mcp)
    say(`3. claude ${argv.join(" ")}`)
    if (!dry) {
      const r = spawnSync("claude", argv, { stdio: "inherit" })
      if (r.error || r.status !== 0) fail("`claude mcp add` failed; run the command above by hand")
      console.log(`The ${s.mcp.auth === "oauth" ? "OAuth " : ""}sign-in finishes on the first use: open /mcp in Claude Code and pick ${tool.id}.`)
    }
  }
  if (s.cli) {
    say(`3. ${s.cli.login.join(" ")}`)
    if (!dry) spawnSync(s.cli.login[0], s.cli.login.slice(1), { stdio: "inherit" })
  }
  if (s.docs) say(`docs: ${s.docs} (no verified install command; follow the docs, then it counts as ready only once its MCP is registered)`)
  say(`4. record the opt-in in ${optInFile()}`)
  if (!dry) {
    const o = readOptIns()
    o[tool.id] = { at: new Date().toISOString(), by: who() }
    writeOptIns(o)
    console.log(`${tool.id}: ${rowOf(tool, realProbes()).status}`)
  }
}
function remove(tool, flags) {
  const s = tool.setup
  if (s.mcp) spawnSync("claude", ["mcp", "remove", tool.id], { stdio: "inherit" })
  const o = readOptIns()
  delete o[tool.id]
  writeOptIns(o)
  if (s.key && flags.has("--forget-key")) spawnSync("security", ["delete-generic-password", "-s", SERVICE, "-a", s.key], { stdio: "ignore" })
  console.log(`${tool.id}: removed${s.key && !flags.has("--forget-key") ? ` (the key ${s.key} stays in the Keychain; --forget-key deletes it)` : ""}`)
}

// ---- tests -----------------------------------------------------------------------------------------
async function selfTest() {
  const assert = (await import("node:assert/strict")).default
  const doc = JSON.parse(fs.readFileSync(STAGES, "utf8"))
  const tools = paidTools(doc)
  assert.deepEqual(tools.map((t) => t.id).sort(), ["elevenlabs", "epidemic", "fal", "higgs", "veo-api"])
  for (const t of tools) assert.ok(t.price && t.setup.signup, t.id)
  assert.deepEqual(mcpAddArgv("elevenlabs", { transport: "http", url: "https://u" }), ["mcp", "add", "--transport", "http", "elevenlabs", "https://u"])
  assert.deepEqual(mcpAddArgv("fal", { transport: "http", scope: "user", url: "https://u" }), ["mcp", "add", "--transport", "http", "--scope", "user", "fal", "https://u"])
  assert.deepEqual(keychainFindArgv("K"), ["find-generic-password", "-s", "databayt", "-a", "K", "-w"])
  assert.deepEqual(keychainAddArgv("K"), ["add-generic-password", "-U", "-s", "databayt", "-a", "K", "-w"])
  assert.deepEqual([...parseMcpList("Checking MCP server health...\n\nfal: https://mcp.fal.ai/mcp-relay (HTTP) - ✓ Connected\nblender: uvx x - ✗ Failed\n")], ["fal", "blender"])
  const none = { key: () => false, mcp: () => false, cli: () => false }
  const veo = tools.find((t) => t.id === "veo-api"), fal = tools.find((t) => t.id === "fal"), hg = tools.find((t) => t.id === "higgs"), ep = tools.find((t) => t.id === "epidemic")
  assert.equal(rowOf(veo, none).status, "not set up")
  assert.equal(rowOf(veo, { ...none, key: (k) => k === "GEMINI_API_KEY" }).status, "ready")
  assert.equal(rowOf(fal, { ...none, mcp: (id) => id === "fal" }).status, "ready")
  assert.equal(rowOf(fal, { ...none, key: () => true }).status, "not set up", "fal has no key to find")
  assert.equal(rowOf(hg, { ...none, cli: (a) => a[0] === "higgsfield" }).status, "ready")
  assert.equal(rowOf(ep, { key: () => true, mcp: () => true, cli: () => true }).status, "not set up", "epidemic has no verified command")
  // the opt-in record round trip, in a temp folder
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "video-tools-"))
  process.env.VIDEO_TOOLS_HOME = tmp
  assert.deepEqual(readOptIns(), {})
  writeOptIns({ fal: { at: "t", by: "x" } })
  assert.deepEqual(readOptIns(), { fal: { at: "t", by: "x" } })
  // setup --dry-run changes nothing
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "setup", "veo-api", "--dry-run", "--no-open"], { encoding: "utf8", env: { ...process.env, VIDEO_TOOLS_HOME: tmp } })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /\[dry run\] 2\. store GEMINI_API_KEY/)
  assert.deepEqual(readOptIns(), { fal: { at: "t", by: "x" } })
  console.log("video-tools: all checks passed")
}

// ---- main ------------------------------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, ...rest] = process.argv.slice(2)
  const flags = new Set(rest.filter((a) => a.startsWith("--")))
  const id = rest.find((a) => !a.startsWith("--"))
  if (cmd === "--test") await selfTest()
  else if (cmd === "list") list(loadTools(), flags.has("--json"))
  else if (cmd === "status" && id) status(pick(loadTools(), id), flags.has("--json"))
  else if (cmd === "setup" && id) await setup(pick(loadTools(), id), flags)
  else if (cmd === "remove" && id) remove(pick(loadTools(), id), flags)
  else fail("usage: video-tools.mjs list [--json] | status <tool> | setup <tool> [--no-open] [--dry-run] | remove <tool> [--forget-key] | --test", 2)
}
