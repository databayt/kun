import { readFile, writeFile } from "node:fs/promises";
import { DATA_TS_PATH } from "./config.js";
import type { NewAssetRow } from "./types.js";

function escape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortName(slug: string): string {
  return slug.split("-").map((w) => w ? w[0]!.toUpperCase() + w.slice(1) : "").join(" ");
}

export function rowToTs(row: NewAssetRow): string {
  const dims = row.width && row.height ? `, ${row.width}, ${row.height}` : "";
  const name = row.name || shortName(row.key.split("/").pop()!.replace(/\.[^.]+$/, ""));
  const desc = row.description || `${name} (${row.format.toUpperCase()})`;
  return `  a("${escape(row.key)}", "${escape(row.sourceUrl)}", "${escape(name)}", "${escape(desc)}", "${row.category}", "${row.format}", "${escape(row.source)}"${dims}),`;
}

export async function appendRowsAndBumpDate(rows: NewAssetRow[], today: string): Promise<void> {
  const txt = await readFile(DATA_TS_PATH, "utf-8");

  const closeRe = /(\n\];\s*\n\n\/\/ Computed stats)/;
  const closeMatch = txt.match(closeRe);
  if (!closeMatch) {
    throw new Error("Could not locate end of assets array in data.ts");
  }

  const grouped = new Map<string, NewAssetRow[]>();
  for (const r of rows) {
    const arr = grouped.get(r.category) ?? [];
    arr.push(r);
    grouped.set(r.category, arr);
  }

  const blocks: string[] = [];
  blocks.push(`\n  // ── Re-crawl ${today} ──────────────────────────────────────────────────`);
  for (const [cat, arr] of grouped) {
    blocks.push(`  // ${cat}`);
    for (const r of arr) blocks.push(rowToTs(r));
  }

  const insertion = blocks.join("\n");
  let updated = txt.replace(closeRe, () => `${insertion}\n];\n\n// Computed stats`);

  updated = updated.replace(
    /export const LAST_CRAWLED = "[^"]+";/,
    `export const LAST_CRAWLED = "${today}";`,
  );

  await writeFile(DATA_TS_PATH, updated, "utf-8");
}
