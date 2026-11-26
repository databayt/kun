#!/usr/bin/env node
// long.mjs — long mode on the dispatch bus. A `long` issue is a goal; this loop plans it as a checklist, runs one
// step at a time on a free or paid agent, and leaves every step as evidence on the issue (GitHub is the truth).
//   kun-long "<goal>" [--repo R] [--to fcc|opencode|claude|codex|agy] [--hours H] [--steps-max N] [--step-timeout MIN]
//            [--private] [--queue] [--machine <login>|any]
//   kun-long run <n> | status | stop <n|all> | resume <n> | log <n>
// Everything is injectable (gh, exec, clock, sleep, spawn) so node:test drives it with mocks.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REPO, STATE_DIR, MAX_OUTPUT, busRepos, realGh, hostId, login, parseBrief, buildBody, matchIssue, billingGuard,
  loadEngine, installedAgents, buildCommand, execAgent, takeLock, ensureLabels, repoCwd,
} from "./lib.mjs";

export const LONG_AGENTS = ["fcc", "opencode", "claude", "codex", "agy"];
export const LONG_LABELS = [
  ["long", "5319e7", "Long mode: a goal run step by step until done"],
  ["paused", "fbca04", "Long mode paused (stop, deadline or interruption)"],
  ["data:private", "b60205", "Private data: only the claude agent, only in the private repo"],
];
const DEFAULTS = { hours: 8, step_timeout_min: 30, steps_max: 15 };
const here = path.dirname(new URL(import.meta.url).pathname);

const names = (i) => (i.labels || []).map((l) => (typeof l === "string" ? l : l.name));
const val = (i, p) => names(i).find((n) => n.startsWith(p))?.slice(p.length);
const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m` : s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`);

// ---- body: goal + yaml + ## Steps ----------------------------------------------------------
export function parseSteps(body = "") {
  const m = body.match(/^## Steps[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  const steps = [];
  if (m) for (const line of m[1].split("\n")) {
    const k = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+?)\s*$/);
    if (k) steps.push({ done: k[1] !== " ", text: k[2] });
  }
  return { steps, hasSection: !!m };
}

