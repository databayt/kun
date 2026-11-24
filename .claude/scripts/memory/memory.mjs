#!/usr/bin/env node
// memory.mjs — the org's shared memory, public and plain in this repo. Every agent on every
// machine reads ~/kun/.claude/memory and writes new facts there; `sync` keeps machines in step.
//   node memory.mjs sync [--no-pull] [--no-push]   pull, commit memory paths only, push (never force)
//   node memory.mjs status                         what changed locally under .claude/memory
// Env  KUN_REPO (default: the repo containing this script)
import { execFileSync } from "node:child_process"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(process.env.KUN_REPO || path.join(HERE, "../../.."))
const MEM = ".claude/memory"
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

function changed() {
  return git("status", "--porcelain", "--", MEM).split("\n").filter(Boolean).map((l) => l.slice(3).trim())
}

export function sync({ pull = true, push = true } = {}) {
  if (pull) git("pull", "--rebase", "--autostash", "origin", "main")
  const paths = changed()
  if (paths.length) {
    git("add", "--", ...paths)
    git("commit", "-m", `chore(memory): sync from ${os.hostname().split(".")[0]}`, "--", ...paths)
  }
  if (push && paths.length) git("push", "origin", "main")
  return paths
}

const [cmd, ...rest] = process.argv.slice(2)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (cmd === "sync") {
    const p = sync({ pull: !rest.includes("--no-pull"), push: !rest.includes("--no-push") })
    console.log(p.length ? `memory: synced ${p.length} path(s)` : "memory: up to date")
  } else if (cmd === "status") {
    const p = changed()
    console.log(p.length ? p.join("\n") : "memory: no local changes")
  } else {
    console.log("usage: memory.mjs sync [--no-pull] [--no-push] | status")
    process.exit(cmd ? 1 : 0)
  }
}
