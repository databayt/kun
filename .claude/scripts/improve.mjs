#!/usr/bin/env node
// improve.mjs — kun's LEARN layer: turn what happened into findings, fix the safe ones.
//
//   node ~/kun/.claude/scripts/improve.mjs              findings as Markdown (detects first)
//   node ~/kun/.claude/scripts/improve.mjs --json       findings as JSON
//   node ~/kun/.claude/scripts/improve.mjs --apply-safe apply the machine-local SAFE fixes
//   node ~/kun/.claude/scripts/improve.mjs --issue      sync the rolling "Engine decisions" issue
//   node ~/kun/.claude/scripts/improve.mjs --add DECIDE "<title>" "<fix>" --source sync:anthropic
//                                                     a finding from outside the detectors (a /sync
//                                                     tier, a review) — it joins the same queue
//   node ~/kun/.claude/scripts/improve.mjs --close <id> [--reason "<why>"]   drop one (e.g. rejected)
//
// Zero tokens. Deterministic detectors read kun's own evidence — the run ledger, the
// awareness snapshot and its history, the router log, transcripts (via preamble.mjs),
// and the existing free checks (lint-contracts, extract-dispatch-cases, bench-retire,
// health.sh) — and write ~/.claude/state/findings.json:
//
//   { id (stable hash of detector+subject), detector, class, title, evidence[],
//     metric{name, before, target, after}, fix{kind, how}, first_seen, last_seen, status }
//
// class   SAFE   mechanical and reversible — `local` fixes run here (--apply-safe);
//                `repo` fixes are applied and committed by `/sync self`
//         DECIDE changes behaviour, cost, or a fleet surface — goes to ONE rolling GitHub
//                issue (label engine-decision); Abdout approves with a comment `yes <id>`
//         TRACK  real, shown in the weekly plan, nothing to do yet
// status  open → proposed (in the issue) → approved (yes <id>) → applied@<sha> →
//         verified (the detector stops firing) | regressed (it fires again)
// Policy: engine.json → improve. Consumers: /sync tier `self`, the weekly captain routine,
// aware.mjs (open count in every brief), #133 via aware.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const HOME = os.homedir();
const KUN = process.env.KUN_DIR || path.join(HOME, "kun");
const CLAUDE = path.join(HOME, ".claude");
const STATE = path.join(CLAUDE, "state");
const FINDINGS = path.join(STATE, "findings.json");
const LEDGER = path.join(CLAUDE, "logs", "runs.jsonl");
const RESOLVE_LOG = path.join(CLAUDE, "logs", "resolve.jsonl");
const NOW = Date.now();
const TODAY = new Date().toISOString().slice(0, 10);

const readJSON = (p, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return d;
  }
};
const parse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
const writeAtomic = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
};
const run = (cmd, args, timeout = 60000, opts = {}) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"], cwd: KUN, ...opts }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
};
const jsonl = (p, maxLines = 20000) => {
  try {
    return fs.readFileSync(p, "utf8").split("\n").slice(-maxLines).map(parse).filter(Boolean);
  } catch {
    return [];
  }
};
const hoursAgo = (iso) => (NOW - Date.parse(iso)) / 3.6e6;
const id = (detector, subject) => crypto.createHash("sha1").update(`${detector}|${subject}`).digest("hex").slice(0, 8);

const engine = readJSON(path.join(KUN, ".claude/engine.json"), {});
const pol = {
  prefix_target_tokens: 85000,
  avg_context_target: 250000,
  hook_p95_ms: 150,
  required_labels: ["engine-decision", "config-health", "priority/p0", "priority/p1", "priority/p2", "priority/p3"],
  issue_repo: "databayt/kun",
  issue_label: "engine-decision",
  approver: "abdout",
  ...(engine.improve || {}),
};

const found = [];
const add = (f) => found.push({ ...f, id: id(f.detector, f.subject || f.title) });

