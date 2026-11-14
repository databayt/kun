#!/usr/bin/env node
// compile-lanes.mjs — one word in, the harness's knobs out.
//
//   node .claude/scripts/compile-lanes.mjs            stamp every agent and skill from its lane
//   node .claude/scripts/compile-lanes.mjs --check    exit 1 if a file is not what its lane compiles to
//   node .claude/scripts/compile-lanes.mjs --list     the table: file → lane → what it runs as
//   node .claude/scripts/compile-lanes.mjs --page     write content/docs/lanes.mdx from the table
//
// Routing used to be prose: a table in engine.json that nothing enforced, and a model pinned
// by hand in each file. Now every kun-authored agent and skill carries one word, `lane:`, and
// this script writes the frontmatter Claude Code actually reads from engine.json → lanes:
//
//   agent                 model + effort (+ the lane's      (applied when the agent is spawned)
//                         autoCompactWindow, if it has one)
//   skill on a fork lane  context: fork + model + effort    (a subagent with no conversation
//                                                           history; mechanical, lookup, research)
//   skill on an inline    effort only, never a model        (a model switch mid-conversation
//   lane                                                    throws the prompt cache away; build,
//                                                           judge, captain)
//
// Changing a row in engine.json → lanes and re-running this changes everything on that lane.
// It runs by hand and inside build-plugin.sh; hooks only ever run --check. The check compares
// parsed keys, not bytes, so a formatter cannot make it loop. Sources are .claude/agents and
// .claude/skills in this repo only — third-party skills in ~/.claude are never touched.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const KEYS = ["model", "effort", "context", "autoCompactWindow"];

export function loadLanes(root = ROOT) {
  const lanes = JSON.parse(fs.readFileSync(path.join(root, ".claude/engine.json"), "utf8")).lanes || {};
  return Object.fromEntries(Object.entries(lanes).filter(([k, v]) => !k.startsWith("$") && v && typeof v === "object"));
}

// What a file on this lane must carry. null means the key must be absent.
export function expected(kind, laneName, lanes) {
  const lane = lanes[laneName];
  if (!lane) return { error: `unknown lane "${laneName}" (engine.json → lanes has: ${Object.keys(lanes).join(", ")})` };
  if (!lane.model || !lane.effort || !lane.skill) return { error: `lane "${laneName}" is not one a ${kind} can declare` };
  if (/fable|mythos/i.test(lane.model)) return { error: `lane "${laneName}" runs on ${lane.model} — attended only, never in a ${kind}` };
  // autoCompactWindow: a Haiku agent compacts at 100K, because above that Haiku costs five times as much
  if (kind === "agent") return { model: lane.model, effort: lane.effort, autoCompactWindow: lane.autoCompactWindow ? String(lane.autoCompactWindow) : null };
  if (lane.skill === "fork") return { context: "fork", model: lane.model, effort: lane.effort };
  return { context: null, model: null, effort: lane.effort };
}

