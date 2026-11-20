#!/usr/bin/env node
// provision.mjs — take a machine to 100% readiness and keep it there. Zero deps.
//
//   node provision.mjs --check | --complete | --maintain  [--only a,b] [--departments x,y]
//        [--role engineer|member] [--json] [--dry-run] [--catalog <path>]
//
// Catalog: .claude/machine/readiness.json. Probe runner: `bash .claude/scripts/kun-ready <probe>`
// (exit 0 pass / 1 fail / 2 skip, one detail line). Test hooks: PROVISION_PROBE_CMD,
// PROVISION_ONBOARD_CMD, PROVISION_STATE_DIR, PROVISION_PLATFORM, RUNS_LEDGER.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync, unlinkSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const HOME = process.env.HOME || homedir();
const STATE_DIR = process.env.PROVISION_STATE_DIR || join(HOME, ".claude/state");
const LEDGER = process.env.RUNS_LEDGER || join(HOME, ".claude/logs/runs.jsonl");
const FIX_TIMEOUT_MS = Number(process.env.PROVISION_FIX_TIMEOUT_MS) || 15 * 60 * 1000;
const CONCURRENCY = 4;
const AGENT_LANES = ["code", "desktop", "agy", "opencode", "hermes"];

// ── args ───────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { mode: null, json: false, dry: false, only: null, departments: null, role: null, catalog: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const val = () => (t.includes("=") ? t.slice(t.indexOf("=") + 1) : argv[++i]);
    if (t === "--check" || t === "--complete" || t === "--maintain") a.mode = t.slice(2);
    else if (t === "--json") a.json = true;
    else if (t === "--dry-run") a.dry = true;
    else if (t.startsWith("--only")) a.only = val().split(",").filter(Boolean);
    else if (t.startsWith("--departments")) a.departments = val().split(",").filter(Boolean);
    else if (t.startsWith("--role")) a.role = val();
    else if (t.startsWith("--catalog")) a.catalog = val();
  }
  return a;
}

// ── safety ─────────────────────────────────────────────────────
const FORBIDDEN = [/\bsudo\b/, /\brm\s+(-[a-zA-Z]*\s+)*-?[a-zA-Z]*r[a-zA-Z]*\s+(-[a-zA-Z]*\s+)*\/(\s|$|\*)/, /git\s+push\b.*(--force\b|\s-f\b|--force-with-lease)/, /prisma\s+migrate\s+reset/, /\bDROP\b/i];
export function forbidden(cmd) {
  const s = String(cmd || "");
  for (const re of FORBIDDEN) if (re.test(s)) return re.source;
  return null;
}

const SECRET_NAME = /\b([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S+)/gi;
const SECRET_SHAPE = /\b(sk-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,})/g;
export function redact(s) {
  return String(s ?? "")
    .split("\n")[0]
    .replace(SECRET_NAME, "$1=***")
    .replace(SECRET_SHAPE, "***")
    .slice(0, 300);
}

