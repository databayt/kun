#!/usr/bin/env node
// resolve.mjs — kun's deterministic router: names in a prompt → repos and blocks.
//
//   node ~/kun/.claude/scripts/resolve.mjs "fix the admission form"   JSON: repos, blocks, hints
//   node ~/kun/.claude/scripts/resolve.mjs --route "<task>"           one repo id (Hermes `auto`)
//   node ~/kun/.claude/scripts/resolve.mjs --hook                     UserPromptSubmit (stdin JSON)
//   node ~/kun/.claude/scripts/resolve.mjs --build                    (re)build the index
//   node ~/kun/.claude/scripts/resolve.mjs --test                     the routing test suite
//
// Abdout speaks plainly; a word should land in the right place without a model guessing.
// The index (~/.claude/kun-index.json, written atomically) joins three sources:
//   1. .claude/memory/repositories.json — ids, aliases, bareMatch (curated)
//   2. every databayt git repo under ~ and ~/oss (discovered; explicit forms only)
//   3. every <repo>/.claude/blocks.json — the feature blocks
// plus engine.json → resolver (global_blocks, never_bare) and each skill's trigger words.
//
// Matching rules (built so false positives stay cheap):
//   - a repo matches bare only when the registry marks it bareMatch (hogwarts, mkan…);
//     anything else needs an explicit form: "in X", "X repo", "~/X", "databayt/X", "X's"
//   - blocks of the CURRENT project match exactly as the old block-context.sh did — same
//     keys, same order, same protocol text, byte for byte (the block protocol is unchanged)
//   - blocks of ANOTHER repo match only when the prompt names that repo, or when the key is
//     in engine.json → resolver.global_blocks; both give a one-line pointer, never the full
//     protocol, and name any skill whose triggers share the word ("also: seek")
// The hook never builds or scans; without an index it stays silent. Every hit is logged
// to ~/.claude/logs/resolve.jsonl so improve.mjs can review false positives and latency.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const T0 = process.hrtime.bigint();
const HOME = os.homedir();
const KUN = process.env.KUN_DIR || path.join(HOME, "kun");
const INDEX = process.env.KUN_INDEX || path.join(HOME, ".claude", "kun-index.json");
const LOG = path.join(HOME, ".claude", "logs", "resolve.jsonl");

