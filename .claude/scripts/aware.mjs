#!/usr/bin/env node
// aware.mjs — kun's SENSE layer: one zero-token snapshot of everything happening.
//
//   node ~/kun/.claude/scripts/aware.mjs              the snapshot as Markdown (refreshes if stale)
//   node ~/kun/.claude/scripts/aware.mjs --refresh    sense now: write state, history, alerts
//   node ~/kun/.claude/scripts/aware.mjs --brief      SessionStart lines — only what needs attention
//   node ~/kun/.claude/scripts/aware.mjs --json       the full snapshot
//   node ~/kun/.claude/scripts/aware.mjs --install    launchd refresher, every 30 min (owner Mac)
//   node ~/kun/.claude/scripts/aware.mjs --uninstall
//
// Writes ~/.claude/state/aware.json (full), ~/.claude/state/aware.md (≤1.5K chars — what
// Hermes reads for "status", what Cowork reads through the filesystem, what the phone gets),
// ~/.claude/logs/aware-history.jsonl (trend, 90 days) and a daily aware-<date>.log line
// (so runs.sh sees the refresher itself go quiet).
//
// Senses: machine (disk, swap, sessions, Remote Control, presence) · jobs (runs.sh) ·
// spend (headless ledger + every transcript's usage, per surface: cli / desktop / sdk-cli) ·
// engine (heartbeat, sync tiers, bench age, findings, decisions due) · queue (reports,
// kun issues by priority, bridge handoffs) · products (latest main CI per repo) ·
// surfaces (Hermes gateway, Slack reconnects, bridge runs) · wip (dirty / unpushed) ·
// running (sessions active in the last 30 min).
//
// Alerts are transitions only: a condition must hold on two refreshes in a row, fires once,
// clears when it goes away, and at most engine.json aware.alert_cap_per_day fire a day.
// Present at the Mac → desktop banner; away → this machine's ~/.claude/.kun-notify target.
// Spend, sync, bench and dirty files are shown, never alerted. Never spends a token.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";

const HOME = os.homedir();
const KUN = process.env.KUN_DIR || path.join(HOME, "kun");
const CLAUDE = path.join(HOME, ".claude");
const STATE_DIR = process.env.KUN_AWARE_STATE_DIR || path.join(CLAUDE, "state"); // override: tests
const LOG_DIR = path.join(CLAUDE, "logs");
const SNAP = path.join(STATE_DIR, "aware.json");
const MD = path.join(STATE_DIR, "aware.md");
const TSTATE = path.join(STATE_DIR, "aware-transcripts.json");
const REPORTS_CACHE = path.join(STATE_DIR, "reports.json");
const HIST = process.env.KUN_AWARE_STATE_DIR ? path.join(STATE_DIR, "aware-history.jsonl") : path.join(LOG_DIR, "aware-history.jsonl");
const ENGINE_PATH = path.join(KUN, ".claude", "engine.json");
const MAC = process.platform === "darwin";
const NOW = Date.now();
const TODAY = new Date().toISOString().slice(0, 10);

const readJSON = (p, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return d;
  }
};
const writeAtomic = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
};
const run = (cmd, args, timeout = 15000, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"], ...opts });
  } catch {
    return null;
  }
};
const runAsync = (cmd, args, timeout = 20000) =>
  new Promise((resolve) => {
    let out = "";
    let done = false;
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        child.kill();
        resolve(null);
      }
    }, timeout);
    child.stdout.on("data", (d) => (out += d));
    child.on("error", () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
    child.on("close", (code) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(code === 0 ? out : null);
      }
    });
  });
const has = (bin) => !!run("/bin/sh", ["-c", `command -v ${bin}`], 3000);
const expand = (p) => (p || "").replace(/^~(?=\/|$)/, HOME);
const r1 = (n) => Math.round(n * 10) / 10;
const hoursAgo = (ms) => (NOW - ms) / 3.6e6;

const engine = readJSON(ENGINE_PATH, {});
const cfg = {
  repos: ["kun", "hogwarts", "mkan", "souq", "marketing", "codebase", "space"],
  refresh_minutes: 30,
  alert_cap_per_day: 6,
  disk_low_gb: 10,
  disk_drop_gb_24h: 5,
  unpushed_hours: 12,
  ...(engine.aware || {}),
};

