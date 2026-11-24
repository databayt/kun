#!/usr/bin/env node
// Writes this machine's status to kun/.claude/state/machines/<login>.json (not committed).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { REPO, KUN_DIR, STATE_DIR, realGh, hostId, login, installedAgents, which, matchIssue } from "./lib.mjs";

export function heartbeat(gh = realGh) {
  const me = login(gh);
  const installed = installedAgents();
  const agents = installed.map((a) => {
    const bin = a === "fcc" ? "claude" : a;
    let version = null;
    try { version = execFileSync(which(bin) || bin, ["--version"], { encoding: "utf8", timeout: 8000 }).trim().split("\n")[0]; } catch {}
    return { agent: a, version };
  });
  let queue = null;
  try {
    const issues = JSON.parse(gh(["issue", "list", "--repo", REPO, "--label", "dispatch", "--state", "open", "--limit", "100", "--json", "number,labels"]));
    queue = issues.filter((i) => matchIssue(i, { login: me, installed })).length;
  } catch {}
  let lastPass = null;
  try { lastPass = JSON.parse(fs.readFileSync(path.join(STATE_DIR, "last-pass.json"), "utf8")); } catch {}
  const out = { login: me, host: hostId(), at: new Date().toISOString(), agents, last_pass: lastPass, queue_depth: queue };
  const dir = path.join(KUN_DIR, ".claude/state/machines");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${me}.json`), JSON.stringify(out, null, 2) + "\n");
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(heartbeat(), null, 2));