const readJSON = (p, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return d;
  }
};
const writeAtomic = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// word boundaries that also hold for Arabic: no letter/number/underscore on either side
const word = (alt, plural = false) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alt})${plural ? "s?" : ""}(?![\\p{L}\\p{N}_])`, "iu");

// ── build ──────────────────────────────────────────────────────────────────
function gitRemote(dir) {
  try {
    return execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
function skillTriggers() {
  // word → [skill] from each skill's when_to_use "Triggers on: a, b, c" list
  const map = {};
  for (const root of [path.join(KUN, ".claude/skills"), path.join(HOME, ".claude/skills")]) {
    let dirs = [];
    try {
      dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {}
    for (const d of dirs) {
      let head = "";
      try {
        head = fs.readFileSync(path.join(root, d.name, "SKILL.md"), "utf8").slice(0, 3000);
      } catch {
        continue;
      }
      const m = /Triggers on:([^"\n]*)/i.exec(head);
      if (!m) continue;
      for (const t of m[1].split(/[,.;]/).map((x) => x.trim().toLowerCase()).filter(Boolean)) {
        for (const w of t.split(/\s+/)) if (w.length >= 4) (map[w] ||= new Set()).add(d.name);
      }
    }
  }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]));
}
export function build() {
  const reg = readJSON(path.join(KUN, ".claude/memory/repositories.json"), {});
  const engine = readJSON(path.join(KUN, ".claude/engine.json"), {});
  const rcfg = engine.resolver || {};
  const neverBare = new Set(rcfg.never_bare || ["kun", "codebase"]);
  const repos = {};
  for (const group of Object.values(reg.repositories || {})) {
    for (const r of group || []) {
      if (!r?.id) continue;
      const candidates = [path.join(HOME, r.id), r.local].filter(Boolean);
      const dir = candidates.find((p) => fs.existsSync(path.join(p, ".git")));
      repos[r.id] = {
        id: r.id,
        path: dir ? fs.realpathSync(dir) : null,
        aliases: (r.aliases || []).map((a) => a.toLowerCase()),
        bare: !!r.bareMatch && !neverBare.has(r.id),
        source: "registry",
      };
    }
  }
  for (const root of [HOME, path.join(HOME, "oss")]) {
    let ents = [];
    try {
      ents = fs.readdirSync(root, { withFileTypes: true });
    } catch {}
    for (const e of ents) {
      if (e.name.startsWith(".") || repos[e.name]) continue;
      const dir = path.join(root, e.name);
      let isDir = e.isDirectory();
      if (e.isSymbolicLink()) {
        try {
          isDir = fs.statSync(dir).isDirectory();
        } catch {}
      }
      if (!isDir || !fs.existsSync(path.join(dir, ".git"))) continue;
      if (!/databayt\//i.test(gitRemote(dir))) continue;
      repos[e.name] = { id: e.name, path: fs.realpathSync(dir), aliases: [], bare: false, source: "discovered" };
    }
  }
  const blocks = {};
  for (const r of Object.values(repos)) {
    if (!r.path) continue;
    const bj = readJSON(path.join(r.path, ".claude/blocks.json"));
    if (bj?.blocks) blocks[r.id] = bj.blocks;
  }
  const idx = {
    schema: 1,
    built: new Date().toISOString(),
    repos,
    blocks,
    global_blocks: rcfg.global_blocks || [],
    triggers: skillTriggers(),
  };
  writeAtomic(INDEX, JSON.stringify(idx));
  return idx;
}

// ── resolve ────────────────────────────────────────────────────────────────
function projectRepo(idx, dir) {
  if (!dir) return null;
  let real = dir;
  try {
    real = fs.realpathSync(dir);
  } catch {}
  let best = null;
  for (const r of Object.values(idx.repos)) {
    if (!r.path) continue;
    if ((real === r.path || real.startsWith(r.path + path.sep)) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best;
}
// The old block-context.sh order: keys sorted by length, longest first; ties as `sort -rn`
// leaves them (reverse byte order of the "len key" line); first 3 that match.
function blockKeysInOrder(blocks) {
  return Object.keys(blocks).sort((a, b) => b.length - a.length || (b > a ? 1 : b < a ? -1 : 0));
}
function matchBlocks(blocks, prompt, cap = 3) {
  const out = [];
  for (const key of blockKeysInOrder(blocks)) {
    if (out.length >= cap) break;
    const spaced = key.replace(/-/g, " ");
    if (word(`${esc(key)}|${esc(spaced)}`, true).test(prompt)) out.push(key);
  }
  return out;
}
export function resolve(idx, text, projectDir) {
  const prompt = (text || "").toLowerCase();
  const here = projectRepo(idx, projectDir);
  const repos = [];
  for (const r of Object.values(idx.repos)) {
    if (!r.path) continue;
    const names = [r.id, ...r.aliases];
    const explicit = names.flatMap((n) => [`in ${esc(n)}`, `${esc(n)} repo`, `~/${esc(n)}`, `databayt/${esc(n)}`, `${esc(n)}'s`]);
    const bare = r.bare ? names.map(esc) : r.aliases.map(esc); // aliases are curated — always bare
    const alts = [...explicit, ...bare].filter(Boolean).join("|");
    if (alts && word(alts).test(prompt)) repos.push(r.id);
  }
  // blocks of the current project — the unchanged block protocol
  const local = here && idx.blocks[here.id] ? matchBlocks(idx.blocks[here.id], prompt).map((key) => ({ repo: here.id, key, ...idx.blocks[here.id][key] })) : [];
  // blocks of a repo the prompt names (not the current one): pointers
  const named = [];
  for (const id of repos) {
    if (here && id === here.id) continue;
    if (idx.blocks[id]) for (const key of matchBlocks(idx.blocks[id], prompt)) named.push({ repo: id, key, ...idx.blocks[id][key] });
  }
  // curated global blocks from anywhere else: one-line hints naming skills that share the word
  const global = [];
  for (const [id, blocks] of Object.entries(idx.blocks)) {
    if ((here && id === here.id) || repos.includes(id)) continue;
    for (const key of idx.global_blocks) {
      if (!blocks[key]) continue;
      const spaced = key.replace(/-/g, " ");
      if (word(`${esc(key)}|${esc(spaced)}`, true).test(prompt)) global.push({ repo: id, key, ...blocks[key], also: (idx.triggers[key] || []).slice(0, 3) });
    }
  }
  return {
    project: here?.id || null,
    repos: repos.filter((id) => !(here && id === here.id)).map((id) => ({ id, path: idx.repos[id].path })),
    local,
    named,
    global,
  };
}

