#!/usr/bin/env node
// Vendors the two pieces of context a writer needs before drafting into
// content/social/, where a production build can read them:
//
//   concepts.json — per feature, the hogwarts SPOTLIGHT.md written for the
//                   content team ("what this does for a school, in plain
//                   words"). The Draft stage shows it as the concept card and
//                   the Gemini lane gets its facts and its "do not say" list.
//   voice.json    — per brand, the `## Voice` section of
//                   content/docs/social/<brand>.mdx, fed to the prompt.
//   product-media.json — per feature, the real product screens already on the
//                   CDN: each spotlight's `flows:` names shoot/record flows,
//                   and the product's media manifest holds what they
//                   published. The social block recommends these by feature
//                   with no upload step. `$gaps` lists the features with no
//                   spotlight or no screens, with the shoot command to fix it.
//
// Vendored rather than read live for the features.json reason: a production
// build of kun has no sibling repos, and the Worker has no filesystem.
//
//   node scripts/social-concepts.mjs [--hogwarts /path/to/hogwarts]

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const argIdx = process.argv.indexOf("--hogwarts");
const hogwarts =
  argIdx > -1 ? process.argv[argIdx + 1] : join(root, "..", "hogwarts");
const components = join(hogwarts, "src", "components");
const manifestFile = join(components, "docs", "media-manifest.json");

/**
 * Flat `key: value` frontmatter, read by line. SPOTLIGHT.md writes routes as
 * unquoted `[/ar/s/{school}/…]` flow lists, which are not valid YAML, so a
 * real YAML parser refuses every file; the three keys used here are flat.
 */
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const data = {};
  if (!m) return { data, content: text };
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    data[kv[1]] = v.startsWith("[")
      ? v.replace(/^\[|\]$/g, "").split(",").map((x) => x.trim()).filter(Boolean)
      : v.replace(/^["']|["']$/g, "");
  }
  return { data, content: text.slice(m[0].length) };
}

/** `## Heading` → body, for one markdown document. */
function sections(body) {
  const out = {};
  const parts = body.split(/^## +(.+?)[ \t]*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    out[parts[i].trim()] = (parts[i + 1] ?? "").trim();
  }
  return out;
}

/** Every SPOTLIGHT.md under a directory, nearest first — features live at
 *  school-dashboard/<f>, school-dashboard/listings/<f> and components/<f>. */
function spotlights(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) spotlights(p, out);
    else if (e.name === "SPOTLIGHT.md") out.push(p);
  }
  return out.sort();
}

// ── concepts ────────────────────────────────────────────────────────────────

if (!existsSync(components)) {
  console.error(`✗ no hogwarts checkout at ${hogwarts} (pass --hogwarts)`);
  process.exit(1);
}

const concepts = {};
for (const file of spotlights(components)) {
  const dir = basename(dirname(file));
  const { data, content } = frontmatter(readFileSync(file, "utf8"));
  const s = sections(content);
  concepts[data.feature ?? dir] = {
    title: data.title ?? dir,
    status: data.status ?? "",
    personas: data.personas ?? [],
    routes: data.routes ?? [],
    flows: data.flows ?? [],
    oneLine: s["In one line"] ?? "",
    without: s["The school's day without it"] ?? "",
    what: s["What happens in Balqalam"] ?? "",
    who: s["Who it is for"] ?? "",
    say: s["What you can say"] ?? "",
    dontSay: s["Do not say"] ?? "",
    angles: s["Post angles"] ?? "",
  };
}

// ── product media ───────────────────────────────────────────────────────────

const manifest = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, "utf8"))
  : {};
const entries = manifest.entries ?? manifest;
const narrowest = (o) =>
  o ? o[Object.keys(o).map(Number).sort((a, b) => a - b)[0]] : undefined;

const media = {};
for (const [feature, c] of Object.entries(concepts)) {
  const items = [];
  for (const flow of c.flows) {
    for (const [id, e] of Object.entries(entries)) {
      if (!id.startsWith(`${flow}/`)) continue;
      const lang = id.endsWith("-en") ? "en" : "ar";
      if (e.kind === "video") {
        const src =
          e.sources?.find((x) => /avc1/.test(x.type))?.src ?? e.sources?.[0]?.src;
        if (!src) continue;
        items.push({ id, kind: "video", lang, flow, url: src, poster: e.poster, alt: e.title ?? {} });
      } else {
        // webp, not avif: Graph and every phone the team posts from read it.
        const url = narrowest(e.webp) ?? narrowest(e.avif);
        if (!url) continue;
        items.push({ id, kind: "image", lang, flow, url, alt: e.alt ?? {}, order: e.order ?? 0 });
      }
    }
  }
  if (items.length) media[feature] = items;
}

// What a feature still owes the media team, and the command that pays it.
// Routes with an {id} need a real record and are left to a scripted flow.
const sells = JSON.parse(
  readFileSync(join(root, "content", "social", "features.json"), "utf8"),
);
const ALIASES = { fees: "my-fees", gradebook: "grades", payment: "billing" };
const gaps = [];
for (const raw of (sells.hogwarts ?? []).map((f) => (typeof f === "string" ? f : f.id))) {
  const id = concepts[raw] ? raw : ALIASES[raw] ?? raw;
  const c = concepts[id];
  if (!c) {
    gaps.push({ feature: raw, missing: "spotlight" });
    continue;
  }
  if (media[id]) continue;
  const routes = c.routes
    .map((r) => r.replace("/s/{school}", ""))
    .filter((r) => !/[{?]/.test(r))
    .slice(0, 3);
  gaps.push({
    feature: raw,
    missing: "screens",
    routes,
    command: `node ~/.claude/skills/shoot/scripts/shoot.mjs ${routes.join(" ")}`,
  });
}

// ── voice ───────────────────────────────────────────────────────────────────

const voice = {};
const docs = join(root, "content", "docs", "social");
for (const file of readdirSync(docs).filter((f) => f.endsWith(".mdx"))) {
  const brand = file.replace(/\.mdx$/, "");
  const s = sections(matter(readFileSync(join(docs, file), "utf8")).content);
  if (!s.Voice) continue;
  // Strip MDX links to plain text — the prompt has no use for hrefs.
  voice[brand] = s.Voice.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}
// The product registry spells it moalimee; the doc page moallimee.
if (voice.moallimee && !voice.moalimee) voice.moalimee = voice.moallimee;

const header = {
  $comment:
    "GENERATED by scripts/social-concepts.mjs — edit the source (hogwarts SPOTLIGHT.md / content/docs/social/<brand>.mdx) and re-run.",
};
writeFileSync(
  join(root, "content", "social", "concepts.json"),
  JSON.stringify({ ...header, school: concepts }, null, 1) + "\n",
);
writeFileSync(
  join(root, "content", "social", "product-media.json"),
  JSON.stringify({ ...header, $gaps: gaps, school: media }, null, 1) + "\n",
);
writeFileSync(
  join(root, "content", "social", "voice.json"),
  JSON.stringify({ ...header, ...voice }, null, 1) + "\n",
);
const shots = Object.values(media).reduce((n, m) => n + m.length, 0);
console.log(
  `concepts: ${Object.keys(concepts).length} features · media: ${Object.keys(media).length} features, ${shots} items · voice: ${Object.keys(voice).length} brands`,
);
for (const g of gaps)
  console.log(`  gap · ${g.feature}: no ${g.missing}${g.command ? ` → ${g.command}` : ""}`);