// ── process helpers ────────────────────────────────────────────
function run(file, args, { timeoutMs, cwd, onStderrLine } = {}) {
  return new Promise((res) => {
    let out = "", err = "", done = false, timedOut = false, buf = "";
    const child = spawn(file, args, { cwd: cwd || ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true });
    const finish = (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (buf && onStderrLine) onStderrLine(buf);
      res({ code, out, err, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
      finish(124);
    }, timeoutMs || 30000);
    child.stdout.on("data", (d) => { if (out.length < 20000) out += d; });
    child.stderr.on("data", (d) => {
      if (err.length < 20000) err += d;
      if (onStderrLine) {
        buf += d;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) { onStderrLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      }
    });
    child.on("error", () => finish(127));
    child.on("close", (c) => finish(c ?? 1));
  });
}

async function probe(step) {
  const base = process.env.PROVISION_PROBE_CMD || `bash ${join(ROOT, ".claude/scripts/kun-ready")}`;
  const timeoutS = step.check?.timeoutS || 30;
  const r = await run("bash", ["-c", `${base} "$1"`, "_", step.check?.probe || step.id], { timeoutMs: timeoutS * 1000 });
  const detail = redact(r.timedOut ? `timeout after ${timeoutS}s` : r.out.trim() || r.err.trim());
  if (r.timedOut) return { status: "fail", detail };
  if (r.code === 0) return { status: "pass", detail };
  if (r.code === 2) return { status: "skip", detail };
  return { status: "fail", detail };
}

// ── catalog + filters ──────────────────────────────────────────
export function loadCatalog(path) {
  const p = path || join(ROOT, ".claude/machine/readiness.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

function readProfile() {
  try { return JSON.parse(readFileSync(join(STATE_DIR, "machine-profile.json"), "utf8")); } catch { return null; }
}

const OS_ALIASES = { darwin: ["darwin", "mac", "macos"], linux: ["linux"], win32: ["win32", "windows", "win"] };
export function select(catalog, { os, departments, role, only }) {
  const aliases = OS_ALIASES[os] || [os];
  const byId = new Map(catalog.steps.map((s) => [s.id, s]));
  let steps = catalog.steps.filter((s) => {
    if (s.os?.length && !s.os.some((o) => aliases.includes(String(o).toLowerCase()))) return false;
    if (departments?.length && s.departments?.length && !s.departments.some((d) => departments.includes(d))) return false;
    if (role && s.roles?.length && !s.roles.includes(role)) return false;
    return true;
  });
  if (only?.length) {
    const keep = new Set();
    const add = (id) => {
      if (keep.has(id) || !byId.has(id)) return;
      keep.add(id);
      for (const d of byId.get(id).after || []) add(d);
    };
    only.forEach(add);
    steps = catalog.steps.filter((s) => keep.has(s.id));
  }
  return steps;
}

// ── lock ───────────────────────────────────────────────────────
function lock() {
  const f = join(STATE_DIR, "locks/provision.lock");
  mkdirSync(dirname(f), { recursive: true });
  if (existsSync(f)) {
    const pid = Number(readFileSync(f, "utf8").trim());
    let alive = false;
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (alive) return null;
  }
  writeFileSync(f, String(process.pid));
  return () => { try { unlinkSync(f); } catch {} };
}

// ── engine ─────────────────────────────────────────────────────
export async function main(argv, out = (s) => process.stdout.write(s)) {
  const args = parseArgs(argv);
  if (!args.mode) {
    out("usage: provision.mjs --check|--complete|--maintain [--only ids] [--departments a,b] [--role engineer|member] [--json] [--dry-run] [--catalog path]\n");
    return 2;
  }
  let catalog;
  try {
    catalog = loadCatalog(args.catalog);
  } catch (e) {
    const fx = join(ROOT, ".claude/skills/provision/fixtures/readiness.json");
    out(`provision: cannot read catalog (${e.code || e.message}); pass --catalog <path> (fixture: ${fx})\n`);
    return 2;
  }
  const release = lock();
  if (!release) { out("provision: another run is in progress\n"); return 3; }
  try { return await execute(args, catalog, out); } finally { release(); }
}

async function execute(args, catalog, out) {
  const profile = readProfile();
  const departments = args.departments || profile?.departments || null;
  const role = args.role || profile?.role || null;
  const os = process.env.PROVISION_PLATFORM || platform();
  const steps = select(catalog, { os, departments, role, only: args.only });
  const ids = new Set(steps.map((s) => s.id));
  const now = () => new Date().toISOString();
  const events = [];
  const prevState = (() => { try { return JSON.parse(readFileSync(join(STATE_DIR, "readiness.json"), "utf8")); } catch { return {}; } })();
  const lastUpdate = { ...(prevState.lastUpdate || {}) };

  const emit = (ev) => {
    events.push(ev);
    if (args.json) out(JSON.stringify(ev) + "\n");
    else if (ev.type === "step") out(`  ${ev.status.padEnd(16)} ${ev.id.padEnd(22)} ${ev.detail || ""}\n`);
    else if (ev.type === "progress") out(`  [${ev.phase}/${ev.of}] ${ev.label}\n`);
    else if (ev.type === "start") out(`provision ${ev.mode} · catalog ${ev.catalogVersion} · ${ev.total} steps\n`);
    else if (ev.type === "pass") out(`-- pass ${ev.n}\n`);
  };
  const emitStep = (s, status, detail = "") => emit({ type: "step", id: s.id, stage: s.stage, status, detail: redact(detail) });

  emit({ type: "start", mode: args.mode, catalogVersion: catalog.version, total: steps.length });

  const status = new Map(); // id -> {status, detail}
  const attempted = new Set();

  async function checkAll(quietPass) {
    const res = new Map();
    const pending = new Set(steps.map((s) => s.id));
    const running = new Set();
    const settle = (s, r) => {
      res.set(s.id, r);
      let st = r.status;
      if (st === "fail" && s.human) st = "human";
      if (st === "fail" && !s.human && s.fix && s.fix.kind !== "auto" && r.status === "fail") {
        r = { ...r, detail: `${r.detail}${r.detail ? " · " : ""}fix:${s.fix.kind}${s.fix.cmd ? " " + s.fix.cmd : s.fix.url ? " " + s.fix.url : s.fix.message ? " " + s.fix.message : ""}`.trim() };
      } else if (st === "human") {
        r = { ...r, detail: `${r.detail}${r.detail ? " · " : ""}needs you${s.fix?.message ? ": " + s.fix.message : s.fix?.cmd ? ": " + s.fix.cmd : s.fix?.url ? ": " + s.fix.url : ""}` };
      }
      res.set(s.id, { ...r, status: r.status === "fail" && s.human ? "human" : r.status });
      emitStep(s, res.get(s.id).status, res.get(s.id).detail);
    };
    await new Promise((done) => {
      const tick = () => {
        for (const s of steps) {
          if (!pending.has(s.id)) continue;
          const deps = (s.after || []).filter((d) => ids.has(d));
          if (deps.some((d) => !res.has(d))) continue;
          pending.delete(s.id);
          const bad = deps.find((d) => ["fail", "blocked", "human"].includes(res.get(d).status));
          if (bad) { settle(s, { status: "blocked", detail: `after ${bad}` }); continue; }
          if (running.size >= CONCURRENCY) { pending.add(s.id); break; }
          running.add(s.id);
          probe(s).then((r) => { running.delete(s.id); settle(s, r); tick(); });
        }
        if (!pending.size && !running.size) done();
      };
      tick();
    });
    return res;
  }

  const count = (res) => {
    let passed = 0, applicable = 0;
    for (const r of res.values()) { if (r.status === "skip") continue; applicable++; if (r.status === "pass") passed++; }
    return { passed, applicable };
  };

  async function fix(s) {
    attempted.add(s.id);
    const cmd = s.fix?.cmd;
    const bad = forbidden(cmd);
    if (bad) { emitStep(s, "fail", `refused: fix matches guardrail /${bad}/`); return false; }
    if (args.dry) { emitStep(s, "fixing", `dry-run: ${cmd}`); return false; }
    emitStep(s, "fixing", cmd);
    const r = await run("bash", ["-lc", cmd], { timeoutMs: FIX_TIMEOUT_MS });
    if (r.code === 0) { emitStep(s, "fixed", ""); return true; }
    emitStep(s, "fail", r.timedOut ? "fix timed out" : `fix exited ${r.code}: ${r.err.trim().split("\n").pop() || ""}`);
    return false;
  }

  async function onboardingDelta(res) {
    const failing = steps.filter((s) => ["foundation", "agents", "repos"].includes(s.stage) && res.get(s.id)?.status === "fail" && s.fix?.kind === "auto");
    if (!failing.length) return;
    const missing = AGENT_LANES.filter((l) => failing.some((s) => s.stage === "agents" && (s.id.includes(l) || s.check?.probe?.includes(l))));
    const cmd = process.env.PROVISION_ONBOARD_CMD || `bash ${join(ROOT, ".claude/scripts/onboarding-mac.sh")} --quiet --agents=${missing.join(",") || "none"}`;
    if (args.dry) { emit({ type: "progress", phase: 0, of: 8, label: `dry-run: ${cmd}` }); return; }
    await run("bash", ["-lc", cmd], {
      timeoutMs: FIX_TIMEOUT_MS,
      onStderrLine: (l) => {
        const m = /^PROGRESS:(\d+)\/(\d+):(.*)$/.exec(l);
        if (m) emit({ type: "progress", phase: Number(m[1]), of: Number(m[2]), label: redact(m[3]) });
      },
    });
  }

  let res;
  let n = 0;
  const complete = args.mode === "complete" || args.mode === "maintain";
  n++; emit({ type: "pass", n });
  res = await checkAll();
  if (complete) {
    if (!args.dry) await onboardingDelta(res); else await onboardingDelta(res);
    // the delta may have healed things; re-check only if it ran
    let prev = count(res).passed;
    let first = true;
    for (;;) {
      const fixable = steps.filter((s) => res.get(s.id)?.status === "fail" && !s.human && s.fix?.kind === "auto" && s.fix.cmd && !attempted.has(s.id));
      if (!fixable.length || args.dry && !first) break;
      for (const s of fixable) await fix(s);
      if (args.dry) break;
      if (n >= 3) break;
      n++; emit({ type: "pass", n });
      res = await checkAll();
      const c = count(res).passed;
      if (c <= prev) break;
      prev = c;
      first = false;
    }
  }

  // maintain: updates that are due
  if (args.mode === "maintain") {
    for (const s of steps) {
      if (!s.update || res.get(s.id)?.status !== "pass") continue;
      const gap = s.update.cadence === "weekly" ? 7 * 864e5 : 864e5;
      const last = lastUpdate[s.id] ? Date.parse(lastUpdate[s.id]) : 0;
      if (Date.now() - last < gap) continue;
      if (!s.update.auto) { emitStep(s, "update-available", s.update.cmd); continue; }
      const bad = forbidden(s.update.cmd);
      if (bad) { emitStep(s, "fail", `refused: update matches guardrail /${bad}/`); continue; }
      if (args.dry) { emitStep(s, "update-available", `dry-run: ${s.update.cmd}`); continue; }
      const r = await run("bash", ["-lc", s.update.cmd], { timeoutMs: FIX_TIMEOUT_MS });
      if (r.code === 0) { lastUpdate[s.id] = now(); emitStep(s, "updated", ""); }
      else emitStep(s, "fail", `update exited ${r.code}`);
    }
  }

  const { passed, applicable } = count(res);
  const failing = steps.filter((s) => ["fail", "blocked", "human"].includes(res.get(s.id)?.status)).map((s) => s.id);
  const human = steps.filter((s) => res.get(s.id)?.status === "human").map((s) => s.id);
  const percent = applicable ? Math.round((passed / applicable) * 1000) / 10 : 100;
  emit({ type: "done", percent, passed, applicable, failing, human });
  if (!args.json) out(`\n${percent}% ready (${passed}/${applicable})${failing.length ? " · failing: " + failing.join(", ") : ""}${human.length ? " · needs a person: " + human.join(", ") : ""}\n`);

  if (!args.dry) {
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      const at = now();
      writeFileSync(join(STATE_DIR, "readiness.json"), JSON.stringify({
        catalogVersion: catalog.version, at, percent, failing, human,
        steps: steps.map((s) => ({ id: s.id, status: res.get(s.id)?.status, detail: redact(res.get(s.id)?.detail), at })),
        lastUpdate,
      }, null, 2));
      mkdirSync(dirname(LEDGER), { recursive: true });
      appendFileSync(LEDGER, JSON.stringify({
        ts: at.replace(/\.\d+Z$/, "Z"), job: "provision", status: failing.length ? "warn" : "ok",
        summary: `${args.mode}: ${percent}% ready (${passed}/${applicable})${failing.length ? "; failing " + failing.join(",") : ""}`,
        needs_human: human.length > 0,
      }) + "\n");
    } catch {}
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(redact(e.message)); process.exit(1); });
}