export function goalOf(body = "") {
  return parseBrief(body.replace(/^## Steps[ \t]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, "")).brief;
}

export function appendSteps(body, texts) {
  const stripped = body.replace(/^## Steps[ \t]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, "").trimEnd();
  return `${stripped}\n\n## Steps\n\n${texts.map((t) => `- [ ] ${t}`).join("\n")}\n`;
}

// Tick by text, never by index: a human may have reordered or edited the list.
export function tickStep(body, text) {
  const lines = body.split("\n");
  const i = lines.findIndex((l) => { const k = l.match(/^(\s*[-*]\s+)\[ \]\s+(.+?)\s*$/); return k && k[2] === text; });
  if (i < 0) return null;
  lines[i] = lines[i].replace("[ ]", "[x]");
  return lines.join("\n");
}

export function parsePlan(output, max) {
  const out = [];
  for (const line of String(output || "").split("\n")) {
    const k = line.match(/^\s*[-*]\s+\[ \]\s+(.+?)\s*$/);
    if (k) out.push(k[1]);
  }
  return out.slice(0, max);
}

export function stepVerdict(output) {
  let v = null;
  for (const line of String(output || "").split("\n")) {
    const k = line.match(/^\W*STEP:\s*(done|failed)\b\s*[—–:-]*\s*(.*?)\s*$/i);
    if (k) v = { status: k[1].toLowerCase(), reason: k[2] };
  }
  return v;
}

export function stepBrief(goal, steps, k) {
  const list = steps.map((s) => `- [${s.done ? "x" : " "}] ${s.text}`).join("\n");
  return `${goal}\n\n## Steps\n\n${list}\n\nYou are on step ${k + 1} of ${steps.length}: ${steps[k].text}. Do only this step. If you change files in a git repo, commit with explicit pathspecs and push to main (git pull --rebase first). End your reply with exactly one final line: "STEP: done" or "STEP: failed — <reason>".`;
}

export const planBrief = (goal, max) => `${goal}\n\nWrite a plan as a Markdown checklist of 3–${max} small, independently verifiable steps under the heading \`## Steps\`. Output only the checklist. Change no files.`;

function longComment({ title, agent, host, seconds, output, note }) {
  let out = (output || "").trim();
  let truncated = false;
  if (out.length > MAX_OUTPUT) { out = "…" + out.slice(-MAX_OUTPUT); truncated = true; }
  return [
    `**${title}** — \`${agent}\` on \`${host}\` in ${seconds}s`,
    note ? `\n${note}` : "",
    "",
    "<details open><summary>output" + (truncated ? ` (last ${MAX_OUTPUT} chars)` : "") + "</summary>",
    "",
    "```",
    out.replace(/```/g, "ʼʼʼ") || "(no output)",
    "```",
    "</details>",
  ].join("\n");
}

// ---- resilient gh --------------------------------------------------------------------------
// Retries with backoff; every comment goes to the local journal first and, if posting finally fails, to a backlog
// posted (marked late) after the next successful call. Never throws for a comment.
export function makeBus(rawGh, { n, repo, stateDir = STATE_DIR, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), tries = 5, base = 10_000, max = 300_000, now = Date.now } = {}) {
  fs.mkdirSync(stateDir, { recursive: true });
  const journal = path.join(stateDir, `long-${n}.jsonl`);
  const backlog = [];
  let flushing = false;
  const jot = (e) => { try { fs.appendFileSync(journal, JSON.stringify({ ts: new Date(now()).toISOString(), n, ...e }) + "\n"); } catch {} };
  const postRaw = async (body) => rawGh(["issue", "comment", String(n), "--repo", repo, "--body-file", "-"], { input: body });
  const flush = async () => {
    if (flushing) return;
    flushing = true;
    try {
      while (backlog.length) {
        const b = backlog[0];
        try { await postRaw(`_posted late (written ${b.ts})_\n\n${b.body}`); backlog.shift(); jot({ kind: "late-posted", ts0: b.ts }); } catch { break; }
      }
    } finally { flushing = false; }
  };
  async function gh(args, opts) {
    let err;
    for (let a = 1; a <= tries; a++) {
      try { const r = await rawGh(args, opts); await flush(); return r; } catch (e) {
        err = e;
        if (a < tries) { jot({ kind: "gh-retry", args: args.slice(0, 3), error: String(e.message).split("\n")[0] }); await sleep(Math.min(base * 2 ** (a - 1), max)); }
      }
    }
    throw err;
  }
  // Patient: keep trying until `until` (ms epoch) passes — for the reads and edits the loop cannot go on without.
  async function patient(args, opts, until) {
    for (;;) {
      try { return await gh(args, opts); } catch (e) {
        if (now() >= until) throw e;
        await sleep(max);
      }
    }
  }
  async function comment(body) {
    const e = { ts: new Date(now()).toISOString(), body };
    jot({ kind: "comment", body });
    try { await gh(["issue", "comment", String(n), "--repo", repo, "--body-file", "-"], { input: body }); return true; } catch {
      backlog.push(e); jot({ kind: "backlog", body: e.body.slice(0, 80) }); return false;
    }
  }
  return { gh, patient, comment, flush, backlog, journal };
}

// ---- local state ---------------------------------------------------------------------------
export const files = (n, dir = STATE_DIR) => ({
  stop: path.join(dir, `long-${n}.stop`), pid: path.join(dir, `long-${n}.pid`), log: path.join(dir, `long-${n}.log`), journal: path.join(dir, `long-${n}.jsonl`),
});
const alive = (pid) => { try { process.kill(Number(pid), 0); return true; } catch { return false; } };
export const pidAlive = (f) => { try { return alive(fs.readFileSync(f, "utf8")); } catch { return false; } };

function powerLine() {
  const run = (c, a) => { try { return execFileSync(c, a, { encoding: "utf8", timeout: 5000 }); } catch { return ""; } };
  if (process.platform !== "darwin") return "power: n/a";
  const batt = run("pmset", ["-g", "batt"]).trim().split("\n").slice(0, 2).join(" | ");
  const dis = run("pmset", ["-g"]).split("\n").find((l) => /disablesleep/i.test(l))?.trim() || "disablesleep: unset";
  return `${batt || "power: unknown"}; ${dis}`;
}

function keepAwake() {
  if (process.platform !== "darwin") return;
  try { spawn("caffeinate", ["-i", "-m", "-s", "-w", String(process.pid)], { detached: true, stdio: "ignore" }).unref(); } catch {}
}

function gitLog(cwd, sinceIso) {
  try { return execFileSync("git", ["log", "--oneline", `--since=${sinceIso}`, "-20"], { cwd, encoding: "utf8", timeout: 10_000 }).trim(); } catch { return ""; }
}

// ---- the loop ------------------------------------------------------------------------------
async function claimAsync(g, n, repo, host) {
  const label = `claimed:${host}`;
  try { await g.gh(["label", "create", label, "--repo", repo, "--color", "fbca04", "--description", "Dispatch task taken by this machine", "--force"]); } catch {}
  await g.gh(["issue", "edit", String(n), "--repo", repo, "--add-label", label, "--add-assignee", "@me"]);
  const events = JSON.parse((await g.gh(["api", `repos/${repo}/issues/${n}/events`, "--paginate"])) || "[]");
  const claims = events.filter((e) => e.event === "labeled" && e.label?.name?.startsWith("claimed:"))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id);
  if (claims[0]?.label.name === label) return true;
  try { await g.gh(["issue", "edit", String(n), "--repo", repo, "--remove-label", label]); } catch {}
  return false;
}

// Runs one issue. Returns {state: done|failed|paused|skipped|gone}.
export async function runIssue(n, repo, ctx) {
  const { rawGh, exec = execAgent, now = Date.now, sleep, host, me, engine, stateDir = STATE_DIR, proc = process, installed, log = () => {}, tries, base, max } = ctx;
  const f = files(n, stateDir);
  const bus = makeBus(rawGh, { n, repo, stateDir, sleep, now, tries, base, max });
  const hardStop = now() + 24 * 3600_000; // patience horizon for reads/edits
  const view = async () => JSON.parse(await bus.patient(["issue", "view", String(n), "--repo", repo, "--json", "number,title,body,labels,state"], undefined, hardStop));
  const label = (add, remove) => bus.patient(["issue", "edit", String(n), "--repo", repo, ...(add ? ["--add-label", add] : []), ...(remove ? ["--remove-label", remove] : [])], undefined, hardStop).catch(() => {});
  const editBody = (body) => bus.patient(["issue", "edit", String(n), "--repo", repo, "--body-file", "-"], { input: body }, hardStop);
  const say = (b) => bus.comment(b);

  let issue = await view();
  const nm = names(issue);
  if (issue.state && String(issue.state).toUpperCase() !== "OPEN") return { state: "gone" };
  if (!nm.includes("long")) return { state: "skipped", why: "not a long issue" };
  if (nm.includes("done")) return { state: "skipped", why: "done" };
  const claimedBy = nm.find((x) => x.startsWith("claimed:"));
  const failRun = async (why) => { await say(`**long failed** — ${why}`); await label("failed"); return { state: "failed", why }; };

  // refusals
  const { brief: _b, cfg: cfg0 } = parseBrief(issue.body || "");
  const to = val(issue, "to:");
  const agent = !to || to === "any" ? "fcc" : to;
  const lane = val(issue, "lane:") || (agent === "claude" ? "build" : undefined);
  const isPrivate = nm.includes("data:private");
  const privateRepo = engine?.dispatch?.private_repo;
  const guard = billingGuard({ model: cfg0.model, lane });
  if (guard) return failRun(guard);
  if (isPrivate && agent !== "claude") return failRun(`data:private work never goes to a free agent (\`${agent}\`); send it to \`claude\` or drop the label.`);
  if (isPrivate && (!privateRepo || repo !== privateRepo)) return failRun(`data:private work must live in the private repo (engine.json dispatch.private_repo), not \`${repo}\`.`);
  if (installed && !installed.includes(agent)) return { state: "skipped", why: `agent ${agent} not installed here` };
  const cwd = repoCwd(cfg0.repo || cfg0.cwd);
  if (!cwd || !fs.existsSync(cwd)) return failRun(`repo/cwd not found on ${host}: ${cfg0.repo || cfg0.cwd}`);

  // claim
  if (claimedBy && claimedBy !== `claimed:${host}`) return { state: "skipped", why: `claimed by ${claimedBy}` };
  const resumed = claimedBy === `claimed:${host}`;
  if (!resumed && !(await claimAsync(bus, n, repo, host))) return { state: "skipped", why: "lost the claim" };
  if (nm.includes("paused")) await label(undefined, "paused");

  const hours = cfg0.hours || DEFAULTS.hours;
  const stepMs = (cfg0.step_timeout_min || DEFAULTS.step_timeout_min) * 60_000;
  const stepsMax = cfg0.steps_max || DEFAULTS.steps_max;
  const started = now();
  const deadline = started + hours * 3600_000;
  const startIso = new Date(started).toISOString();
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(f.pid, String(process.pid));
  // A stop file older than this process is stale; one written while we started up (claiming takes seconds) is honoured.
  try { if (fs.statSync(f.stop).mtimeMs < Date.now() - process.uptime() * 1000 - 1000) fs.rmSync(f.stop, { force: true }); } catch {}

  let current = { k: null, total: null, child: null };
  const onSig = async (sig) => {
    try { current.child?.kill("SIGTERM"); } catch {}
    try {
      const where = current.k == null ? "before the first step" : `step ${current.k + 1}/${current.total}`;
      const body = `**long interrupted** — ${sig} at ${where}; paused. Resume with \`kun-long resume ${n}\`.`;
      try { fs.appendFileSync(f.journal, JSON.stringify({ ts: new Date(now()).toISOString(), n, kind: "comment", body }) + "\n"); } catch {}
      try { rawGh(["issue", "comment", String(n), "--repo", repo, "--body-file", "-"], { input: body }); } catch {}
      try { rawGh(["issue", "edit", String(n), "--repo", repo, "--add-label", "paused"]); } catch {}
    } finally { fs.rmSync(f.pid, { force: true }); ctx.release?.(); proc.exit?.(sig === "SIGINT" ? 130 : 143); }
  };
  const sigs = ["SIGTERM", "SIGINT"];
  sigs.forEach((s) => proc.on?.(s, onSig));
  const cleanup = () => { sigs.forEach((s) => proc.removeListener?.(s, onSig)); fs.rmSync(f.pid, { force: true }); };

  const envFor = (spec) => agent === "fcc" ? { ...spec, env: { ...spec.env, KUN_FREE_ROUTE: "pool", KUN_FREE_COMBO: "long" } } : spec;
  const runAgent = async (brief, killMs) => {
    const spec = envFor(buildCommand(agent, { brief, cwd, model: agent === "opencode" ? "omniroute/long" : cfg0.model, lane, engine }));
    spec.onSpawn = (c) => { current.child = c; };
    const t0 = now();
    const res = await exec(spec, killMs);
    current.child = null;
    return { ...res, seconds: Math.round((now() - t0) / 1000) };
  };

  try {
    await say([
      `**long started** — \`${agent}\` on \`${host}\`${resumed ? " (resumed)" : ""}`,
      "",
      `| | |`, `|---|---|`,
      `| agent | \`${agent}\`${agent === "fcc" ? " (pool class `long`)" : ""} |`,
      `| deadline | ${new Date(deadline).toISOString()} (${hours}h) |`,
      `| step timeout | ${stepMs / 60_000} min |`,
      `| steps max | ${stepsMax} |`,
      `| repo | \`${cfg0.repo || cfg0.cwd || "kun"}\` (${cwd}) |`,
      `| power | ${(ctx.power || powerLine)()} |`,
      "",
      "_Evidence: one comment per step, the `## Steps` checklist below, a summary at the end. Stop it with `kun-long stop " + n + "`._",
    ].join("\n"));

    // plan
    let { steps, hasSection } = parseSteps(issue.body);
    if (!steps.length) {
      const goal = goalOf(issue.body);
      const r = await runAgent(planBrief(goal, stepsMax), stepMs);
      const plan = parsePlan(r.output, stepsMax);
      await say(longComment({ title: `long plan ${plan.length ? "ready" : "failed"}`, agent, host, seconds: r.seconds, output: r.output, note: plan.length ? `${plan.length} steps.` : "No `- [ ]` lines in the planner's reply." }));
      if (!plan.length) { cleanup(); return failRun("the planning run produced no checklist"); }
      issue = await view();
      await editBody(appendSteps(issue.body, plan));
      hasSection = true;
    }

    const durations = new Map();
    const attempts = new Map();
    for (;;) {
      issue = await view();
      if (String(issue.state).toUpperCase() !== "OPEN") { cleanup(); return { state: "gone" }; }
      steps = parseSteps(issue.body).steps;
      const total = steps.length;
      const k = steps.findIndex((s) => !s.done);
      current = { k: k < 0 ? null : k, total, child: null };

      if (k < 0) {
        const secs = Math.round((now() - started) / 1000);
        const lines = steps.map((s, i) => `${i + 1}. ${s.text}${durations.has(s.text) ? ` — ${fmtDur(durations.get(s.text))}` : ""}`);
        const commits = gitLog(cwd, startIso);
        await say([`**long done** — ${total}/${total} steps in ${fmtDur(secs)} on \`${host}\` (\`${agent}\`)`, "", ...lines, "", "commits since start:", "```", commits.split("\n").slice(0, 20).join("\n") || "(none)", "```"].join("\n"));
        await label("done");
        await bus.patient(["issue", "close", String(n), "--repo", repo, "--reason", "completed"], undefined, hardStop);
        cleanup();
        return { state: "done" };
      }
      if (fs.existsSync(f.stop)) {
        fs.rmSync(f.stop, { force: true });
        await say(`**long paused** — paused by person at step ${k + 1}/${total}. Resume with \`kun-long resume ${n}\`.`);
        await label("paused"); cleanup();
        return { state: "paused", why: "stop" };
      }
      if (now() >= deadline) {
        await say(`**long paused** — deadline (${hours}h) passed at step ${k + 1}/${total}. Resume with \`kun-long resume ${n}\`.`);
        await label("paused"); cleanup();
        return { state: "paused", why: "deadline" };
      }

      const text = steps[k].text;
      const attempt = (attempts.get(text) || 0) + 1;
      attempts.set(text, attempt);
      const r = await runAgent(stepBrief(goalOf(issue.body), steps, k), stepMs);
      const verdict = stepVerdict(r.output);
      const ok = r.code === 0 && !r.timedOut && (!verdict || verdict.status === "done");
      const note = r.timedOut ? `Timed out after ${stepMs / 60_000} min.` : r.code !== 0 ? `Exit code ${r.code}.` : !verdict ? "no STEP line" : verdict.status === "failed" ? `Agent reported: ${verdict.reason || "no reason"}` : undefined;
      await say(longComment({ title: `long step ${k + 1}/${total} ${ok ? "done" : "failed"} (attempt ${attempt})`, agent, host, seconds: r.seconds, output: r.output, note }));
      if (ok) {
        durations.set(text, r.seconds);
        const fresh = await view();
        const next = tickStep(fresh.body, text);
        if (next) await editBody(next);
        else await say(`_Could not tick \`${text}\`: the line was edited on the issue; the loop re-reads the checklist._`);
      } else if (attempt >= 2) {
        cleanup();
        return failRun(`step ${k + 1}/${total} failed twice (${note || "no reason"}); stopping. Fix it on the issue, then \`kun-long resume ${n}\`.`);
      }
    }
  } catch (e) {
    cleanup();
    log(`#${n}: ${String(e.message).split("\n")[0]}`);
    try { await bus.comment(`**long error** — ${String(e.message).split("\n")[0]}; the loop stopped, the issue is intact. Resume with \`kun-long resume ${n}\`.`); } catch {}
    return { state: "error", why: e.message };
  }
}

// Take the machine lock, run `n`, then drain the next open long issues for this machine.
export async function runLong(n, ctx = {}) {
  const rawGh = ctx.rawGh || realGh;
  const stateDir = ctx.stateDir || STATE_DIR;
  const engine = ctx.engine || loadEngine();
  const repos = busRepos(engine);
  const repo0 = ctx.repo || REPO;
  const release = takeLock("long", stateDir);
  if (!release) return [{ n, state: "skipped", why: "another long loop runs here" }];
  const c = { ...ctx, rawGh, stateDir, engine, release, host: ctx.host || hostId(), me: ctx.me || login(rawGh), installed: ctx.installed || installedAgents() };
  try {
    for (const r of repos) { try { ensureLabels(rawGh, LONG_LABELS, r); } catch {} }
    const results = [];
    const seen = new Set();
    let next = { n, repo: repo0 };
    while (next) {
      seen.add(`${next.repo}#${next.n}`);
      let r;
      try { r = await runIssue(next.n, next.repo, c); } catch (e) { r = { state: "error", why: e.message }; }
      results.push({ n: next.n, repo: next.repo, ...r });
      c.log?.(`#${next.n}: ${r.state}`);
      next = nextLong(rawGh, c, repos, seen);
    }
    return results;
  } finally { release(); }
}

// Oldest-first open long issue this machine may take, same matching rules as matchIssue.
export function nextLong(rawGh, c, repos, seen) {
  const cands = [];
  for (const repo of repos) {
    let list = [];
    try { list = JSON.parse(rawGh(["issue", "list", "--repo", repo, "--label", "long", "--state", "open", "--limit", "50", "--json", "number,labels"]) || "[]"); } catch { continue; }
    for (const i of list) if (!seen.has(`${repo}#${i.number}`)) cands.push({ ...i, repo });
  }
  cands.sort((a, b) => a.number - b.number);
  for (const i of cands) {
    const nm = names(i);
    const labels = nm.filter((x) => x !== "to:any").map((name) => ({ name }));
    if (!labels.some((l) => l.name.startsWith("to:"))) labels.push({ name: "to:fcc" });
    if (!nm.includes("dispatch")) continue;
    if (matchIssue({ labels }, { login: c.me, installed: c.installed })) return { n: i.number, repo: i.repo };
  }
  return null;
}

// ---- CLI -----------------------------------------------------------------------------------
const BOOL = new Set(["private", "queue"]);
export function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); o[k] = BOOL.has(k) ? true : argv[++i]; } else o._.push(a);
  }
  return o;
}