// ── render (hook output) ───────────────────────────────────────────────────
function protocol(b, root) {
  // byte-identical to the old block-context.sh, including the trailing space on line 1
  const L = [];
  L.push(`<block-protocol block="${b.key}" path="${b.path}">`);
  L.push(`This prompt touches the registered block '${b.key}'. Unless this is a quick small task (typo-level, single-line, pure question):`);
  L.push("BEFORE starting:");
  if ((b.context || []).length) L.push(`1. Read the block records: ${b.context.map((f) => `${b.path}/${f} `).join("")}`);
  else L.push(`1. Block has no records yet (no README.md/ISSUE.md/CLAUDE.md in ${b.path}) — plan to create README.md when finishing substantial work.`);
  L.push(`2. Check related GitHub issues: gh issue list --search "${b.key}" --state open`);
  L.push("AFTER the work is done:");
  L.push(`1. Update the block records (${b.path}/{README.md,ISSUE.md,CLAUDE.md}) to reflect what changed — status, decisions, known issues.`);
  if ((b.docs || []).length) L.push(`2. Update the block docs: ${b.docs.join(" + ")}`);
  else L.push(`2. No <block>.mdx docs page exists — create one under the repo's docs content dir if the change is user-facing.`);
  L.push("3. Comment the outcome on the related GitHub issue (close it if resolved).");
  L.push("</block-protocol>");
  return L.join("\n");
}
const tilde = (p) => (p && p.startsWith(HOME) ? "~" + p.slice(HOME.length) : p);
export function render(idx, res) {
  const out = res.local.map((b) => protocol(b));
  const lines = [];
  for (const r of res.repos) lines.push(`repo ${r.id} → ${tilde(r.path)} (another repo: its own CLAUDE.md applies there; use absolute paths)`);
  for (const b of res.named) lines.push(`block ${b.repo}/${b.key} → ${tilde(path.join(idx.repos[b.repo].path, b.path))} — block protocol applies: read its records first; after the work update them + its docs + the issue`);
  for (const b of res.global) {
    const also = b.also.length ? ` (also a ${b.also.join("/")} skill trigger — pick by context)` : "";
    lines.push(`'${b.key}' may mean the ${b.repo} block ${tilde(path.join(idx.repos[b.repo].path, b.path))}${also}; if so, its block protocol applies`);
  }
  if (lines.length) out.push(`<kun-route>\n${lines.join("\n")}\n</kun-route>`);
  return out.join("\n");
}

// ── test suite ─────────────────────────────────────────────────────────────
const CASES = [
  // [prompt, projectDir(~-relative or null), expect: {repos?, local?, global?, named?, none?}]
  ["fix the admission form", "~/hogwarts", { local: ["admission", "form"], repos: [], global: [] }], // hogwarts has a `form` block; the old hook matched it too
  ["fix the admission form", "~/kun", { global: ["admission"], local: [] }],
  ["admission deadlines for masters programs in Germany", "~/kun", { global: ["admission"], alsoIncludes: "seek" }],
  ["mkan listing is broken", "~/kun", { repos: ["mkan"] }],
  ["mkan listing is broken", "~/mkan", { repos: [] }],
  ["deploy balqalam", "~/kun", { repos: ["hogwarts"] }],
  ["افتح بالقلم", "~/kun", { repos: ["hogwarts"] }],
  ["check hogwarts attendance", "~/kun", { repos: ["hogwarts"], named: ["attendance"], global: [] }],
  ["the timetable for grade 4 is wrong", "~/kun", { global: ["timetable"] }],
  ["parent portal shows the wrong child", "~/kun", { global: ["parent-portal"] }],
  ["my fees page totals are off", "~/kun", { global: ["my-fees"] }],
  ["fix the docs table", "~/kun", { none: true }],
  ["update the dashboard settings", "~/kun", { none: true }],
  ["finance report is late", "~/kun", { none: true }],
  ["grades for the textbook loop", "~/kun", { none: true }],
  ["listings in kigali", "~/kun", { none: true }],
  ["like mkan, build a booking flow", "~/souq", { repos: ["mkan"] }],
  ["make souq look like shifa", "~/kun", { repos: ["souq", "shifa"] }],
  ["run the kun health check", "~/hogwarts", { repos: [] }],
  ["refactor the codebase registry", "~/kun", { repos: [] }],
  ["in codebase, add the blur atom", "~/kun", { repos: ["codebase"] }],
  ["open ~/marketing and fix the hero", "~/kun", { repos: ["marketing"] }],
  ["our marketing plan for Q1", "~/kun", { repos: [] }],
  ["the catalog of books", "~/kun", { repos: [] }],
  ["sync the catalog repo", "~/kun", { repos: ["catalog"] }],
  ["databayt/space careers page", "~/kun", { repos: ["space"] }],
  ["what's new in claude code", "~/kun", { none: true }],
  ["admissions are open", "~/kun", { global: ["admission"] }],
  ["transportation routes for the buses", "~/kun", { global: ["transportation"] }],
  ["school dashboard is slow", "~/kun", { global: ["school-dashboard"] }],
  ["teaching scope for science", "~/kun", { global: ["teaching-scope"] }],
  ["school switcher dropdown", "~/kun", { global: ["school-switcher"] }],
  ["qbank automation job failed", "~/kun", { global: ["qbank-automation"] }],
  ["attendance in hogwarts", "~/hogwarts", { local: ["attendance"], repos: [] }],
  ["fix docs and table in hogwarts", "~/hogwarts", { local: ["table", "docs"] }],
  ["mkan's whatsapp agent", "~/kun", { repos: ["mkan"] }],
  ["hogwartsx is not a repo", "~/kun", { repos: [] }],
  ["remake the mkan.sd homepage", "~/kun", { repos: ["mkan"] }],
  ["shifa appointments", "~/kun", { repos: ["shifa"] }],
  ["ثبت القبول في المدرسة", "~/kun", { none: true }],
  ["good morning", "~/kun", { none: true }],
  ["", "~/kun", { none: true }],
];
function test(idx) {
  let pass = 0;
  const fails = [];
  const times = [];
  for (const [prompt, proj, exp] of CASES) {
    const t = process.hrtime.bigint();
    const res = resolve(idx, prompt, proj ? proj.replace(/^~/, HOME) : null);
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
    const ids = (a) => a.map((x) => x.id || x.key).sort().join(",");
    const errs = [];
    const eq = (name, got, want) => {
      if (want !== undefined && got !== [...want].sort().join(",")) errs.push(`${name}: got [${got}] want [${[...want].sort()}]`);
    };
    if (exp.none) {
      if (res.repos.length || res.local.length || res.named.length || res.global.length) errs.push(`expected nothing, got ${JSON.stringify({ repos: ids(res.repos), local: ids(res.local), named: ids(res.named), global: ids(res.global) })}`);
    } else {
      eq("repos", ids(res.repos), exp.repos);
      eq("local", res.local.map((b) => b.key).sort().join(","), exp.local);
      eq("named", res.named.map((b) => b.key).sort().join(","), exp.named);
      eq("global", res.global.map((b) => b.key).sort().join(","), exp.global);
      if (exp.alsoIncludes && !res.global.some((b) => b.also.includes(exp.alsoIncludes))) errs.push(`hint should name skill ${exp.alsoIncludes}`);
    }
    if (errs.length) fails.push(`✗ "${prompt}" @ ${proj}: ${errs.join("; ")}`);
    else pass++;
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`resolve --test: ${pass}/${CASES.length} pass · per-prompt p95 ${p95.toFixed(2)} ms`);
  for (const f of fails) console.log(f);
  return fails.length === 0;
}