// ── machine ────────────────────────────────────────────────────────────────
function machine(history) {
  const m = { disk_gb: null, disk_delta_24h: null, swap_pct: null, sessions: null, rc_armed: false, rc_up: null, present: false };
  try {
    const st = fs.statfsSync(HOME);
    m.disk_gb = r1((st.bavail * st.bsize) / 1024 ** 3);
  } catch {}
  if (MAC) {
    const s = run("sysctl", ["-n", "vm.swapusage"], 3000) || "";
    const t = /total = ([\d.]+)M/.exec(s);
    const u = /used = ([\d.]+)M/.exec(s);
    if (t && u && +t[1] > 0) m.swap_pct = Math.round((+u[1] * 100) / +t[1]);
  } else if (fs.existsSync("/proc/meminfo")) {
    const mi = fs.readFileSync("/proc/meminfo", "utf8");
    const t = /SwapTotal:\s+(\d+)/.exec(mi);
    const f = /SwapFree:\s+(\d+)/.exec(mi);
    if (t && f && +t[1] > 0) m.swap_pct = Math.round(((+t[1] - +f[1]) * 100) / +t[1]);
  }
  const ps = run("ps", ["-axo", "tty=,comm="], 5000);
  if (ps) {
    m.sessions = ps
      .split("\n")
      .map((l) => l.trim().split(/\s+/))
      .filter(([tty, comm]) => tty && tty !== "??" && tty !== "?" && comm && path.basename(comm) === "claude").length;
  }
  if (MAC) {
    const rc = engine.devices?.rc_server || {};
    m.rc_armed = fs.existsSync(path.join(HOME, "Library/LaunchAgents/com.databayt.claude-rc.plist"));
    if (m.rc_armed && has("tmux")) m.rc_up = run("tmux", ["has-session", "-t", rc.tmux_session || "kun-rc"], 3000) !== null;
  }
  m.present = fs.existsSync(expand(engine.devices?.presence?.file || "~/.claude/.present"));
  // 24h disk delta from the closest history entry at least 23h old
  const old = [...history].reverse().find((h) => hoursAgo(Date.parse(h.ts)) >= 23);
  if (old && m.disk_gb != null && old.disk_gb != null) m.disk_delta_24h = r1(m.disk_gb - old.disk_gb);
  return m;
}

