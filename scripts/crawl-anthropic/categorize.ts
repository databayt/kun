import type { AssetCategory, AssetFormat, BlobMeta, AssetCandidate } from "./types.js";

const PERSON_NAME = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}$/;

export function categorize(
  candidate: AssetCandidate,
  blob: BlobMeta,
): { category: AssetCategory; needsReview: boolean } {
  const fmt = blob.format;
  const url = candidate.sourceUrl.toLowerCase();
  const page = candidate.pageUrl.toLowerCase();
  const alt = (candidate.alt || "").toLowerCase();
  const path = (() => {
    try { return new URL(candidate.sourceUrl).pathname.toLowerCase(); }
    catch { return url; }
  })();

  if (fmt === "woff2" || fmt === "ttf") return { category: "fonts", needsReview: false };
  if (fmt === "pdf") return { category: "documents", needsReview: false };
  if (fmt === "mp4" || fmt === "wav" || fmt === "webm") {
    return { category: "animations", needsReview: false };
  }
  if (fmt === "json") {
    if (url.includes("lottie") || url.includes("/files/")) {
      return { category: "animations", needsReview: false };
    }
    return { category: "animations", needsReview: true };
  }
  if (fmt === "ico") return { category: "brand", needsReview: false };

  if (page.includes("/features/claude-on-mars")) return { category: "mars", needsReview: false };

  if (page.includes("/events") || /\b(event|summit|conference)\b/.test(path)) {
    return { category: "events", needsReview: false };
  }

  if ((page.includes("/team") || page.includes("/company")) &&
      candidate.alt && PERSON_NAME.test(candidate.alt.trim())) {
    return { category: "team", needsReview: false };
  }

  if (page.includes("/customers") || /\b(partner|customer|case-stud)\b/.test(path)) {
    return { category: "partners", needsReview: false };
  }

  const isResearchPage = /\/(research|science|transparency|responsible-scaling-policy|constitution|economic-futures)\b/.test(page);
  const isSquareLarge = blob.width && blob.height && blob.width === blob.height && blob.width >= 800;

  if (isResearchPage && fmt === "svg" && isSquareLarge) {
    return { category: "illustrations", needsReview: false };
  }
  if ((page.includes("/research") || page.includes("/science")) &&
      (fmt === "svg" || fmt === "png") && !isSquareLarge) {
    return { category: "benchmarks", needsReview: false };
  }

  if (page.includes("/engineering")) return { category: "engineering", needsReview: false };

  if (candidate.fromMeta === "og:image" || candidate.fromMeta === "twitter:image" ||
      /og-image|twitter-card|social/.test(path)) {
    return { category: "social", needsReview: false };
  }

  if (/\b(map|geo)\b/.test(path) || alt.includes("map")) {
    return { category: "maps", needsReview: false };
  }

  if (/(logo|wordmark|mark|favicon|brand|apple-touch-icon|webclip|safari-pinned)/.test(path) ||
      /(logo|wordmark|brand|favicon)/.test(alt)) {
    return { category: "brand", needsReview: false };
  }

  const small = blob.width && blob.height && blob.width <= 64 && blob.height <= 64;
  if ((/\b(icon|glyph)\b/.test(path) || candidate.fromMeta === "icon") && small) {
    return { category: "ui-icons", needsReview: false };
  }

  if (page.includes("/careers") && fmt === "svg" && isSquareLarge) {
    return { category: "values", needsReview: false };
  }

  return { category: "illustrations", needsReview: true };
}

export function detectFormat(url: string, contentType: string | null): AssetFormat | null {
  const lower = url.toLowerCase();
  const ext = lower.split("?")[0]!.split("#")[0]!.split(".").pop();
  const ct = (contentType || "").toLowerCase();

  const map: Record<string, AssetFormat> = {
    svg: "svg", png: "png", jpg: "jpg", jpeg: "jpg",
    webp: "webp", gif: "gif", ico: "ico",
    json: "json", lottie: "json",
    mp4: "mp4", webm: "webm", wav: "wav",
    woff2: "woff2", woff: "woff2", ttf: "ttf", otf: "ttf",
    pdf: "pdf",
  };

  if (ext && map[ext]) return map[ext];

  if (ct.includes("svg")) return "svg";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("json")) return "json";
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("font/woff2")) return "woff2";
  if (ct.includes("font/ttf") || ct.includes("font/otf")) return "ttf";
  if (ct.includes("pdf")) return "pdf";

  return null;
}
