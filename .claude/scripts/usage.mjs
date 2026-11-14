#!/usr/bin/env node
// usage.mjs — what the engine's fleet is actually used for, read back from the transcripts.
//
//   node .claude/scripts/usage.mjs            last 90 days, human table
//   node .claude/scripts/usage.mjs 30         another window, in days
//   node .claude/scripts/usage.mjs --json     machine form (also written to ~/.claude/state/usage.json)
//
// Zero tokens. Every MCP server, agent and skill is paid for in every session's opening
// context whether or not it is ever called, so "is it used" is the first question before
// keeping, trimming or moving one. This counts, across every project's transcripts:
//   - MCP tool calls per server, split main loop / subagent (a server the main loop never
//     calls can move to the agents that do, or go)
//   - Agent dispatches per subagent type (agents earn their dispatch)
//   - Skill invocations per skill
// It reads Claude Code's own JSONL transcripts; Claude Code prunes old ones, so a window
// longer than its retention shows what is left, not the full history.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const DAYS = Number(args.find((a) => /^\d+$/.test(a)) || 90);
const ROOT = path.join(os.homedir(), ".claude/projects");
const cutoff = Date.now() - DAYS * 86400000;

const mcp = {};
const agents = {};
const skills = {};
let files = 0;
let sessions = 0;
const bump = (o, k, f = "n") => {
  o[k] ||= { main: 0, sub: 0, n: 0 };
  o[k][f]++;
};

function walk(dir) {
  let ents = [];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".jsonl")) read(p);
  }
}
function read(p) {
  let st;
  try {
    st = fs.statSync(p);
  } catch {
    return;
  }
  if (st.mtimeMs < cutoff) return;
  files++;
  const sideFile = path.basename(p).startsWith("agent-") || p.includes(`${path.sep}subagents${path.sep}`);
  if (!sideFile) sessions++;
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"tool_use"')) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const side = sideFile || !!o.isSidechain;
    for (const c of o.message?.content || []) {
      if (c?.type !== "tool_use") continue;
      const name = c.name || "";
      if (name.startsWith("mcp__")) bump(mcp, name.split("__")[1], side ? "sub" : "main");
      else if (name === "Skill") bump(skills, String(c.input?.skill || "?"));
      else if (name === "Agent" || name === "Task") bump(agents, String(c.input?.subagent_type || "general-purpose"));
    }
  }
}
walk(ROOT);

const out = { days: DAYS, ts: new Date().toISOString(), files, sessions, mcp, agents: Object.fromEntries(Object.entries(agents).map(([k, v]) => [k, v.n])), skills: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, v.n])) };
try {
  const state = path.join(os.homedir(), ".claude/state");
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, "usage.json"), JSON.stringify(out, null, 1));
} catch {}

if (JSON_OUT) {
  console.log(JSON.stringify(out, null, 1));
} else {
  const by = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  console.log(`usage: last ${DAYS} days — ${sessions} sessions, ${files} transcript files`);
  console.log("\nMCP server calls        main loop   subagents");
  for (const [k, v] of Object.entries(mcp).sort((a, b) => b[1].main + b[1].sub - a[1].main - a[1].sub)) console.log(`  ${k.padEnd(24)}${String(v.main).padStart(7)}${String(v.sub).padStart(12)}`);
  console.log(`\nAgent dispatches: ${by(out.agents).map(([k, n]) => `${k} ${n}`).join(" · ") || "none"}`);
  console.log(`\nSkill invocations: ${by(out.skills).map(([k, n]) => `${k} ${n}`).join(" · ") || "none"}`);
}
