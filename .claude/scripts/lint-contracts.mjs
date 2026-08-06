#!/usr/bin/env node
// lint-contracts.mjs — L2 static half: check that what a skill DECLARES still
// resolves against the repo.
//
// L1 asks "does the right skill fire?". This asks the cheaper question nobody
// was asking: "is what the skill says about itself still true?" It is fully
// deterministic — no agents, no tokens, no judge to calibrate — so it can run on
// every health check.
//
// Usage:
//   node .claude/scripts/lint-contracts.mjs           # human report
//   node .claude/scripts/lint-contracts.mjs --json    # findings to stdout
//   node .claude/scripts/lint-contracts.mjs --check   # exit 1 on any error-severity finding
//
// Checks, each earned by finding something real rather than by seeming sensible:
//
//   trigger-authority  A trigger phrase that names a vocabulary spell routing to
//                      a DIFFERENT skill. Validated: run against higgs before the
//                      2026-08-06 fix it catches `og image` → /carousel, the same
//                      defect the L1 benchmark needed 16 agents to surface.
//   stale-model        Frontmatter pinning a model VERSION instead of an alias.
//                      engine.json is explicit — "never pin a version number
//                      there" — and health.sh already greps for retired versions,
//                      but only in docs/ and CLAUDE.md, never in the frontmatter
//                      where they actually are.
//   broken-ref         A `.claude/…` or `docs/…` path that resolves in NEITHER
//                      the project nor the user root. Runtime and per-product-repo
//                      artifacts are allowlisted: their absence here is correct.
//   workflow-parity    A referenced workflow file exists and its meta.name matches
//                      its filename.
//   no-when-to-use     A skill with no when_to_use is invisible to dispatch — it
//                      can only ever be invoked by exact name.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HOME = process.env.HOME || "";
const JSON_OUT = process.argv.includes("--json");
const CHECK = process.argv.includes("--check");

// Correctly absent from this repo — asserting otherwise would be the lint lying.
// session-state.json is written at runtime by /check; blocks.json is a per-product
// -repo artifact that kun itself has no reason to carry.
const RUNTIME_ARTIFACTS = [/session-state\.json$/, /blocks\.json$/, /\.env/, /node_modules/];

const findings = [];
const add = (severity, check, subject, detail, fix) =>
  findings.push({ severity, check, subject, detail, fix });

// ── Load the fleet (project ∪ user, project wins) ───────────────────────────
const skills = new Map();
for (const [dir, scope] of [
  [join(HOME, ".claude/skills"), "user"],
  [join(ROOT, ".claude/skills"), "project"],
]) {
  if (!existsSync(dir)) continue;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = join(dir, e.name, "SKILL.md");
    if (existsSync(p)) skills.set(e.name, { name: e.name, path: p, scope, raw: readFileSync(p, "utf8") });
  }
}

