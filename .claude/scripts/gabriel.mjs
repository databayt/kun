#!/usr/bin/env node
// gabriel.mjs — Gabriel (جبريل), the messenger.
//
// Kun is the word: what should be, declared once in the registry, the lane table and the
// rules. Gabriel carries a command to whoever runs it and brings the answer back. He is a
// thin front for pieces that already exist — the router (resolve.mjs), the runner and its
// ledger (bin/kun-claude.sh), the watcher (aware.mjs) and the notifier (lib/notify.sh) —
// plus the two things that were missing: a run contract and a queue with a human gate.
//
//   gabriel route "<prompt>"             where the words land (repo, block) and on which lane
//   gabriel run [opts] -- "<task>"       one bounded piece of work, under the mandate
//       --repo <id> | --dir <path>       where (default: the current directory)
//       --lane <lane>                    lookup · research · build (default) · judge
//       --job <name>                     ledger name (default gabriel:<repo>)
//       --turns <n> --minutes <n>        the budget (defaults: engine.json → queue)
//       --mode <permission-mode>         default auto
//       --full                           keep skills and MCP (default: lean)
//       --dry                            print the command and the contract, run nothing
//   gabriel status                       one screen: machine, jobs, queue, last runs
//   gabriel queue list                   open asks and where each stands
//   gabriel queue add [--for <repo>] [--lane <lane>] "<ask>"
//   gabriel queue approve <n> [lane]     the owner's yes (the same as commenting "yes")
//   gabriel queue tick [--dry]           one pass: refuse, ask, wait or run — owner Mac only
//   gabriel node init [--runner c|d] [--window 22:00-06:00] [--repos a,b] [--runs 3]
//   gabriel node status                  this machine as a node: window, budget, last night
//   gabriel node tick [--dry] [--now]    in its window, take one `night-ok` issue and run it
//
// Properties, each one checkable:
//   faithful        every report cites its evidence (ledger line, commit, progress note);
//                   a run without evidence is reported as unverified
//   by command only nothing is published, deployed, spent or sent to a person unattended
//                   (engine.json → mandate; hooks/mandate-guard.sh blocks the commands)
//   strong          a run has a budget, leaves a progress note, and resumes from it
//   obeyed          a run takes its lane from the table and cannot renegotiate it
//
// The queue. A teammate asks; the ask is an issue labelled `queue` in engine.json →
// queue.repo. Nothing runs on the owner's account until the owner himself says yes on that
// issue (a comment from queue.approver starting with "yes"; "yes judge" also grants the
// lane). An ask from someone without write access to the repo is refused, an ask the
// mandate keeps for the owner is refused with the rule named, and the daily cap holds the
// rest. State lives in labels (queue:asked, queue:running, queue:done, queue:failed).
//
// Nodes. Any machine with ~/.claude/.kun-node.json is a node: its owner, the runner it uses
// (`c` Claude Code on the owner's own plan, `d` the DeepSeek lane with the owner's own key),
// the lanes it may take, the hours its owner offers, and a nightly budget. GitHub is the
// tracker: an issue labelled `night-ok` is a piece anyone may take; a node claims one by
// assigning itself and adding `claimed:<node>`, runs it under the same contract and mandate
// as any other run, and hands it back if the run fails. Three failures park the node for
// the night. Nothing is scheduled by this script: the node's owner arms the tick.
//
// Zero tokens except for `run`. Never blocks a caller: errors print and exit non-zero.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HOME = os.homedir();
const KUN = process.env.KUN_DIR || path.join(HOME, "kun");
const SCRIPTS = path.join(KUN, ".claude/scripts");
const STATE = process.env.GABRIEL_STATE || path.join(HOME, ".claude/state/gabriel");
const WRAPPER = path.join(HOME, ".claude/bin/kun-claude.sh");
const LANE_ORDER = ["lookup", "mechanical", "research", "build", "judge"];

const readJSON = (p, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return d;
  }
};
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26, ...opts });
  return { ok: r.status === 0, code: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim(), timedOut: r.error?.code === "ETIMEDOUT" };
};
const engine = () => readJSON(path.join(KUN, ".claude/engine.json"), {});
const tilde = (p) => (p && p.startsWith(HOME) ? "~" + p.slice(HOME.length) : p);
const die = (msg, code = 1) => {
  console.error(`gabriel: ${msg}`);
  process.exit(code);
};

