#!/usr/bin/env node
// prune --ns <namespace> --manifest <path> [--repo <dir>] [--match <regex>] [--delete]
//
// Lists the CDN objects under <ns>/ that nothing points at any more — the leftovers of a re-keyed
// publish (hashed names, pre-<lang>/ paths). A key survives when the manifest serves it OR its path
// or its file name appears anywhere in the repo's tracked files (app chrome, marketing art and icons
// are referenced from code — often by bare name through asset() — not the manifest).
// --match picks the candidates; the default is content-hashed names only (<stem>.<sha8>.<ext>), the
// scheme publish no longer writes. Pass --match for a retired clean folder, e.g. '^hogwarts/students/'.
// Read-only by default; --delete removes the listed keys one by one (never a prefix delete).
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { arg, CDN_BUCKET, CDN_HOST, flag, sh } from "./rt.mjs"

const ns = arg("ns"), manifest = arg("manifest"), repo = arg("repo")
if (!ns || !manifest) {
  console.error("usage: prune --ns <ns> --manifest <path> [--repo <dir>] [--match <regex>] [--delete]")
  process.exit(2)
}
const match = new RegExp(arg("match", "\\.[0-9a-f]{8}\\.[a-z0-9]+$"))

const keys = sh("aws", ["s3api", "list-objects-v2", "--bucket", CDN_BUCKET, "--prefix", `${ns}/`, "--query", "Contents[].Key", "--output", "text"])
  .split(/\s+/).filter(Boolean)

const served = new Set()
const walk = (v) => {
  if (typeof v === "string" && v.startsWith(`https://${CDN_HOST}/`)) served.add(v.slice(CDN_HOST.length + 9).split("?")[0])
  else if (v && typeof v === "object") Object.values(v).forEach(walk)
}
walk(JSON.parse(readFileSync(manifest, "utf8")))

// one pass over the repo: which candidate keys (or bare file names) does any tracked file spell out?
const base = (k) => k.slice(k.lastIndexOf("/") + 1)
let candidates = keys.filter((k) => match.test(k) && !served.has(k))
if (repo && candidates.length) {
  const needles = [...new Set(candidates.map(base))]
  const g = spawnSync("git", ["-C", repo, "grep", "-h", "-o", "-F", "-f", "/dev/stdin"], { input: needles.join("\n"), encoding: "utf8", maxBuffer: 64 << 20 })
  const named = new Set(g.stdout.split("\n").filter(Boolean))
  candidates = candidates.filter((k) => !named.has(base(k)))
}

for (const k of candidates) console.log(k)
console.error(`${candidates.length} unreferenced of ${keys.length} under ${ns}/ (manifest serves ${served.size})`)

if (flag("delete")) {
  for (const k of candidates) sh("aws", ["s3", "rm", `s3://${CDN_BUCKET}/${k}`, "--only-show-errors"])
  console.error(`deleted ${candidates.length}`)
}
