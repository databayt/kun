#!/usr/bin/env node
// harvest-transcripts.mjs — mine real (prompt → skill) dispatches out of the
// Claude Code session transcripts.
//
// This is the only ground truth in the whole bench system that comes from the
// REAL main loop — with CLAUDE.md, path-scoped rules, the MCP tool listings and
// conversation history all present. The L1 harness deliberately strips all of
// that to isolate the frontmatter, so these pairs are what tell us how far the
// proxy sits from reality. It costs nothing and grows with every session.
//
// Usage:
//   node .claude/scripts/harvest-transcripts.mjs           # human summary
//   node .claude/scripts/harvest-transcripts.mjs --json     # pairs to stdout
//   node .claude/scripts/harvest-transcripts.mjs --out <p>  # write JSON to a path
//
// Three biases, stated up front because they bound what these numbers can prove:
//   1. Under-sampled — it can only see the explicit `Skill` tool. Much of kun's
//      dispatch is a passive inline SKILL.md read, which leaves no trace at all.
//   2. Survivorship-biased — it records dispatches that HAPPENED. It can never
//      show the dispatch that should have happened and didn't, which is the more
//      interesting failure.
//   3. Self-selected — these are prompts Abdout actually types, so they skew to
//      the skills he already trusts.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HOME = process.env.HOME || "";
const PROJECTS = join(HOME, ".claude/projects");

const JSON_OUT = process.argv.includes("--json");
const OUT_IDX = process.argv.indexOf("--out");
const OUT_PATH = OUT_IDX > -1 ? process.argv[OUT_IDX + 1] : null;

const MAX_PROMPT = 400; // longer than this and the prompt is a task brief, not a dispatch cue

// A continuation carries no dispatch information — the skill fired because of
// accumulated context, not because of these words. Observed in the real data:
// "resume" → higgs, "go" → mcp-doctor. Pairing them would manufacture ground
// truth. Kept as a fixed word list so the filter stays objective; deciding this
// case-by-case would need a judgment call, and judgment does not belong in the
// ground truth.
const CONTINUATION =
  /^(go|ok|okay|yes|y|no|resume|continue|next|proceed|do it|go ahead|carry on|keep going|again|more|and\?|\?|\.|k)$/i;

// Distance is in transcript LINES, which include the assistant's own thinking and
// tool traffic — so even a direct dispatch sits at 3–10. Beyond this the prompt
// did not plausibly cause the dispatch. Recorded per pair so the cutoff can be
// re-examined rather than trusted.
const MAX_DISTANCE = 40;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".jsonl")) yield p;
  }
}

// A transcript "user" turn is not necessarily something a human typed: tool
// results, hook output, command stdout and system reminders all arrive wearing
// the same role. Only genuine typed text can serve as a dispatch cue.
const NOISE =
  /<system-reminder>|<local-command-stdout>|<command-name>|<command-message>|<user-memory-input>|Caveat: The messages below/;

function userText(msg) {
  const c = msg?.message?.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return null;
  if (c.some((b) => b.type === "tool_result")) return null; // a result, not a prompt
  return c
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

const pairs = [];
const skillCounts = new Map();
let files = 0;
let invocations = 0;

for (const file of walk(PROJECTS)) {
  files++;
  let lines;
  try {
    lines = readFileSync(file, "utf8").split("\n");
  } catch {
    continue;
  }

  let lastPrompt = null;
  let lastPromptLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let o;
    try {
      o = JSON.parse(lines[i]);
    } catch {
      continue;
    }

    if (o.type === "user") {
      const t = userText(o);
      if (t && t.trim() && !NOISE.test(t)) {
        lastPrompt = t.trim();
        lastPromptLine = i;
      }
      continue;
    }

    if (o.type !== "assistant") continue;
    const content = o?.message?.content;
    if (!Array.isArray(content)) continue;

    for (const b of content) {
      if (b.type !== "tool_use" || b.name !== "Skill") continue;
      invocations++;
      const skill = b.input?.skill;
      if (!skill) continue;
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);

      // Only pair when a real prompt preceded it. A skill invoked deep inside a
      // long agentic run has no single prompt that "caused" it, and inventing
      // one would manufacture ground truth rather than observe it.
      if (!lastPrompt || lastPrompt.length > MAX_PROMPT) continue;
      const distance = i - lastPromptLine;
      const rejected = CONTINUATION.test(lastPrompt.trim())
        ? "continuation"
        : distance > MAX_DISTANCE
          ? "too-distant"
          : null;
      pairs.push({
        prompt: lastPrompt,
        skill,
        args: b.input?.args || null,
        distance,
        rejected, // kept, not dropped — the reject list is auditable
        file: file.replace(HOME, "~"),
      });
    }
  }
}