// ── jobs (runs.sh owns the logic; only on machines that have it) ───────────
function jobs() {
  const rs = [path.join(CLAUDE, "scripts/runs.sh"), path.join(KUN, ".claude/scripts/runs.sh")].find((p) => fs.existsSync(p));
  if (!rs) return null;
  const out = run("bash", [rs, "--json"], 30000, { env: { ...process.env, KUN_DIR: KUN } });
  const j = out ? readJSONString(out) : null;
  if (!j) return null;
  const why = Object.fromEntries((j.rows || []).map((r) => [r.job, r.why]));
  return {
    red: (j.red || []).map((n) => ({ job: n, why: why[n] || "" })),
    stale: (j.stale || []).map((n) => ({ job: n, why: why[n] || "" })),
    needs_human: j.needs_human || [],
    total: (j.rows || []).length,
  };
}
function readJSONString(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ── spend: headless ledger + incremental transcript usage ──────────────────
function headless() {
  const ledger = path.join(LOG_DIR, "runs.jsonl");
  const out = { tokens_24h: 0, usd_24h: 0, runs_24h: 0, tokens_7d: 0, usd_7d: 0, by_job_7d: {} };
  if (!fs.existsSync(ledger)) return out;
  const lines = fs.readFileSync(ledger, "utf8").split("\n").slice(-20000);
  for (const l of lines) {
    const e = readJSONString(l);
    if (!e || e.kind !== "claude") continue;
    const h = hoursAgo(Date.parse(e.ts));
    if (h > 24 * 7) continue;
    out.tokens_7d += e.tokens || 0;
    out.usd_7d += e.cost_usd || 0;
    out.by_job_7d[e.job] = (out.by_job_7d[e.job] || 0) + (e.tokens || 0);
    if (h <= 24) {
      out.tokens_24h += e.tokens || 0;
      out.usd_24h += e.cost_usd || 0;
      out.runs_24h += 1;
    }
  }
  out.usd_24h = r1(out.usd_24h);
  out.usd_7d = r1(out.usd_7d);
  return out;
}

const SURFACE = { cli: "cli", "claude-desktop": "desktop", "sdk-cli": "headless" };
function walkJsonl(dir, sinceMs, acc = []) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJsonl(p, sinceMs, acc);
    else if (e.name.endsWith(".jsonl")) {
      try {
        const st = fs.statSync(p);
        if (st.mtimeMs >= sinceMs) acc.push({ p, size: st.size, mtimeMs: st.mtimeMs });
      } catch {}
    }
  }
  return acc;
}
// Every assistant turn in ~/.claude/projects carries message.usage. Read only the bytes
// appended since the last refresh (offsets in aware-transcripts.json), dedupe the content
// blocks of one message (same message.id + requestId), bucket per day × surface × model.
function interactive(budgetMs = 20000) {
  const t0 = Date.now();
  const st = readJSON(TSTATE, { files: {}, days: {} });
  const root = path.join(CLAUDE, "projects");
  const files = walkJsonl(root, NOW - 8 * 864e5);
  let complete = true;
  for (const f of files) {
    if (Date.now() - t0 > budgetMs) {
      complete = false;
      break;
    }
    const rec = st.files[f.p] || { offset: 0, keys: [] };
    if (f.size < rec.offset) rec.offset = 0; // rewritten
    if (f.size === rec.offset) continue;
    let fd;
    try {
      fd = fs.openSync(f.p, "r");
    } catch {
      continue;
    }
    const recent = new Set(rec.keys || []);
    const project = path.basename(path.dirname(f.p)).replace(/^-Users-[^-]+-?/, "") || "home";
    let pos = rec.offset;
    let carry = "";
    const CHUNK = 8 * 1024 * 1024;
    const buf = Buffer.alloc(CHUNK);
    while (pos < f.size) {
      const n = fs.readSync(fd, buf, 0, Math.min(CHUNK, f.size - pos), pos);
      if (n <= 0) break;
      pos += n;
      const text = carry + buf.toString("utf8", 0, n);
      const lines = text.split("\n");
      carry = lines.pop();
      for (const line of lines) {
        if (line.indexOf('"usage"') < 0 || line.indexOf('"assistant"') < 0) continue;
        const d = readJSONString(line);
        const m = d?.message;
        if (!m?.usage || d.type !== "assistant") continue;
        const key = `${m.id}|${d.requestId}`;
        if (recent.has(key)) continue;
        recent.add(key);
        if (recent.size > 400) recent.delete(recent.values().next().value);
        const day = (d.timestamp || "").slice(0, 10) || TODAY;
        const surface = SURFACE[d.entrypoint] || d.entrypoint || "other";
        const model = (m.model || "unknown").replace(/^claude-/, "");
        const u = m.usage;
        const b = (((st.days[day] ||= {})[surface] ||= {})[model] ||= { in: 0, out: 0, cc: 0, cr: 0, turns: 0 });
        b.in += u.input_tokens || 0;
        b.out += u.output_tokens || 0;
        b.cc += u.cache_creation_input_tokens || 0;
        b.cr += u.cache_read_input_tokens || 0;
        b.turns += 1;
        const pj = (((st.projects ||= {})[day] ||= {})[project] ||= 0);
        st.projects[day][project] = pj + (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      }
    }
    fs.closeSync(fd);
    rec.offset = pos - Buffer.byteLength(carry, "utf8"); // re-read a trailing partial line next time
    rec.keys = [...recent].slice(-400);
    st.files[f.p] = rec;
  }
  // forget files and days older than 8 days
  for (const p of Object.keys(st.files)) if (!files.find((f) => f.p === p)) delete st.files[p];
  const keepDays = new Set([...Array(8)].map((_, i) => new Date(NOW - i * 864e5).toISOString().slice(0, 10)));
  for (const k of Object.keys(st.days)) if (!keepDays.has(k)) delete st.days[k];
  for (const k of Object.keys(st.projects || {})) if (!keepDays.has(k)) delete st.projects[k];
  writeAtomic(TSTATE, JSON.stringify(st));
  // fresh = input + cache writes + output (what the plan's limits feel most); cache_read is
  // the context re-read every turn — cheap per token, but its size per turn is the signal
  // that a session has grown too long (/clear, /compact, delegate to a subagent).
  const sum = (day) => {
    const o = { fresh: 0, cache_read: 0, out: 0, turns: 0, by_surface: {}, by_model: {} };
    for (const [surface, models] of Object.entries(st.days[day] || {})) {
      for (const [model, b] of Object.entries(models)) {
        const fresh = b.in + b.cc + b.out;
        o.fresh += fresh;
        o.cache_read += b.cr;
        o.out += b.out;
        o.turns += b.turns;
        const sv = (o.by_surface[surface] ||= { fresh: 0, cache_read: 0, turns: 0 });
        sv.fresh += fresh;
        sv.cache_read += b.cr;
        sv.turns += b.turns;
        o.by_model[model] = (o.by_model[model] || 0) + fresh;
      }
    }
    o.avg_context_per_turn = o.turns ? Math.round((o.cache_read + o.fresh - o.out) / o.turns) : 0;
    return o;
  };
  const today = sum(TODAY);
  const d7 = { fresh: 0, cache_read: 0, turns: 0 };
  for (const day of Object.keys(st.days)) {
    const x = sum(day);
    d7.fresh += x.fresh;
    d7.cache_read += x.cache_read;
    d7.turns += x.turns;
  }
  return { today, d7, today_by_project: st.projects?.[TODAY] || {}, complete };
}

// ── engine ─────────────────────────────────────────────────────────────────
function engineState() {
  const e = { maintain: null, sync_overdue: [], bench_age_d: null, findings_open: null, decisions_due: [] };
  const ms = readJSON(path.join(CLAUDE, ".kun-maintain.json"));
  if (ms) e.maintain = { verdict: ms.verdict, at: ms.ts };
  const sync = engine.sync || {};
  const tiers = sync.tiers || ["anthropic", "stack", "services", "practice"];
  for (const t of tiers) {
    const stamp = sync[t];
    const cadence = sync.cadence_days?.[t] ?? 30;
    const age = stamp ? Math.floor((NOW - Date.parse(stamp)) / 864e5) : null;
    if (age == null || age > cadence) e.sync_overdue.push({ tier: t, age_d: age });
  }
  const scores = readJSON(path.join(KUN, ".claude/memory/skill-scores.json"));
  const lu = scores?.last_updated || scores?.updated;
  if (lu) e.bench_age_d = Math.floor((NOW - Date.parse(lu)) / 864e5);
  const fnd = readJSON(path.join(STATE_DIR, "findings.json"));
  if (fnd?.findings) e.findings_open = fnd.findings.filter((f) => f.status === "open" || /^proposed/.test(f.status || "")).length;
  const ddir = path.join(KUN, ".claude/memory/decisions");
  try {
    for (const f of fs.readdirSync(ddir).filter((x) => x.endsWith(".md"))) {
      const s = fs.readFileSync(path.join(ddir, f), "utf8");
      const rb = /\*\*Reviewed-by\*\*:\s*(\d{4}-\d{2}-\d{2})/.exec(s);
      if (rb && rb[1] < TODAY && !/^\*\*Reviewed\*\*:/m.test(s)) e.decisions_due.push(f.replace(/\.md$/, ""));
    }
  } catch {}
  return e;
}

// ── queue (one gh search for reports — cached for the reports hook) ────────
async function queue() {
  const q = { reports: null, kun_issues: null, handoffs: { code_to_cowork: 0, cowork_to_code: 0 } };
  if (has("gh")) {
    const [rep, iss] = await Promise.all([
      runAsync("gh", ["search", "issues", "--owner", "databayt", "--label", "report", "--state", "open", "--limit", "50", "--json", "repository,number,title,labels,createdAt,author"]),
      runAsync("gh", ["issue", "list", "--repo", "databayt/kun", "--state", "open", "--limit", "200", "--json", "number,title,labels"]),
    ]);
    const reps = rep ? readJSONString(rep) : null;
    if (reps) {
      writeAtomic(REPORTS_CACHE, JSON.stringify({ ts: new Date().toISOString(), rows: reps }));
      const labels = (r) => r.labels.map((l) => l.name);
      q.reports = {
        open: reps.length,
        accepted: reps.filter((r) => labels(r).includes("accepted")).length,
        verified: reps.filter((r) => labels(r).includes("verified-report")).length,
      };
    }
    const issues = iss ? readJSONString(iss) : null;
    if (issues) {
      const pri = (i) => {
        const n = i.labels.map((l) => l.name);
        if (n.includes("priority/p0") || n.includes("P0-critical")) return "p0";
        if (n.includes("priority/p1") || n.includes("P1-high")) return "p1";
        if (n.includes("priority/p2") || n.includes("P2-medium")) return "p2";
        if (n.includes("priority/p3") || n.includes("P3-low")) return "p3";
        return "none";
      };
      const by = { p0: 0, p1: 0, p2: 0, p3: 0, none: 0 };
      for (const i of issues) by[pri(i)]++;
      q.kun_issues = { open: issues.length, by_priority: by, p0: issues.filter((i) => pri(i) === "p0").map((i) => `#${i.number} ${i.title.slice(0, 60)}`) };
    }
  }
  try {
    const b = fs.readFileSync(path.join(CLAUDE, "bridge.md"), "utf8");
    const sec = (title) => {
      const i = b.indexOf(title);
      if (i < 0) return 0;
      const rest = b.slice(i + title.length);
      const end = rest.search(/\n## /);
      return (end < 0 ? rest : rest.slice(0, end)).split("\n").filter((l) => /^- \*\*/.test(l)).length;
    };
    q.handoffs = { code_to_cowork: sec("## Open — Code → Cowork"), cowork_to_code: sec("## Open — Cowork → Code") };
  } catch {}
  return q;
}

// ── products: latest main CI per repo ──────────────────────────────────────
async function products() {
  if (!has("gh")) return null;
  const res = await Promise.all(
    cfg.repos.map(async (r) => {
      const out = await runAsync("gh", ["run", "list", "--repo", `databayt/${r}`, "--branch", "main", "--limit", "1", "--json", "conclusion,status,workflowName,createdAt,url"]);
      const j = out ? readJSONString(out)?.[0] : null;
      if (!j) return { repo: r, ci: "none" };
      const ci = j.status !== "completed" ? "running" : j.conclusion || "unknown";
      return { repo: r, ci, workflow: j.workflowName, at: j.createdAt, url: j.url };
    }),
  );
  return res;
}

// ── surfaces ───────────────────────────────────────────────────────────────
function surfaces() {
  const s = { hermes_installed: fs.existsSync(path.join(HOME, ".hermes")), hermes_up: null, slack_reconnects_24h: null, bridge_runs_today: null };
  if (!s.hermes_installed) return s;
  const ps = run("ps", ["-axo", "command="], 5000) || "";
  s.hermes_up = /hermes_cli\.main gateway/.test(ps);
  try {
    const lines = fs.readFileSync(path.join(HOME, ".hermes/logs/errors.log"), "utf8").split("\n").slice(-3000);
    s.slack_reconnects_24h = lines.filter((l) => /reconnecting/i.test(l) && hoursAgo(Date.parse(l.slice(0, 19).replace(" ", "T"))) <= 24).length;
  } catch {}
  try {
    const lines = fs.readFileSync(path.join(HOME, ".hermes/logs/claude-bridge.log"), "utf8").split("\n").slice(-2000);
    s.bridge_runs_today = lines.filter((l) => l.startsWith(TODAY) && l.includes(" START ")).length;
  } catch {}
  return s;
}

// ── wip: dirty + unpushed per repo (report-only) ───────────────────────────
function wip() {
  const out = [];
  for (const r of cfg.repos) {
    const dir = path.join(HOME, r);
    if (!fs.existsSync(path.join(dir, ".git"))) continue;
    const dirty = (run("git", ["-C", dir, "status", "--porcelain"], 10000) || "").split("\n").filter(Boolean).length;
    const ts = (run("git", ["-C", dir, "log", "@{u}..HEAD", "--format=%ct"], 5000) || "").split("\n").filter(Boolean);
    const oldest = ts.length ? Math.min(...ts.map(Number)) * 1000 : null;
    out.push({ repo: r, dirty, unpushed: ts.length, oldest_unpushed_h: oldest ? Math.round(hoursAgo(oldest)) : null });
  }
  return out;
}

// ── running: sessions active in the last 30 minutes ────────────────────────
function running() {
  const root = path.join(CLAUDE, "projects");
  const files = walkJsonl(root, NOW - 30 * 6e4).filter((f) => !f.p.includes(`${path.sep}subagents${path.sep}`));
  return files.map((f) => {
    const project = path.basename(path.dirname(f.p)).replace(/^-Users-[^-]+-?/, "") || "home";
    let last = "";
    try {
      const fd = fs.openSync(f.p, "r");
      const len = Math.min(f.size, 256 * 1024);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, f.size - len);
      fs.closeSync(fd);
      const lines = buf.toString("utf8").split("\n").reverse();
      // every transcript line carries the entrypoint; a headless run (sdk-cli) is not a session
      const ep = /"entrypoint":"([^"]+)"/.exec(lines.find((l) => l.includes('"entrypoint":"')) || "");
      if (ep && ep[1] === "sdk-cli") return null;
      for (const l of lines) {
        if (l.indexOf('"type":"user"') < 0) continue;
        const d = readJSONString(l);
        const c = d?.message?.content;
        const text = typeof c === "string" ? c : Array.isArray(c) ? c.find((x) => x.type === "text")?.text : "";
        if (text && !text.startsWith("<")) {
          last = text.replace(/\s+/g, " ").slice(0, 80);
          break;
        }
      }
    } catch {}
    return { project, minutes_ago: Math.round((NOW - f.mtimeMs) / 6e4), last_prompt: last };
  }).filter(Boolean);
}

