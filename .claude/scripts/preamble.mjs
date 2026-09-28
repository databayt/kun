#!/usr/bin/env node
// preamble.mjs — measure what a Claude Code session carries before a word is typed.
//
// Every surface below is injected into EVERY turn of every session, so it is the one
// cost the engine pays whether or not anything useful happens. This reads it back from
// a real transcript instead of estimating it with `wc -c` over the files we think load:
//
//   prefix   — the first turn's prompt size from the API usage block (input +
//              cache-creation + cache-read tokens): the true token count, including
//              Claude Code's own system prompt and tool schemas
//   surfaces — the session-specific parts the harness injected, in characters:
//              the skill listing, the instruction files (CLAUDE.md + rules + MEMORY.md,
//              each listed), deferred MCP tool names per server, MCP instruction
//              blocks, and the agent listing
//
// The transcript format is Claude Code's internal JSONL; when it changes, this prints
// what it can and says what it could not find rather than guessing.
//
// Usage:
//   node .claude/scripts/preamble.mjs                  # newest session of the current repo
//   node .claude/scripts/preamble.mjs ~/hogwarts       # newest session of another repo
//   node .claude/scripts/preamble.mjs --session <id>   # one specific session
//   node .claude/scripts/preamble.mjs --last 10        # prefix trend over recent sessions
//   node .claude/scripts/preamble.mjs --json

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const JSON_OUT = args.includes("--json");
const LAST = Number(flag("--last")) || 0;
const SESSION = flag("--session");
const positional = args.filter(
  (a, i) => !a.startsWith("--") && !["--last", "--session"].includes(args[i - 1]),
);
const projectDir = resolve(positional[0] || process.cwd());
const slug = projectDir.replace(/[^a-zA-Z0-9]/g, "-");
const dir = join(homedir(), ".claude", "projects", slug);

if (!existsSync(dir)) {
  console.error(`preamble: no transcripts for ${projectDir} (looked in ${dir})`);
  process.exit(1);
}

const sessions = readdirSync(dir)
  .filter((f) => f.endsWith(".jsonl"))
  .map((f) => ({ id: f.slice(0, -6), path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

function measure(path) {
  const out = { prefix: null, model: null, surfaces: {}, instructions: [], mcp: {}, missing: [] };
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type === "assistant" && o.message?.usage) {
      const u = o.message.usage;
      out.prefix =
        (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      out.cached_shared = u.cache_read_input_tokens || 0;
      out.model = o.message.model;
      break; // everything injected before the first answer is the preamble
    }
    const a = o.type === "attachment" ? o.attachment : null;
    if (!a) continue;
    if (a.type === "skill_listing" && typeof a.content === "string") {
      out.surfaces.skill_listing = (out.surfaces.skill_listing || 0) + a.content.length;
    } else if (a.type === "instructions" && Array.isArray(a.files)) {
      for (const f of a.files) {
        const n = (f.content || "").length;
        out.instructions.push({ path: f.path, type: f.type, chars: n });
        out.surfaces.instructions = (out.surfaces.instructions || 0) + n;
      }
    } else if (a.type === "deferred_tools_delta" && Array.isArray(a.addedNames)) {
      for (const n of a.addedNames) {
        const server = n.startsWith("mcp__") ? n.split("__")[1] : "(built-in)";
        out.mcp[server] ??= { tools: 0, chars: 0 };
        out.mcp[server].tools += 1;
        out.mcp[server].chars += n.length + 1;
        out.surfaces.mcp_tool_names = (out.surfaces.mcp_tool_names || 0) + n.length + 1;
      }
    } else if (a.type === "mcp_instructions_delta" && Array.isArray(a.addedBlocks)) {
      out.surfaces.mcp_instructions =
        (out.surfaces.mcp_instructions || 0) + a.addedBlocks.reduce((s, b) => s + b.length, 0);
    } else if (a.type === "agent_listing_delta" && Array.isArray(a.addedLines)) {
      out.surfaces.agent_listing =
        (out.surfaces.agent_listing || 0) + a.addedLines.reduce((s, l) => s + l.length, 0);
    }
  }
  for (const k of ["skill_listing", "instructions", "mcp_tool_names", "mcp_instructions", "agent_listing"]) {
    if (!(k in out.surfaces)) out.missing.push(k);
  }
  return out;
}

const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-US"));

if (LAST) {
  const rows = sessions.slice(0, LAST).map((s) => ({ id: s.id, when: new Date(s.mtime).toISOString().slice(0, 16), ...measure(s.path) }));
  if (JSON_OUT) {
    console.log(JSON.stringify(rows.map(({ id, when, prefix, model }) => ({ id, when, prefix, model })), null, 2));
  } else {
    console.log(`first-turn prefix, last ${rows.length} sessions of ${projectDir}`);
    for (const r of rows) console.log(`  ${r.when}  ${fmt(r.prefix).padStart(8)} tok  ${r.model || ""}  ${r.id}`);
  }
  process.exit(0);
}

const target = SESSION ? sessions.find((s) => s.id.startsWith(SESSION)) : sessions[0];
if (!target) {
  console.error(`preamble: session ${SESSION} not found in ${dir}`);
  process.exit(1);
}
const m = measure(target.path);

if (JSON_OUT) {
  console.log(JSON.stringify({ session: target.id, ...m }, null, 2));
  process.exit(0);
}

const total = Object.values(m.surfaces).reduce((s, n) => s + n, 0);
console.log(`session ${target.id}  (${m.model || "no answer yet"})`);
console.log(`first-turn prefix: ${fmt(m.prefix)} tokens (${fmt(m.cached_shared)} of them the shared system prompt + tools)`);
console.log(`session-specific surfaces: ${fmt(total)} chars`);
for (const [k, n] of Object.entries(m.surfaces).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${fmt(n).padStart(8)}  ${k}`);
}
if (m.instructions.length) {
  console.log("instruction files:");
  for (const f of [...m.instructions].sort((a, b) => b.chars - a.chars)) {
    console.log(`  ${fmt(f.chars).padStart(8)}  ${f.type.padEnd(8)} ${f.path.replace(homedir(), "~")}`);
  }
}
const servers = Object.entries(m.mcp).sort((a, b) => b[1].chars - a[1].chars);
if (servers.length) {
  console.log("deferred MCP tool names by server:");
  for (const [s, v] of servers) console.log(`  ${fmt(v.chars).padStart(8)}  ${String(v.tools).padStart(4)} tools  ${s}`);
}
if (m.missing.length) console.log(`not found in this transcript: ${m.missing.join(", ")}`);
