import { request } from "undici";
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import mime from "mime-types";
import { USER_AGENT, RATE_LIMIT, STAGING_DIR } from "./config.js";
import { detectFormat } from "./categorize.js";
import type { BlobMeta, AssetFormat } from "./types.js";

async function backoff(attempt: number): Promise<void> {
  const ms = Math.min(
    RATE_LIMIT.backoffMaxMs,
    RATE_LIMIT.backoffStartMs * Math.pow(2, attempt),
  );
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchBytes(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
  for (let attempt = 0; attempt < RATE_LIMIT.retries; attempt++) {
    try {
      const { statusCode, headers, body } = await request(url, {
        headers: {
          "user-agent": USER_AGENT,
          "accept": "*/*",
        },
      });
      if (statusCode === 429 || statusCode === 503) {
        await backoff(attempt);
        continue;
      }
      if (statusCode >= 400) {
        await body.dump();
        return null;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(chunk as Buffer);
      const buf = Buffer.concat(chunks);
      const contentType = String(headers["content-type"] || "");
      return { buf, contentType };
    } catch (err) {
      if (attempt === RATE_LIMIT.retries - 1) {
        console.error(`[download] ${url} failed:`, (err as Error).message);
        return null;
      }
      await backoff(attempt);
    }
  }
  return null;
}

async function dimensionsFromBuffer(buf: Buffer, format: AssetFormat): Promise<{ width?: number; height?: number }> {
  if (format === "svg") {
    const txt = buf.toString("utf-8", 0, Math.min(buf.length, 4096));
    const viewBox = txt.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/);
    if (viewBox) {
      return { width: Math.round(parseFloat(viewBox[1]!)), height: Math.round(parseFloat(viewBox[2]!)) };
    }
    const w = txt.match(/<svg[^>]*\swidth\s*=\s*["'](\d+)/)?.[1];
    const h = txt.match(/<svg[^>]*\sheight\s*=\s*["'](\d+)/)?.[1];
    if (w && h) return { width: parseInt(w, 10), height: parseInt(h, 10) };
    return {};
  }

  if (format === "png" || format === "jpg" || format === "webp" || format === "gif") {
    try {
      const meta = await sharp(buf).metadata();
      return { width: meta.width, height: meta.height };
    } catch { return {}; }
  }

  if (format === "json") {
    try {
      const obj = JSON.parse(buf.toString("utf-8"));
      if (typeof obj.w === "number" && typeof obj.h === "number") {
        return { width: obj.w, height: obj.h };
      }
    } catch { /* ignore */ }
    return {};
  }

  return {};
}

export async function downloadAsset(sourceUrl: string): Promise<BlobMeta | null> {
  const fetched = await fetchBytes(sourceUrl);
  if (!fetched) return null;
  const { buf, contentType } = fetched;
  if (buf.length === 0) return null;

  const format = detectFormat(sourceUrl, contentType);
  if (!format) {
    console.warn(`[download] no format detected for ${sourceUrl} (ct=${contentType})`);
    return null;
  }

  const sha256 = createHash("sha256").update(buf).digest("hex");
  const dims = await dimensionsFromBuffer(buf, format);

  await mkdir(STAGING_DIR, { recursive: true });
  const stagingPath = join(STAGING_DIR, `${sha256}.${format}`);
  await writeFile(stagingPath, buf);

  const ct = contentType || mime.lookup(format) || "application/octet-stream";

  return {
    sha256,
    bytes: buf.length,
    contentType: ct,
    format,
    width: dims.width,
    height: dims.height,
    stagingPath,
  };
}