const USAGE = 'usage: kun-long "<goal>" [--repo R] [--to fcc|opencode|claude|codex|agy] [--hours H] [--steps-max N] [--step-timeout MIN] [--private] [--queue] [--machine <login>|any]\n       kun-long run <n> | status | stop <n|all> | resume <n> | log <n>';

// File the issue; returns {url, number, repo}.
export function fileLong(argv, { gh = realGh, engine = loadEngine() } = {}) {
  const o = parseArgs(argv);
  const goal = o._.join(" ").trim();
  if (!goal) throw new Error(USAGE);
  const priv = !!o.private;
  const to = o.to || (priv ? "claude" : "fcc");
  if (!LONG_AGENTS.includes(to)) throw new Error(`--to must be one of ${LONG_AGENTS.join(", ")}`);
  if (priv && to !== "claude") throw new Error("--private work runs only on claude: free agents never get private data");
  const issueRepo = priv ? engine?.dispatch?.private_repo : REPO;
  if (!issueRepo) throw new Error("set engine.json dispatch.private_repo to a private databayt repo");
  const num = (k, d) => { if (o[k] === undefined) return d; const v = Number(o[k]); if (!(v > 0)) throw new Error(`--${k} must be a positive number`); return v; };
  const me = login(gh);
  const machine = o.machine || me;
  const labels = ["dispatch", "long", `to:${to}`, `machine:${machine}`, ...(priv ? ["data:private"] : [])];
  ensureLabels(gh, [...LONG_LABELS, ...labels.filter((l) => l.startsWith("to:") || l.startsWith("machine:")).map((n) => [n, "1d76db", "dispatch routing"])], issueRepo);
  const body = buildBody(goal, { repo: o.repo, hours: num("hours", DEFAULTS.hours), step_timeout_min: num("step-timeout", DEFAULTS.step_timeout_min), steps_max: num("steps-max", DEFAULTS.steps_max) });
  const url = gh(["issue", "create", "--repo", issueRepo, "--title", `long: ${goal.split("\n")[0].slice(0, 60)}`, "--body", body, ...labels.flatMap((l) => ["--label", l])]).trim();
  return { url, number: Number(url.match(/(\d+)\s*$/)?.[1]), repo: issueRepo, queue: !!o.queue };
}

