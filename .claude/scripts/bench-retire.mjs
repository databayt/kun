#!/usr/bin/env node
// bench-retire.mjs — retirement EVIDENCE for the skill fleet. Never a decision.
//
// This is Hermes' curator idea (stale → archive lifecycle) rebuilt under kun's
// constraints: fully deterministic, zero tokens, and it only ever produces a
// ranked evidence table for a /decide. Nothing here deletes, merges, or edits a
// skill — a fleet optimized purely by usage evidence would destroy per-skill
// allowed-tools, plugin packaging and argument-hint ergonomics this script
// cannot see. The machine finds and evidences; the human signs off.
//
// Three independent signals, joined:
//   usage      — Skill-tool invocations observed in ~/.claude/projects/ (weak:
//                passive inline SKILL.md reads leave no trace; a zero here is
//                suggestive, never proof)
//   redundancy — highest cosine neighbour from the measured adjacency pairs
//   cost       — frontmatter chars: what every session pays for the skill to
//                exist, whether or not it ever fires
//
// Usage:
//   node .claude/scripts/bench-retire.mjs           # ranked table
//   node .claude/scripts/bench-retire.mjs --json    # machine-readable

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const JSON_OUT = process.argv.includes("--json");

const CASES = join(ROOT, ".claude/evals/cases/dispatch.json");
const PAIRS = join(ROOT, ".claude/evals/cases/real-pairs.json");
const VOCAB = join(ROOT, ".claude/vocabulary.json");

if (!existsSync(CASES)) {
  console.error("no dispatch.json — run extract-dispatch-cases.mjs --json first");
  process.exit(2);
}
const corpus = JSON.parse(readFileSync(CASES, "utf8"));
const usage = existsSync(PAIRS) ? JSON.parse(readFileSync(PAIRS, "utf8")).by_skill || {} : {};
const vocab = JSON.parse(readFileSync(VOCAB, "utf8"));

// spells pointing at each skill — a spell is reachability independent of usage
const spellsFor = new Map();
for (const sc of vocab.schools || []) {
  for (const sp of sc.spells || []) {
    if (sp.mergedInto) continue;
    for (const o of sp.order || []) {
      if (o.type !== "skill") continue;
      const n = o.name.replace(/^\//, "");
      spellsFor.set(n, (spellsFor.get(n) || 0) + 1);
    }
  }
}

// best cosine neighbour per skill, from the measured pairs
const neighbour = new Map();
for (const [a, b, c] of corpus.top_pairs || []) {
  if (!neighbour.has(a) || neighbour.get(a).cos < c) neighbour.set(a, { with: b, cos: c });
  if (!neighbour.has(b) || neighbour.get(b).cos < c) neighbour.set(b, { with: a, cos: c });
}

const rows = Object.entries(corpus.per_skill).map(([name, s]) => {
  const inv = usage[name] || 0;
  const spells = spellsFor.get(name) || 0;
  const nb = neighbour.get(name);
  // Evidence score, not a verdict: unobserved + unspelled + a close neighbour +
  // expensive = worth a human look. Weights are deliberately crude — this ranks
  // a reading list, it does not decide anything.
  const score =
    (inv === 0 ? 2 : 0) +
    (spells === 0 ? 1 : 0) +
    (nb && nb.cos >= 0.4 ? 2 : nb && nb.cos >= 0.33 ? 1 : 0) +
    (s.chars >= 600 ? 1 : 0) +
    (s.claude_md_routed ? -2 : 0); // CLAUDE.md routes it — retiring breaks a documented path
  return {
    skill: name,
    invocations: inv,
    spells,
    support: s.support,
    chars: s.chars,
    neighbour: nb ? `${nb.with}@${nb.cos}` : "—",
    claude_md_routed: s.claude_md_routed,
    evidence: score,
  };
});

rows.sort((a, b) => b.evidence - a.evidence || b.chars - a.chars);
const candidates = rows.filter((r) => r.evidence >= 3);
const reclaim = candidates.reduce((n, r) => n + r.chars, 0);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        $comment:
          "Retirement EVIDENCE — input to a /decide, never an action. usage undercounts passive inline reads; a zero is suggestive, not proof.",
        generated_from: { cases: corpus.corpus.corpus_hash, transcripts_by_skill: Object.keys(usage).length },
        candidates,
        chars_reclaimable_if_all_retired: reclaim,
        all: rows,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(`fleet ${rows.length} skills · candidates (evidence ≥ 3): ${candidates.length} · chars reclaimable if all retired: ${reclaim}`);
console.log("");
console.log("evd  skill            inv  spells  chars  nearest-neighbour       claude_md");
console.log("---  ---------------  ---  ------  -----  ----------------------  ---------");
for (const r of rows.slice(0, 20)) {
  console.log(
    `${String(r.evidence).padStart(3)}  ${r.skill.padEnd(15)}  ${String(r.invocations).padStart(3)}  ${String(r.spells).padStart(6)}  ${String(r.chars).padStart(5)}  ${r.neighbour.padEnd(22)}  ${r.claude_md_routed ? "yes" : ""}`
  );
}
console.log("");
console.log("Every char here is paid on every prompt, fired or not. A candidate is a");
console.log("reading assignment for /decide — usage undercounts passive reads, and this");
console.log("script cannot see allowed-tools, plugin packaging, or argument ergonomics.");