// Top-level frontmatter keys only: `key: value` at column 0 between the first two `---`.
export function parse(raw) {
  const lines = raw.split("\n");
  if (lines[0].trim() !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end < 0) return null;
  const keys = {};
  for (let i = 1; i < end; i++) {
    const m = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i]);
    if (m) keys[m[1]] = { line: i, value: m[2].trim().replace(/^["']|["']$/g, "") };
  }
  return { lines, end, keys };
}

export function drift(raw, want) {
  const fm = parse(raw);
  if (!fm) return ["no frontmatter"];
  const out = [];
  for (const k of KEYS) {
    if (!(k in want)) continue;
    const have = fm.keys[k]?.value ?? null;
    if (have !== want[k]) out.push(`${k}: ${have ?? "absent"} → ${want[k] ?? "absent"}`);
  }
  return out;
}

export function stamp(raw, want) {
  const fm = parse(raw);
  if (!fm) return raw;
  const { lines, keys } = fm;
  const drop = new Set();
  const add = [];
  for (const k of KEYS) {
    if (!(k in want)) continue;
    if (want[k] === null) {
      if (keys[k]) drop.add(keys[k].line);
    } else if (keys[k]) lines[keys[k].line] = `${k}: ${want[k]}`;
    else add.push(`${k}: ${want[k]}`);
  }
  const out = [];
  lines.forEach((l, i) => {
    if (!drop.has(i)) out.push(l);
    if (i === keys.lane.line) out.push(...add); // new keys sit right under the lane that produced them
  });
  return out.join("\n");
}

export function sources(root = ROOT) {
  const out = [];
  const agents = path.join(root, ".claude/agents");
  for (const f of fs.existsSync(agents) ? fs.readdirSync(agents).sort() : []) {
    if (f.endsWith(".md") && !f.startsWith("_")) out.push({ kind: "agent", name: f.slice(0, -3), path: path.join(agents, f) });
  }
  const skills = path.join(root, ".claude/skills");
  for (const d of fs.existsSync(skills) ? fs.readdirSync(skills).sort() : []) {
    const p = path.join(skills, d, "SKILL.md");
    if (fs.existsSync(p)) out.push({ kind: "skill", name: d, path: p });
  }
  return out;
}

// One row per source: its lane, what it should carry, and what is off.
export function audit(root = ROOT) {
  const lanes = loadLanes(root);
  return sources(root).map((s) => {
    const raw = fs.readFileSync(s.path, "utf8");
    const lane = parse(raw)?.keys.lane?.value || null;
    if (!lane) return { ...s, raw, lane: null, problems: ["no lane declared"], declared: false };
    const want = expected(s.kind, lane, lanes);
    if (want.error) return { ...s, raw, lane, problems: [want.error], declared: false };
    return { ...s, raw, lane, want, problems: drift(raw, want), declared: true };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = audit();
  const mode = process.argv[2] || "";
  if (mode === "--list") {
    for (const r of rows) {
      const w = r.want || {};
      const runs = r.kind === "agent" ? `${w.model} · ${w.effort}` : w.context === "fork" ? `fork · ${w.model} · ${w.effort}` : `inline · effort ${w.effort}`;
      console.log(`${r.kind.padEnd(6)}${r.name.padEnd(24)}${(r.lane || "—").padEnd(12)}${r.declared ? runs : r.problems[0]}`);
    }
  } else if (mode === "--page") {
    // The public page: the lane table and who is on each lane. Generated, so it cannot go stale.
    const lanes = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude/engine.json"), "utf8")).lanes || {};
    const order = ["script", "mechanical", "lookup", "research", "build", "judge", "captain", "escalate"];
    const code = (x) => "`" + x + "`";
    const on = (lane, kind) => rows.filter((r) => r.lane === lane && r.kind === kind).map((r) => r.name);
    const L = ["---", "title: Lanes", "description: One table decides which model and how much effort each kind of work gets", "---", ""];
    L.push("{/* Generated by node .claude/scripts/compile-lanes.mjs --page — edit engine.json or the script, not this file. */}", "");
    L.push("A lane is a kind of work with a fixed model and a fixed effort. Every agent and every skill in the engine names one lane, in one word, in its frontmatter. Nobody sets a model by hand: a script reads the table below and writes the settings Claude Code actually applies.", "");
    L.push("## The table", "", "| Lane | Model | Effort | How it runs |", "| --- | --- | --- | --- |");
    for (const n of order) {
      const l = lanes[n];
      if (!l) continue;
      L.push(`| ${code(n)} | ${l.model || "none"} | ${l.effort || "—"} | ${l.runs || ""} |`);
    }
    L.push("", "The table lives in `.claude/engine.json` under `lanes`. Change a row, run `node .claude/scripts/compile-lanes.mjs`, and everything on that lane changes with it.", "");
    L.push("## What a lane writes", "");
    L.push("| For | It writes | Why |", "| --- | --- | --- |");
    L.push("| an agent | `model` and `effort` | applied when the agent starts |");
    L.push("| a skill on `mechanical`, `lookup` or `research` | `context: fork`, `model`, `effort` | the skill runs as a separate agent with no conversation history, on the lane's model |");
    L.push("| a skill on `build`, `judge` or `captain` | `effort` only | switching model in the middle of a conversation throws away the prompt cache, so these stay on the session's model and hand heavy steps to an agent |");
    L.push("", "## Where it is enforced", "");
    L.push("1. **Frontmatter.** Claude Code applies an agent's model when it starts it, and forks a skill onto its lane's model when the skill is invoked.");
    L.push("2. **Explore.** The engine ships its own `Explore` agent on Haiku; the built-in one ran on the session's model.");
    L.push("3. **The route hint.** A short prompt that opens with a fork-lane skill (`dev`, `health`, `watch`) is told to invoke the skill rather than do the work in the main loop.");
    L.push("4. **The route guard.** A subagent call that names no model gets the build lane's; a call that names Fable is refused.");
    L.push("5. **Headless runs.** A scheduled run takes its model from its job's lane and can never be Fable.");
    L.push("6. **The lint.** `lint-contracts.mjs` fails on an agent or skill with no lane, or with a model or effort set by hand.");
    L.push("", "One call can still ask for more: naming a model on a single agent call overrides the lane for that call.", "");
    L.push("## Who is on which lane", "");
    for (const n of order) {
      const a = on(n, "agent");
      const k = on(n, "skill");
      if (!a.length && !k.length) continue;
      L.push(`### ${n}`, "");
      if (a.length) L.push(`**Agents (${a.length}):** ${a.map(code).join(", ")}`, "");
      if (k.length) L.push(`**Skills (${k.length}):** ${k.map(code).join(", ")}`, "");
    }
    L.push("## Checks", "", "```bash", "node .claude/scripts/compile-lanes.mjs --check   # every file matches its lane", "node .claude/scripts/compile-lanes.mjs --list    # file → lane → how it runs", "node .claude/scripts/lint-contracts.mjs --check  # no missing lane, no hand-set model", "```", "");
    fs.writeFileSync(path.join(ROOT, "content/docs/lanes.mdx"), L.join("\n"));
    console.log(`lanes: wrote content/docs/lanes.mdx (${rows.length} agents and skills)`);
  } else if (mode === "--check") {
    const bad = rows.filter((r) => r.problems.length);
    for (const r of bad) console.error(`lanes: ${r.kind} ${r.name} — ${r.problems.join("; ")}`);
    if (bad.length) {
      console.error(`lanes: ${bad.length} file(s) off — run: node .claude/scripts/compile-lanes.mjs`);
      process.exit(1);
    }
    console.log(`lanes: ${rows.length} agents and skills match their lane`);
  } else {
    let changed = 0;
    const undeclared = rows.filter((r) => !r.declared);
    for (const r of rows.filter((x) => x.declared && x.problems.length)) {
      fs.writeFileSync(r.path, stamp(r.raw, r.want));
      changed++;
      console.log(`stamped ${r.kind} ${r.name} (${r.lane}): ${r.problems.join("; ")}`);
    }
    for (const r of undeclared) console.error(`lanes: ${r.kind} ${r.name} — ${r.problems[0]}`);
    console.log(`lanes: ${changed} stamped, ${rows.length - changed - undeclared.length} already current${undeclared.length ? `, ${undeclared.length} without a usable lane` : ""}`);
    if (undeclared.length) process.exit(1);
  }
}