export function startDetached(n, repo, { stateDir = STATE_DIR, spawnFn = spawn } = {}) {
  fs.mkdirSync(stateDir, { recursive: true });
  const logFile = files(n, stateDir).log;
  const fd = fs.openSync(logFile, "a");
  const child = spawnFn(process.execPath, [path.join(here, "long.mjs"), "run", String(n), "--in", repo], { detached: true, stdio: ["ignore", fd, fd], env: process.env });
  child.unref?.();
  return { log: logFile, pid: child.pid };
}

export function status(gh = realGh, { engine = loadEngine(), stateDir = STATE_DIR } = {}) {
  const rows = [];
  for (const repo of busRepos(engine)) {
    let list = [];
    try { list = JSON.parse(gh(["issue", "list", "--repo", repo, "--label", "long", "--state", "open", "--limit", "50", "--json", "number,title,body,labels,comments"]) || "[]"); } catch {}
    for (const i of list) {
      const { steps } = parseSteps(i.body);
      const lastStep = [...(i.comments || [])].reverse().find((c) => /\*\*long (step|plan|started|done|paused)/.test(c.body || ""));
      rows.push({ n: i.number, repo, title: i.title, labels: names(i), step: `${steps.filter((s) => s.done).length}/${steps.length}`, running: pidAlive(files(i.number, stateDir).pid), last: lastStep?.createdAt || null });
    }
  }
  return rows.sort((a, b) => a.n - b.n);
}

