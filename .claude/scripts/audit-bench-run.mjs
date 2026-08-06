#!/usr/bin/env node
// audit-bench-run.mjs — check a bench run for answer-key contamination.
//
// The first L1 run scored 0.9942 because the dispatch agents were told to read
// the case file, and that file carried `label` for every case. They were reading
// the answer key. An instruction not to look is not a control; this is the check
// that the instruction held.
//
// Contamination is anything that could reveal a case's label to a grader:
//   - the full case set (has `label`, `source`, `tags`, `split`)
//   - any SKILL.md (its trigger phrases sit verbatim beside its own name)
//   - vocabulary.json (spell → skill routing)
//   - re-running the extractor
//
// Usage:
//   node .claude/scripts/audit-bench-run.mjs <run-transcript-dir>
//   node .claude/scripts/audit-bench-run.mjs --latest

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.HOME || "";
const args = process.argv.slice(2);

function latestRunDir() {
  const base = join(HOME, ".claude/projects");
  const found = [];
  const walk = (d, depth = 0) => {
    if (depth > 6) return;
    let es;
    try {
      es = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of es) {
      if (!e.isDirectory()) continue;
      const p = join(d, e.name);
      if (e.name.startsWith("wf_")) found.push(p);
      else walk(p, depth + 1);
    }
  };
  walk(base);
  if (!found.length) return null;
  return found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

const dir = args.includes("--latest") ? latestRunDir() : args[0];
if (!dir || !existsSync(dir)) {
  console.error("usage: audit-bench-run.mjs <run-transcript-dir> | --latest");
  process.exit(2);
}

// Only DISPATCH agents are blind. Adjudicators are supposed to see labels — that
// is their whole job — and extract/persist necessarily touch the labelled file.
const FORBIDDEN = [
  { name: "labelled case set", re: /cases\/dispatch\.json/ },
  { name: "a SKILL.md", re: /SKILL\.md/ },
  { name: "vocabulary.json", re: /vocabulary\.json/ },
  { name: "the extractor", re: /extract-dispatch-cases/ },
  { name: "skill-scores.json", re: /skill-scores\.json/ },
];

const findings = [];
let dispatchAgents = 0;
let checked = 0;

for (const f of readdirSync(dir)) {
  if (!f.startsWith("agent-") || !f.endsWith(".jsonl")) continue;
  checked++;
  const raw = readFileSync(join(dir, f), "utf8");

  // Identify the agent by its own prompt: only the dispatch prompt says "blind".
  const isDispatch = /This is a blind measurement|measuring skill DISPATCH/.test(raw);
  if (!isDispatch) continue;
  dispatchAgents++;

  const lines = raw.split("\n");
  for (const l of lines) {
    if (!l.trim()) continue;
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    const c = o?.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type !== "tool_use") continue;
      const input = JSON.stringify(b.input || {});
      // The agent quoting its own instructions is not a read. Only tool INPUTS count.
      for (const hit of FORBIDDEN) {
        if (hit.re.test(input)) {
          findings.push({ agent: f.slice(0, 22), tool: b.name, source: hit.name, input: input.slice(0, 160) });
        }
      }
    }
  }
}

console.log(`run          ${dir.split("/").pop()}`);
console.log(`agents       ${checked} total, ${dispatchAgents} blind dispatch agents`);

if (!dispatchAgents) {
  console.log("verdict      INCONCLUSIVE — no dispatch agents identified in this run");
  process.exit(2);
}

if (findings.length) {
  console.log(`verdict      CONTAMINATED — ${findings.length} forbidden reads by blind agents`);
  for (const f of findings) {
    console.log(`  ${f.agent}  ${f.tool}  → ${f.source}`);
    console.log(`      ${f.input}`);
  }
  console.log("\nThe score from this run is not a measurement. Do not persist it.");
  process.exit(1);
}

console.log("verdict      CLEAN — no blind agent touched a labelled source");