// ── 1. trigger-authority ────────────────────────────────────────────────────
const vocab = JSON.parse(readFileSync(join(ROOT, ".claude/vocabulary.json"), "utf8"));
const authority = new Map();
for (const sc of vocab.schools || []) {
  for (const sp of sc.spells || []) {
    if (sp.mergedInto) continue;
    const t = (sp.order || []).filter((o) => o.type === "skill").map((o) => o.name.replace(/^\//, ""));
    if (t.length) authority.set(sp.name.toLowerCase(), { skill: t[0], school: sc.id });
  }
}

for (const s of skills.values()) {
  const m = s.raw.match(/when_to_use:[\s\S]*?Triggers on:?\s+([^"\n]*)/i);
  if (!m) continue;
  for (let ph of m[1].split(/,(?![^(]*\))/)) {
    ph = ph.trim().replace(/^["'`]+|["'`.]+$/g, "").toLowerCase();
    const a = authority.get(ph);
    if (a && a.skill !== s.name) {
      add(
        "error",
        "trigger-authority",
        s.name,
        `claims trigger "${ph}", but vocabulary.json (${a.school}) routes that spell to /${a.skill}`,
        `drop "${ph}" from ${s.name}'s trigger list, or change the spell's order chain — one of the two is wrong`
      );
    }
  }
}

// ── 2. stale-model ──────────────────────────────────────────────────────────
const engine = JSON.parse(readFileSync(join(ROOT, ".claude/engine.json"), "utf8"));
const live = new Set([engine.model, ...(engine.fallback_models || [])]);
const ALIASES = new Set(["opus", "sonnet", "haiku", "fable", "inherit"]);

const frontmatters = [];
for (const s of skills.values()) frontmatters.push({ kind: "skill", name: s.name, raw: s.raw, path: s.path });
for (const [dir, scope] of [
  [join(ROOT, ".claude/agents"), "project"],
  [join(HOME, ".claude/agents"), "user"],
]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md") || f.startsWith("_index")) continue;
    frontmatters.push({ kind: "agent", name: f.replace(/\.md$/, ""), raw: readFileSync(join(dir, f), "utf8"), path: join(dir, f), scope });
  }
}

for (const fm of frontmatters) {
  const m = fm.raw.slice(0, 1200).match(/^model:\s*(.+)$/m);
  if (!m) continue;
  const val = m[1].trim().replace(/["']/g, "");
  if (ALIASES.has(val)) continue;
  const retired = !live.has(val);
  add(
    retired ? "error" : "warn",
    "stale-model",
    `${fm.kind} ${fm.name}`,
    retired
      ? `pins \`model: ${val}\`, which is not the engine model or a declared fallback (${[...live].join(", ")})`
      : `pins \`model: ${val}\` — a version, where engine.json requires an alias`,
    `use an alias from engine.json → model_tiers (opus | sonnet | haiku), so the fleet follows the engine instead of a frozen version`
  );
}

// ── 3. broken-ref ───────────────────────────────────────────────────────────
const resolves = (rel) =>
  existsSync(join(ROOT, rel)) ||
  existsSync(join(HOME, rel)) ||
  existsSync(join(HOME, rel.replace(/^\.claude\//, ".claude/"))) ||
  // rules ship from .claude/rules-global/ to ~/.claude/rules/ via setup.sh
  existsSync(join(ROOT, rel.replace(/^\.claude\/rules\//, ".claude/rules-global/")));

for (const s of skills.values()) {
  const seen = new Set();
  for (const m of s.raw.matchAll(/`(\.claude\/[A-Za-z0-9._/-]+|docs\/[A-Za-z0-9._/-]+\.(?:md|mdx))`/g)) {
    const rel = m[1];
    if (seen.has(rel) || /[<>*{}]/.test(rel)) continue;
    seen.add(rel);
    if (RUNTIME_ARTIFACTS.some((r) => r.test(rel))) continue;
    if (!resolves(rel)) {
      add("warn", "broken-ref", s.name, `references \`${rel}\`, which exists in neither the project nor the user root`, `fix the path or delete the reference`);
    }
  }
}

// ── 4. workflow-parity ──────────────────────────────────────────────────────
const wfDir = join(ROOT, ".claude/workflows");
if (existsSync(wfDir)) {
  for (const f of readdirSync(wfDir).filter((x) => x.endsWith(".js"))) {
    const raw = readFileSync(join(wfDir, f), "utf8");
    const m = raw.match(/name:\s*["']([^"']+)["']/);
    const expected = f.replace(/\.js$/, "");
    if (m && m[1] !== expected) {
      add("warn", "workflow-parity", f, `meta.name is "${m[1]}" but the file is ${f}`, `make them match — the name is how the workflow is invoked`);
    }
  }
}

// ── 5. no-when-to-use ───────────────────────────────────────────────────────
for (const s of skills.values()) {
  if (!/^when_to_use:/m.test(s.raw.slice(0, 2000))) {
    add("warn", "no-when-to-use", s.name, `has no when_to_use, so dispatch can only reach it by exact name`, `add a when_to_use with a "Triggers on:" list`);
  }
}

// ── Output ──────────────────────────────────────────────────────────────────
const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

if (JSON_OUT) {
  console.log(JSON.stringify({ skills: skills.size, errors: errors.length, warnings: warns.length, findings }, null, 2));
  process.exit(0);
}

const byCheck = new Map();
for (const f of findings) {
  if (!byCheck.has(f.check)) byCheck.set(f.check, []);
  byCheck.get(f.check).push(f);
}

if (CHECK) {
  for (const f of warns) console.warn(`warn: ${f.check}: ${f.subject} — ${f.detail}`);
  for (const f of errors) console.error(`error: ${f.check}: ${f.subject} — ${f.detail}`);
  if (errors.length) process.exit(1);
  console.log(`contracts: ${skills.size} skills, 0 errors, ${warns.length} warnings`);
  process.exit(0);
}

console.log(`fleet    ${skills.size} skills + ${frontmatters.filter((f) => f.kind === "agent").length} agents`);
console.log(`verdict  ${errors.length} errors, ${warns.length} warnings\n`);
for (const [check, fs_] of byCheck) {
  console.log(`${check} (${fs_.length})`);
  for (const f of fs_) console.log(`  ${f.severity === "error" ? "✗" : "·"} ${f.subject}: ${f.detail}`);
  if (fs_[0].fix) console.log(`  → ${fs_[0].fix}\n`);
}
if (!findings.length) console.log("no findings — every declared reference resolves");
