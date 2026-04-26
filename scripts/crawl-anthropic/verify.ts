// Read-only audit: list S3 anthropic/* objects, parse data.ts asset rows,
// report orphans (in S3 but not catalogued) and dangling (in data.ts but
// missing from S3). Use after a crawl or backfill to confirm zero gap.

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "hogwarts-databayt";

async function listAll(): Promise<string[]> {
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

async function main(): Promise<void> {
  const s3Keys = new Set(await listAll());
  const dataTs = await readFile("src/components/root/anthropic/data.ts", "utf-8");
  const dataKeys = new Set<string>();
  const re = /a\(\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dataTs))) dataKeys.add(m[1]!);

  const orphans = [...s3Keys].filter(k => !dataKeys.has(k));
  const dangling = [...dataKeys].filter(k => !s3Keys.has(k));

  console.log(`S3 anthropic/ objects:  ${s3Keys.size}`);
  console.log(`data.ts asset rows:     ${dataKeys.size}`);
  console.log(`Orphans (S3, !data.ts): ${orphans.length}`);
  console.log(`Dangling (data.ts, !S3): ${dangling.length}`);
  if (orphans.length > 0) {
    const byCat = new Map<string, number>();
    for (const k of orphans) {
      const c = k.split("/")[1] ?? "unknown";
      byCat.set(c, (byCat.get(c) ?? 0) + 1);
    }
    console.log("\nOrphans by category:");
    for (const [c, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${c.padEnd(15)} ${n}`);
    }
  }
  if (dangling.length > 0) {
    console.log("\nDangling rows (in data.ts but missing from S3):");
    dangling.slice(0, 20).forEach(k => console.log(`  ${k}`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
