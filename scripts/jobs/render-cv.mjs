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

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const only = process.argv[2];
const registry = JSON.parse(readFileSync("jobs/variants.json", "utf-8"));
const targets = registry.variants.filter((v) => v.kind === "cv" && v.source && v.pdf && (!only || v.id === only));
if (targets.length === 0) {
  console.error(only ? `no cv variant "${only}"` : "no cv variants with a source");
  process.exit(1);
}

const fonts = `file://${resolve("node_modules/@fontsource")}`;
const scratch = mkdtempSync(join(tmpdir(), "cv-"));
const browser = await chromium.launch({ channel: "chrome", headless: true });

let failed = 0;
try {
  for (const v of targets) {
    const html = readFileSync(v.source, "utf-8").replaceAll("node_modules/@fontsource", fonts);
    const tmp = join(scratch, `${v.id.replace(/[^a-z0-9@]/gi, "_")}.html`);
    writeFileSync(tmp, html);
    const page = await browser.newPage();
    await page.goto(`file://${tmp}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    await page.close();
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    if (pages < 1 || pages > 2) {
      console.log(`✗ ${v.id}: ${pages} pages — not written`);
      failed++;
      continue;
    }
    writeFileSync(v.pdf, pdf);
    console.log(`✓ ${v.id} → ${v.pdf} (${pages} page${pages > 1 ? "s" : ""}, ${Math.round(statSync(v.pdf).size / 1024)} KB)`);
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
