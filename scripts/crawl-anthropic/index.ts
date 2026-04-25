import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import pLimit from "p-limit";
import { Agent, setGlobalDispatcher, interceptors } from "undici";

setGlobalDispatcher(new Agent().compose(interceptors.redirect({
  maxRedirections: 5,
})));

import {
  CONCURRENCY, MANIFEST_PATH, REPORT_PATH, STAGING_DIR,
  ALLOWED_CDN_HOSTS,
} from "./config.js";
import { URL_INDEX_EXTENDED } from "./sources.js";
import { fetchPage, fetchStatic, closeBrowser } from "./fetcher.js";
import { extractAssets, extractLinks } from "./extract.js";
import { downloadAsset } from "./download.js";
import { uploadAsset, hasCredentials } from "./upload.js";
import { categorize } from "./categorize.js";
import { deriveSlug, ensureUnique } from "./slugify.js";
import { loadSeenSourceUrls, loadExistingKeys } from "./diff.js";
import { appendRowsAndBumpDate } from "./emit.js";
import type { Manifest, NewAssetRow, RunReport, AssetCandidate, PageSource } from "./types.js";

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has("--dry-run");
const UPLOAD_ONLY = argv.has("--upload-only");
const SKIP_BUILD = argv.has("--skip-build");

async function loadManifest(): Promise<Manifest> {
  if (!existsSync(MANIFEST_PATH)) return {};
  try { return JSON.parse(await readFile(MANIFEST_PATH, "utf-8")); }
  catch { return {}; }
}

async function saveManifest(m: Manifest): Promise<void> {
  await writeFile(MANIFEST_PATH, JSON.stringify(m, null, 2), "utf-8");
}

function pageGroupTag(src: PageSource): string {
  return src.group;
}

