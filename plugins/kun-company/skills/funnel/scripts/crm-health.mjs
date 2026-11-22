#!/usr/bin/env node
// crm-health.mjs — the Sales department's health check. Prints {ok, rows:[{name, level, critical, detail}]}
// (level: ok | warn | fail), the shape machine/src/components/pack/health.rs reads. Zero dependencies,
// read-only, never prints a secret, always exits 0 with valid JSON.
//
//   node ~/.claude/skills/funnel/scripts/crm-health.mjs [--json]

import { spawnSync } from "node:child_process"
import https from "node:https"

const HOST = "crm-api.databayt.org" // content/docs/crm.mdx: the public API
const KEY_NAMES = ["TWENTY_API_KEY", "TWENTY_API_KEY_DATABAYT"]
const rows = []
const add = (name, level, critical, detail) => rows.push({ name, level, critical, detail })

function keyRow() {
  const found = KEY_NAMES.find((n) => (process.env[n] ?? "").trim())
  if (found) return add("CRM key", "ok", true, `${found} is set`)
  if (process.platform === "darwin") {
    try {
      const r = spawnSync("security", ["find-generic-password", "-s", "databayt-twenty", "-a", "hogwarts"], { stdio: "ignore", timeout: 3000 })
      if (r.status === 0) return add("CRM key", "ok", true, "in the Keychain (databayt-twenty)")
    } catch {}
  }
  add("CRM key", "warn", true, `${KEY_NAMES.join(" / ")} not set and no Keychain entry (databayt-twenty)`)
}

function reachable() {
  return new Promise((resolve) => {
    const t0 = Date.now()
    let done = false
    const finish = (level, detail) => {
      if (done) return
      done = true
      add("CRM API reachable", level, true, detail)
      resolve()
    }
    try {
      const req = https.request({ host: HOST, path: "/", method: "HEAD", timeout: 3000 }, (res) => {
        res.resume()
        const ms = Date.now() - t0
        finish(ms <= 3000 ? "ok" : "warn", `${HOST} answered ${res.statusCode} in ${ms} ms`)
      })
      req.on("timeout", () => {
        req.destroy()
        finish("warn", `${HOST} did not answer within 3 s`)
      })
      req.on("error", (e) => finish("warn", `${HOST}: ${e.code ?? e.message}`))
      req.end()
      setTimeout(() => finish("warn", `${HOST} did not answer within 3 s`), 3200).unref?.()
    } catch (e) {
      finish("warn", String(e?.message ?? e))
    }
  })
}

function ghRow() {
  try {
    const r = spawnSync("gh", ["auth", "status"], { encoding: "utf8", timeout: 5000, windowsHide: true })
    if (r.error) return add("gh signed in", "warn", false, "gh is not installed")
    return r.status === 0 ? add("gh signed in", "ok", false, "signed in") : add("gh signed in", "warn", false, "run gh auth login")
  } catch (e) {
    add("gh signed in", "warn", false, String(e?.message ?? e))
  }
}

try {
  keyRow()
  await reachable()
  ghRow()
} catch (e) {
  add("crm-health", "warn", false, String(e?.message ?? e))
}
console.log(JSON.stringify({ ok: rows.every((r) => r.level === "ok"), rows }, null, 2))
process.exit(0)
