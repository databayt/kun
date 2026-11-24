// dispatch/lib.mjs — the cross-machine work bus on GitHub issues (databayt/kun).
// Pure helpers + an injectable `gh`, so node:test drives the whole thing with a mock.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const REPO = "databayt/kun";
export const AGENTS = ["claude", "codex", "opencode", "agy", "hermes", "fcc"];
// Web seats (scripts/web/web.mjs): text only, on the free quota of a chat site in the vault Chrome. `web` = auto (first seat
// that is free); the others name one seat. Never picked by `to:any`: a person asks for them.
export const WEB_AGENTS = ["web", "chatgpt", "deepseek", "glm", "gemini"];
export const KUN_DIR = process.env.KUN_DIR || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
export const STATE_DIR = process.env.KUN_DISPATCH_DIR || path.join(os.homedir(), ".kun", "dispatch");
export const MAX_OUTPUT = 3500;

export const LABELS = {
  dispatch: ["dispatch", "0e8a16", "Work-bus task for a coding agent"],
  done: ["done", "0e8a16", "Dispatch task finished"],
  failed: ["failed", "d73a4a", "Dispatch task failed"],
};

// The real gh: returns stdout, throws on non-zero. Tests pass a mock with the same shape.
export function realGh(args, { input } = {}) {
  return execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 32 << 20, stdio: ["pipe", "pipe", "pipe"] });
}

function rawHost() {
  if (process.env.KUN_HOST) return process.env.KUN_HOST;
  if (process.platform === "darwin") { try { return execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim(); } catch {} }
  return os.hostname().split(".")[0];
}
export const hostId = () => rawHost().toLowerCase().replace(/[^a-z0-9-]/g, "-");

export function login(gh) {
  return process.env.KUN_LOGIN || gh(["api", "user", "-q", ".login"]).trim();
}

// ---- brief parsing ---------------------------------------------------------------------
// Body = markdown brief + optional fenced ```yaml block {repo, cwd, timeout_min, model}.
export function parseBrief(body = "") {
  const m = body.match(/```ya?ml\s*\n([\s\S]*?)```/i);
  const cfg = {};
  let brief = body;
  if (m) {
    brief = body.replace(m[0], "").trim();
    for (const line of m[1].split("\n")) {
      const k = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.*?)\s*$/);
      if (k) cfg[k[1]] = k[2].replace(/^["']|["']$/g, "");
    }
  }
  if (cfg.timeout_min !== undefined) cfg.timeout_min = Number(cfg.timeout_min) || undefined;
  return { brief: brief.trim(), cfg };
}

export function buildBody(brief, { repo, cwd, timeout_min, model } = {}) {
  const y = Object.entries({ repo, cwd, timeout_min, model }).filter(([, v]) => v !== undefined && v !== "");
  return y.length ? `${brief}\n\n\`\`\`yaml\n${y.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\`\`\`\n` : `${brief}\n`;
}

// ---- labels ---------------------------------------------------------------------------
const names = (issue) => (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name));
const val = (issue, prefix) => names(issue).find((n) => n.startsWith(prefix))?.slice(prefix.length);

// Is this issue ours to run? `installed` = agents present on this machine.
// Returns {agent} or null. `any` takes the first installed agent that is not busy.
export function matchIssue(issue, { login: me, installed, busy = new Set() }) {
  const n = names(issue);
  if (!n.includes("dispatch") || n.includes("done") || n.includes("failed")) return null;
  if (n.some((x) => x.startsWith("claimed:"))) return null;
  const machine = val(issue, "machine:");
  if (machine && machine !== "any" && machine.toLowerCase() !== String(me).toLowerCase()) return null;
  const to = val(issue, "to:") || "any";
  if (to === "any") {
    const pick = AGENTS.find((a) => installed.includes(a) && !busy.has(a));
    return pick ? { agent: pick } : null;
  }
  if (!installed.includes(to) || busy.has(to)) return null;
  return { agent: to };
}

// ---- billing guard --------------------------------------------------------------------
// Subscription only: no Fable / escalate in a headless run, by model name or by lane.
export function billingGuard({ model, lane } = {}) {
  const bad = /fable|mythos|escalate/i;
  if (model && bad.test(model)) return `refused: model "${model}" bills usage credits; headless runs use opus, sonnet or haiku`;
  if (lane && bad.test(lane)) return `refused: lane "${lane}" is attended-only`;
  return null;
}

