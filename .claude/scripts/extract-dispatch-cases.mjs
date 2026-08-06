#!/usr/bin/env node
// extract-dispatch-cases.mjs — deterministic L1 dispatch-benchmark case extractor.
//
// kun already contains its own labeled test set: the literal "Triggers on:" phrase
// lists inside each skill's `when_to_use`, plus every vocabulary spell that names a
// skill target — and every spell that names an agent/MCP instead, which is a prompt
// that must fire NO skill. This script turns that into cases. Nothing is synthesized.
//
// The LLM must never do this parsing. If it did, the case set would stop being
// reproducible and every run would measure a different test.
//
// Usage:
//   node .claude/scripts/extract-dispatch-cases.mjs            # human summary
//   node .claude/scripts/extract-dispatch-cases.mjs --json      # full case set to stdout
//   node .claude/scripts/extract-dispatch-cases.mjs --check     # exit 1 on guard violation (health.sh runs this)
//
// Guards enforced by --check (see docs/CONFIG-BENCHMARK.md → Engine KPIs):
//   1. corpus_hash — the trigger phrases ARE the test set. If they move, scores are
//      not comparable and the run must stop. This is the anti-Goodhart guard: a tuner
//      that edits a description cannot also edit the cases it is scored against.
//   2. listing budget — the fleet listing is loaded into EVERY session before a word
//      is typed. Total <= LISTING_CAP chars, per-skill <= SKILL_CAP.
//   3. coverage — every skill must yield at least one positive case.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HOME = process.env.HOME || "";
const PROJECT_SKILLS = join(ROOT, ".claude/skills");
const USER_SKILLS = join(HOME, ".claude/skills");
const VOCAB_PATH = join(ROOT, ".claude/vocabulary.json");
const CLAUDE_MD_PATH = join(ROOT, ".claude/CLAUDE.md");
const SCORES_PATH = join(ROOT, ".claude/memory/skill-scores.json");

const JSON_OUT = process.argv.includes("--json");
const CHECK = process.argv.includes("--check");

// Budget caps. Current reality is 25,403 chars total / 1,091 max (draft), so both
// bind immediately — that is deliberate. Accuracy bought with prefix bloat is not
// a win: every added word is paid by all 66 skills on every prompt.
const LISTING_CAP = 26000;
const SKILL_CAP = 1200;

const SPLIT_SALT = "kun-dispatch-v1";
const HOLDOUT_PCT = 20;

// Skills the harness cannot see the text of (Claude Code built-ins have no file on
// disk). They still compete for dispatch in the real loop — a documented blind spot,
// not an oversight. See "Fidelity" in the plan.
const BUILTIN_SKILLS = new Set([
  "loop", "schedule", "goal", "code-review", "simplify", "batch", "debug",
  "claude-api", "deep-research", "run", "verify", "insights", "usage", "memory",
  "init", "security-review", "dataviz", "artifact-design", "artifact-diagramming",
  "artifact-capabilities", "update-config", "keybindings-help", "fewer-permission-prompts",
]);

// A false fire here has side effects the user must undo. Weighted separately from
// accuracy — safety and accuracy are never tradeable in one number.
const HIGH_FP_COST = new Set([
  "publish", "ship", "deploy", "release", "incident", "qa", "report",
]);

// ── FNV-1a 32-bit ───────────────────────────────────────────────────────────
// Pure integer, no floats, no locale — byte-stable across Node versions and
// machines. Used for both corpus_hash and the train/holdout split so a run on
// Abdout's Mac and a run in CI assign identically.
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const hex = (n) => n.toString(16).padStart(8, "0");