function sourceTag(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.host.replace(/^www\./, "")}${path}`;
  } catch { return pageUrl; }
}

function describe(candidate: AssetCandidate, format: string): { name: string; description: string } {
  const alt = candidate.alt?.trim();
  const name = alt && alt.length > 1 ? alt : "Asset";
  const description = alt
    ? `${alt} (${format.toUpperCase()})`
    : `Asset from ${sourceTag(candidate.pageUrl)}`;
  return { name, description };
}

async function expandFollowedPages(src: PageSource): Promise<PageSource[]> {
  if (!src.followLinks) return [src];
  const r = await fetchStatic(src.url);
  if (!r || !r.html) return [src];
  const links = extractLinks(r.html, src.url, src.followLinks.selector).slice(0, 50);
  const out: PageSource[] = [src];
  for (const link of links) {
    out.push({ url: link, group: src.group, dynamic: src.dynamic });
  }
  return out;
}

async function main(): Promise<void> {
  console.log(`[crawl-anthropic] start (dry=${DRY_RUN}, uploadOnly=${UPLOAD_ONLY})`);
  await mkdir(STAGING_DIR, { recursive: true });

  const seenSourceUrls = await loadSeenSourceUrls();
  const existingKeys = await loadExistingKeys();
  const manifest = await loadManifest();
  const usedKeys = new Set(existingKeys);

  console.log(`[crawl-anthropic] ${seenSourceUrls.size} existing assets, ${Object.keys(manifest).length} manifest entries`);

  const credsAvailable = hasCredentials();
  if (!credsAvailable && !DRY_RUN) {
    console.warn(`[crawl-anthropic] no AWS credentials in env (AWS_ACCESS_KEY_ID/AWS_PROFILE). Will download but skip upload. Set credentials and re-run with --upload-only to push.`);
  }

  const report: RunReport = {
    startedAt: new Date().toISOString(),
    finishedAt: "",
    pagesCrawled: 0,
    pagesFailed: [],
    assetsDiscovered: 0,
    assetsSkippedExisting: 0,
    assetsDownloaded: 0,
    assetsUploaded: 0,
    assetsNeedReview: [],
    newRows: [],
    deadLinks: [],
  };

  const allPages: PageSource[] = [];
  for (const src of URL_INDEX_EXTENDED) {
    if (src.authWalled) continue;
    const expanded = await expandFollowedPages(src);
    allPages.push(...expanded);
  }
  console.log(`[crawl-anthropic] ${allPages.length} pages to crawl (incl. followed)`);

  const pageLimit = pLimit(CONCURRENCY.pages);
  const downloadLimit = pLimit(CONCURRENCY.downloads);
  const uploadLimit = pLimit(CONCURRENCY.uploads);

  const candidatesByUrl = new Map<string, AssetCandidate>();

  await Promise.all(allPages.map((src) => pageLimit(async () => {
    const r = await fetchPage(src);
    if (!r) {
      report.pagesFailed.push(src.url);
      return;
    }
    report.pagesCrawled++;
    const candidates = extractAssets(r.html, src.url, r.networkAssets);
    for (const c of candidates) {
      if (!candidatesByUrl.has(c.sourceUrl)) candidatesByUrl.set(c.sourceUrl, c);
    }
    console.log(`[page] ${src.url} → ${candidates.length} candidates`);
  })));

  await closeBrowser();

  report.assetsDiscovered = candidatesByUrl.size;
  console.log(`[crawl-anthropic] ${report.assetsDiscovered} unique candidates discovered`);

  const newCandidates: AssetCandidate[] = [];
  for (const [url, cand] of candidatesByUrl) {
    if (seenSourceUrls.has(url)) {
      report.assetsSkippedExisting++;
      continue;
    }
    newCandidates.push(cand);
  }
  console.log(`[crawl-anthropic] ${newCandidates.length} new candidates after dedup`);

  await Promise.all(newCandidates.map((cand) => downloadLimit(async () => {
    const existingManifest = manifest[cand.sourceUrl];

    const blob = await downloadAsset(cand.sourceUrl);
    if (!blob) {
      report.deadLinks.push(cand.sourceUrl);
      return;
    }
    report.assetsDownloaded++;

    if (existingManifest && existingManifest.sha256 === blob.sha256) {
      return;
    }

    const { category, needsReview } = categorize(cand, blob);
    const baseSlug = deriveSlug({
      alt: cand.alt,
      caption: cand.caption,
      pageUrl: cand.pageUrl,
      sourceUrl: cand.sourceUrl,
      sha256: blob.sha256,
      category,
    });
    const slug = ensureUnique(baseSlug, category, usedKeys, blob.sha256);
    const key = `anthropic/${category}/${slug}.${blob.format}`;
    const { name, description } = describe(cand, blob.format);

    const row: NewAssetRow = {
      key,
      sourceUrl: cand.sourceUrl,
      name,
      description,
      category,
      format: blob.format,
      source: sourceTag(cand.pageUrl),
      width: blob.width,
      height: blob.height,
    };

    let uploadOk = false;
    if (!DRY_RUN && credsAvailable) {
      try {
        const result = await uploadLimit(() => uploadAsset(key, blob, cand.sourceUrl));
        if (result.uploaded) report.assetsUploaded++;
        manifest[cand.sourceUrl] = {
          sha256: blob.sha256,
          key,
          bytes: blob.bytes,
          uploadedAt: new Date().toISOString(),
          contentType: blob.contentType,
        };
        uploadOk = true;
      } catch (err) {
        console.error(`[upload] ${key} failed:`, (err as Error).message);
        return;
      }
    }

    if (DRY_RUN || uploadOk) {
      report.newRows.push(row);
      if (needsReview) report.assetsNeedReview.push(row);
    }
  })));

  if (!DRY_RUN) {
    await saveManifest(manifest);
  }

  const safeToWriteDataTs = !DRY_RUN && credsAvailable && report.newRows.length > 0;
  if (safeToWriteDataTs) {
    const today = new Date().toISOString().slice(0, 10);
    await appendRowsAndBumpDate(report.newRows, today);
    console.log(`[crawl-anthropic] appended ${report.newRows.length} rows to data.ts, LAST_CRAWLED=${today}`);
  } else if (!DRY_RUN && !credsAvailable) {
    console.warn(`[crawl-anthropic] skipped data.ts append — no AWS creds, so uploads were skipped. Configure AWS_* env then re-run with --upload-only.`);
  }

  report.finishedAt = new Date().toISOString();
  await writeReport(report);
  console.log(`[crawl-anthropic] report → ${REPORT_PATH}`);
  console.log(`[crawl-anthropic] summary: ${report.pagesCrawled}/${allPages.length} pages, +${report.newRows.length} new rows, ${report.assetsUploaded} uploaded, ${report.assetsNeedReview.length} need review, ${report.deadLinks.length} dead links, ${report.pagesFailed.length} page failures`);

  if (safeToWriteDataTs && !SKIP_BUILD) {
    console.log(`[crawl-anthropic] running pnpm build...`);
    try {
      execSync("pnpm build", { stdio: "inherit" });
    } catch {
      console.error(`[crawl-anthropic] pnpm build failed — review data.ts edits`);
      process.exit(1);
    }
  }
}

async function writeReport(r: RunReport): Promise<void> {
  const lines: string[] = [];
  lines.push(`# Anthropic Crawl Report`);
  lines.push("");
  lines.push(`Started: ${r.startedAt}`);
  lines.push(`Finished: ${r.finishedAt}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Pages crawled: ${r.pagesCrawled}`);
  lines.push(`- Page failures: ${r.pagesFailed.length}`);
  lines.push(`- Assets discovered: ${r.assetsDiscovered}`);
  lines.push(`- Already in data.ts (skipped): ${r.assetsSkippedExisting}`);
  lines.push(`- Downloaded: ${r.assetsDownloaded}`);
  lines.push(`- Uploaded to S3: ${r.assetsUploaded}`);
  lines.push(`- New rows in data.ts: ${r.newRows.length}`);
  lines.push(`- Need review (low-confidence category): ${r.assetsNeedReview.length}`);
  lines.push(`- Dead links: ${r.deadLinks.length}`);

  if (r.newRows.length > 0) {
    lines.push("");
    lines.push(`## New Rows`);
    lines.push("");
    const byCat = new Map<string, NewAssetRow[]>();
    for (const row of r.newRows) {
      const arr = byCat.get(row.category) ?? [];
      arr.push(row);
      byCat.set(row.category, arr);
    }
    for (const [cat, arr] of byCat) {
      lines.push(`### ${cat} (${arr.length})`);
      for (const row of arr) {
        const dims = row.width && row.height ? ` ${row.width}×${row.height}` : "";
        lines.push(`- \`${row.key}\`${dims} ← ${row.sourceUrl}`);
      }
      lines.push("");
    }
  }

  if (r.assetsNeedReview.length > 0) {
    lines.push("");
    lines.push(`## Needs Review`);
    lines.push("");
    for (const row of r.assetsNeedReview) {
      lines.push(`- \`${row.key}\` from ${row.source} — auto-categorized as **${row.category}**`);
    }
  }

  if (r.deadLinks.length > 0) {
    lines.push("");
    lines.push(`## Dead Links`);
    lines.push("");
    for (const link of r.deadLinks) lines.push(`- ${link}`);
  }

  if (r.pagesFailed.length > 0) {
    lines.push("");
    lines.push(`## Page Failures`);
    lines.push("");
    for (const url of r.pagesFailed) lines.push(`- ${url}`);
  }

  await writeFile(REPORT_PATH, lines.join("\n"), "utf-8");
}

main().catch((err) => {
  console.error(`[crawl-anthropic] fatal:`, err);
  process.exit(1);
});
