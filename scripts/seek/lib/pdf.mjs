// ── HTML → A4 PDF through the local Chrome (playwright-core) ─────────────────
//
// Shared by render-cv.mjs (the fixed lane CVs) and tailor.ts (per-job CVs).
// Refuses anything that is not 1-2 pages — the send gate holds a card whose
// CV is longer, so a PDF it would reject is never written.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const FONTS = `file://${resolve("node_modules/@fontsource")}`;

/// items: [{ html, out }] → [{ out, pages, ok, error? }]. One browser for all.
export async function htmlToPdfs(items) {
  const scratch = mkdtempSync(join(tmpdir(), "cv-"));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    for (const [i, { html, out }] of items.entries()) {
      const tmp = join(scratch, `${i}.html`);
      writeFileSync(tmp, html.replaceAll("node_modules/@fontsource", FONTS));
      const page = await browser.newPage();
      await page.goto(`file://${tmp}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      await page.close();
      const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      if (pages < 1 || pages > 2) {
        results.push({ out, pages, ok: false, error: `${pages} pages` });
        continue;
      }
      writeFileSync(out, pdf);
      results.push({ out, pages, ok: true });
    }
  } finally {
    await browser.close();
    rmSync(scratch, { recursive: true, force: true });
  }
  return results;
}