// ── alerts: transitions, confirmed twice, capped per day ───────────────────
function candidates(s) {
  const c = {};
  const m = s.machine;
  if (m.disk_gb != null && m.disk_gb < cfg.disk_low_gb) c.disk_low = `Disk ${m.disk_gb} GB free (under ${cfg.disk_low_gb})`;
  if (m.disk_delta_24h != null && m.disk_delta_24h <= -cfg.disk_drop_gb_24h) c.disk_drop = `Disk fell ${-m.disk_delta_24h} GB in 24 h`;
  for (const j of s.jobs?.red || []) c[`job_red:${j.job}`] = `Job red: ${j.job}${j.why ? ` — ${j.why.slice(0, 80)}` : ""}`;
  if (s.surfaces?.hermes_installed && s.surfaces.hermes_up === false) c.hermes_down = "Hermes gateway is not running";
  if (m.rc_armed && m.rc_up === false) c.rc_down = "Remote Control server is down (the phone can't reach the Mac)";
  for (const p of s.products || []) if (p.ci === "failure") c[`ci_fail:${p.repo}`] = `${p.repo} main CI failed (${p.workflow})`;
  for (const w of s.wip || []) if (w.oldest_unpushed_h != null && w.oldest_unpushed_h > cfg.unpushed_hours) c[`unpushed:${w.repo}`] = `${w.repo}: ${w.unpushed} commit(s) unpushed for ${w.oldest_unpushed_h} h`;
  return c;
}
function deliver(prev, s) {
  const cand = candidates(s);
  const prevCand = new Set(prev?.alerts?.candidates || []);
  // notified = delivered and still active. Kept apart from `active` so an alert held back
  // by the daily cap (or by KUN_AWARE_NO_NOTIFY) is still sent later, not silently swallowed.
  const prevNotified = new Set(prev?.alerts?.notified || []);
  const sent = prev?.alerts?.sent?.day === TODAY ? prev.alerts.sent : { day: TODAY, n: 0 };
  const active = [];
  const pending = [];
  for (const k of Object.keys(cand)) {
    if (!prevCand.has(k)) continue; // first sighting — wait for confirmation
    active.push(k);
    if (!prevNotified.has(k)) pending.push(k);
  }
  const notified = active.filter((k) => prevNotified.has(k));
  let delivered = [];
  if (pending.length && sent.n < cfg.alert_cap_per_day && process.env.KUN_AWARE_NO_NOTIFY !== "1") {
    const keys = pending.slice(0, cfg.alert_cap_per_day - sent.n);
    delivered = keys.map((k) => cand[k]);
    notify(delivered);
    sent.n += keys.length;
    notified.push(...keys);
  }
  return { candidates: Object.keys(cand), active, notified, messages: Object.fromEntries(Object.entries(cand).filter(([k]) => active.includes(k))), sent, delivered };
}
function notify(msgs) {
  const text = msgs.join("\n");
  if (process.env.KUN_AWARE_NOTIFY_FILE) return fs.appendFileSync(process.env.KUN_AWARE_NOTIFY_FILE, text + "\n---\n"); // tests
  const present = fs.existsSync(expand(engine.devices?.presence?.file || "~/.claude/.present"));
  let target = "";
  try {
    target = fs.readFileSync(path.join(CLAUDE, ".kun-notify"), "utf8").split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")) || "";
  } catch {}
  const hermes = path.join(HOME, ".local/bin/hermes");
  if (!present && target && fs.existsSync(hermes)) {
    if (run(hermes, ["send", "--to", target, "--quiet", "--subject", "kun", text], 60000) !== null) return;
  }
  if (MAC) run("osascript", ["-e", `display notification ${JSON.stringify(msgs[0].slice(0, 180))} with title "kun"`], 5000);
}

