import * as cheerio from "cheerio";
import { ALLOWED_CDN_HOSTS, ASSET_EXTENSIONS } from "./config.js";
import type { AssetCandidate } from "./types.js";

const URL_RE = /https?:\/\/[^\s'"<>()]+/gi;

function hostAllowed(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return ALLOWED_CDN_HOSTS.has(u.host);
  } catch { return false; }
}

function looksLikeAsset(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname.toLowerCase();
    // Exclude i18n bundles, statsig configs, Next.js chunks, Mintlify favicon mirrors that 404.
    if (path.includes("/i18n/") || path.includes("/statsig")) return false;
    if (path.includes("/_next/static/")) return false;
    if (path.includes("/_mintlify/favicons/")) return false;
    const ext = path.split(".").pop() ?? "";
    if (ASSET_EXTENSIONS.has(ext)) return true;
    if (u.host === "assets.anthropic.com" && u.pathname.startsWith("/m/")) return true;
    if (u.pathname.includes("/lottie")) return true;
    return false;
  } catch { return false; }
}

// Webflow CDN serves responsive variants like `name-p-500.webp`; the un-suffixed
// `name.webp` is the higher-quality original. Always enqueue both.
function maybeAddWebflowOriginal(
  out: AssetCandidate[],
  seen: Set<string>,
  childUrl: string,
  pageUrl: string,
  meta: Partial<AssetCandidate>,
): void {
  try {
    const u = new URL(childUrl);
    if (u.host !== "cdn.prod.website-files.com") return;
    const m = u.pathname.match(/^(.+?)-p-\d+\.(webp|png|jpg|jpeg)$/i);
    if (!m) return;
    const originalUrl = `${u.origin}${m[1]}.${m[2]!.toLowerCase()}${u.search}`;
    if (seen.has(originalUrl)) return;
    seen.add(originalUrl);
    out.push({ sourceUrl: originalUrl, pageUrl, ...meta });
  } catch { /* ignore */ }
}

// URLs harvested from inline scripts/HTML occasionally contain JSON-encoded
// entities (`&amp;` for `&`) or stray trailing escapes. Normalize them.
function sanitizeUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/g, "&")
    .replace(/\\\//g, "/")
    .replace(/[\\"']+$/g, "");
}

function pushIf(
  out: AssetCandidate[],
  seen: Set<string>,
  url: string | undefined | null,
  pageUrl: string,
  meta: Partial<AssetCandidate>,
): void {
  if (!url) return;
  const trimmed = sanitizeUrl(url);
  if (!trimmed) return;
  let abs: string;
  try { abs = new URL(trimmed, pageUrl).toString(); }
  catch { return; }
  if (!hostAllowed(abs) || !looksLikeAsset(abs)) return;
  if (!seen.has(abs)) {
    seen.add(abs);
    out.push({ sourceUrl: abs, pageUrl, ...meta });
  }
  maybeAddWebflowOriginal(out, seen, abs, pageUrl, meta);
}

function parseSrcset(srcset: string): string[] {
  return srcset.split(",")
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean) as string[];
}

export function extractAssets(html: string, pageUrl: string, networkAssets: string[] = []): AssetCandidate[] {
  if (!html && networkAssets.length === 0) return [];
  const $ = cheerio.load(html || "");
  const seen = new Set<string>();
  const out: AssetCandidate[] = [];

  $("img").each((_, el) => {
    const $el = $(el);
    const alt = $el.attr("alt") || undefined;
    pushIf(out, seen, $el.attr("src"), pageUrl, { alt });
    pushIf(out, seen, $el.attr("data-src"), pageUrl, { alt });
    const srcset = $el.attr("srcset") || $el.attr("data-srcset");
    if (srcset) {
      for (const s of parseSrcset(srcset)) {
        pushIf(out, seen, s, pageUrl, { alt });
      }
    }
  });

  $("picture source").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("srcset");
    if (srcset) for (const s of parseSrcset(srcset)) pushIf(out, seen, s, pageUrl, {});
  });

  $("video").each((_, el) => {
    const $el = $(el);
    pushIf(out, seen, $el.attr("src"), pageUrl, {});
    pushIf(out, seen, $el.attr("poster"), pageUrl, {});
  });
  $("video source, audio source").each((_, el) => {
    pushIf(out, seen, $(el).attr("src"), pageUrl, {});
  });

  $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]').each((_, el) => {
    pushIf(out, seen, $(el).attr("href"), pageUrl, { fromMeta: "icon" });
  });

  $('link[rel="preload"][as="image"], link[rel="preload"][as="font"]').each((_, el) => {
    pushIf(out, seen, $(el).attr("href"), pageUrl, { fromMeta: "preload" });
  });

  $('meta[property="og:image"], meta[name="og:image"]').each((_, el) => {
    pushIf(out, seen, $(el).attr("content"), pageUrl, { fromMeta: "og:image" });
  });
  $('meta[name="twitter:image"], meta[property="twitter:image"]').each((_, el) => {
    pushIf(out, seen, $(el).attr("content"), pageUrl, { fromMeta: "twitter:image" });
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const matches = style.match(/url\(['"]?([^'")]+)['"]?\)/gi);
    if (matches) {
      for (const m of matches) {
        const url = m.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");
        pushIf(out, seen, url, pageUrl, {});
      }
    }
  });

  $("script").each((_, el) => {
    const txt = $(el).html() || "";
    if (!txt) return;
    const matches = txt.match(URL_RE);
    if (!matches) return;
    for (const m of matches) pushIf(out, seen, m, pageUrl, {});
  });

  $("style").each((_, el) => {
    const txt = $(el).html() || "";
    const matches = txt.match(/url\(['"]?([^'")]+)['"]?\)/gi);
    if (!matches) return;
    for (const m of matches) {
      const url = m.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");
      pushIf(out, seen, url, pageUrl, {});
    }
  });

  for (const url of networkAssets) {
    pushIf(out, seen, url, pageUrl, {});
  }

  return out;
}

export function extractLinks(html: string, pageUrl: string, selector: string): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $(selector).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl).toString().split("#")[0]!;
      out.add(abs);
    } catch { /* ignore */ }
  });
  return Array.from(out);
}
