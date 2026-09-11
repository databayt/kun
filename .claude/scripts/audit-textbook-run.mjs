#!/usr/bin/env node
// audit-textbook-run.mjs — check a textbook workflow run for read contamination.
//
// An agreement score is a measurement only if the second read never saw the first. The audit
// transcribers and every benchmark transcriber are told so ("This is a blind transcription"), but an
// instruction not to look is not a control — bench-dispatch learned that at 0.9942. This scans each
// blind agent's transcript for tool INPUTS that name an earlier transcription of the page, the gold
// directory, or the assembled twin, and fails the run on any hit.
//
// Allowed for blind agents: the page images, the crops, the contract (pages-md/_CONTRACT.md), the
// task file, and their OWN output directory. Forbidden: pages-md/<N>.md, pages-md-audit/,
// pages-md-verify/, gold/, the benchmark manifest, textbook.md, textbook.ocr.md.
//
// Usage:
//   node .claude/scripts/audit-textbook-run.mjs <run-transcript-dir> [--out-dir <blind agents' own dir>]
//   node .claude/scripts/audit-textbook-run.mjs --latest

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.HOME || "";
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out-dir");
const OWN = outIdx >= 0 ? args[outIdx + 1] : null;

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

const dir = args.includes("--latest") ? latestRunDir() : args.find((a) => !a.startsWith("--") && a !== OWN);
if (!dir || !existsSync(dir)) {
  console.error("usage: audit-textbook-run.mjs <run-transcript-dir> | --latest");
  process.exit(2);
}

// Only BLIND agents are checked. The adjudicator is supposed to read both transcriptions — that is
// its job — and the assemble/score/persist agents necessarily touch every file.
const FORBIDDEN = [
  { name: "an earlier page transcription", re: /pages-md\/\d+\.md/ },
  { name: "the audit reads", re: /pages-md-audit\// },
  { name: "the verdict files", re: /pages-md-verify\// },
  { name: "the gold directory", re: /\/gold\/|(^|[^a-z])gold\/\d+\.md/ },
  { name: "the benchmark manifest", re: /evals\/textbook\/manifest\.json/ },
  { name: "the assembled twin", re: /textbook(\.ocr)?\.md/ },
];

const findings = [];
let blind = 0;
let checked = 0;

for (const f of readdirSync(dir)) {
  if (!f.startsWith("agent-") || !f.endsWith(".jsonl")) continue;
  checked++;
  const raw = readFileSync(join(dir, f), "utf8");
  if (!/This is a blind transcription/.test(raw)) continue;
  blind++;
  for (const l of raw.split("\n")) {
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
      // Writing into the agent's own output directory is its job, never a leak.
      if (OWN && input.includes(OWN) && b.name === "Write") continue;
      for (const hit of FORBIDDEN) {
        if (hit.re.test(input)) {
          // an audit read writing pages-md-audit/<N>.md is its own output, not a peek
          if (hit.name === "the audit reads" && b.name === "Write") continue;
          findings.push({ agent: f.slice(0, 22), tool: b.name, source: hit.name, input: input.slice(0, 160) });
        }
      }
    }
  }
}

console.log(`run          ${dir.split("/").pop()}`);
console.log(`agents       ${checked} total, ${blind} blind transcribers`);
if (!blind) {
  console.log("verdict      INCONCLUSIVE — no blind transcribers identified in this run");
  process.exit(2);
}
if (findings.length) {
  console.log(`verdict      CONTAMINATED — ${findings.length} forbidden reads by blind agents`);
  for (const f of findings) {
    console.log(`  ${f.agent}  ${f.tool}  → ${f.source}`);
    console.log(`      ${f.input}`);
  }
  console.log("\nThe agreement or benchmark score from this run is not a measurement. Persist it as invalid.");
  process.exit(1);
}
console.log("verdict      CLEAN — no blind transcriber touched an earlier read");