// ── render ─────────────────────────────────────────────────────────────────
const alertLine = (s) =>
  Object.entries(s.alerts?.messages || {})
    .filter(([k]) => !k.startsWith("job_red:"))
    .map(([, m]) => (m.length > 70 ? m.slice(0, 69) + "…" : m))
    .join(" · ");
const fmtTok = (n) => (n >= 1e6 ? `${r1(n / 1e6)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n || 0}`);
function markdown(s) {
  const L = [];
  const host = os.hostname().replace(/\.local$/, "");
  L.push(`# kun · ${host} · ${new Date(s.ts).toISOString().slice(0, 16).replace("T", " ")} UTC`);
  if (alertLine(s)) L.push(`⚠ ${alertLine(s)}`);
  if (s.jobs) L.push(`Jobs: ${s.jobs.red.length} red${s.jobs.red.length ? ` (${s.jobs.red.map((j) => j.job).join(", ")})` : ""} · ${s.jobs.stale.length} stale · ${s.jobs.total} watched`);
  const m = s.machine;
  L.push(`Machine: disk ${m.disk_gb} GB${m.disk_delta_24h != null ? ` (${m.disk_delta_24h >= 0 ? "+" : ""}${m.disk_delta_24h} GB/24h)` : ""}${m.swap_pct != null ? ` · swap ${m.swap_pct}%` : ""} · ${m.sessions ?? "?"} sessions${m.rc_armed ? ` · RC ${m.rc_up ? "up" : "DOWN"}` : ""}`);
  const sp = s.spend;
  if (sp) {
    const t = sp.interactive.today;
    const surf = Object.entries(t.by_surface || {}).map(([k, v]) => `${k} ${fmtTok(v.fresh)}`).join(", ");
    L.push(`Spend today: ${fmtTok(t.fresh)} fresh tokens${surf ? ` (${surf})` : ""} + ${fmtTok(t.cache_read)} cache reads over ${t.turns} turns · avg context ${fmtTok(t.avg_context_per_turn)}/turn · 7d ${fmtTok(sp.interactive.d7.fresh)} fresh`);
    if (sp.headless.runs_24h) L.push(`Loops (ledger): ${sp.headless.runs_24h} runs · ${fmtTok(sp.headless.tokens_24h)} tokens · $${sp.headless.usd_24h} plan-equivalent`);
  }
  const q = s.queue;
  if (q) {
    const parts = [];
    if (q.reports) parts.push(`reports ${q.reports.open} (${q.reports.accepted} accepted)`);
    if (q.kun_issues) parts.push(`kun issues ${q.kun_issues.open} (p0 ${q.kun_issues.by_priority.p0}, p1 ${q.kun_issues.by_priority.p1})`);
    if (s.engine.decisions_due.length) parts.push(`decisions due ${s.engine.decisions_due.length}`);
    parts.push(`handoffs ${q.handoffs.code_to_cowork}→Cowork / ${q.handoffs.cowork_to_code}→Code`);
    L.push(`Queue: ${parts.join(" · ")}`);
    if (q.kun_issues?.p0?.length) L.push(`P0: ${q.kun_issues.p0.slice(0, 3).join(" · ")}`);
  }
  if (s.products) L.push(`CI main: ${s.products.map((p) => `${p.repo} ${p.ci === "success" ? "✓" : p.ci === "failure" ? "✗" : p.ci === "running" ? "…" : "·"}`).join(" ")}`);
  if (s.wip?.length) L.push(`WIP: ${s.wip.filter((w) => w.dirty || w.unpushed).map((w) => `${w.repo} ${w.dirty} dirty${w.unpushed ? `/${w.unpushed} unpushed` : ""}`).join(" · ") || "clean"}`);
  const e = s.engine;
  const eng = [];
  if (e.maintain) eng.push(`heartbeat ${e.maintain.verdict}`);
  if (e.sync_overdue.length) eng.push(`sync overdue ${e.sync_overdue.map((t) => `${t.tier} ${t.age_d ?? "never"}d`).join(", ")}`);
  if (e.bench_age_d != null) eng.push(`bench ${e.bench_age_d}d old`);
  if (e.findings_open) eng.push(`${e.findings_open} improvement finding(s) open`);
  if (eng.length) L.push(`Engine: ${eng.join(" · ")}`);
  if (s.surfaces?.hermes_installed) L.push(`Hermes: ${s.surfaces.hermes_up ? "up" : "DOWN"} · Slack reconnects 24h ${s.surfaces.slack_reconnects_24h ?? "?"} · bridge runs today ${s.surfaces.bridge_runs_today ?? 0}`);
  if (s.running?.length) {
    const by = {};
    for (const r of s.running) by[r.project] = (by[r.project] || 0) + 1;
    L.push(`Active now: ${Object.entries(by).map(([p, n]) => `${p}${n > 1 ? ` ×${n}` : ""}`).join(", ")}`);
  }
  let md = L.join("\n") + "\n";
  if (md.length > 1500) md = md.slice(0, 1490) + "…\n";
  return md;
}

