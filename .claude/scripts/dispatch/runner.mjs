#!/usr/bin/env node
// One pass of the dispatch runner: claim and run open tasks addressed to this machine.
import fs from "node:fs";
import path from "node:path";
import {
  REPO, STATE_DIR, WEB_AGENTS, realGh, hostId, login, parseBrief, matchIssue, installedAgents, busyAgents, takeLock,
  claim, billingGuard, buildCommand, execAgent, formatComment, lastLedgerRun, loadEngine, repoCwd, ensureLabels,
} from "./lib.mjs";

export async function runTask(gh, issue, agent, { host, engine, exec = execAgent, now = Date.now } = {}) {
  const n = issue.number;
  const { brief, cfg } = parseBrief(issue.body || "");
  const lane = (issue.labels || []).map((l) => l.name || l).find((x) => x.startsWith("lane:"))?.slice(5);
  const comment = (b) => gh(["issue", "comment", String(n), "--repo", REPO, "--body-file", "-"], { input: b });
  const finish = (ok) => {
    gh(["issue", "edit", String(n), "--repo", REPO, "--add-label", ok ? "done" : "failed"]);
    if (ok) gh(["issue", "close", String(n), "--repo", REPO, "--reason", "completed"]);
  };
  const bad = billingGuard({ model: cfg.model, lane });
  const cwd = repoCwd(cfg.repo || cfg.cwd);
  const refuse = bad || (!cwd || !fs.existsSync(cwd) ? `repo/cwd not found on ${host}: ${cfg.repo || cfg.cwd}` : null);
  if (refuse) {
    comment(formatComment({ agent, host, ok: false, code: 78, output: refuse, seconds: 0 }));
    finish(false);
    return { ok: false, refused: true };
  }
  const spec = buildCommand(agent, { brief, cwd, model: cfg.model, lane, engine });
  const started = now();
  const res = await exec(spec, (cfg.timeout_min || 30) * 60_000);
  const ok = res.code === 0 && !res.timedOut;
  const runId = agent === "claude" ? lastLedgerRun(`dispatch:claude`, started) : null;
  const note = !ok && res.code === 75 && WEB_AGENTS.includes(agent) ? "No web seat could answer: capped today, signed out, limited or a CAPTCHA. Sign in once with `bash ~/.claude/bin/chrome-debug.sh 9222 <site url>`, or send the task to another agent." : undefined;
  comment(formatComment({ agent, host, ok, code: res.code, timedOut: res.timedOut, output: res.output, seconds: Math.round((now() - started) / 1000), runId, note }));
  finish(ok);
  return { ok, ...res };
}

export async function pass({ gh = realGh, exec = execAgent, installed, stateDir = STATE_DIR, log = console.log } = {}) {
  const host = hostId();
  const me = login(gh);
  installed ||= installedAgents();
  const engine = loadEngine();
  const issues = JSON.parse(gh(["issue", "list", "--repo", REPO, "--label", "dispatch", "--state", "open", "--limit", "50", "--json", "number,title,body,labels"]) || "[]");
  const busy = busyAgents(stateDir);
  const results = [];
  const claimedThisPass = new Set();
  for (const issue of issues.sort((a, b) => a.number - b.number)) {
    const m = matchIssue(issue, { login: me, installed, busy: new Set([...busy, ...claimedThisPass]) });
    if (!m) continue;
    const release = takeLock(m.agent, stateDir);
    if (!release) continue;
    try {
      if (!claim(gh, issue.number, host, me)) { log(`#${issue.number}: lost the claim`); results.push({ n: issue.number, lost: true }); continue; }
      log(`#${issue.number}: running on ${m.agent}`);
      const r = await runTask(gh, issue, m.agent, { host, engine, exec });
      results.push({ n: issue.number, agent: m.agent, ok: r.ok });
    } catch (e) { log(`#${issue.number}: ${e.message.split("\n")[0]}`); results.push({ n: issue.number, error: true });
    } finally { release(); claimedThisPass.add(m.agent); }
  }
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, "last-pass.json"), JSON.stringify({ at: new Date().toISOString(), host, login: me, installed, seen: issues.length, results }));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  pass().then((r) => { if (!r.length) console.log("dispatch: nothing for this machine"); }).catch((e) => { console.error("dispatch runner:", e.message); process.exit(1); });
}
