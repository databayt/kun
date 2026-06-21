#!/usr/bin/env node
/**
 * generate-blocks.mjs — build .claude/blocks.json for a product repo.
 *
 * Blocks are the feature directories under src/components/ (depth 1) plus the
 * children of any "dashboard-like" dir (a depth-1 dir where 3+ children carry
 * their own README.md — e.g. hogwarts' school-dashboard/). Each block keyword
 * maps to its path, its context records (README.md / ISSUE.md / CLAUDE.md that
 * exist), and its docs pages (<block>.mdx under content/docs-en|docs-ar|docs).
 *
 * The registry powers the block protocol hooks (~/.claude/hooks/block-*.sh):
 * read records + related GitHub issue before work, update them after.
 *
 * Usage: node generate-blocks.mjs <repo-root>
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv[2];
if (!root || !existsSync(join(root, "src/components"))) {
  console.error("usage: generate-blocks.mjs <repo-root>  (must contain src/components)");
  process.exit(1);
}

const target = join(root, ".claude/blocks.json");

// Carry forward runtime QA state (blocks.json[block].qa) across regenerations.
// Routes + context + docs are derived from the tree and always recomputed; `qa`
// is written by .claude/workflows/qa.js and must survive a regen.
let priorBlocks = {};
try {
  if (existsSync(target)) priorBlocks = JSON.parse(readFileSync(target, "utf8")).blocks || {};
} catch {
  priorBlocks = {};
}

const CONTEXT_FILES = ["README.md", "ISSUE.md", "CLAUDE.md"];
const DOCS_DIRS = ["content/docs-en", "content/docs-ar", "content/docs"].filter((d) =>
  existsSync(join(root, d))
);

// ── Route precompute ──────────────────────────────────────────────────────────
// Scan src/app once. Each page.tsx → a logical route with the structural segments
// stripped: i18n `[lang]`, tenant prefix literal `s` + `[subdomain]`, and every
// `(route-group)`. Dynamic content segments ([id], [slug], [...catchall]) are kept.
// This mirrors the find+strip discovery described in .claude/commands/handover.md,
// so qa.js / handover block mode read blocks.json[block].routes instead of re-deriving.
const STRIP_SEGMENTS = new Set(["[lang]", "[subdomain]", "s"]);
const isGroup = (seg) => seg.startsWith("(") && seg.endsWith(")");
const PAGE_FILES = new Set(["page.tsx", "page.jsx", "page.ts", "page.js"]);

const walkPages = (dir, acc) => {
  const abs = join(root, dir);
  if (!existsSync(abs)) return acc;
  for (const n of readdirSync(abs)) {
    if (n.startsWith(".")) continue;
    const p = `${dir}/${n}`;
    if (statSync(join(root, p)).isDirectory()) walkPages(p, acc);
    else if (PAGE_FILES.has(n)) acc.push(dir);
  }
  return acc;
};

const APP_ROUTES = existsSync(join(root, "src/app"))
  ? [
      ...new Set(
        walkPages("src/app", []).map((d) => {
          const kept = d
            .split("/")
            .slice(2) // drop "src", "app"
            .filter((s) => s && !STRIP_SEGMENTS.has(s) && !isGroup(s));
          return "/" + kept.join("/");
        })
      ),
    ].sort()
  : [];

// A block owns a route when the route's first meaningful segment is the block name
// or a singular/plural variant (admission ↔ admissions, the school-marketing sibling).
const nameVariants = (name) => {
  const v = new Set([name, `${name}s`]);
  if (name.endsWith("s")) v.add(name.slice(0, -1));
  return v;
};
const routesOf = (name) => {
  const want = nameVariants(name);
  return APP_ROUTES.filter((r) => {
    const first = r.split("/").filter(Boolean)[0];
    return first && want.has(first);
  });
};

const dirsOf = (p) =>
  readdirSync(join(root, p))
    .filter((n) => !n.startsWith(".") && !n.startsWith("_"))
    .filter((n) => statSync(join(root, p, n)).isDirectory());

const contextOf = (p) => CONTEXT_FILES.filter((f) => existsSync(join(root, p, f)));
const docsOf = (name) =>
  DOCS_DIRS.map((d) => `${d}/${name}.mdx`).filter((f) => existsSync(join(root, f)));

// Collect candidate blocks: depth-1 dirs, plus children of dashboard-like dirs.
const candidates = [];
for (const name of dirsOf("src/components")) {
  const path = `src/components/${name}`;
  candidates.push({ name, path });
  const children = dirsOf(path);
  const dashboardLike = children.filter((c) => contextOf(`${path}/${c}`).includes("README.md"));
  if (dashboardLike.length >= 3) {
    for (const c of children) candidates.push({ name: c, path: `${path}/${c}` });
  }
}

// Resolve keyword collisions: most context records wins; tie → deeper path
// (the dashboard feature, which is what "optimize <block>" usually means).
const blocks = {};
for (const { name, path } of candidates) {
  const entry = { path, context: contextOf(path), docs: docsOf(name), routes: routesOf(name) };
  // Preserve runtime QA state written by qa.js — never derived from the tree.
  if (priorBlocks[name] && priorBlocks[name].qa) entry.qa = priorBlocks[name].qa;
  const prev = blocks[name];
  if (
    !prev ||
    entry.context.length > prev.context.length ||
    (entry.context.length === prev.context.length && path.split("/").length > prev.path.split("/").length)
  ) {
    blocks[name] = entry;
  }
}

const sorted = Object.fromEntries(Object.entries(blocks).sort(([a], [b]) => a.localeCompare(b)));
const out = {
  description:
    "Block keyword registry — generated by kun/.claude/scripts/generate-blocks.mjs. Powers the block protocol hooks: read context + related GitHub issue before work, update records + docs after.",
  docsDirs: DOCS_DIRS,
  blocks: sorted,
};

mkdirSync(join(root, ".claude"), { recursive: true });
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(
  `${relative(process.cwd(), target)}: ${Object.keys(sorted).length} blocks (` +
    `${Object.values(sorted).filter((b) => b.context.length).length} with records, ` +
    `${Object.values(sorted).filter((b) => b.docs.length).length} with docs, ` +
    `${Object.values(sorted).filter((b) => b.routes.length).length} with routes, ` +
    `${Object.values(sorted).filter((b) => b.qa).length} with qa state)`
);