// ── refresh ────────────────────────────────────────────────────────────────
async function refresh() {
  const prev = readJSON(SNAP, null);
  let history = [];
  try {
    history = fs.readFileSync(HIST, "utf8").split("\n").filter(Boolean).map(readJSONString).filter(Boolean);
  } catch {}
  const [q, prod] = await Promise.all([queue(), products()]);
  const s = {
    schema: 1,
    ts: new Date().toISOString(),
    host: os.hostname(),
    machine: machine(history),
    jobs: MAC ? jobs() : null,
    spend: { headless: headless(), interactive: interactive() },
    engine: engineState(),
    queue: q,
    products: prod,
    surfaces: surfaces(),
    wip: wip(),
    running: running(),
  };
  s.alerts = deliver(prev, s);
  writeAtomic(SNAP, JSON.stringify(s, null, 1));
  writeAtomic(MD, markdown(s));
  const h = { ts: s.ts, disk_gb: s.machine.disk_gb, swap_pct: s.machine.swap_pct, sessions: s.machine.sessions, red: s.jobs?.red.length ?? null, stale: s.jobs?.stale.length ?? null, fresh_today: s.spend.interactive.today.fresh, cache_read_today: s.spend.interactive.today.cache_read, avg_context: s.spend.interactive.today.avg_context_per_turn, headless_today: s.spend.headless.tokens_24h, alerts: s.alerts.active };
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const keep = history.filter((x) => hoursAgo(Date.parse(x.ts)) <= 24 * 90);
  keep.push(h);
  writeAtomic(HIST, keep.map((x) => JSON.stringify(x)).join("\n") + "\n");
  fs.appendFileSync(path.join(LOG_DIR, `aware-${TODAY}.log`), `${s.ts} refresh ok — alerts ${s.alerts.active.length}, delivered ${s.alerts.delivered.length}\n`);
  return s;
}

