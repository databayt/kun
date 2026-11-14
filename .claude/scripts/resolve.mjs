#!/usr/bin/env node
// resolve.mjs — kun's deterministic router: names in a prompt → repos and blocks.
//
//   node ~/kun/.claude/scripts/resolve.mjs "fix the admission form"   JSON: repos, blocks, hints
//   node ~/kun/.claude/scripts/resolve.mjs --route "<task>"           one repo id (Hermes `auto`)
//   node ~/kun/.claude/scripts/resolve.mjs --hook                     UserPromptSubmit (stdin JSON)
//   node ~/kun/.claude/scripts/resolve.mjs --build                    (re)build the index
//   node ~/kun/.claude/scripts/resolve.mjs --page                     write content/docs/places.mdx
//   node ~/kun/.claude/scripts/resolve.mjs --test                     the routing test suite
//
// Abdout speaks plainly; a word should land in the right place without a model guessing.
// The index (~/.claude/kun-index.json, written atomically) joins three sources:
//   1. .claude/memory/repositories.json — ids, aliases, bareMatch (curated)
//   2. every databayt git repo under ~ and ~/oss (discovered; explicit forms only)
//   3. every <repo>/.claude/blocks.json — the feature blocks
// plus engine.json → resolver (always_bare, never_bare) and each skill's trigger words.
//
// Matching rules (built so false positives stay cheap):
//   - a repo matches bare only when the registry marks it bareMatch (hogwarts, mkan…);
//     anything else needs an explicit form: "in X", "X repo", "~/X", "databayt/X", "X's",
//     one of its aliases (a domain alias never matches inside a longer host name), or —
//     unless the repo is in never_bare — its name right before one of its own blocks
//     ("food kitchen", "space cafe")
//   - blocks of the CURRENT project: a repo on the full protocol (hogwarts) matches exactly
//     as the old block-context.sh did — same keys, same order, same protocol text, byte for
//     byte; a repo on the light protocol (blocks.json → protocol: "light") gets a one-line
//     pointer, and only for a block that already has records
//   - blocks of ANOTHER repo match when the prompt names that repo, or when the key's class
//     is `unique`; both give a one-line pointer, never the full protocol, and name any
//     skill whose triggers share the word ("also: seek")
// Every block key gets a class when the index is built (see classify): `unique` — bare from
// any session; `shared` — several repos own it, or the engine already uses the word (a repo,
// skill, agent or spell); `common` — a plain single word. Shared and common keys work bare
// inside their own repo and need the repo named anywhere else. engine.json → resolver.
// always_bare promotes a key to unique (the old global_blocks list is read as a fallback).
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
// a host name: nothing that could be a longer host or an email on the left, no label on the right
const domain = (alt) => new RegExp(`(?<![\\p{L}\\p{N}_.@-])(?:${alt})(?![\\p{L}\\p{N}_-])`, "iu");

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
// Words the engine already gives a meaning: a skill, an agent or a spell of that name.
function engineWords() {
  const words = new Map();
  const put = (w, kind) => {
    const k = String(w || "").toLowerCase().trim();
    if (k && !words.has(k)) words.set(k, kind);
  };
  for (const root of [path.join(KUN, ".claude/skills"), path.join(HOME, ".claude/skills")]) {
    try {
      for (const d of fs.readdirSync(root, { withFileTypes: true })) if (d.isDirectory()) put(d.name, "skill");
    } catch {}
  }
  for (const root of [path.join(KUN, ".claude/agents"), path.join(HOME, ".claude/agents")]) {
    try {
      for (const f of fs.readdirSync(root)) if (f.endsWith(".md") && !f.startsWith("_")) put(f.slice(0, -3), "agent");
    } catch {}
  }
  const vocab = readJSON(path.join(KUN, ".claude/vocabulary.json"), {});
  for (const s of vocab.schools || []) for (const sp of s.spells || []) put(sp.name, "spell");
  return words;
}
// One class per block key, across every repo that has a blocks.json.
export function classify(blocks, repos, always, words) {
  const owners = {};
  for (const [id, bs] of Object.entries(blocks)) for (const k of Object.keys(bs)) (owners[k] ||= []).push(id);
  const repoNames = new Set(Object.values(repos).flatMap((r) => [r.id, ...r.aliases]));
  const taken = (w) => (repoNames.has(w) ? "repo" : words.get(w) || null);
  const out = {};
  for (const key of Object.keys(owners).sort()) {
    const own = owners[key].sort();
    const parts = key.split("-");
    const hit = taken(key) || taken(key.replace(/-/g, " "));
    let cls, why;
    if (always.has(key)) [cls, why] = ["unique", "always_bare"];
    else if (own.length > 1) [cls, why] = ["shared", `a block in ${own.length} repos`];
    else if (hit) [cls, why] = ["shared", `also a ${hit}`];
    else if (parts.length === 1) [cls, why] = ["common", "a plain word"];
    else if (parts.every((p) => taken(p))) [cls, why] = ["shared", "made of words the engine already uses"];
    else [cls, why] = ["unique", "distinctive"];
    out[key] = { class: cls, owners: own, why };
  }
  return out;
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
        never: neverBare.has(r.id),
        private: r.visibility === "private",
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
      repos[e.name] = { id: e.name, path: fs.realpathSync(dir), aliases: [], bare: false, never: neverBare.has(e.name), private: null, source: "discovered" };
    }
  }
  const blocks = {};
  const light = [];
  for (const r of Object.values(repos)) {
    if (!r.path) continue;
    const bj = readJSON(path.join(r.path, ".claude/blocks.json"));
    if (!bj?.blocks) continue;
    blocks[r.id] = bj.blocks;
    if (bj.protocol === "light") light.push(r.id);
  }
  const keywords = classify(blocks, repos, new Set(rcfg.always_bare || rcfg.global_blocks || []), engineWords());
  const idx = {
    schema: 2,
    built: new Date().toISOString(),
    repos,
    blocks,
    light,
    keywords,
    global_blocks: Object.keys(keywords).filter((k) => keywords[k].class === "unique"),
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
  const lightRepos = new Set(idx.light || []);
  const repos = [];
  for (const r of Object.values(idx.repos)) {
    if (!r.path) continue;
    const names = [r.id, ...r.aliases];
    const domains = r.aliases.filter((a) => a.includes("."));
    const plain = r.aliases.filter((a) => !a.includes("."));
    const explicit = names.flatMap((n) => [`in ${esc(n)}`, `${esc(n)} repo`, `~/${esc(n)}`, `databayt/${esc(n)}`, `${esc(n)}'s`]);
    const bare = r.bare ? [r.id, ...plain].map(esc) : plain.map(esc); // aliases are curated — always bare
    const alts = [...explicit, ...bare].filter(Boolean).join("|");
    let hit = !!alts && word(alts).test(prompt);
    // a domain alias must not match inside a longer host name (databayt.org ≠ kun.databayt.org)
    if (!hit && domains.length) hit = domain(domains.map(esc).join("|")).test(prompt);
    // the repo's name right before one of its own blocks: "food kitchen", "space cafe"
    if (!hit && !r.bare && !r.never && idx.blocks[r.id]) {
      const keys = Object.keys(idx.blocks[r.id]).flatMap((k) => (k.includes("-") ? [esc(k), esc(k.replace(/-/g, " "))] : [esc(k)]));
      hit = word(`${esc(r.id)}\\s+(?:${keys.join("|")})`, true).test(prompt);
    }
    if (hit) repos.push(r.id);
  }
  // blocks of the current project — the unchanged block protocol; a light repo keeps only
  // the blocks that already have records (render() gives those one line each)
  let local = here && idx.blocks[here.id] ? matchBlocks(idx.blocks[here.id], prompt).map((key) => ({ repo: here.id, key, ...idx.blocks[here.id][key] })) : [];
  if (here && lightRepos.has(here.id)) local = local.filter((b) => (b.context || []).length).map((b) => ({ ...b, light: true }));
  // blocks of a repo the prompt names (not the current one): pointers
  const named = [];
  for (const id of repos) {
    if (here && id === here.id) continue;
    if (idx.blocks[id]) for (const key of matchBlocks(idx.blocks[id], prompt)) named.push({ repo: id, key, ...idx.blocks[id][key] });
  }
  // unique blocks from anywhere else: one-line hints naming skills that share the word.
  // Longest key first, three keys at most — the same cap the local protocol has.
  const global = [];
  const bareKeys = [...(idx.global_blocks || [])].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  let hits = 0;
  for (const key of bareKeys) {
    if (hits >= 3) break;
    const spaced = key.replace(/-/g, " ");
    if (!word(`${esc(key)}|${esc(spaced)}`, true).test(prompt)) continue;
    let landed = false;
    for (const [id, blocks] of Object.entries(idx.blocks)) {
      if ((here && id === here.id) || repos.includes(id) || !blocks[key]) continue;
      global.push({ repo: id, key, ...blocks[key], also: (idx.triggers[key] || []).slice(0, 3) });
      landed = true;
    }
    if (landed) hits++;
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
  const out = res.local.filter((b) => !b.light).map((b) => protocol(b));
  const lines = [];
  const lightRepos = new Set(idx.light || []);
  const sib = (b) => ((b.siblings || []).length ? ` (also ${b.siblings.join(", ")})` : "");
  const records = (b) => ((b.context || []).length ? ` — read its records first (${b.context.join(", ")}); update them after the work` : "");
  // a light repo's own block: one line, and only when it has records (resolve() filtered)
  for (const b of res.local.filter((b) => b.light)) lines.push(`block ${b.key} → ${b.path}${sib(b)}${records(b)}`);
  for (const r of res.repos) lines.push(`repo ${r.id} → ${tilde(r.path)} (another repo: its own CLAUDE.md applies there; use absolute paths)`);
  for (const b of res.named) {
    const at = tilde(path.join(idx.repos[b.repo].path, b.path));
    if (lightRepos.has(b.repo)) lines.push(`block ${b.repo}/${b.key} → ${at}${sib(b)}${records(b)}`);
    else lines.push(`block ${b.repo}/${b.key} → ${at} — block protocol applies: read its records first; after the work update them + its docs + the issue`);
  }
  for (const b of res.global) {
    const also = b.also.length ? ` (also a ${b.also.join("/")} skill trigger — pick by context)` : "";
    const tail = lightRepos.has(b.repo) ? "" : "; if so, its block protocol applies";
    lines.push(`'${b.key}' may mean the ${b.repo} block ${tilde(path.join(idx.repos[b.repo].path, b.path))}${also}${tail}`);
  }
  if (lines.length) out.push(`<kun-route>\n${lines.join("\n")}\n</kun-route>`);
  return out.join("\n");
}

// ── page (content/docs/places.mdx) ─────────────────────────────────────────
// The public list of repo and block keywords. Only registry repos that are not marked
// private are listed; the index on this machine routes the rest without publishing them.
// The page is written from the clones on this machine, so a run that would drop a repo the
// last run listed stops instead (a teammate without that clone) unless --force is passed.
const PAGE = path.join(KUN, "content/docs/places.mdx");
function sayRepo(r) {
  const forms = r.bare ? [r.id] : [`in ${r.id}`, `${r.id} repo`];
  return [...forms, ...r.aliases];
}
export function page(idx, force = false) {
  const listed = Object.values(idx.repos)
    .filter((r) => r.source === "registry" && r.path && !r.private)
    .sort((a, b) => (idx.blocks[b.id] ? Object.keys(idx.blocks[b.id]).length : 0) - (idx.blocks[a.id] ? Object.keys(idx.blocks[a.id]).length : 0) || a.id.localeCompare(b.id));
  const hidden = Object.values(idx.repos).filter((r) => r.path && !listed.includes(r)).length;
  const stamp = listed.map((r) => `${r.id}:${idx.blocks[r.id] ? Object.keys(idx.blocks[r.id]).length : 0}`).join(" ");
  let prior = "";
  try {
    prior = /repos: ([^*]*?) \*\//.exec(fs.readFileSync(PAGE, "utf8"))?.[1] || "";
  } catch {}
  const lost = prior.split(" ").filter(Boolean).map((x) => x.split(":")).filter(([id, n]) => Number(n) > 0 && !listed.some((r) => r.id === id && idx.blocks[r.id])).map(([id]) => id);
  if (lost.length && !force) {
    console.error(`resolve --page: this machine cannot read the blocks of ${lost.join(", ")} (listed on the current page). Clone them, or pass --force to drop them.`);
    return false;
  }
  const light = new Set(idx.light || []);
  const code = (x) => "`" + x + "`";
  const L = [];
  L.push("---", "title: Places", "description: Every repository and every feature block is a keyword — what to say, and where it lands", "---", "");
  L.push(`{/* Generated by node .claude/scripts/resolve.mjs --page — edit the script or the sources, not this file. repos: ${stamp} */}`, "");
  L.push("Say a name and the work lands in the right place. Nothing here is typed as a command: the router reads each prompt, finds the repository and block names in it, and hands Claude a one-line pointer to the folder (and, where a block keeps records, to the records to read first).", "");
  L.push("## How to say it", "");
  L.push("| You are in | You say | What happens |", "| --- | --- | --- |");
  L.push("| the block's own repo | the block's name — `admission` | hogwarts: the full block protocol. Other repos: one line pointing at the block's records, if it has any |");
  L.push("| any other repo | the repo and the block — `mkan booking`, `food kitchen`, `in kun, the seek console` | a pointer to that repo and to the block's folder |");
  L.push("| any other repo | a **unique** block's name alone — `timetable`, `parent portal` | a hint that the word may mean that block |");
  L.push("", "## Classes", "");
  L.push("Every block key gets one class when the index is built. Nobody keeps this list by hand.", "");
  L.push("- **unique** — one repo owns the word and nothing else in the engine uses it. It works alone from any session.");
  L.push("- **shared** — several repos have a block of that name, or the word is already a repo, a skill, an agent or a spell. It works alone inside its own repo; anywhere else, say the repo with it.");
  L.push("- **common** — a plain single word (`form`, `file`, `settings`). Same rule as shared.");
  L.push("", "To make a plain word work alone from anywhere, add it to `resolver.always_bare` in `.claude/engine.json` and rebuild the index (`node .claude/scripts/resolve.mjs --build`). To give a repo its block list, run `node .claude/scripts/generate-blocks.mjs <repo>`.", "");
  L.push("## Repositories", "");
  L.push("| Repository | Say | Blocks | Protocol |", "| --- | --- | --- | --- |");
  for (const r of listed) {
    const n = idx.blocks[r.id] ? Object.keys(idx.blocks[r.id]).length : 0;
    L.push(`| ${r.id} | ${sayRepo(r).map(code).join(" · ")} | ${n || "—"} | ${n ? (light.has(r.id) ? "light" : "full") : "—"} |`);
  }
  if (hidden) L.push("", `${hidden} more repositories on the build machine are routed the same way and not listed here (private, or not in the registry).`);
  L.push("", "A name in the Say column works from any session. A repository whose row starts with `in …` has a plain English word for a name, so it needs one of those forms, its domain, or its name right before one of its own blocks (`food kitchen`).", "");
  L.push("## Blocks", "");
  for (const r of listed) {
    const blocks = idx.blocks[r.id];
    if (!blocks) continue;
    const keys = Object.keys(blocks).sort();
    const uniq = keys.filter((k) => idx.keywords[k]?.class === "unique");
    L.push(`### ${r.id}`, "");
    L.push(`${keys.length} blocks, ${light.has(r.id) ? "light" : "full"} protocol${uniq.length ? `. Unique: ${uniq.map(code).join(", ")}` : ""}.`, "");
    L.push("| Keyword | Class | Folder | From another repo, say |", "| --- | --- | --- | --- |");
    const prefix = r.bare ? r.id : r.never ? `in ${r.id},` : r.id;
    for (const k of keys) {
      const kw = idx.keywords[k] || { class: "common", why: "" };
      const spaced = k.replace(/-/g, " ");
      const say = kw.class === "unique" ? code(spaced) : code(`${prefix} ${spaced}`);
      const note = kw.class === "unique" ? "unique" : `${kw.class} — ${kw.why}`;
      L.push(`| ${code(k)} | ${note} | ${code(blocks[k].path)}${(blocks[k].siblings || []).length ? " + " + blocks[k].siblings.map(code).join(", ") : ""} | ${say} |`);
    }
    L.push("");
  }
  writeAtomic(PAGE, L.join("\n"));
  return true;
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
  ["fix the docs table", "~/kun", { none: true }], // kun has a `docs` block now, but it is on the light protocol and has no records
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
  // every repo and block is a keyword (2026-11-14): classes, light repos, domains, repo-before-block
  ["rich text editor toolbar is broken", "~/kun", { global: ["rich-text-editor"] }], // hyphenated, one owner → unique
  ["the booking flow double charges", "~/kun", { none: true }], // booking is a block in mkan and space → shared
  ["mkan booking double charges", "~/kun", { repos: ["mkan"], named: ["booking"], global: [] }],
  ["the cashier cannot print", "~/kun", { none: true }], // a plain single word → common
  ["the cashier cannot print", "~/food", { local: ["cashier"], repos: [] }], // food is light; cashier has records
  ["the menu modifiers are wrong", "~/food", { local: [] }], // light repo, no records → silent
  ["the food kitchen screen flickers", "~/kun", { repos: ["food"], named: ["kitchen"] }], // repo name right before its block
  ["space cafe prices", "~/kun", { repos: ["space"], named: ["cafe", "space"] }], // space also has a block called space
  ["a marketing video for the school", "~/kun", { none: true }], // marketing is never_bare — no repo-before-block
  ["a saas dashboard for a client", "~/kun", { none: true }], // both parts are engine words → shared
  ["the seek console is empty", "~/hogwarts", { none: true }], // kun's seek block is also a skill → shared
  ["in kun, the seek console is empty", "~/hogwarts", { repos: ["kun"], named: ["seek"] }],
  ["social drafts are stuck", "~/kun", { none: true }], // kun is light and its blocks have no records
  ["open spacehub.sd", "~/kun", { repos: ["space"] }],
  ["kun.databayt.org is down", "~/hogwarts", { repos: ["kun"] }],
  ["the databayt.org pricing page", "~/kun", { repos: ["marketing"] }],
  ["kun.databayt.org/seek shows nothing", "~/kun", { repos: [] }], // a domain alias never matches inside a longer host
  ["mail from support@databayt.org", "~/kun", { repos: [] }],
  ["report issue dialog", "~/hogwarts", { local: ["report-issue"], global: [] }],
  ["report issue dialog", "~/catalog", { none: true }], // six repos own it → shared
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
    const cls = (c) => Object.values(idx.keywords).filter((k) => k.class === c).length;
    console.log(`resolve: index built — ${Object.keys(idx.repos).length} repos, ${Object.keys(idx.blocks).length} with blocks, ${Object.keys(idx.keywords).length} block keywords (${cls("unique")} unique, ${cls("shared")} shared, ${cls("common")} common) → ${INDEX}`);
  } else if (args[0] === "--page") {
    const idx = build();
    if (page(idx, args.includes("--force"))) console.log(`resolve: wrote ${PAGE}`);
    else process.exitCode = 1;
  } else if (args[0] === "--hook") {
    if (!process.env.KUN_HEADLESS) {
      const idx = readJSON(INDEX);
      if (idx) {
        const input = readJSON("/dev/stdin", {}) || {};
        // Background-task and system notifications arrive as user turns, so this hook fires
        // on them too — and their paths ("output-file", repo names in commands) routed like
        // a request (2026-11-02: a hogwarts `file` block pointer from a task notification).
        // Only words a person typed route.
        const said = /<task-notification>|\[SYSTEM NOTIFICATION|^\s*<system-reminder>/.test(input.prompt || "") ? "" : input.prompt || "";
        const res = resolve(idx, said, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
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
