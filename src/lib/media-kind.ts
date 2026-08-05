// Media-kind inference — the one place that decides whether a URL is an image
// or a video, shared by the delivery fan-out (social-publish.ts), the Hub's
// attachment tray, and the review surfaces. Extension-based on purpose: the
// URLs here are our own CDN renders (higgs, carousel) whose extensions are
// trustworthy, and probing Content-Type would put a network call inside a
// pure routing decision.

export type MediaKind = "image" | "video";

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v"]);

/** Image unless the path's extension says video — unknown extensions are
 *  images because every platform edge we call treats a URL that way. */
export function mediaKind(url: string): MediaKind {
  // Tolerate query strings and fragments (S3 presigns, cache-busters).
  const path = url.split(/[?#]/, 1)[0] ?? "";
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "image";
  const ext = path.slice(dot + 1).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext) ? "video" : "image";
}

export interface SplitMedia {
  images: string[];
  videos: string[];
}

/** Partition an ordered media set by kind, preserving order within each. */
export function splitMedia(urls: string[]): SplitMedia {
  const images: string[] = [];
  const videos: string[] = [];
  for (const url of urls) {
    (mediaKind(url) === "video" ? videos : images).push(url);
  }
  return { images, videos };
}

/**
 * mediaUrls-first read with the legacy single-column fallback — the one shim
 * every reader of SocialVariant media uses while `mediaUrl` still exists.
 * Rows written before the array column exist only in `mediaUrl`; rows written
 * after carry both (dual-write). Drop this with the column.
 */
export function resolveMediaUrls(
  mediaUrls: string[] | null | undefined,
  mediaUrl: string | null | undefined,
): string[] {
  if (mediaUrls && mediaUrls.length > 0) return mediaUrls;
  return mediaUrl ? [mediaUrl] : [];
}