// Dedupe identical (prompt, skill) pairs — the same prompt replayed across
// resumed sessions is one observation, not several.
const seen = new Set();
const unique = pairs.filter((p) => {
  const k = `${p.prompt.toLowerCase()}|${p.skill}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// A prompt that led to two different skills is not noise — it is a genuine
// ambiguity observed in the wild, and the most valuable row in the file.
const byPrompt = new Map();
for (const p of unique) {
  const k = p.prompt.toLowerCase();
  if (!byPrompt.has(k)) byPrompt.set(k, new Set());
  byPrompt.get(k).add(p.skill);
}
const ambiguous = [...byPrompt]
  .filter(([, s]) => s.size > 1)
  .map(([prompt, s]) => ({ prompt, skills: [...s] }));

const usable = unique.filter((p) => !p.rejected);

const payload = {
  $comment:
    "Real (prompt → skill) dispatches observed in the live main loop. Under-sampled (explicit Skill tool only), survivorship-biased (never shows the dispatch that should have happened), and self-selected. Bounds gross proxy error; certifies nothing.",
  transcripts_scanned: files,
  skill_invocations: invocations,
  pairs_usable: usable.length,
  pairs_rejected: {
    continuation: unique.filter((p) => p.rejected === "continuation").length,
    too_distant: unique.filter((p) => p.rejected === "too-distant").length,
    max_distance: MAX_DISTANCE,
  },
  distinct_skills: skillCounts.size,
  by_skill: Object.fromEntries([...skillCounts].sort((a, b) => b[1] - a[1])),
  ambiguous_prompts: ambiguous,
  pairs: usable,
  pairs_all: unique,
};

if (OUT_PATH) {
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`wrote ${unique.length} pairs to ${OUT_PATH}`);
} else if (JSON_OUT) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(`transcripts   ${files} scanned`);
  console.log(`invocations   ${invocations} Skill calls across ${skillCounts.size} distinct skills`);
  console.log(`usable pairs  ${usable.length} of ${unique.length} deduped — rejected ${payload.pairs_rejected.continuation} continuation, ${payload.pairs_rejected.too_distant} too-distant (>${MAX_DISTANCE} lines)`);
  console.log(`by skill`);
  for (const [s, n] of [...skillCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${s}`);
  }
  if (ambiguous.length) {
    console.log(`ambiguous prompts (same text → different skills): ${ambiguous.length}`);
    for (const a of ambiguous.slice(0, 8)) {
      console.log(`  "${a.prompt.slice(0, 70)}" → ${a.skills.join(", ")}`);
    }
  }
  // Coverage against the scored fleet: a skill never observed is not proven dead,
  // but zero observations + zero spells + a used near-neighbour is the retirement
  // signal the /decide report is built from.
  const casesPath = join(ROOT, ".claude/evals/cases/dispatch.json");
  if (existsSync(casesPath)) {
    try {
      const d = JSON.parse(readFileSync(casesPath, "utf8"));
      const fleet = Object.keys(d.per_skill || {});
      const never = fleet.filter((s) => !skillCounts.has(s));
      console.log(
        `coverage      ${fleet.length - never.length}/${fleet.length} skills ever observed; ${never.length} never invoked`
      );
      console.log(`  never seen: ${never.join(", ")}`);
    } catch {
      /* cases file unreadable — coverage is optional context */
    }
  }
}