// ── detectors ──────────────────────────────────────────────────────────────
const detectors = {
  lint() {
    const r = run("node", [".claude/scripts/lint-contracts.mjs", "--json"]);
    const j = parse(r.out);
    if (!j) return;
    const byCheck = {};
    for (const f of j.findings || []) (byCheck[`${f.severity}:${f.check}`] ||= []).push(`${f.subject}: ${f.detail}`);
    for (const [k, ev] of Object.entries(byCheck)) {
      const [sev, check] = k.split(":");
      add({ detector: "lint", subject: check, class: sev === "error" ? "DECIDE" : "TRACK", title: `lint-contracts ${check}: ${ev.length} ${sev}(s)`, evidence: ev.slice(0, 5), metric: { name: `lint.${check}`, before: ev.length, target: 0 }, fix: { kind: "repo", how: "fix each finding (lint-contracts.mjs prints the fix)" } });
    }
  },
  bench() {
    const r = run("node", [".claude/scripts/extract-dispatch-cases.mjs", "--check"]);
    const moved = /corpus_hash moved \(([^)]+)\)/.exec(r.out);
    if (moved) add({ detector: "bench", subject: "baseline", class: "DECIDE", title: "Dispatch bench baseline is stale — trigger phrases changed since the last score", evidence: [`corpus_hash moved ${moved[1]}`], metric: { name: "bench.corpus_drift", before: 1, target: 0 }, fix: { kind: "repo", how: "re-run /bench deliberately (bench-dispatch workflow, ~1.3M subagent tokens) and note it in weekly_history — never automatic" } });
    const scores = readJSON(path.join(KUN, ".claude/memory/skill-scores.json"));
    const lu = scores?.last_updated || scores?.updated;
    const cadence = engine.eval?.cadence_days ?? 7;
    if (lu) {
      const age = Math.floor((NOW - Date.parse(lu)) / 864e5);
      if (age > cadence * 2) add({ detector: "bench", subject: "age", class: "TRACK", title: `Dispatch bench is ${age} days old (cadence ${cadence})`, evidence: [`skill-scores.json last_updated ${lu}`], metric: { name: "bench.age_days", before: age, target: cadence } });
    }
  },
  retire() {
    const r = run("node", [".claude/scripts/bench-retire.mjs", "--json"]);
    const j = parse(r.out);
    const zero = (j?.candidates || []).filter((c) => c.invocations === 0);
    if (zero.length) {
      const chars = zero.reduce((n, c) => n + (c.chars || 0), 0);
      add({ detector: "retire", subject: "skills", class: "DECIDE", title: `${zero.length} skills never invoked — ${chars} listing chars paid every prompt`, evidence: zero.slice(0, 8).map((c) => `${c.skill} (${c.chars} chars${c.neighbour ? `, nearest ${c.neighbour}` : ""})`), metric: { name: "listing.dead_chars", before: chars, target: 0 }, fix: { kind: "repo", how: "merge into the nearest skill or retire via /decide (usage undercounts passive reads — evidence, not proof)" } });
    }
  },
  preamble() {
    const r = run("node", [".claude/scripts/preamble.mjs", "--json"]);
    const j = parse(r.out);
    if (!j?.prefix) return;
    if (j.prefix > pol.prefix_target_tokens) {
      const s = j.surfaces || {};
      add({ detector: "preamble", subject: "prefix", class: "TRACK", title: `Session prefix ${Math.round(j.prefix / 1000)}K tokens (target ${Math.round(pol.prefix_target_tokens / 1000)}K)`, evidence: Object.entries(s).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / 1000)}K chars`), metric: { name: "preamble.prefix_tokens", before: j.prefix, target: pol.prefix_target_tokens }, fix: { kind: "repo", how: "trim the largest surface (path-scope rules, retire dead skills, drop unused MCP)" } });
    }
  },
  health() {
    const r = run("bash", [path.join(KUN, ".claude/scripts/health.sh")], 120000);
    for (const line of r.out.split("\n")) {
      const m = /\|\s*(⚠️|❌)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/.exec(line);
      if (!m) continue;
      const [, sev, check, detail] = m;
      if (/dispatch (cases|scores)/.test(check)) continue; // the bench detector owns these
      let cls = sev === "❌" ? "DECIDE" : "TRACK";
      let fix = { kind: "repo", how: "see health.sh" };
      const counts = /engine\.json=(\d+) actual=(\d+)/.exec(detail);
      if (counts && /^engine /.test(check)) {
        cls = "SAFE";
        fix = { kind: "repo", how: `set engine.json counts for "${check}" to ${counts[2]} (declared truth follows reality)` };
      }
      if (/plugin parity/.test(check)) {
        const dirty = run("git", ["status", "--porcelain", "--", ".claude", "plugins"]).out.trim();
        cls = dirty ? "TRACK" : "SAFE";
        fix = { kind: "repo", how: dirty ? "sources have uncommitted work from a session — rebuild after it lands" : "bash .claude/scripts/build-plugin.sh" };
      }
      add({ detector: "health", subject: check, class: cls, title: `health: ${check} — ${detail}`, evidence: [line.trim()], fix });
    }
  },
  ledger() {
    const lines = jsonl(LEDGER).filter((e) => e.kind === "claude");
    const byJob = {};
    for (const e of lines) (byJob[e.job] ||= []).push(e);
    for (const [job, runs] of Object.entries(byJob)) {
      const last3 = runs.slice(-3);
      if (last3.length === 3 && last3.every((e) => e.status !== "ok")) add({ detector: "ledger", subject: `fails:${job}`, class: "DECIDE", title: `${job}: last 3 headless runs failed`, evidence: last3.map((e) => `${e.ts} ${e.summary}`), metric: { name: `ledger.${job}.fail_streak`, before: 3, target: 0 }, fix: { kind: "repo", how: "read the job log, fix the cause" } });
      const wk = (lo, hi) => runs.filter((e) => hoursAgo(e.ts) >= lo * 24 && hoursAgo(e.ts) < hi * 24);
      const avg = (a) => (a.length ? a.reduce((n, e) => n + (e.tokens || 0), 0) / a.length : 0);
      const thisW = wk(0, 7);
      const lastW = wk(7, 14);
      if (thisW.length >= 2 && lastW.length >= 2 && avg(thisW) > avg(lastW) * 1.3) add({ detector: "ledger", subject: `cost:${job}`, class: avg(thisW) > avg(lastW) * 2 ? "DECIDE" : "TRACK", title: `${job}: tokens per run up ${Math.round((avg(thisW) / avg(lastW) - 1) * 100)}% week on week`, evidence: [`this week ${Math.round(avg(thisW))} / run (${thisW.length} runs)`, `last week ${Math.round(avg(lastW))} / run (${lastW.length} runs)`], metric: { name: `ledger.${job}.tokens_per_run`, before: Math.round(avg(thisW)), target: Math.round(avg(lastW)) }, fix: { kind: "repo", how: "lean mode, a smaller model or effort, or a tighter prompt" } });
    }
    const adhoc = lines.filter((e) => hoursAgo(e.ts) <= 24 * 7 && (e.job === "adhoc" || e.job_source === "adhoc"));
    if (adhoc.length) add({ detector: "ledger", subject: "adhoc", class: "DECIDE", title: `${adhoc.length} headless run(s) this week had no job name (lose lean mode and attribution)`, evidence: adhoc.slice(-3).map((e) => `${e.ts} model ${e.model}`), fix: { kind: "repo", how: "set KUN_JOB at the caller (or import scripts/lib/kun-claude.mjs)" } });
  },
  aware() {
    const s = readJSON(path.join(STATE, "aware.json"));
    if (!s) return;
    const t = s.spend?.interactive?.today;
    if (t?.avg_context_per_turn > pol.avg_context_target && t.turns > 50) add({ detector: "aware", subject: "context", class: "TRACK", title: `Average context ${Math.round(t.avg_context_per_turn / 1000)}K tokens per turn today (target ${Math.round(pol.avg_context_target / 1000)}K)`, evidence: [`${t.turns} turns, ${Math.round(t.cache_read / 1e6)}M cache reads, ${Math.round(t.fresh / 1e6)}M fresh`], metric: { name: "context.avg_per_turn", before: t.avg_context_per_turn, target: pol.avg_context_target }, fix: { kind: "habit", how: "/clear between unrelated tasks, /compact long ones, send research to subagents" } });
    const sdk = t?.by_surface?.headless;
    const led = s.spend?.headless?.tokens_24h || 0;
    if (sdk && sdk.fresh + sdk.cache_read > 1e6 && sdk.fresh + sdk.cache_read > 1.5 * led) add({ detector: "aware", subject: "unledgered", class: "DECIDE", title: "Headless runs are spending outside the ledger", evidence: [`transcripts (sdk-cli) ${Math.round((sdk.fresh + sdk.cache_read) / 1e6)}M tokens today vs ledger ${Math.round(led / 1e6)}M`], fix: { kind: "repo", how: "route the remaining `claude -p` callers through .claude/bin/kun-claude.sh" } });
    if ((s.engine?.decisions_due || []).length) add({ detector: "aware", subject: "decisions", class: "DECIDE", title: `${s.engine.decisions_due.length} decisions are past their Reviewed-by date`, evidence: s.engine.decisions_due.slice(0, 6), fix: { kind: "repo", how: "the Friday review's decision sweep: grade each prediction, write the lesson, add **Reviewed**: <date>" } });
    if ((s.engine?.sync_overdue || []).length) add({ detector: "aware", subject: "sync", class: "TRACK", title: `Sync tiers overdue: ${s.engine.sync_overdue.map((x) => `${x.tier} ${x.age_d ?? "never"}d`).join(", ")}`, evidence: ["the weekly routine syncs only tiers with new releases"], fix: { kind: "repo", how: "/sync <tier>" } });
    if ((s.surfaces?.slack_reconnects_24h ?? 0) > 20) add({ detector: "aware", subject: "slack", class: "TRACK", title: `Hermes Slack socket reconnected ${s.surfaces.slack_reconnects_24h} times in 24 h`, evidence: ["~/.hermes/logs/errors.log"], fix: { kind: "local", how: "check the Mac's network / Hermes version" } });
    // disk trend from history: projected under 5 GB within 48 h
    const hist = jsonl(path.join(CLAUDE, "logs", "aware-history.jsonl"));
    const old = [...hist].reverse().find((h) => hoursAgo(h.ts) >= 23);
    const now = hist[hist.length - 1];
    if (old && now?.disk_gb != null && old.disk_gb != null) {
      const perDay = now.disk_gb - old.disk_gb;
      if (perDay < 0 && now.disk_gb + perDay * 2 < 5) add({ detector: "aware", subject: "disk-trend", class: "SAFE", title: `Disk falls ${Math.abs(perDay).toFixed(1)} GB/day — under 5 GB within 48 h at this rate`, evidence: [`${old.disk_gb} → ${now.disk_gb} GB in ~24 h`], metric: { name: "disk.free_gb", before: now.disk_gb, target: 20 }, fix: { kind: "local", how: "bash ~/.claude/scripts/maintain.sh --run (approved hygiene prune)" } });
    }
  },
  resolver() {
    const hits = jsonl(RESOLVE_LOG).filter((h) => hoursAgo(h.ts) <= 24 * 7);
    if (!hits.length) return;
    const ms = hits.map((h) => h.ms).sort((a, b) => a - b);
    const p95 = ms[Math.floor(ms.length * 0.95)];
    if (p95 > pol.hook_p95_ms) add({ detector: "resolver", subject: "latency", class: "TRACK", title: `Prompt router p95 ${p95} ms (target ${pol.hook_p95_ms})`, evidence: [`${hits.length} hits this week`], metric: { name: "resolver.p95_ms", before: p95, target: pol.hook_p95_ms } });
    const g = {};
    for (const h of hits) for (const k of h.global || []) g[k] = (g[k] || 0) + 1;
    const top = Object.entries(g).sort((a, b) => b[1] - a[1]);
    if (top.length) add({ detector: "resolver", subject: "global-hints", class: "TRACK", title: "Global block hints fired this week — review for false positives", evidence: top.slice(0, 5).map(([k, n]) => `${k} ×${n}`), fix: { kind: "repo", how: "drop a key from engine.json → resolver.global_blocks if its hints were wrong" } });
  },
  labels() {
    const r = run("gh", ["label", "list", "--repo", pol.issue_repo, "--limit", "300", "--json", "name", "-q", ".[].name"], 30000);
    if (!r.ok) return;
    const have = new Set(r.out.split("\n").filter(Boolean));
    const missing = pol.required_labels.filter((l) => !have.has(l));
    if (missing.length) add({ detector: "labels", subject: missing.join(","), class: "SAFE", title: `Labels the engine relies on are missing in ${pol.issue_repo}: ${missing.join(", ")}`, evidence: ["engine.json → improve.required_labels"], fix: { kind: "local", how: "gh label create", labels: missing } });
  },
  envperms() {
    const dir = path.join(HOME, ".cache/cf-build");
    const bad = [];
    const visit = (p, depth) => {
      let ents = [];
      try {
        ents = fs.readdirSync(p, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of ents) {
        const f = path.join(p, e.name);
        if (e.isDirectory() && depth < 1 && /env/i.test(e.name)) visit(f, depth + 1);
        else if (e.isFile() && /(^|\.)env$|\.env$|^prod\.env$/.test(e.name)) {
          try {
            if ((fs.statSync(f).mode & 0o077) !== 0) bad.push(f);
          } catch {}
        }
      }
    };
    visit(dir, 0);
    if (bad.length) add({ detector: "envperms", subject: "cf-build", class: "SAFE", title: `${bad.length} production env file(s) readable by other users`, evidence: bad.map((f) => f.replace(HOME, "~")), fix: { kind: "local", how: "chmod 600", files: bad } });
  },
  memory() {
    const dir = path.join(CLAUDE, "projects", `-${KUN.replace(/^\//, "").replace(/[/.]/g, "-")}`, "memory");
    const idx = path.join(dir, "MEMORY.md");
    let s = "";
    try {
      s = fs.readFileSync(idx, "utf8");
    } catch {
      return;
    }
    const dangling = [...s.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]).filter((f) => !f.startsWith("..") && !fs.existsSync(path.join(dir, f)));
    if (dangling.length) add({ detector: "memory", subject: "dangling", class: "DECIDE", title: `${dangling.length} MEMORY.md line(s) point at missing files`, evidence: dangling.slice(0, 6), fix: { kind: "memory", how: "restore the file or drop the index line" } });
    if (s.length > 12000) add({ detector: "memory", subject: "index-size", class: "TRACK", title: `MEMORY.md index is ${s.length} chars — loaded every session`, evidence: ["archive completed projects to memory/archive/"], metric: { name: "memory.index_chars", before: s.length, target: 8000 } });
  },
};

// ── lifecycle merge ────────────────────────────────────────────────────────
function detect(only) {
  for (const [name, fn] of Object.entries(detectors)) {
    if (only && !only.includes(name)) continue;
    try {
      fn();
    } catch (e) {
      add({ detector: name, subject: "crashed", class: "TRACK", title: `detector ${name} crashed`, evidence: [String(e?.message || e)] });
    }
  }
  const prev = readJSON(FINDINGS, { findings: [] });
  const prevById = Object.fromEntries((prev.findings || []).map((f) => [f.id, f]));
  const seen = new Set();
  const merged = found.map((f) => {
    seen.add(f.id);
    const p = prevById[f.id];
    let status = p?.status || "open";
    if (status === "verified") status = "regressed"; // it came back
    const metric = f.metric ? { ...f.metric, ...(p?.metric?.baseline != null ? { baseline: p.metric.baseline } : { baseline: f.metric.before }) } : undefined;
    return { ...f, metric, first_seen: p?.first_seen || new Date().toISOString(), last_seen: new Date().toISOString(), status, applied: p?.applied, approved_by: p?.approved_by };
  });
  // gone since last time: applied → verified, anything else → resolved
  for (const p of prev.findings || []) {
    if (seen.has(p.id) || ["resolved", "verified"].includes(p.status)) continue;
    // added findings (a /sync tier, a review) have no detector to re-fire them: they stay
    // until closed (--close) or applied, never silently "resolved"
    if (!detectors[p.detector] && !p.closed) {
      merged.push(p);
      continue;
    }
    if (only && !only.includes(p.detector)) {
      merged.push(p);
      continue;
    }
    merged.push({ ...p, status: /^applied/.test(p.status) ? "verified" : "resolved", closed: new Date().toISOString() });
  }
  // keep closed ones 30 days for the record
  const keep = merged.filter((f) => !f.closed || hoursAgo(f.closed) <= 24 * 30);
  const out = { schema: 1, ts: new Date().toISOString(), findings: keep };
  writeAtomic(FINDINGS, JSON.stringify(out, null, 1));
  return out;
}

// ── SAFE local fixes ───────────────────────────────────────────────────────
function applySafe(state) {
  const log = [];
  for (const f of state.findings) {
    if (f.class !== "SAFE" || f.fix?.kind !== "local" || !["open", "regressed"].includes(f.status)) continue;
    let ok = false;
    if (f.detector === "envperms") {
      for (const file of f.fix.files || []) {
        try {
          fs.chmodSync(file, 0o600);
          ok = true;
        } catch {}
      }
    } else if (f.detector === "labels") {
      ok = (f.fix.labels || []).every((l) => run("gh", ["label", "create", l, "--repo", pol.issue_repo, "--force", "--color", l === "engine-decision" ? "5319e7" : "ededed"], 30000).ok);
    } else if (f.detector === "aware" && f.subject === "disk-trend") {
      ok = run("bash", [path.join(CLAUDE, "scripts/maintain.sh"), "--run", "--quiet"], 600000).ok;
    }
    if (ok) {
      f.status = `applied@local:${TODAY}`;
      f.applied = new Date().toISOString();
      log.push(`applied ${f.id} — ${f.title}`);
      fs.appendFileSync(path.join(CLAUDE, "logs", "improve.jsonl"), JSON.stringify({ ts: f.applied, id: f.id, title: f.title, metric: f.metric || null, how: f.fix.how }) + "\n");
    } else log.push(`could not apply ${f.id} — ${f.title}`);
  }
  writeAtomic(FINDINGS, JSON.stringify(state, null, 1));
  return log;
}

// ── the rolling Engine decisions issue ─────────────────────────────────────
function syncIssue(state) {
  // One machine owns the shared issue — the one running aware's launchd refresher (Abdout's
  // Mac). A teammate's local findings (their disk, their env files) must not rewrite it.
  const owner = fs.existsSync(path.join(HOME, "Library/LaunchAgents/com.databayt.kun-aware.plist"));
  if (!owner && !process.argv.includes("--force")) return "not the owner machine — the Engine decisions issue is written from the Mac that runs aware's refresher (--force overrides)";
  const decide = state.findings.filter((f) => f.class === "DECIDE" && ["open", "proposed", "approved", "regressed"].includes(f.status));
  const list = run("gh", ["issue", "list", "--repo", pol.issue_repo, "--label", pol.issue_label, "--state", "open", "--json", "number", "-q", ".[0].number"], 30000);
  let num = list.ok ? list.out.trim() : "";
  // approvals first: `yes <id>` comments from the approver
  if (num) {
    const c = run("gh", ["issue", "view", num, "--repo", pol.issue_repo, "--json", "comments", "-q", `.comments[] | select(.author.login == "${pol.approver}") | .body`], 30000);
    const yes = new Set([...(c.out || "").matchAll(/\byes\s+([0-9a-f]{8})\b/gi)].map((m) => m[1].toLowerCase()));
    for (const f of state.findings) if (yes.has(f.id) && ["open", "proposed", "regressed"].includes(f.status)) {
      f.status = "approved";
      f.approved_by = pol.approver;
    }
  }
  const rows = decide.map((f) => `| \`${f.id}\` | ${f.status === "approved" ? "✅ approved" : f.status} | ${f.title.replace(/\|/g, "/")} | ${(f.evidence || []).slice(0, 2).join("<br>").replace(/\|/g, "/")} | ${(f.fix?.how || "").replace(/\|/g, "/")} |`);
  const body = `Kun's self-improvement queue — written by \`improve.mjs\` (zero tokens), rewritten on every run. Each row is a change that alters behaviour, cost, or a fleet surface, so it waits for Abdout.

**Approve from the phone:** comment \`yes <id>\` (one or several). The next \`/sync self\` (the Monday routine, or say "sync self") applies approved rows, commits them, and measures before/after in \`docs/CONFIG-BENCHMARK.md\` → Adoption log.

| id | status | finding | evidence | proposed fix |
|---|---|---|---|---|
${rows.join("\n") || "| — | — | nothing waiting | | |"}

<sub>Updated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · SAFE fixes apply automatically · TRACK items appear in the weekly plan · source: ~/.claude/state/findings.json</sub>`;
  if (!decide.length && !num) return "no DECIDE findings — no issue needed";
  let res;
  if (num) res = run("gh", ["issue", "edit", num, "--repo", pol.issue_repo, "--body", body], 30000);
  else {
    run("gh", ["label", "create", pol.issue_label, "--repo", pol.issue_repo, "--force", "--color", "5319e7"], 30000);
    res = run("gh", ["issue", "create", "--repo", pol.issue_repo, "--title", "Engine decisions — kun self-improvement queue", "--label", pol.issue_label, "--body", body], 30000);
    num = (/\/issues\/(\d+)/.exec(res.out) || [])[1] || "";
  }
  for (const f of state.findings) if (f.class === "DECIDE" && f.status === "open" && res.ok) f.status = "proposed";
  writeAtomic(FINDINGS, JSON.stringify(state, null, 1));
  return res.ok ? `issue #${num} synced — ${decide.length} decision(s)` : `issue sync failed: ${res.out.slice(0, 200)}`;
}

// ── render ─────────────────────────────────────────────────────────────────
function markdown(state) {
  const open = state.findings.filter((f) => !["resolved", "verified"].includes(f.status));
  const by = (c) => open.filter((f) => f.class === c);
  const L = [`# kun · improvement findings · ${state.ts.slice(0, 16).replace("T", " ")} UTC`, ""];
  for (const [c, label] of [
    ["SAFE", "Safe — applied automatically"],
    ["DECIDE", "Decide — waiting for Abdout (`yes <id>` on the Engine decisions issue)"],
    ["TRACK", "Track — shown, nothing to do yet"],
  ]) {
    const xs = by(c);
    if (!xs.length) continue;
    L.push(`## ${label}`);
    for (const f of xs) L.push(`- \`${f.id}\` ${f.title}${f.status !== "open" ? ` _(${f.status})_` : ""}${f.fix?.how ? ` → ${f.fix.how}` : ""}`);
    L.push("");
  }
  const done = state.findings.filter((f) => ["verified", "resolved"].includes(f.status));
  if (done.length) L.push(`Closed in the last 30 days: ${done.length} (${done.filter((f) => f.status === "verified").length} verified fixes)`);
  return L.join("\n") + "\n";
}

// ── main ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
if (args[0] === "--add" || args[0] === "--close") {
  const st = readJSON(FINDINGS, { schema: 1, findings: [] });
  const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  if (args[0] === "--add") {
    const [, cls, title, how] = args;
    if (!["SAFE", "DECIDE", "TRACK"].includes(cls) || !title) {
      console.error('usage: improve.mjs --add SAFE|DECIDE|TRACK "<title>" "<fix>" [--source <who>] [--evidence "<line>"]');
      process.exit(2);
    }
    const source = opt("--source") || "manual";
    const f = { detector: source, subject: title, class: cls, title, evidence: opt("--evidence") ? [opt("--evidence")] : [], fix: { kind: "repo", how: how && !how.startsWith("--") ? how : "" } };
    f.id = id(f.detector, f.subject);
    if (!st.findings.find((x) => x.id === f.id)) st.findings.push({ ...f, first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), status: "open" });
    console.log(`added ${f.id} — ${title}`);
  } else {
    const fid = args[1];
    const f = st.findings.find((x) => x.id === fid);
    if (!f) {
      console.error(`no finding ${fid}`);
      process.exit(1);
    }
    f.status = "resolved";
    f.closed = new Date().toISOString();
    f.reason = opt("--reason") || "closed by hand";
    console.log(`closed ${fid} — ${f.title}`);
  }
  st.ts = new Date().toISOString();
  writeAtomic(FINDINGS, JSON.stringify(st, null, 1));
  process.exit(0);
}
const state = detect(only);
if (args.includes("--apply-safe")) for (const l of applySafe(state)) console.log(l);
if (args.includes("--issue")) console.log(syncIssue(state));
if (args.includes("--json")) console.log(JSON.stringify(state, null, 1));
else if (!args.includes("--apply-safe") && !args.includes("--issue")) process.stdout.write(markdown(state));
