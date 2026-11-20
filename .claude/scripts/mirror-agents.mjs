#!/usr/bin/env node
// Mirror .claude/skills/<name>/ → .agents/skills/<name>/ (the Antigravity/Codex workspace copy).
// Nothing else generated .agents/skills before this; it had been hand-copied and drifted.
//
//   node .claude/scripts/mirror-agents.mjs          copy what differs (idempotent)
//   node .claude/scripts/mirror-agents.mjs --check  report drift, write nothing, exit 1 on drift
//
// Never deletes: a mirror directory with no source is reported as `extra` and left alone.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(ROOT, ".claude/skills");
const DST = join(ROOT, ".agents/skills");
const SKIP = new Set(["node_modules", ".DS_Store", ".git"]);

/** Relative file paths under `dir`, sorted. */
function files(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (SKIP.has(name)) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/** Drift of one skill: files missing or different in the mirror. */
export function drift(name) {
  const bad = [];
  for (const f of files(join(SRC, name))) {
    const to = join(DST, name, f);
    if (!existsSync(to) || sha(to) !== sha(join(SRC, name, f))) bad.push(f);
  }
  return bad;
}

function main() {
  const check = process.argv.includes("--check");
  if (!existsSync(SRC)) {
    console.error(`mirror-agents: ${SRC} not found`);
    process.exit(2);
  }
  const names = readdirSync(SRC).filter((n) => !SKIP.has(n) && statSync(join(SRC, n)).isDirectory());
  let changed = 0;
  for (const name of names) {
    const bad = drift(name);
    if (!bad.length) continue;
    changed++;
    if (check) {
      console.log(`drift  ${name} (${bad.length} file${bad.length > 1 ? "s" : ""})`);
      continue;
    }
    for (const f of bad) {
      const to = join(DST, name, f);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, readFileSync(join(SRC, name, f)));
    }
    console.log(`mirrored ${name} (${bad.length})`);
  }
  const extra = existsSync(DST)
    ? readdirSync(DST).filter((n) => !SKIP.has(n) && statSync(join(DST, n)).isDirectory() && !names.includes(n))
    : [];
  for (const n of extra) console.log(`extra  ${n} (no source in .claude/skills; left alone)`);
  console.log(`mirror-agents: ${names.length} skills, ${changed} ${check ? "drifted" : "updated"}, ${extra.length} extra`);
  if (check && (changed || extra.length)) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