// ── main ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const ms = () => Number(process.hrtime.bigint() - T0) / 1e6;
try {
  if (args[0] === "--build") {
    const idx = build();
    console.log(`resolve: index built — ${Object.keys(idx.repos).length} repos, ${Object.values(idx.blocks).reduce((n, b) => n + Object.keys(b).length, 0)} blocks, ${idx.global_blocks.length} global → ${INDEX}`);
  } else if (args[0] === "--hook") {
    if (!process.env.KUN_HEADLESS) {
      const idx = readJSON(INDEX);
      if (idx) {
        const input = readJSON("/dev/stdin", {}) || {};
        const res = resolve(idx, input.prompt || "", process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
        const out = render(idx, res);
        if (out) {
          process.stdout.write(out + "\n");
          const hit = { ts: new Date().toISOString(), project: res.project, repos: res.repos.map((r) => r.id), local: res.local.map((b) => b.key), named: res.named.map((b) => `${b.repo}/${b.key}`), global: res.global.map((b) => `${b.repo}/${b.key}`), ms: Math.round(ms()) };
          try {
            fs.mkdirSync(path.dirname(LOG), { recursive: true });
            fs.appendFileSync(LOG, JSON.stringify(hit) + "\n");
          } catch {}
        }
      }
    }
  } else if (args[0] === "--route") {
    const idx = readJSON(INDEX) || build();
    const res = resolve(idx, args.slice(1).join(" "), null);
    const allowed = new Set(Object.values(idx.repos).filter((r) => r.source === "registry" && r.path).map((r) => r.id));
    const pick = res.repos.map((r) => r.id).find((id) => allowed.has(id)) || res.global.map((b) => b.repo).find((id) => allowed.has(id)) || "kun";
    console.log(pick);
  } else if (args[0] === "--test") {
    const idx = readJSON(INDEX) || build();
    process.exitCode = test(idx) ? 0 : 1;
  } else {
    const idx = readJSON(INDEX) || build();
    const proj = args.includes("--project") ? args[args.indexOf("--project") + 1] : null;
    const text = args.filter((a, i) => a !== "--project" && args[i - 1] !== "--project").join(" ");
    console.log(JSON.stringify(resolve(idx, text, proj), null, 1));
  }
} catch (err) {
  // a router must never block a prompt
  if (args[0] !== "--hook") console.error(`resolve: ${err?.message || err}`);
}
