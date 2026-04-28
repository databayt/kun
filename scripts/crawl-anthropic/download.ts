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

// Sniff the real format from magic bytes. Servers sometimes do server-side
// conversion (e.g. Sanity returns WebP when given a PNG URL with `?fm=webp`).
// Trust the bytes, not the extension.
function sniffFormat(buf: Buffer): AssetFormat | null {
  if (buf.length < 12) return null;
  const h = buf;
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return "png";
  if (h[0] === 0xff && h[1] === 0xd8) return "jpg";
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
      h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50) return "webp";
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) return "gif";
  if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) return "pdf";
  if (h[0] === 0x00 && h[1] === 0x00 && h[2] === 0x01 && h[3] === 0x00) return "ico";
  if (h[0] === 0x77 && h[1] === 0x4f && h[2] === 0x46 && h[3] === 0x32) return "woff2";
  if (h[0] === 0x00 && h[1] === 0x01 && h[2] === 0x00 && h[3] === 0x00) return "ttf";
  if (h[0] === 0x4f && h[1] === 0x54 && h[2] === 0x54 && h[3] === 0x4f) return "ttf";
  if (h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70) return "mp4";
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return "webm";
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
      h[8] === 0x57 && h[9] === 0x41 && h[10] === 0x56 && h[11] === 0x45) return "wav";
  const head = buf.slice(0, 512).toString("utf-8").trim().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "svg";
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  return null;
}

export async function downloadAsset(sourceUrl: string): Promise<BlobMeta | null> {
  const fetched = await fetchBytes(sourceUrl);
  if (!fetched) return null;
  const { buf, contentType } = fetched;
  if (buf.length === 0) return null;

  // Reject HTML 404 splashes outright (e.g. Mintlify serves /favicon.ico as a 200 OK splash).
  const ctLower = contentType.toLowerCase();
  if (ctLower.includes("text/html") || ctLower.includes("application/xhtml")) {
    console.warn(`[download] ${sourceUrl} returned ${contentType} — HTML splash rejected`);
    return null;
  }

  // Sniff actual format from bytes — handles server-side conversions like
  // Sanity's `?fm=webp` query that converts PNG to WebP at delivery time.
  const sniffed = sniffFormat(buf);
  const fromUrl = detectFormat(sourceUrl, contentType);
  const format = sniffed ?? fromUrl;
  if (!format) {
    console.warn(`[download] no format detected for ${sourceUrl} (ct=${contentType})`);
    return null;
  }

  const sha256 = createHash("sha256").update(buf).digest("hex");
  const dims = await dimensionsFromBuffer(buf, format);

  await mkdir(STAGING_DIR, { recursive: true });
  const stagingPath = join(STAGING_DIR, `${sha256}.${format}`);
  await writeFile(stagingPath, buf);

  // Trust the format-derived MIME over the server header; CDNs sometimes mislabel.
  const formatMime: Record<string, string> = {
    svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp",
    gif: "image/gif", ico: "image/x-icon",
    json: "application/json", pdf: "application/pdf",
    woff2: "font/woff2", ttf: "font/ttf",
    mp4: "video/mp4", webm: "video/webm", wav: "audio/wav",
  };
  const ct = formatMime[format] || mime.lookup(format) || contentType || "application/octet-stream";

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