// ── brief: SessionStart, ≤5 lines, silent when green ───────────────────────
function brief(projectDir) {
  const s = readJSON(SNAP, null);
  const staleMin = s ? Math.round((NOW - Date.parse(s.ts)) / 6e4) : null;
  if (!s || staleMin > cfg.refresh_minutes) backgroundRefresh();
  if (!s) return "";
  const L = [];
  const warn = engine.devices?.warn || {};
  if (alertLine(s)) L.push(`⚠ ${alertLine(s)}`);
  if (s.jobs && (s.jobs.red.length || s.jobs.stale.length)) {
    const red = s.jobs.red.map((j) => j.job).join(", ");
    const stale = s.jobs.stale.map((j) => j.job).join(", ");
    L.push(`Jobs needing attention: ${[red && `red ${red}`, stale && `stale ${stale}`].filter(Boolean).join("; ")} — detail: bash ~/.claude/scripts/runs.sh`);
  }
  const m = s.machine || {};
  if (m.disk_gb != null && m.disk_gb < (warn.disk_free_gb ?? 20) && !s.alerts?.active?.some((k) => k.startsWith("disk"))) L.push(`Mac disk: ${m.disk_gb} GB free (under ${warn.disk_free_gb ?? 20}) — builds and swap fail near zero.`);
  if (m.sessions > (warn.sessions ?? 6) && (m.swap_pct ?? 0) >= (warn.swap_used_pct ?? 80)) L.push(`Memory: ${m.sessions} Claude sessions open, swap ${m.swap_pct}% — close idle ones.`);
  const inKun = projectDir && path.resolve(projectDir) === path.resolve(KUN);
  if (inKun) {
    const e = s.engine || {};
    const eng = [];
    if (e.sync_overdue?.length) eng.push(`sync overdue ${e.sync_overdue.map((t) => `${t.tier}(${t.age_d ?? "never"}d)`).join(" ")}`);
    if (e.maintain && e.maintain.verdict !== "GREEN") eng.push(`heartbeat ${e.maintain.verdict}`);
    if (e.findings_open) eng.push(`${e.findings_open} improvement finding(s) — say "sync self"`);
    if (eng.length) L.push(`Engine: ${eng.join(" · ")}`);
  }
  if (s.queue?.handoffs?.cowork_to_code) L.push(`bridge.md: ${s.queue.handoffs.cowork_to_code} Cowork → Code handoff(s) open.`);
  if (!L.length) return "";
  if (staleMin > cfg.refresh_minutes) L.push(`(as of ${staleMin} min ago — refreshing; live: ~/.claude/state/aware.md)`);
  return L.slice(0, 5).join("\n");
}
function backgroundRefresh() {
  try {
    const lock = path.join(STATE_DIR, "aware.refreshing");
    fs.mkdirSync(STATE_DIR, { recursive: true });
    try {
      const st = fs.statSync(lock);
      if (NOW - st.mtimeMs < 10 * 6e4) return; // one refresher at a time
    } catch {}
    fs.writeFileSync(lock, String(process.pid));
    const child = spawn(process.execPath, [new URL(import.meta.url).pathname, "--refresh", "--release-lock"], { detached: true, stdio: "ignore", env: { ...process.env, KUN_HEADLESS: "" } });
    child.unref();
  } catch {}
}

