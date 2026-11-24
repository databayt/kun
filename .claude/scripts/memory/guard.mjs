#!/usr/bin/env node
// guard.mjs — pre-commit guard for the public kun repo. Staged diff only, so it is fast.
//   BLOCK: a staged file under an "enforced" private path that is not sops-encrypted
//   BLOCK: an added line that looks like a secret (API key, token, private key, DB URL with password)
//   WARN : an added line with a phone number or an external email, outside docs/ and content/
// Usage: node guard.mjs            (hook mode: reads the index of the cwd repo)
// Env  : KUN_GUARD_SKIP=1 skips (the hook shell does it); a line containing "guard:allow" is ignored.
import { execFileSync } from "node:child_process"
import { readFileSync, realpathSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const git = (args, opts = {}) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"], ...opts })

const PLACEHOLDER = /(your|xxx+|\.\.\.|<[^>]*>|\$\{|\$\(|example|changeme|placeholder|redacted|dummy|fake|\*{3,})/i

export const SECRET_RULES = [
  ["anthropic-key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["openai-style-key", /\bsk-[A-Za-z0-9]{32,}/],
  ["github-token", /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["stripe-key", /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/],
  ["private-key-block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["age-secret-key", /AGE-SECRET-KEY-1[A-Z0-9]{40,}/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/],
  ["bearer-token", /Bearer\s+[A-Za-z0-9._-]{30,}/],
  ["db-connection-string", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@"'`/]+:([^\s@"'`]+)@/, 1],
  [
    "credential-assignment",
    /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["']([^"'\s]{10,})["']/i,
    1,
  ],
]
export const PII_RULES = [
  ["phone", /(?<![\w.])\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}(?!\d)/],
  ["email", /\b[A-Za-z0-9._%+-]+@(?!databayt\.org\b|example\.(?:com|org)\b|users\.noreply\.github\.com\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[a-z]{2,}\b/i],
]

export function loadConfig(root) {
  const cfg = JSON.parse(readFileSync(path.join(root, ".claude/scripts/memory/guard.config.json"), "utf8"))
  const rx = (a) => (a || []).map((s) => new RegExp(s))
  return { enforced: rx(cfg.enforced), pending: rx(cfg.pending), docs: rx(cfg.docsPaths), skip: rx(cfg.skipPaths) }
}

export const isSopsEncrypted = (text) => /"sops"\s*:/.test(text) && /ENC\[AES256_GCM,/.test(text)

/** Pure: scan one added line. Returns [{kind, level}] */
export function scanLine(line, { inDocs }) {
  if (line.includes("guard:allow")) return []
  const out = []
  for (const [kind, re, group] of SECRET_RULES) {
    const m = re.exec(line)
    if (!m) continue
    if (group && PLACEHOLDER.test(m[group] || "")) continue
    if (!group && PLACEHOLDER.test(m[0])) continue
    out.push({ kind, level: "block" })
  }
  if (!inDocs) for (const [kind, re] of PII_RULES) if (re.test(line)) out.push({ kind, level: "warn" })
  return out
}

export function run(root = process.cwd()) {
  const cfg = loadConfig(root)
  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"], { cwd: root }).split("\0").filter(Boolean)
  const problems = []
  const warnings = []

  for (const f of staged) {
    if (cfg.enforced.some((r) => r.test(f))) {
      let blob = ""
      try { blob = git(["show", `:${f}`], { cwd: root }) } catch {}
      if (!isSopsEncrypted(blob)) problems.push(`${f}: private path staged in PLAINTEXT (must be sops-encrypted: memory.mjs encrypt)`)
    } else if (cfg.pending.some((r) => r.test(f))) {
      warnings.push(`${f}: private content still plaintext (pending encrypt switch, see .claude/scripts/memory/encrypt-plan.md)`)
    }
  }

  const scan = staged.filter((f) => !cfg.skip.some((r) => r.test(f)))
  if (scan.length) {
    const diff = git(["diff", "--cached", "-U0", "--no-color", "--diff-filter=ACM", "--", ...scan], { cwd: root })
    let file = ""
    let ln = 0
    const seen = new Set()
    for (const line of diff.split("\n")) {
      if (line.startsWith("+++ b/")) { file = line.slice(6); continue }
      const h = /^@@ -\S+ \+(\d+)/.exec(line)
      if (h) { ln = Number(h[1]) - 1; continue }
      if (!line.startsWith("+") || line.startsWith("+++")) continue
      ln++
      if (line.length > 4000) continue
      const inDocs = cfg.docs.some((r) => r.test(file))
      for (const { kind, level } of scanLine(line.slice(1), { inDocs })) {
        const key = `${level}|${file}|${kind}`
        if (seen.has(key)) continue
        seen.add(key)
        const msg = `${file}:${ln}: ${kind}`
        level === "block" ? problems.push(`${msg} (secret pattern; value not shown)`) : warnings.push(`${msg} (PII: ok in docs, reconsider here)`)
      }
    }
  }

  if (warnings.length) console.error(["guard: warnings", ...warnings.map((w) => "  - " + w)].join("\n"))
  if (problems.length) {
    console.error(["guard: COMMIT BLOCKED", ...problems.map((p) => "  x " + p),
      "Fix: remove the secret (and rotate it if it ever left your machine), or encrypt the private file.",
      "Intentional fake? add `guard:allow` on that line. Emergency: KUN_GUARD_SKIP=1."].join("\n"))
    return 1
  }
  return 0
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  let root
  try { root = git(["rev-parse", "--show-toplevel"]).trim() } catch { process.exit(0) }
  process.exit(run(root))
}