function findRepo(gh, n, engine) {
  for (const repo of busRepos(engine)) { try { gh(["issue", "view", String(n), "--repo", repo, "--json", "number,labels"]); return repo; } catch {} }
  return REPO;
}

export async function cli(argv, { gh = realGh, out = console.log } = {}) {
  const engine = loadEngine();
  const [cmd, arg] = argv;
  if (cmd === "run" && /^\d+$/.test(arg || "")) {
    const o = parseArgs(argv.slice(2));
    keepAwake();
    const res = await runLong(Number(arg), { repo: o.in || findRepo(gh, arg, engine), log: (m) => out(`${new Date().toISOString()} ${m}`) });
    out(JSON.stringify(res));
    return 0;
  }
  if (cmd === "status" && argv.length === 1) {
    const rows = status(gh, { engine });
    if (!rows.length) out("no open long issues");
    for (const r of rows) out(`#${r.n} ${r.repo} [${r.step}] ${r.running ? "RUNNING" : "idle"} ${r.labels.filter((l) => ["paused", "failed", "done", "data:private"].includes(l) || l.startsWith("claimed:") || l.startsWith("to:")).join(",")} last=${r.last || "-"}  ${r.title}`);
    return 0;
  }
  if (cmd === "stop" && arg) {
    const targets = arg === "all" ? status(gh, { engine }).map((r) => r.n) : [Number(arg)];
    for (const n of targets) { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(files(n).stop, new Date().toISOString()); out(`#${n}: stop requested; the loop pauses after the current step`); }
    return 0;
  }
  if (cmd === "resume" && /^\d+$/.test(arg || "")) {
    const n = Number(arg);
    const repo = findRepo(gh, n, engine);
    fs.rmSync(files(n).stop, { force: true });
    for (const l of ["paused", "failed"]) { try { gh(["issue", "edit", String(n), "--repo", repo, "--remove-label", l]); } catch {} }
    if (pidAlive(files(n).pid)) { out(`#${n}: already running`); return 0; }
    const r = startDetached(n, repo);
    out(`#${n}: resumed (pid ${r.pid}); log ${r.log}`);
    return 0;
  }
  if (cmd === "log" && /^\d+$/.test(arg || "")) {
    const f = files(Number(arg)).log;
    if (!fs.existsSync(f)) { out(`no log at ${f}`); return 1; }
    const r = spawn("tail", ["-n", "80", "-f", f], { stdio: "inherit" });
    await new Promise((res) => r.on("close", res));
    return 0;
  }
  if (["run", "stop", "resume", "log"].includes(cmd) && argv.length <= 2) throw new Error(USAGE);
  const filed = fileLong(argv, { gh, engine });
  out(filed.url);
  if (filed.queue) { out("queued: the runner (or another machine) will pick it up within ~2 minutes"); return 0; }
  const r = startDetached(filed.number, filed.repo);
  out(`started on this machine (pid ${r.pid}); log ${r.log}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli(process.argv.slice(2)).then((c) => process.exit(c || 0)).catch((e) => { console.error(e.message); process.exit(1); });
}
