#!/usr/bin/env node
// ── Render CV variants to PDF ────────────────────────────────────────────────
//
//   pnpm jobs:cv                 every variant in jobs/variants.json with a source
//   pnpm jobs:cv cv:web@2        one variant
//
// The HTML sources load Inter from node_modules/@fontsource (a path relative to
// the HTML), so the page is rendered from a copy with that path made absolute.
// Same Chrome channel as scripts/render-carousel.mjs. Refuses to write a PDF
// that is not 1-2 A4 pages — the send gate would hold every card that used it.

import { readFileSync, statSync } from "node:fs";

import { htmlToPdfs } from "./lib/pdf.mjs";

const only = process.argv[2];
const registry = JSON.parse(readFileSync("jobs/variants.json", "utf-8"));
const targets = registry.variants.filter((v) => v.kind === "cv" && v.source && v.pdf && (!only || v.id === only));
if (targets.length === 0) {
  console.error(only ? `no cv variant "${only}"` : "no cv variants with a source");
  process.exit(1);
}

const results = await htmlToPdfs(targets.map((v) => ({ html: readFileSync(v.source, "utf-8"), out: v.pdf })));
let failed = 0;
for (const [i, r] of results.entries()) {
  const v = targets[i];
  if (!r.ok) {
    console.log(`✗ ${v.id}: ${r.error} — not written`);
    failed++;
    continue;
  }
  console.log(`✓ ${v.id} → ${v.pdf} (${r.pages} page${r.pages > 1 ? "s" : ""}, ${Math.round(statSync(v.pdf).size / 1024)} KB)`);
}
process.exit(failed ? 1 : 0);
