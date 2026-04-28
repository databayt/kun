// One-shot script: emit a data.ts row for every S3 object under `anthropic/`
// that isn't already in data.ts. Reads sourceUrl back from the S3 object's
// metadata (set by upload.ts). Use after a normal crawl if any orphans remain.
//
// Run: tsx --env-file=.env scripts/crawl-anthropic/backfill-orphans.ts

import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import { BUCKET, REGION, DATA_TS_PATH } from "./config.js";
import { appendRowsAndBumpDate } from "./emit.js";
import type { NewAssetRow, AssetCategory, AssetFormat } from "./types.js";

const s3 = new S3Client({ region: REGION });

const VALID_CATEGORIES: ReadonlySet<AssetCategory> = new Set([
  "illustrations", "engineering", "research", "values", "ui-icons", "maps",
  "brand", "partners", "benchmarks", "social", "events", "animations",
  "fonts", "documents", "team", "mars",
]);

const VALID_FORMATS: ReadonlySet<AssetFormat> = new Set([
  "svg", "png", "jpg", "webp", "gif", "json", "pdf", "woff2", "ttf",
  "ico", "mp4", "webm", "wav",
]);

async function listAllKeys(): Promise<string[]> {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const r = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: "anthropic/", ContinuationToken: token,
    }));
    for (const o of r.Contents ?? []) if (o.Key) out.push(o.Key);
    token = r.NextContinuationToken;
  } while (token);
  return out;
}

async function loadDataTsKeys(): Promise<Set<string>> {
  const txt = await readFile(DATA_TS_PATH, "utf-8");
  const keys = new Set<string>();
  const re = /a\(\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) keys.add(m[1]!);
  return keys;
}

function titleFromKey(key: string): string {
  const slug = key.split("/").pop()!.replace(/\.[^.]+$/, "");
  return slug
    .split(/[-_]+/)
    .filter((w) => w && !/^[a-f0-9]{4}$/.test(w))
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ") || "Asset";
}

async function head(key: string): Promise<{ sourceUrl: string; contentType: string; bytes: number } | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return {
      sourceUrl: r.Metadata?.sourceurl ?? r.Metadata?.sourceUrl ?? "",
      contentType: r.ContentType ?? "",
      bytes: r.ContentLength ?? 0,
    };
  } catch (e) {
    console.warn(`[head] ${key} failed:`, (e as Error).message);
    return null;
  }
}

function sourceTagFromUrl(pageOrSourceUrl: string): string {
  try {
    const u = new URL(pageOrSourceUrl);
    return `${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return pageOrSourceUrl;
  }
}

async function main(): Promise<void> {
  const s3Keys = await listAllKeys();
  const dataKeys = await loadDataTsKeys();
  const orphans = s3Keys.filter((k) => !dataKeys.has(k));
  console.log(`S3: ${s3Keys.length}  data.ts: ${dataKeys.size}  orphans: ${orphans.length}`);
  if (orphans.length === 0) return;

  const rows: NewAssetRow[] = [];
  for (const key of orphans) {
    const parts = key.split("/");
    if (parts.length < 3) continue;
    const category = parts[1] as AssetCategory;
    const ext = key.split(".").pop()!.toLowerCase() as AssetFormat;
    if (!VALID_CATEGORIES.has(category)) {
      console.warn(`[skip] ${key} has invalid category "${category}"`);
      continue;
    }
    if (!VALID_FORMATS.has(ext)) {
      console.warn(`[skip] ${key} has invalid format "${ext}"`);
      continue;
    }

    const meta = await head(key);
    const sourceUrl = meta?.sourceUrl || `https://hogwarts-databayt.s3.amazonaws.com/${key}`;
    const name = titleFromKey(key);
    const description = `${name} (${ext.toUpperCase()})`;
    const source = sourceUrl ? sourceTagFromUrl(sourceUrl) : "anthropic.com";

    rows.push({ key, sourceUrl, name, description, category, format: ext, source });
  }

  console.log(`Emitting ${rows.length} backfill rows...`);
  const today = new Date().toISOString().slice(0, 10);
  await appendRowsAndBumpDate(rows, today);
  console.log(`Done. Bumped LAST_CRAWLED to ${today}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