export function policy(e = engine()) {
  const q = e.queue || {};
  return {
    repo: q.repo || "databayt/kun",
    label: q.label || "queue",
    approver: q.approver || "abdout",
    daily_cap: q.daily_cap ?? 5,
    lane_default: q.lane_default || "build",
    lane_ceiling: q.lane_ceiling || "build",
    turns: q.turns ?? 40,
    minutes: q.minutes ?? 30,
    ask_patterns: (e.mandate?.ask_patterns || []).map((p) => ({ rule: p.rule, re: new RegExp(p.pattern, "iu") })),
    lanes: e.lanes || {},
  };
}

// ── flags ──────────────────────────────────────────────────────────────────
function parse(argv, valued) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const k = a.slice(2);
      flags[k] = valued.includes(k) ? argv[++i] : true;
    } else rest.push(a);
  }
  return { flags, rest };
}

// ── route ──────────────────────────────────────────────────────────────────
function route(text) {
  if (!text) die('route needs a prompt: gabriel route "fix the admission form"');
  const r = sh("node", [path.join(SCRIPTS, "resolve.mjs"), "--project", process.cwd(), text]);
  let res = null;
  try {
    res = JSON.parse(r.out);
  } catch {}
  if (!res) die(`the router gave no answer (${r.err || "no output"})`);
  const L = [];
  L.push(`here     ${res.project || "not a known repo"}`);
  for (const x of res.repos) L.push(`repo     ${x.id} → ${tilde(x.path)}`);
  for (const b of res.local) L.push(`block    ${b.key} → ${b.path}`);
  for (const b of res.named) L.push(`block    ${b.repo}/${b.key} → ${b.path}`);
  for (const b of res.global) L.push(`block    ${b.repo}/${b.key} → ${b.path} (unique keyword)`);
  if (res.skill) L.push(`skill    ${res.skill.name} → lane ${res.skill.lane} (${res.skill.model}, ${res.skill.effort}, forked)`);
  for (const s of res.skills || []) L.push(`skill    ${s.names.join(" or ")} ← "${s.phrase}"${s.lane ? ` → lane ${s.lane}` : ""}`);
  const lanes = engine().lanes || {};
  const row = (n) => (lanes[n]?.model ? `${n} ${lanes[n].model}·${lanes[n].effort}` : null);
  L.push(`lanes    ${["lookup", "research", "build", "judge"].map(row).filter(Boolean).join("  ")}  (by the work, not by the feature)`);
  console.log(L.join("\n"));
}

// ── run ────────────────────────────────────────────────────────────────────
export function contract(note, mandate) {
  const may = (mandate?.unattended || ["read", "build", "test", "commit and push to main after green", "draft"]).join(", ");
  const not = (mandate?.needs_owner || ["publish", "deploy to production", "spend money", "message a person", "delete data", "change model or billing settings"]).join(", ");
  return [
    "",
    "---",
    "Run contract (Gabriel). This is one bounded piece of work, run unattended.",
    `1. Before you start, read the progress note if it exists (${note}) and \`git log -5 --oneline\`: resume, do not restart.`,
    "2. Do the one task above. Stay on `main`; commit only what is green, by explicit path, and push.",
    `3. You may: ${may}.`,
    `4. You must not: ${not}. If the task needs one of these, stop and say exactly what is needed — the owner does it himself.`,
    `5. Before you end (done, blocked, or out of budget), write the progress note at ${note}: what is done, what is next, and the evidence (commit hashes, test output, URLs). Report only what the evidence shows; say plainly what you did not verify.`,
  ].join("\n");
}

function repoDir(id) {
  const idx = readJSON(path.join(HOME, ".claude/kun-index.json"), {});
  return idx?.repos?.[id]?.path || null;
}

