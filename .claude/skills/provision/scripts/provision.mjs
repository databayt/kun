#!/usr/bin/env node
// provision.mjs — take a machine to 100% readiness and keep it there. Zero deps.
//
//   node provision.mjs --check | --complete | --maintain  [--only a,b] [--departments x,y]
//        [--role engineer|member] [--json] [--dry-run] [--catalog <path>]
//   node provision.mjs --uninstall --only a,b  [--json] [--dry-run] [--catalog <path>]
//
// --uninstall removes the named steps (requires --only; exits 2 without it) using each step's
// catalog `uninstall` command: dependents first; a step another installed step needs is `blocked`;
// terminal + keystone uninstalls are handed off as `human`, never run here. A removed or handed-off
// step is recorded in <STATE_DIR>/readiness-optout.json so --check shows it `skip` ("removed by
// you") and --complete does not reinstall it; `--complete --only <id>` clears the opt-out.
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
const OPTOUT_GRACE_MS = 30 * 60 * 1000; // a handed-off removal may still be in progress
const AGENT_LANES = ["code", "desktop", "agy", "opencode", "hermes"];

// ── args ───────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { mode: null, json: false, dry: false, only: null, departments: null, role: null, catalog: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const val = () => (t.includes("=") ? t.slice(t.indexOf("=") + 1) : argv[++i]);
    if (t === "--check" || t === "--complete" || t === "--maintain" || t === "--uninstall") a.mode = t.slice(2);
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
    out("usage: provision.mjs --check|--complete|--maintain [--only ids] [--departments a,b] [--role engineer|member] [--json] [--dry-run] [--catalog path]\n       provision.mjs --uninstall --only ids [--json] [--dry-run] [--catalog path]\n");
    return 2;
  }
  if (args.mode === "uninstall" && !args.only?.length) {
    out("usage: provision.mjs --uninstall --only <id,id> [--json] [--dry-run]  (--only is required: nothing is removed by default)\n");
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

  // opt-out: steps a person removed on purpose — never reinstalled behind their back
  const optoutFile = join(STATE_DIR, "readiness-optout.json");
  const optout = (() => { try { return { ...(JSON.parse(readFileSync(optoutFile, "utf8")).removed || {}) }; } catch { return {}; } })();
  let optoutDirty = false;
  const saveOptout = () => {
    if (args.dry || !optoutDirty) return;
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(optoutFile, JSON.stringify({ removed: optout }, null, 2));
      optoutDirty = false;
    } catch {}
  };
  // `--complete --only <id>` on an opted-out id is an explicit reinstall
  if ((args.mode === "complete" || args.mode === "maintain") && args.only?.length) {
    for (const id of args.only) if (id in optout) { delete optout[id]; optoutDirty = true; }
    saveOptout();
  }
  const applyOptout = (s, r) => {
    const at = optout[s.id];
    if (!at) return r;
    if (r.status !== "pass") return { status: "skip", detail: "removed by you" };
    if (Date.now() - Date.parse(at) > OPTOUT_GRACE_MS) { delete optout[s.id]; optoutDirty = true; return r; }
    return { status: "skip", detail: "removal in progress" };
  };

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
          probe(s).then((r) => { running.delete(s.id); settle(s, applyOptout(s, r)); tick(); });
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
    if (Object.keys(optout).length) return; // the onboarding script would reinstall what was removed
    if (os === "win32" && !process.env.PROVISION_ONBOARD_CMD) return; // onboarding-mac.sh is macOS; Windows steps carry their own fixes
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

  async function uninstallAll() {
    const byId = new Map(catalog.steps.map((s) => [s.id, s]));
    const targets = [];
    for (const id of args.only) {
      const s = steps.find((x) => x.id === id);
      if (s) targets.push(s);
      else emit({ type: "step", id, stage: byId.get(id)?.stage ?? null, status: "fail", detail: byId.has(id) ? "not applicable on this machine" : "no such step" });
    }
    // transitive `after`: a step goes before everything it depends on
    const needs = (s, seen = new Set()) => {
      for (const d of byId.get(s.id)?.after || []) if (!seen.has(d)) { seen.add(d); needs({ id: d }, seen); }
      return seen;
    };
    const dep = new Map(targets.map((s) => [s.id, needs(s)]));
    const order = [];
    const left = [...targets];
    while (left.length) {
      const i = left.findIndex((s) => !left.some((t) => t !== s && dep.get(t.id).has(s.id)));
      order.push(...left.splice(i < 0 ? 0 : i, 1));
    }
    const targetIds = new Set(targets.map((s) => s.id));
    const universe = select(catalog, { os });
    const record = (s) => { optout[s.id] = now(); optoutDirty = true; saveOptout(); };
    for (const s of order) {
      const u = s.uninstall;
      if (!u || !u.cmd) { emitStep(s, "fail", "no uninstaller"); continue; }
      if (u.kind === "terminal" || u.keystone) {
        emitStep(s, "human", u.cmd);
        if (!args.dry) record(s);
        continue;
      }
      const needers = [];
      for (const o of universe) {
        if (targetIds.has(o.id) || !(o.after || []).includes(s.id)) continue;
        if ((await probe(o)).status === "pass") needers.push(o.id);
      }
      if (needers.length) { emitStep(s, "blocked", `needed by: ${needers.join(", ")}`); continue; }
      const bad = forbidden(u.cmd);
      if (bad) { emitStep(s, "fail", `refused: uninstall matches guardrail /${bad}/`); continue; }
      if (args.dry) { emitStep(s, "removing", `dry-run: ${u.cmd}`); continue; }
      emitStep(s, "removing", u.cmd);
      const r = await run("bash", ["-lc", u.cmd], { timeoutMs: FIX_TIMEOUT_MS });
      if (r.code === 0) { record(s); emitStep(s, "removed", ""); }
      else emitStep(s, "fail", r.timedOut ? "uninstall timed out" : `uninstall exited ${r.code}: ${r.err.trim().split("\n").pop() || ""}`);
    }
  }

  if (args.mode === "uninstall") await uninstallAll();

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

  saveOptout();
  // An --only run looked at part of the catalog: fold it into the last full picture, so the
  // percent and the state file keep describing the whole computer, not the few steps just run.
  const stamp = now();
  const order = new Map(catalog.steps.map((s, i) => [s.id, i]));
  const kept = args.only?.length && Array.isArray(prevState.steps) ? prevState.steps.filter((p) => p && order.has(p.id) && !ids.has(p.id)) : [];
  const picture = [
    ...kept.map((p) => ({ id: p.id, status: p.status, detail: p.detail, at: p.at })),
    ...steps.map((s) => ({ id: s.id, status: res.get(s.id)?.status, detail: redact(res.get(s.id)?.detail), at: stamp })),
  ].sort((a, b) => order.get(a.id) - order.get(b.id));
  const applicable = picture.filter((p) => p.status !== "skip").length;
  const passed = picture.filter((p) => p.status === "pass").length;
  const failing = picture.filter((p) => ["fail", "blocked", "human"].includes(p.status)).map((p) => p.id);
  const human = picture.filter((p) => p.status === "human").map((p) => p.id);
  const percent = applicable ? Math.round((passed / applicable) * 1000) / 10 : 100;
  emit({ type: "done", percent, passed, applicable, failing, human });
  if (!args.json) out(`\n${percent}% ready (${passed}/${applicable})${failing.length ? " · failing: " + failing.join(", ") : ""}${human.length ? " · needs a person: " + human.join(", ") : ""}\n`);

  if (!args.dry) {
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      const at = stamp;
      writeFileSync(join(STATE_DIR, "readiness.json"), JSON.stringify({
        catalogVersion: catalog.version, at, percent, failing, human, removed: Object.keys(optout),
        steps: picture,
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