export function laneModel(lane, engine) {
  const l = engine?.lanes?.[lane || "build"];
  return l && typeof l === "object" ? { model: l.model || undefined, effort: l.effort || undefined } : {};
}

export function loadEngine() {
  try { return JSON.parse(fs.readFileSync(path.join(KUN_DIR, ".claude/engine.json"), "utf8")); } catch { return {}; }
}

// ---- installed agents -----------------------------------------------------------------
export function which(bin, env = process.env) {
  for (const d of (env.PATH || "").split(path.delimiter)) {
    const p = path.join(d, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return null;
}

// launchers.json is the single source of agent CLIs; map its ids/bins to dispatch agent names.
export function installedAgents(whichFn = which) {
  let launchers = [];
  try { launchers = JSON.parse(fs.readFileSync(path.join(KUN_DIR, ".claude/machine/launchers.json"), "utf8")).launchers; } catch {}
  const binOf = Object.fromEntries(launchers.map((l) => [l.bin, l]));
  const out = [];
  for (const a of AGENTS) {
    const bin = a === "fcc" ? "kun-free.sh" : a;
    const kunBin = path.join(KUN_DIR, ".claude/bin", bin);
    const found = whichFn(bin) || (a === "fcc" && fs.existsSync(kunBin) && whichFn("claude") ? kunBin : null);
    if (found && (binOf[bin] || a === "fcc" || launchers.length === 0)) out.push(a);
  }
  if (fs.existsSync(path.join(KUN_DIR, "scripts/web/web.mjs"))) out.push(...WEB_AGENTS);
  return out;
}

// ---- argv per agent -------------------------------------------------------------------
export function buildCommand(agent, { brief, cwd, model, lane, engine }) {
  const lm = laneModel(lane, engine);
  const m = model || lm.model;
  const kunClaude = path.join(KUN_DIR, ".claude/bin/kun-claude.sh");
  const env = { KUN_JOB: `dispatch:${agent}`, KUN_HEADLESS: "1", ...(lane ? { KUN_LANE: lane } : {}) };
  switch (agent) {
    case "claude": {
      const a = ["-p", brief, "--dangerously-skip-permissions"];
      if (m) a.push("--model", m);
      if (lm.effort && !model) a.push("--effort", lm.effort);
      return { cmd: kunClaude, args: a, env, cwd };
    }
    case "fcc":
      return { cmd: path.join(KUN_DIR, ".claude/bin/kun-free.sh"), args: ["-p", brief, "--dangerously-skip-permissions"], env, cwd };
    case "codex":
      return { cmd: "codex", args: ["exec", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check", "-C", cwd, ...(model ? ["-m", model] : []), brief], env, cwd };
    case "opencode":
      return { cmd: "opencode", args: ["run", "--dir", cwd, ...(model ? ["-m", model] : []), brief], env, cwd };
    case "agy":
      return { cmd: "agy", args: ["-p", brief, "--dangerously-skip-permissions", ...(model ? ["--model", model] : [])], env, cwd };
    case "hermes":
      return { cmd: "hermes", args: ["-z", brief, ...(model ? ["-m", model] : [])], env, cwd };
    case "web": case "chatgpt": case "deepseek": case "glm": case "gemini":
      return { cmd: process.execPath, args: [path.join(KUN_DIR, "scripts/web/web.mjs"), "ask", agent === "web" ? "auto" : agent, brief], env: { ...env, KUN_JOB: `dispatch:${agent}` }, cwd };
    default:
      return null;
  }
}

// ---- execution ------------------------------------------------------------------------
export function execAgent(spec, timeoutMs) {
  return new Promise((resolve) => {
    let out = "", timedOut = false;
    const child = spawn(spec.cmd, spec.args, { cwd: spec.cwd, env: { ...process.env, ...spec.env }, stdio: ["ignore", "pipe", "pipe"] });
    const t = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 5000).unref(); }, timeoutMs);
    child.stdout.on("data", (d) => { out += d; if (out.length > 2e6) out = out.slice(-1e6); });
    child.stderr.on("data", (d) => { out += d; if (out.length > 2e6) out = out.slice(-1e6); });
    child.on("error", (e) => { clearTimeout(t); resolve({ code: 127, output: String(e), timedOut: false }); });
    child.on("close", (code) => { clearTimeout(t); resolve({ code: timedOut ? 124 : code ?? 1, output: out, timedOut }); });
  });
}

export function lastLedgerRun(job, since, ledger = process.env.RUNS_LEDGER || path.join(os.homedir(), ".claude/logs/runs.jsonl")) {
  try {
    const lines = fs.readFileSync(ledger, "utf8").trim().split("\n").reverse();
    for (const l of lines) {
      const e = JSON.parse(l);
      if (e.job === job && Date.parse(e.ts) >= since - 2000) return `${e.ts} ${e.job} ${e.status}${e.cost_usd ? ` $${e.cost_usd}` : ""}`;
    }
  } catch {}
  return null;
}

export function formatComment({ agent, host, ok, code, timedOut, output, seconds, runId, note }) {
  const status = timedOut ? "failed: timeout" : ok ? "done" : `failed: exit ${code}`;
  let out = (output || "").trim();
  let truncated = false;
  if (out.length > MAX_OUTPUT) { out = "…" + out.slice(-MAX_OUTPUT); truncated = true; }
  return [
    `**dispatch ${status}** — \`${agent}\` on \`${host}\` in ${seconds}s`,
    note ? `\n${note}` : "",
    "",
    "<details open><summary>output" + (truncated ? ` (last ${MAX_OUTPUT} chars)` : "") + "</summary>",
    "",
    "```",
    out.replace(/```/g, "ʼʼʼ") || "(no output)",
    "```",
    "</details>",
    "",
    `ledger run: ${runId || "n/a (agent does not write the kun ledger)"}`,
  ].filter((x) => x !== undefined).join("\n");
}

// ---- claim ----------------------------------------------------------------------------
// Atomically-ish: add claimed:<host>, then read the label events. The earliest `labeled`
// event whose label starts with claimed: wins (ties broken by event id). Losers back out.
export function claim(gh, number, host, me) {
  const label = `claimed:${host}`;
  try { gh(["label", "create", label, "--repo", REPO, "--color", "fbca04", "--description", "Dispatch task taken by this machine", "--force"]); } catch {}
  gh(["issue", "edit", String(number), "--repo", REPO, "--add-label", label, "--add-assignee", "@me"]);
  const events = JSON.parse(gh(["api", `repos/${REPO}/issues/${number}/events`, "--paginate"]) || "[]");
  const claims = events
    .filter((e) => e.event === "labeled" && e.label?.name?.startsWith("claimed:"))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id);
  const winner = claims[0]?.label.name;
  if (winner === label) return true;
  try { gh(["issue", "edit", String(number), "--repo", REPO, "--remove-label", label]); } catch {}
  return false;
}

// ---- lock -----------------------------------------------------------------------------
export function takeLock(agent, dir = STATE_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${agent}.lock`);
  try {
    const pid = Number(fs.readFileSync(f, "utf8"));
    try { process.kill(pid, 0); return null; } catch { fs.rmSync(f, { force: true }); }
  } catch {}
  try { fs.writeFileSync(f, String(process.pid), { flag: "wx" }); } catch { return null; }
  return () => fs.rmSync(f, { force: true });
}

export function busyAgents(dir = STATE_DIR) {
  const s = new Set();
  for (const a of [...AGENTS, ...WEB_AGENTS]) {
    try { process.kill(Number(fs.readFileSync(path.join(dir, `${a}.lock`), "utf8")), 0); s.add(a); } catch {}
  }
  return s;
}

export function ensureLabels(gh, extra = []) {
  for (const [n, c, d] of [...Object.values(LABELS), ...extra]) {
    try { gh(["label", "create", n, "--repo", REPO, "--color", c, "--description", d, "--force"]); } catch {}
  }
}

export function repoCwd(repo) {
  if (!repo) return KUN_DIR;
  if (path.isAbsolute(repo)) return repo;
  const home = os.homedir();
  for (const p of [path.join(home, repo), path.join(home, "oss", repo), path.join(home, "Documents", repo)]) if (fs.existsSync(p)) return p;
  return null;
}