export function runTask(opts, task) {
  const e = engine();
  const pol = policy(e);
  const lane = opts.lane || pol.lane_default;
  const row = pol.lanes[lane];
  if (!row?.model) return { ok: false, error: `no such lane "${lane}" (engine.json → lanes)` };
  if (/fable|mythos/i.test(row.model)) return { ok: false, error: `lane "${lane}" runs on ${row.model} — attended only, never through Gabriel` };
  let dir = opts.dir ? path.resolve(opts.dir) : opts.repo ? repoDir(opts.repo) : process.cwd();
  if (!dir || !fs.existsSync(dir)) return { ok: false, error: `no local clone for "${opts.repo || opts.dir}"` };
  dir = fs.realpathSync(dir);
  const job = opts.job || `gabriel:${opts.repo || path.basename(dir)}`;
  const note = path.join(STATE, "notes", `${job.replace(/[^A-Za-z0-9_.-]+/g, "-")}.md`);
  fs.mkdirSync(path.dirname(note), { recursive: true });
  const prompt = `${task}\n${contract(note, e.mandate)}`;
  const turns = String(opts.turns || pol.turns);
  const minutes = Number(opts.minutes || pol.minutes);
  // auto: ordinary build work goes through unprompted and the classifier stops the risky
  // rest — the same mode kun's other loops run in. The notes folder is added so the run can
  // write its progress note outside the repo.
  const args = ["-p", prompt, "--output-format", "json", "--max-turns", turns, "--permission-mode", opts.mode || "auto", "--add-dir", path.dirname(note)];
  const env = { ...process.env, KUN_JOB: job, KUN_LANE: lane, KUN_MANDATE: "1", ...(opts.full ? { KUN_LEAN: "0" } : {}) };
  // runner d: the same wrapper and ledger, but the binary underneath is the DeepSeek lane
  if (opts.runner === "d") env.KUN_CLAUDE_REAL = path.join(HOME, ".claude/bin/kun-d.sh");
  if (opts.dry) {
    return { ok: true, dry: true, job, lane, model: row.model, effort: row.effort, dir, note, turns, minutes, prompt };
  }
  if (!fs.existsSync(WRAPPER)) return { ok: false, error: `${tilde(WRAPPER)} is not installed — run kun's setup.sh` };
  const t0 = Date.now();
  const r = sh(WRAPPER, args, { cwd: dir, env, timeout: minutes * 60000 });
  let out = null;
  try {
    out = JSON.parse(r.out);
  } catch {}
  const used = Object.keys(out?.modelUsage || {});
  return {
    ok: r.ok && !out?.is_error,
    job,
    lane,
    dir,
    note,
    noteWritten: fs.existsSync(note) && fs.statSync(note).mtimeMs >= t0,
    timedOut: r.timedOut,
    code: r.code,
    result: out?.result || r.err.slice(-600) || (r.timedOut ? `stopped at the ${minutes}-minute budget` : "no output"),
    turns: out?.num_turns ?? null,
    cost: out?.total_cost_usd ?? null,
    models: used,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

function printRun(r) {
  if (r.error) die(r.error);
  if (r.dry) {
    console.log(`job ${r.job} · lane ${r.lane} (${r.model}, ${r.effort}) · ${tilde(r.dir)} · ${r.turns} turns, ${r.minutes} min\nnote ${tilde(r.note)}\n\n${r.prompt}`);
    return;
  }
  console.log(r.result);
  console.log(`\n— ${r.ok ? "done" : r.timedOut ? "stopped at the budget" : `failed (exit ${r.code})`} · job ${r.job} · lane ${r.lane} · ${r.models.join(", ") || "model unknown"} · ${r.turns ?? "?"} turns · $${r.cost?.toFixed?.(3) ?? "?"} · ${r.seconds}s`);
  console.log(`— evidence: ${r.noteWritten ? tilde(r.note) : "no progress note was written — treat the result as unverified"} · ledger ~/.claude/logs/runs.jsonl (job ${r.job})`);
  process.exitCode = r.ok ? 0 : 1;
}

// ── queue ──────────────────────────────────────────────────────────────────
// The backend is GitHub through `gh`, or a fixture file for tests (GABRIEL_FIXTURE) whose
// actions are printed instead of performed.
function backend(pol, dry) {
  const fx = process.env.GABRIEL_FIXTURE ? readJSON(process.env.GABRIEL_FIXTURE) : null;
  const log = [];
  const act = (kind, n, payload = "") => {
    log.push({ kind, n, payload });
    if (fx || dry) return true;
    const R = ["--repo", pol.repo];
    if (kind === "comment") return sh("gh", ["issue", "comment", String(n), ...R, "--body", payload]).ok;
    if (kind === "label") {
      sh("gh", ["label", "create", payload, ...R, "--force", "--color", "5319e7"]);
      return sh("gh", ["issue", "edit", String(n), ...R, "--add-label", payload]).ok;
    }
    if (kind === "unlabel") return sh("gh", ["issue", "edit", String(n), ...R, "--remove-label", payload]).ok;
    if (kind === "close") return sh("gh", ["issue", "close", String(n), ...R, "--reason", payload || "completed"]).ok;
    if (kind === "notify") {
      const lib = path.join(HOME, ".claude/scripts/lib/notify.sh");
      return sh("bash", ["-c", `. "${lib}" 2>/dev/null && kun_notify me "Gabriel — queue" "$1"`, "_", payload]).ok;
    }
    return false;
  };
  if (fx) {
    return {
      log,
      act,
      issues: () => fx.issues || [],
      night: () => fx.night || [],
      comments: (n) => (fx.comments || {})[String(n)] || [],
      permission: (login) => (fx.permissions || {})[login] || "none",
    };
  }
  return {
    log,
    act,
    issues: () => {
      const r = sh("gh", ["issue", "list", "--repo", pol.repo, "--label", pol.label, "--state", "open", "--limit", "50", "--json", "number,title,body,author,labels,createdAt,url"]);
      if (!r.ok) throw new Error(`gh issue list failed: ${r.err.slice(0, 200)}`);
      return JSON.parse(r.out || "[]").map((i) => ({ ...i, author: i.author?.login, labels: (i.labels || []).map((l) => l.name) }));
    },
    night: () => {
      const r = sh("gh", ["search", "issues", "--owner", pol.repo.split("/")[0], "--label", "night-ok", "--state", "open", "--no-assignee", "--limit", "40", "--json", "number,title,body,labels,repository,assignees,url"]);
      if (!r.ok) throw new Error(`gh search failed: ${r.err.slice(0, 200)}`);
      return JSON.parse(r.out || "[]").map((i) => ({ number: i.number, title: i.title, body: i.body || "", url: i.url, repo: i.repository?.name, labels: (i.labels || []).map((l) => l.name), assignees: (i.assignees || []).map((a) => a.login) }));
    },
    comments: (n) => {
      const r = sh("gh", ["api", `repos/${pol.repo}/issues/${n}/comments`, "--paginate", "-q", ".[] | {login: .user.login, body: .body, at: .created_at}"]);
      return r.ok ? r.out.split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    permission: (login) => sh("gh", ["api", `repos/${pol.repo}/collaborators/${login}/permission`, "-q", ".permission"]).out || "none",
  };
}

// The ask's own lines: "repo: mkan" and "lane: build" anywhere in the body.
export function askOf(issue) {
  const body = issue.body || "";
  const repo = /^\s*repo:\s*([A-Za-z0-9_.-]+)\s*$/im.exec(body)?.[1]?.toLowerCase() || "kun";
  const lane = /^\s*lane:\s*([a-z_]+)\s*$/im.exec(body)?.[1] || null;
  const text = `${issue.title.replace(/^queue:\s*/i, "")}\n\n${body.replace(/^\s*(repo|lane):.*$/gim, "").replace(/\n-{3,}\s*$/m, "").trim()}`.trim();
  return { repo, lane, text };
}

// Pure: what should happen to one ask. No I/O — the fixture tests call this through tick().
export function decide(issue, comments, permission, pol, ranToday) {
  const labels = issue.labels || [];
  const has = (l) => labels.includes(`${pol.label}:${l}`);
  if (has("done") || has("failed") || has("refused") || has("running")) return { action: "skip" };
  if (!["admin", "maintain", "write"].includes(permission)) return { action: "refuse", reason: `@${issue.author} has no write access to ${pol.repo}; the queue is for the team` };
  const ask = askOf(issue);
  const kept = pol.ask_patterns.find((p) => p.re.test(ask.text));
  if (kept) return { action: "refuse", reason: `the mandate keeps this for the owner — ${kept.rule}. It is his to do himself, in his own session` };
  let verdict = null;
  let granted = null;
  for (const c of comments) {
    if (c.login !== pol.approver) continue;
    const m = /^\s*(yes|نعم|no|لا)(?![\p{L}\p{N}_])[\s,:-]*([a-z_]+)?/iu.exec(c.body || "");
    if (!m) continue;
    verdict = /^(yes|نعم)$/iu.test(m[1]) ? "yes" : "no";
    granted = verdict === "yes" && LANE_ORDER.includes(m[2]) ? m[2] : null;
  }
  if (verdict === "no") return { action: "refuse", reason: "the owner declined" };
  if (verdict !== "yes") return has("asked") ? { action: "wait", reason: "waiting for the owner's yes" } : { action: "ask" };
  if (ranToday >= pol.daily_cap) return { action: "wait", reason: `today's cap of ${pol.daily_cap} runs is used` };
  const want = LANE_ORDER.includes(ask.lane) ? ask.lane : pol.lane_default;
  const ceiling = LANE_ORDER.indexOf(pol.lane_ceiling);
  const lane = granted || (LANE_ORDER.indexOf(want) > ceiling ? pol.lane_ceiling : want);
  return { action: "run", lane, repo: ask.repo, text: ask.text, clamped: !granted && lane !== want ? want : null };
}

function ranToday() {
  const s = readJSON(path.join(STATE, "queue.json"), {});
  const day = new Date().toISOString().slice(0, 10);
  return s.day === day ? s.runs || 0 : 0;
}
function countRun() {
  const day = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(path.join(STATE, "queue.json"), JSON.stringify({ day, runs: ranToday() + 1 }));
}

function tick(dry) {
  const pol = policy();
  const be = backend(pol, dry);
  const lock = path.join(STATE, "tick.lock");
  if (!process.env.GABRIEL_FIXTURE) {
    // The queue spends the owner's plan, so only the owner's machine drives it: the one
    // whose gh login is the approver.
    const me = sh("gh", ["api", "user", "-q", ".login"], { timeout: 20000 }).out;
    if (me !== pol.approver) return console.log(`gabriel: the queue runs on ${pol.approver}'s machine only (this one is signed in to GitHub as ${me || "nobody"})`);
  }
  if (!process.env.GABRIEL_FIXTURE && !dry) {
    fs.mkdirSync(STATE, { recursive: true });
    try {
      fs.mkdirSync(lock);
    } catch {
      const age = (Date.now() - fs.statSync(lock).mtimeMs) / 60000;
      if (age < 180) return console.log(`gabriel: a queue tick is already running (${Math.round(age)} min)`);
      fs.rmdirSync(lock);
      fs.mkdirSync(lock);
    }
  }
  try {
    let ran = ranToday();
    for (const issue of be.issues()) {
      const d = decide(issue, be.comments(issue.number), be.permission(issue.author), pol, ran);
      const n = issue.number;
      if (d.action === "skip") continue;
      if (d.action === "refuse") {
        be.act("comment", n, `Gabriel: not run — ${d.reason}.`);
        be.act("label", n, `${pol.label}:refused`);
        be.act("close", n, "not planned");
      } else if (d.action === "ask") {
        be.act("label", n, `${pol.label}:asked`);
        be.act("notify", n, `#${n} from ${issue.author}: ${issue.title} — reply "yes" on the issue to run it (${issue.url || pol.repo})`);
      } else if (d.action === "run") {
        be.act("label", n, `${pol.label}:running`);
        const r = process.env.GABRIEL_FIXTURE || dry ? { ok: true, dry: true, result: "(dry run)", lane: d.lane } : runTask({ repo: d.repo, lane: d.lane, job: `queue:${n}` }, d.text);
        if (!r.dry) countRun();
        ran++;
        const tail = r.dry ? "" : `\n\n— lane ${d.lane}${d.clamped ? ` (asked for ${d.clamped}; the queue's ceiling is ${pol.lane_ceiling})` : ""} · ${(r.models || []).join(", ") || "model unknown"} · ${r.turns ?? "?"} turns · $${r.cost?.toFixed?.(3) ?? "?"}\n— evidence: ${r.noteWritten ? "progress note on the owner's Mac" : "no progress note was written — treat this as unverified"}; ledger job \`queue:${n}\``;
        be.act("comment", n, `Gabriel${r.ok ? "" : " (the run did not finish)"}:\n\n${String(r.error || r.result).slice(0, 3000)}${tail}`);
        be.act("unlabel", n, `${pol.label}:running`);
        be.act("label", n, `${pol.label}:${r.ok ? "done" : "failed"}`);
        if (r.ok) be.act("close", n, "completed");
      }
      if (process.env.GABRIEL_FIXTURE || dry) console.log(`#${n} ${d.action}${d.lane ? ` lane=${d.lane}` : ""}${d.reason ? ` — ${d.reason}` : ""}${d.clamped ? ` (asked ${d.clamped})` : ""}`);
    }
  } finally {
    if (!process.env.GABRIEL_FIXTURE && !dry) {
      try {
        fs.rmdirSync(lock);
      } catch {}
    }
  }
}

function queueList() {
  const pol = policy();
  const be = backend(pol, true);
  const rows = be.issues();
  if (!rows.length) return console.log(`queue: nothing open in ${pol.repo}`);
  for (const i of rows) {
    const st = ["running", "done", "failed", "refused", "asked"].find((l) => i.labels.includes(`${pol.label}:${l}`)) || "new";
    console.log(`#${String(i.number).padEnd(5)} ${st.padEnd(8)} ${String(i.author).padEnd(14)} ${i.title.slice(0, 80)}`);
  }
}

function queueAdd(flags, text) {
  if (!text) die('queue add needs the ask: gabriel queue add --for mkan "the booking total is wrong on mobile"');
  const pol = policy();
  const body = `${text}\n\n---\nrepo: ${flags.for || "kun"}\nlane: ${flags.lane || pol.lane_default}\n`;
  sh("gh", ["label", "create", pol.label, "--repo", pol.repo, "--force", "--color", "5319e7", "--description", "An ask for Gabriel — runs only after the owner's yes"]);
  const r = sh("gh", ["issue", "create", "--repo", pol.repo, "--title", `queue: ${text.split("\n")[0].slice(0, 70)}`, "--body", body, "--label", pol.label]);
  if (!r.ok) die(`could not file the ask: ${r.err.slice(0, 300)}`);
  console.log(`asked: ${r.out}\nIt runs only after ${pol.approver} answers "yes" on that issue.`);
}

// ── status ─────────────────────────────────────────────────────────────────
function status() {
  const a = sh("node", [path.join(SCRIPTS, "aware.mjs")], { timeout: 60000 });
  console.log(a.out || "aware: no snapshot yet — node ~/kun/.claude/scripts/aware.mjs --refresh");
  const ledger = path.join(HOME, ".claude/logs/runs.jsonl");
  try {
    const lines = fs.readFileSync(ledger, "utf8").trim().split("\n").slice(-400).map((l) => readJSONString(l)).filter((r) => r?.kind === "claude").slice(-5);
    if (lines.length) console.log("\nlast runs");
    for (const r of lines) console.log(`  ${String(r.ts).slice(5, 16)}  ${String(r.job).padEnd(28)} ${String(r.lane || "-").padEnd(8)} ${String(r.model_actual || r.model || "-").padEnd(20)} $${Number(r.cost_usd || 0).toFixed(3)}  ${r.status || ""}`);
  } catch {}
  const pol = policy();
  const q = sh("gh", ["issue", "list", "--repo", pol.repo, "--label", pol.label, "--state", "open", "--json", "number", "-q", "length"], { timeout: 20000 });
  console.log(`\nqueue  ${q.ok ? `${q.out || 0} open in ${pol.repo}` : "unreachable (gh)"} · ${ranToday()} of ${pol.daily_cap} runs used today`);
}
function readJSONString(l) {
  try {
    return JSON.parse(l);
  } catch {
    return null;
  }
}

// ── node ───────────────────────────────────────────────────────────────────
const NODE_FILE = process.env.GABRIEL_NODE || path.join(HOME, ".claude/.kun-node.json");
export function inWindow(win, d = new Date()) {
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(win || "");
  if (!m) return false;
  const now = d.getHours() * 60 + d.getMinutes();
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = Number(m[3]) * 60 + Number(m[4]);
  return a <= b ? now >= a && now < b : now >= a || now < b; // a window may cross midnight
}
// The night a moment belongs to: before noon it is still last evening's night.
const nightOf = (d = new Date()) => new Date(d.getTime() - (d.getHours() < 12 ? 86400000 : 0)).toISOString().slice(0, 10);
// Pure: the first open piece this node may take.
export function pickWork(issues, node) {
  for (const i of issues) {
    if (!i.labels.includes("night-ok") || (i.assignees || []).length) continue;
    if (i.labels.some((l) => l.startsWith("claimed:") || l === "night:done")) continue;
    if ((node.repos || []).length && !node.repos.includes(i.repo)) continue;
    const lane = i.labels.find((l) => l.startsWith("lane:"))?.slice(5) || "build";
    if (!(node.lanes || ["build"]).includes(lane)) continue;
    return { ...i, lane };
  }
  return null;
}
function nodeState() {
  const s = readJSON(path.join(STATE, "node.json"), {});
  return s.night === nightOf() ? s : { night: nightOf(), runs: 0, strikes: 0, parked: false, last: s.last || null };
}
function saveNodeState(s) {
  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(path.join(STATE, "node.json"), JSON.stringify(s, null, 1));
}
function nodeInit(flags) {
  const me = sh("gh", ["api", "user", "-q", ".login"], { timeout: 20000 }).out || os.userInfo().username;
  const node = {
    node: `${me}-${os.hostname().split(".")[0].toLowerCase()}`,
    owner: me,
    runner: flags.runner === "d" ? "d" : "c",
    lanes: flags.runner === "d" ? ["lookup", "research", "build"] : ["lookup", "research", "build", "judge"],
    window: flags.window || "22:00-06:00",
    runs_per_night: Number(flags.runs || 3),
    repos: flags.repos ? String(flags.repos).split(",").map((x) => x.trim()).filter(Boolean) : [],
  };
  fs.writeFileSync(NODE_FILE, JSON.stringify(node, null, 2) + "\n");
  console.log(`node ${node.node}: runner ${node.runner}, lanes ${node.lanes.join("/")}, window ${node.window}, ${node.runs_per_night} runs a night, ${node.repos.length ? node.repos.join(", ") : "any repo cloned here"}\nsaved ${tilde(NODE_FILE)}. Nothing is scheduled: arm \`gabriel node tick\` yourself when you want this machine to work at night.`);
}
function nodeStatus() {
  const node = readJSON(NODE_FILE);
  if (!node) return console.log("this machine is not a node — gabriel node init");
  const s = nodeState();
  console.log(`node ${node.node} · runner ${node.runner} · lanes ${node.lanes.join("/")} · window ${node.window} (${inWindow(node.window) ? "open now" : "closed now"})\ntonight ${s.runs} of ${node.runs_per_night} runs · ${s.strikes} failed${s.parked ? " · parked until tomorrow" : ""}${s.last ? `\nlast: ${s.last}` : ""}`);
}
function nodeTick(flags) {
  const node = readJSON(NODE_FILE);
  if (!node) return console.log("this machine is not a node — gabriel node init");
  const dry = !!flags.dry || !!process.env.GABRIEL_FIXTURE;
  if (!flags.now && !inWindow(node.window)) return console.log(`node ${node.node}: outside its window (${node.window})`);
  const s = nodeState();
  if (s.parked) return console.log(`node ${node.node}: parked for tonight after ${s.strikes} failed runs`);
  if (s.runs >= node.runs_per_night) return console.log(`node ${node.node}: tonight's ${node.runs_per_night} runs are used`);
  const pol = policy();
  const be = backend(pol, dry);
  const w = pickWork(be.night(), node);
  if (!w) return console.log(`node ${node.node}: nothing labelled night-ok that this node may take`);
  if (!repoDir(w.repo) && !dry) return console.log(`node ${node.node}: ${w.repo}#${w.number} is open, but ${w.repo} is not cloned on this machine`);
  const ref = `${pol.repo.split("/")[0]}/${w.repo}`;
  console.log(`node ${node.node}: taking ${w.repo}#${w.number} on lane ${w.lane} — ${w.title}`);
  if (dry) return;
  const R = ["--repo", ref];
  sh("gh", ["label", "create", `claimed:${node.node}`, ...R, "--force", "--color", "c5def5"]);
  if (!sh("gh", ["issue", "edit", String(w.number), ...R, "--add-assignee", "@me", "--add-label", `claimed:${node.node}`]).ok) return console.log("could not claim it");
  // two nodes may claim in the same second: the one whose name sorts first keeps it
  const claims = (sh("gh", ["issue", "view", String(w.number), ...R, "--json", "labels", "-q", ".labels[].name"]).out || "").split("\n").filter((l) => l.startsWith("claimed:")).sort();
  if (claims[0] !== `claimed:${node.node}`) {
    sh("gh", ["issue", "edit", String(w.number), ...R, "--remove-assignee", "@me", "--remove-label", `claimed:${node.node}`]);
    return console.log(`another node claimed it first (${claims[0]})`);
  }
  const task = `${w.title}\n\n${w.body}\n\nThis is issue ${ref}#${w.number}. When the work is green and pushed, comment the outcome on the issue.`;
  const r = runTask({ repo: w.repo, lane: w.lane, job: `node:${w.repo}#${w.number}`, runner: node.runner }, task);
  s.runs++;
  s.last = `${new Date().toISOString().slice(0, 16)} ${w.repo}#${w.number} ${r.ok ? "done" : "handed back"}`;
  const tail = `\n\n— node ${node.node} · lane ${w.lane} · ${(r.models || []).join(", ") || "model unknown"} · ${r.turns ?? "?"} turns\n— evidence: ${r.noteWritten ? "a progress note on the node" : "no progress note — treat this as unverified"}`;
  sh("gh", ["issue", "comment", String(w.number), ...R, "--body", `Gabriel (night run${r.ok ? "" : ", not finished — handed back"}):\n\n${String(r.error || r.result).slice(0, 3000)}${tail}`]);
  if (r.ok) {
    sh("gh", ["label", "create", "night:done", ...R, "--force", "--color", "0e8a16"]);
    sh("gh", ["issue", "edit", String(w.number), ...R, "--add-label", "night:done"]);
  } else {
    sh("gh", ["issue", "edit", String(w.number), ...R, "--remove-assignee", "@me", "--remove-label", `claimed:${node.node}`]);
    s.strikes++;
    if (s.strikes >= 3) {
      s.parked = true;
      be.act("notify", w.number, `node ${node.node} parked itself for tonight after three failed runs (last: ${w.repo}#${w.number})`);
    }
  }
  saveNodeState(s);
  console.log(s.last);
}

// ── main ───────────────────────────────────────────────────────────────────
const HELP = `gabriel — carries a command to whoever runs it, and brings the answer back

  gabriel route "<prompt>"            where the words land, and on which lane
  gabriel run [--repo id] [--lane build] [--turns n] [--minutes n] [--dry] -- "<task>"
  gabriel status                      machine, jobs, queue, last runs
  gabriel queue list | add [--for repo] [--lane l] "<ask>" | approve <n> [lane] | tick [--dry]
  gabriel node init [--runner c|d] [--window 22:00-06:00] [--repos a,b] | status | tick [--dry] [--now]

Nothing is published, deployed, spent or sent to a person unattended (engine.json → mandate).`;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [cmd, ...argv] = process.argv.slice(2);
  try {
    if (cmd === "route") route(argv.join(" "));
    else if (cmd === "run") {
      const { flags, rest } = parse(argv, ["repo", "dir", "lane", "job", "turns", "minutes", "mode", "runner"]);
      if (!rest.length) die('run needs a task: gabriel run --repo kun -- "fix the failing test in scripts/seek"');
      printRun(runTask(flags, rest.join(" ")));
    } else if (cmd === "status") status();
    else if (cmd === "queue") {
      const [sub, ...qa] = argv;
      const { flags, rest } = parse(qa, ["for", "lane"]);
      if (!sub || sub === "list") queueList();
      else if (sub === "add") queueAdd(flags, rest.join(" "));
      else if (sub === "tick") tick(!!flags.dry);
      else if (sub === "approve") {
        const pol = policy();
        if (!/^\d+$/.test(rest[0] || "")) die("queue approve needs the issue number");
        const r = sh("gh", ["issue", "comment", rest[0], "--repo", pol.repo, "--body", `yes${rest[1] ? ` ${rest[1]}` : ""}`]);
        console.log(r.ok ? `approved #${rest[0]} — it runs on the next tick (gabriel queue tick)` : `could not comment: ${r.err.slice(0, 200)}`);
      } else die(`unknown queue command "${sub}"`);
    } else if (cmd === "node") {
      const [sub, ...na] = argv;
      const { flags } = parse(na, ["runner", "window", "repos", "runs"]);
      if (sub === "init") nodeInit(flags);
      else if (sub === "tick") nodeTick(flags);
      else nodeStatus();
    } else console.log(HELP);
  } catch (err) {
    die(err?.message || String(err));
  }
}