// ── YAML frontmatter: a line-walking reader, not a regex ────────────────────
// Quoting in this corpus is genuinely mixed — single-with-'' escapes (qa),
// double-with-\" escapes (check, release, ship), plain scalars (atom, canon),
// and flow sequences (allowed-tools). A regex parses some of these and silently
// mangles the rest; this parses 66/66.
function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return {};
  const lines = raw.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return {};

  const out = {};
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let s = m[2];
    let j = i;

    if (s.startsWith("'")) {
      // Closed when it ends in ' AND the total count of ' is even ('' is an escape).
      const closed = (t) => t.length > 1 && t.endsWith("'") && (t.match(/'/g) || []).length % 2 === 0;
      while (!closed(s) && j + 1 < end) s += " " + lines[++j].trim();
      out[key] = s.slice(1).replace(/'$/, "").split("''").join("'");
    } else if (s.startsWith('"')) {
      const closed = (t) => t.length > 1 && t.endsWith('"') && !t.endsWith('\\"');
      while (!closed(s) && j + 1 < end) s += " " + lines[++j].trim();
      out[key] = s.slice(1).replace(/"$/, "").split('\\"').join('"');
    } else {
      out[key] = s;
    }
    i = j;
  }
  return out;
}

// ── The trigger tail ────────────────────────────────────────────────────────
// Three hazards, each capable of silently corrupting a run:
//   1. The colon is OPTIONAL — atom/idea/template write `Triggers on "atom <name>"`.
//      Matching "Triggers on:" finds 40 skills; "Triggers on" finds 43.
//   2. The list is not always terminal — clone and wire continue with a new
//      sentence, which would otherwise be captured as a trigger phrase.
//   3. Search when_to_use FIRST, description SECOND, and NEVER concatenate them.
//      Concatenating bleeds the tail across the field boundary: 268 phrases of
//      which 35 are description fragments. 15% garbage. The correct answer is 233.
function triggerTail(field) {
  if (!field) return null;
  const m = field.match(/Triggers on:?\s+([\s\S]*)$/i);
  if (!m) return null;
  let t = m[1].trim();
  const cut = t.search(/\.\s+(?=[A-Z][a-z])/); // "Foo. Bar baz" but not "e.g. QA this"
  if (cut > -1) t = t.slice(0, cut + 1);
  return t.trim() || null;
}

// Depth-aware split. A naive split(",") shatters real content:
//   "promote checked build (Vercel --prod)"
//   "one-spell handoff (handover→check→ship→watch→close issue)"
//   "optionally scoped to a product (hogwarts, souq, mkan, shifa, kun)"
// Arabic comma U+060C is currently unused (all 24 Arabic phrases use ASCII
// commas) but costs one character to support.
function splitPhrases(tail) {
  const out = [];
  let buf = "";
  let dq = false;
  let par = 0, ang = 0, brk = 0;

  const push = () => {
    const s = buf
      .trim()
      .replace(/^["“”'`]+/, "")
      .replace(/["“”'`.]+$/, "")
      .trim();
    if (s) out.push(s);
    buf = "";
  };

  for (const ch of tail) {
    if (ch === '"' || ch === "“" || ch === "”") dq = !dq;
    else if (ch === "(") par++;
    else if (ch === ")") par = Math.max(0, par - 1);
    else if (ch === "<") ang++;
    else if (ch === ">") ang = Math.max(0, ang - 1);
    else if (ch === "[") brk++;
    else if (ch === "]") brk = Math.max(0, brk - 1);

    if ((ch === "," || ch === "،") && !dq && !par && !ang && !brk) {
      push();
      continue;
    }
    buf += ch;
  }
  push();
  return out;
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "x";

// Case IDs are the split ledger's primary key, so they must be unique AND stable
// under reordering — an index-based suffix would reshuffle every later ID when a
// phrase is inserted, silently reassigning holdout membership. A content hash
// does neither. (The slug alone is not enough: higgs declares both "/higgs" and
// "higgs", which slug identically.)
const caseId = (prefix, skill, prompt) =>
  `${prefix}:${skill}:${slug(prompt)}-${hex(fnv1a(prompt)).slice(0, 4)}`;

// ── Load the fleet ──────────────────────────────────────────────────────────
// The real listing is project ∪ user, deduped by directory name — that is what
// Claude Code resolves. Benchmarking the 48 project skills alone would measure a
// listing the model never sees, and the 18 user-only skills are disproportionately
// the weak ones (deploy, dev, fix, test, ...).
function loadSkills() {
  const byName = new Map();
  const parseFailures = [];

  for (const [dir, scope] of [
    [USER_SKILLS, "user"],
    [PROJECT_SKILLS, "project"], // project wins on collision
  ]) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(dir, entry.name, "SKILL.md");
      if (!existsSync(path)) continue;
      const raw = readFileSync(path, "utf8");
      const fm = parseFrontmatter(raw);
      if (!fm.description && !fm.when_to_use) {
        parseFailures.push(`${scope}/${entry.name}`);
      }
      byName.set(entry.name, {
        // The directory name is the label. 18 skills carry a title-cased `name:`
        // ("MCP Doctor", "SaaS") that would never match a dispatch answer.
        skill: entry.name,
        declaredName: fm.name || entry.name,
        description: fm.description || "",
        when_to_use: fm.when_to_use || "",
        argumentHint: fm["argument-hint"] || "",
        scope,
        path,
        body: raw,
      });
    }
  }

  for (const s of byName.values()) {
    s.chars =
      s.skill.length + s.description.length + s.when_to_use.length + 2;
  }
  return { skills: [...byName.values()].sort((a, b) => a.skill.localeCompare(b.skill)), parseFailures };
}

// ── Cosine adjacency ────────────────────────────────────────────────────────
// Clusters are mined, not guessed. The intuitive cluster (ship/publish/release/
// deploy) is mostly wrong — ship↔publish is 0.093. The real collisions are
// plan↔tasks 0.680, approve↔publish 0.560, plan↔spec 0.523.
const STOP = new Set(
  ("the a an and or of to for in on at by with from as is are be it its this that when use used " +
    "using not no non only any all each per via than then them they use user abdout claude kun " +
    "one two three what which who whom whose how why where into out over under across after before " +
    "does do did done doing has have had having will would can could should may might must shall " +
    "run runs running new news now just also but if else while about against between during " +
    "skill skills triggers trigger")
    .split(/\s+/)
);

function bag(text) {
  const m = new Map();
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []) {
    if (STOP.has(w)) continue;
    m.set(w, (m.get(w) || 0) + 1);
  }
  return m;
}

function cosine(a, b) {
  let dot = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [w, n] of small) if (large.has(w)) dot += n * large.get(w);
  if (!dot) return 0;
  const norm = (m) => Math.sqrt([...m.values()].reduce((s, n) => s + n * n, 0));
  return dot / (norm(a) * norm(b));
}

// ── Split assignment: hash for new IDs, ledger for immutability ─────────────
// A pure hash satisfies "never changes" but leaves 14 skills with zero holdout
// cases (median is 4 phrases/skill, so a 20% coin flip misses a fifth of the
// fleet). A per-skill rescue fixes coverage but breaks stability. The ledger
// resolves both: entries are write-once, so the rescue can only ever touch a
// brand-new skill.
function assignSplit(cases, ledger) {
  const next = { ...ledger };
  for (const c of cases) {
    if (next[c.id]) continue; // frozen forever — zero flips, by construction
    next[c.id] = fnv1a(SPLIT_SALT + "|" + c.id) % 100 < HOLDOUT_PCT ? "holdout" : "train";
  }
  const bySkill = new Map();
  for (const c of cases) {
    if (!c.label || c.label === "none") continue;
    if (!bySkill.has(c.label)) bySkill.set(c.label, []);
    bySkill.get(c.label).push(c);
  }
  for (const [, cs] of bySkill) {
    if (cs.some((c) => ledger[c.id])) continue; // pre-existing skill — never touch
    if (cs.some((c) => next[c.id] === "holdout")) continue;
    next[cs.slice().sort((a, b) => a.id.localeCompare(b.id))[0].id] = "holdout";
  }
  return next;
}

// ── Build ───────────────────────────────────────────────────────────────────
const { skills, parseFailures } = loadSkills();
const skillNames = new Set(skills.map((s) => s.skill));
const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf8"));
const claudeMd = existsSync(CLAUDE_MD_PATH) ? readFileSync(CLAUDE_MD_PATH, "utf8") : "";

const cases = [];
const findings = [];
const seenPrompt = new Map(); // normalized prompt → first case (dedupe + collision report)
const seenId = new Map(); // case id → case, so a collision can never pass silently

function addCase(c) {
  const key = c.prompt.toLowerCase().trim();
  const prior = seenPrompt.get(key);
  if (prior) {
    if (prior.label !== c.label) {
      findings.push({
        kind: "prompt-collision",
        detail: `"${c.prompt}" is claimed by both ${prior.label} and ${c.label}`,
      });
    }
    return; // first writer wins; dedupe is deterministic because sources are ordered
  }
  // Two distinct prompts sharing an id would collide in the split ledger and one
  // would silently inherit the other's holdout membership. Hard error, never a warn.
  const idClash = seenId.get(c.id);
  if (idClash) {
    findings.push({
      kind: "case-id-collision",
      fatal: true,
      detail: `id ${c.id} generated by both "${idClash.prompt}" and "${c.prompt}"`,
    });
    return;
  }
  seenId.set(c.id, c);
  seenPrompt.set(key, c);
  cases.push(c);
}

// 1. Trigger phrases — the primary source.
let triggerPhraseCount = 0;
const noTrigger = [];
for (const s of skills) {
  const tail = triggerTail(s.when_to_use) || triggerTail(s.description);
  if (!tail) {
    noTrigger.push(s.skill);
    continue;
  }
  const phrases = splitPhrases(tail);
  triggerPhraseCount += phrases.length;
  for (const p of phrases) {
    const tags = [];
    if (p.toLowerCase() === s.skill.toLowerCase()) tags.push("trivial");
    // A phrase that literally names a DIFFERENT skill is a hard negative: a miss
    // there is a real finding, not a labeling error. `costs :: "budget check"`
    // firing /check would be an actual production bug.
    for (const other of skillNames) {
      if (other === s.skill) continue;
      if (new RegExp(`\\b${other}\\b`, "i").test(p)) {
        tags.push(`hard:names-${other}`);
      }
    }
    addCase({
      id: caseId("trg", s.skill, p),
      prompt: p,
      label: s.skill,
      source: "trigger_phrase",
      tags,
    });
  }
}

// 2. Vocabulary spells that name a skill → positives.
//    Spells that name an agent/MCP/hook instead → the none-of-the-above class,
//    by the engine's OWN declared truth. That is 95 free negatives.
let spellPositives = 0;
let noneCases = 0;
const builtinTargeted = [];
for (const school of vocab.schools || []) {
  for (const sp of school.spells || []) {
    if (sp.mergedInto) continue;
    const targets = (sp.order || [])
      .filter((o) => o.type === "skill")
      .map((o) => o.name.replace(/^\//, ""));

    if (targets.length) {
      const label = targets[0];
      if (!skillNames.has(label)) {
        // A Claude Code built-in has no file, so the harness cannot show the model
        // its text — the case would be unanswerable. Excluded, but counted: these
        // are dispatch decisions the benchmark is structurally blind to.
        builtinTargeted.push(`${school.id}/${sp.name} → ${label}`);
        continue;
      }
      spellPositives++;
      addCase({
        id: caseId("spell", school.id, sp.name),
        prompt: sp.name,
        label,
        source: "vocab_spell",
        tags: sp.name.toLowerCase() === label.toLowerCase() ? ["trivial"] : [],
      });
    } else {
      // A spell named like a real skill CANNOT be a none-case — and the fact that
      // it routes elsewhere is itself a defect generate-vocab.mjs never checks.
      if (skillNames.has(sp.name)) {
        findings.push({
          kind: "spell-skill-collision",
          detail: `spell "${sp.name}" (${school.id}) routes to ${(sp.order || [])
            .map((o) => `${o.type}:${o.name}`)
            .join(", ")} while a skill named "${sp.name}" exists`,
        });
        continue;
      }
      noneCases++;
      addCase({
        id: caseId("none", school.id, sp.name),
        prompt: sp.name,
        label: "none",
        source: "vocab_none",
        tags: school.id === "unforgivable" ? ["destructive"] : [],
      });
    }
  }
}

// 3. Fallback for skills with no trigger tail: quoted keywords in the frontmatter.
let quotedKeywords = 0;
for (const name of noTrigger) {
  const s = skills.find((x) => x.skill === name);
  const text = `${s.description} ${s.when_to_use}`;
  for (const m of text.matchAll(/"([^"]{2,40})"/g)) {
    const p = m[1].trim();
    if (!p || p.toLowerCase() === s.skill.toLowerCase()) continue;
    quotedKeywords++;
    addCase({
      id: caseId("kw", s.skill, p),
      prompt: p,
      label: s.skill,
      source: "quoted_keyword",
      tags: [],
    });
  }
}

// ── Adjacency ───────────────────────────────────────────────────────────────
const bags = new Map(
  skills.map((s) => [s.skill, bag(`${s.skill} ${s.description} ${s.when_to_use}`)])
);
const pairs = [];
for (let i = 0; i < skills.length; i++) {
  for (let j = i + 1; j < skills.length; j++) {
    const a = skills[i].skill, b = skills[j].skill;
    const c = cosine(bags.get(a), bags.get(b));
    if (c >= 0.33) pairs.push([a, b, Number(c.toFixed(3))]);
  }
}
pairs.sort((x, y) => y[2] - x[2]);

// Union-find over the adjacency pairs → clusters.
const parent = new Map(skills.map((s) => [s.skill, s.skill]));
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
for (const [a, b] of pairs) parent.set(find(a), find(b));
const clusterMap = new Map();
for (const s of skills) {
  const r = find(s.skill);
  if (!clusterMap.has(r)) clusterMap.set(r, []);
  clusterMap.get(r).push(s.skill);
}
const clusters = [...clusterMap.values()]
  .filter((m) => m.length > 1)
  .map((members) => ({
    id: members.slice().sort()[0],
    members: members.sort(),
    max_cosine: Math.max(
      ...pairs.filter(([a, b]) => members.includes(a) && members.includes(b)).map(([, , c]) => c)
    ),
  }))
  .sort((a, b) => b.max_cosine - a.max_cosine);

const inCluster = new Set(clusters.flatMap((c) => c.members));
for (const c of cases) {
  if (c.label !== "none" && inCluster.has(c.label)) c.tags.push("hard:cluster");
}

// ── Per-skill metadata ──────────────────────────────────────────────────────
const positivesBySkill = new Map();
for (const c of cases) {
  if (c.label === "none") continue;
  positivesBySkill.set(c.label, (positivesBySkill.get(c.label) || 0) + 1);
}

const perSkill = {};
for (const s of skills) {
  perSkill[s.skill] = {
    support: positivesBySkill.get(s.skill) || 0,
    chars: s.chars,
    scope: s.scope,
    fp_cost: HIGH_FP_COST.has(s.skill) ? 3 : 1,
    // CLAUDE.md's Behavior section routes several skills explicitly ("Send to
    // client (one spell) → /release <block>"). For those, the frontmatter was
    // never the binding constraint — a proxy miss is suspect and must NOT be
    // tuned against in round 1.
    claude_md_routed: new RegExp(`/${s.skill}\\b`).test(claudeMd),
    has_when_to_use: Boolean(s.when_to_use),
  };
}

// ── Guards ──────────────────────────────────────────────────────────────────
const listingChars = skills.reduce((n, s) => n + s.chars, 0);
const zeroCoverage = skills.filter((s) => !perSkill[s.skill].support).map((s) => s.skill);
const overCap = skills.filter((s) => s.chars > SKILL_CAP).map((s) => `${s.skill}=${s.chars}`);

// corpus_hash covers ONLY the trigger tails — the test set. It is what makes
// guard #1 mechanical: a tuner cannot edit the cases it is scored against
// without the next --check refusing to compare scores.
const corpusHash = hex(
  fnv1a(
    skills
      .map((s) => `${s.skill} ${triggerTail(s.when_to_use) || triggerTail(s.description) || ""}`)
      .join("")
  )
);

let ledger = {};
if (existsSync(SCORES_PATH)) {
  try {
    ledger = JSON.parse(readFileSync(SCORES_PATH, "utf8"))?.split?.ledger || {};
  } catch {
    /* unreadable scores file — treat as a first run */
  }
}
const split = assignSplit(cases, ledger);
for (const c of cases) c.split = split[c.id];

const trivial = cases.filter((c) => c.tags.includes("trivial")).length;
const destructive = cases.filter((c) => c.tags.includes("destructive")).length;
const hard = cases.filter((c) => c.tags.some((t) => t.startsWith("hard:"))).length;

const payload = {
  corpus: {
    skills_listed: skills.length,
    project_skills: skills.filter((s) => s.scope === "project").length,
    user_only_skills: skills.filter((s) => s.scope === "user").length,
    listing_chars: listingChars,
    cases_total: cases.length,
    positive: cases.filter((c) => c.label !== "none").length,
    none: cases.filter((c) => c.label === "none").length,
    trivial,
    hard,
    destructive,
    sources: {
      trigger_phrase: triggerPhraseCount,
      vocab_spell: spellPositives,
      quoted_keyword: quotedKeywords,
      vocab_none: noneCases,
    },
    skills_without_triggers: noTrigger.length,
    builtin_targeted_spells: builtinTargeted.length,
    corpus_hash: `fnv1a:${corpusHash}`,
  },
  split: { version: "v1", salt: SPLIT_SALT, holdout_pct: HOLDOUT_PCT, ledger: split },
  listing: skills.map((s) => ({
    skill: s.skill,
    description: s.description,
    when_to_use: s.when_to_use,
  })),
  cases,
  clusters,
  top_pairs: pairs.slice(0, 25),
  per_skill: perSkill,
  findings,
  guards: {
    listing_cap: LISTING_CAP,
    skill_cap: SKILL_CAP,
    listing_over_cap: listingChars > LISTING_CAP,
    skills_over_cap: overCap,
    zero_coverage: zeroCoverage,
    parse_failures: parseFailures,
  },
};

// ── Output ──────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

if (CHECK) {
  const errors = [];
  const warnings = [];

  if (parseFailures.length)
    errors.push(`frontmatter unparsed for: ${parseFailures.join(", ")}`);
  if (listingChars > LISTING_CAP)
    errors.push(`listing budget: ${listingChars} chars > cap ${LISTING_CAP} — shrink a description before adding one`);
  if (overCap.length)
    errors.push(`per-skill cap ${SKILL_CAP} exceeded: ${overCap.join(", ")}`);
  for (const f of findings.filter((f) => f.fatal))
    errors.push(`${f.kind}: ${f.detail}`);
  if (zeroCoverage.length)
    warnings.push(`${zeroCoverage.length} skills yield no positive case (add a "Triggers on:" list): ${zeroCoverage.join(", ")}`);
  for (const f of findings) warnings.push(`${f.kind}: ${f.detail}`);

  if (existsSync(SCORES_PATH)) {
    try {
      const stored = JSON.parse(readFileSync(SCORES_PATH, "utf8"))?.corpus?.corpus_hash;
      if (stored && stored !== payload.corpus.corpus_hash) {
        errors.push(
          `corpus_hash moved (${stored} → ${payload.corpus.corpus_hash}) — the trigger phrases ARE the test set. ` +
            `Scores are not comparable across this edit. Reset the baseline deliberately: re-run the benchmark and note it in weekly_history.`
        );
      }
    } catch {
      warnings.push("skill-scores.json unreadable — cannot verify corpus_hash");
    }
  } else {
    warnings.push("no skill-scores.json yet — first run will establish the baseline");
  }

  for (const w of warnings) console.warn(`warn: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    process.exit(1);
  }
  console.log(
    `dispatch cases: ${cases.length} over ${skills.length} skills, listing ${listingChars}/${LISTING_CAP} chars, ${payload.corpus.corpus_hash}`
  );
  process.exit(0);
}

// Human summary
const pct = (n) => `${((n / cases.length) * 100).toFixed(1)}%`;
console.log(`fleet         ${skills.length} skills (${payload.corpus.project_skills} project + ${payload.corpus.user_only_skills} user-only), ${listingChars} chars / ${LISTING_CAP} cap`);
console.log(`cases         ${cases.length} total — ${payload.corpus.positive} positive, ${payload.corpus.none} none-of-the-above`);
console.log(`  sources     trigger_phrase ${triggerPhraseCount}, vocab_spell ${spellPositives}, quoted_keyword ${quotedKeywords}, vocab_none ${noneCases}`);
console.log(`  tags        trivial ${trivial} (${pct(trivial)}), hard ${hard}, destructive ${destructive}`);
console.log(`  split       ${cases.filter((c) => c.split === "holdout").length} holdout / ${cases.filter((c) => c.split === "train").length} train`);
console.log(`corpus_hash   ${payload.corpus.corpus_hash}`);
console.log(`clusters      ${clusters.length}`);
for (const c of clusters.slice(0, 6)) console.log(`  ${c.max_cosine.toFixed(3)}  ${c.members.join(", ")}`);
console.log(`top pairs`);
for (const [a, b, c] of pairs.slice(0, 10)) console.log(`  ${c.toFixed(3)}  ${a} ↔ ${b}`);
if (zeroCoverage.length) console.log(`no positive cases (${zeroCoverage.length}): ${zeroCoverage.join(", ")}`);
if (noTrigger.length) console.log(`no "Triggers on:" (${noTrigger.length}): ${noTrigger.join(", ")}`);
if (builtinTargeted.length) console.log(`blind spot — spells routing to a built-in (${builtinTargeted.length}): ${builtinTargeted.join(", ")}`);
for (const f of findings) console.log(`finding  ${f.kind}: ${f.detail}`);