// ── launchd (owner Mac only) ───────────────────────────────────────────────
const LABEL = "com.databayt.kun-aware";
const PLIST = path.join(HOME, "Library/LaunchAgents", `${LABEL}.plist`);
function install() {
  if (!MAC) {
    console.log("aware: launchd is macOS-only — elsewhere the daily heartbeat (maintain.sh) and session start refresh it.");
    return;
  }
  const PATHV = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin", path.join(HOME, ".local/bin"), path.join(CLAUDE, "bin")].join(":");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>${LABEL}</string>
	<key>ProgramArguments</key>
	<array><string>${process.execPath}</string><string>${path.join(KUN, ".claude/scripts/aware.mjs")}</string><string>--refresh</string></array>
	<key>StartInterval</key><integer>${cfg.refresh_minutes * 60}</integer>
	<key>RunAtLoad</key><true/>
	<key>StandardOutPath</key><string>${path.join(LOG_DIR, "aware-launchd.out")}</string>
	<key>StandardErrorPath</key><string>${path.join(LOG_DIR, "aware-launchd.err")}</string>
	<key>EnvironmentVariables</key>
	<dict><key>PATH</key><string>${PATHV}</string><key>KUN_DIR</key><string>${KUN}</string></dict>
</dict>
</plist>
`;
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  run("launchctl", ["bootout", `gui/${process.getuid()}/${LABEL}`], 5000);
  fs.writeFileSync(PLIST, xml);
  const ok = run("launchctl", ["bootstrap", `gui/${process.getuid()}`, PLIST], 10000) !== null || run("launchctl", ["load", PLIST], 10000) !== null;
  console.log(ok ? `aware: armed ${LABEL} (every ${cfg.refresh_minutes} min)` : `aware: wrote ${PLIST} — load it with launchctl`);
}
function uninstall() {
  if (!MAC) return;
  run("launchctl", ["bootout", `gui/${process.getuid()}/${LABEL}`], 5000);
  try {
    fs.unlinkSync(PLIST);
  } catch {}
  console.log(`aware: disarmed ${LABEL}`);
}

// ── main ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const arg = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
try {
  if (flag("--brief")) {
    const out = process.env.KUN_HEADLESS ? "" : brief(arg("--project") || process.env.CLAUDE_PROJECT_DIR || process.cwd());
    if (out) console.log(out);
  } else if (flag("--refresh")) {
    const s = await refresh();
    if (flag("--release-lock")) fs.rmSync(path.join(STATE_DIR, "aware.refreshing"), { force: true });
    if (!flag("--quiet") && !flag("--release-lock")) process.stdout.write(markdown(s));
  } else if (flag("--json")) {
    const s = readJSON(SNAP, null) || (await refresh());
    console.log(JSON.stringify(s, null, 1));
  } else if (flag("--install")) install();
  else if (flag("--uninstall")) uninstall();
  else {
    let s = readJSON(SNAP, null);
    if (!s || (NOW - Date.parse(s.ts)) / 6e4 > cfg.refresh_minutes) s = await refresh();
    process.stdout.write(markdown(s));
  }
} catch (err) {
  // a sensor must never break a session or a heartbeat
  if (flag("--refresh") || !flag("--brief")) console.error(`aware: ${err?.message || err}`);
  if (flag("--release-lock")) fs.rmSync(path.join(STATE_DIR, "aware.refreshing"), { force: true });
}
// exitCode, not exit(): a hard exit can truncate stdout still draining into the hook's pipe
process.exitCode = 0;
