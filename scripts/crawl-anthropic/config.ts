export const BUCKET = "hogwarts-databayt";
export const REGION = "us-east-1";
export const DISTRIBUTION_DOMAIN = "d1dlwtcfl0db67.cloudfront.net";
export const CNAME_DOMAIN = "cdn.databayt.org";
export const CDN_BASE = `https://${DISTRIBUTION_DOMAIN}`;

export const USER_AGENT =
  "databayt-anthropic-mirror/1.0 (+osmanabdout@hotmail.com)";

export const ALLOWED_CDN_HOSTS = new Set([
  "cdn.sanity.io",
  "www-cdn.anthropic.com",
  "cdn.prod.website-files.com",
  "assets.anthropic.com",
  "claude.ai",
  "www.claude.com",
  "claude.com",
  "www.anthropic.com",
  "anthropic.com",
  "docs.claude.com",
  "docs.anthropic.com",
  "support.anthropic.com",
  "github.com",
  "raw.githubusercontent.com",
  "user-images.githubusercontent.com",
  "repository-images.githubusercontent.com",
  "avatars.githubusercontent.com",
  "opengraph.githubassets.com",
  "dka575ofm4ao0.cloudfront.net",
  "upload.wikimedia.org",
]);

export const STATIC_ASSET_HOSTS = new Set([
  "cdn.sanity.io",
  "www-cdn.anthropic.com",
  "cdn.prod.website-files.com",
  "assets.anthropic.com",
  "raw.githubusercontent.com",
  "user-images.githubusercontent.com",
  "repository-images.githubusercontent.com",
  "opengraph.githubassets.com",
  "dka575ofm4ao0.cloudfront.net",
  "upload.wikimedia.org",
]);

export const CONCURRENCY = {
  pages: 2,
  downloads: 8,
  uploads: 4,
};

export const RATE_LIMIT = {
  perHostMaxRps: 2,
  jitterMs: 250,
  retries: 5,
  backoffStartMs: 1000,
  backoffMaxMs: 16000,
};

export const ASSET_EXTENSIONS = new Set([
  "svg", "png", "jpg", "jpeg", "webp", "gif", "ico",
  "json", "lottie",
  "mp4", "webm", "mov", "wav", "mp3",
  "woff2", "woff", "ttf", "otf",
  "pdf",
]);

export const CACHE_CONTROL = "public, max-age=31536000, immutable";

export const STAGING_DIR = "scripts/crawl-anthropic/state/staging";
export const MANIFEST_PATH = "scripts/crawl-anthropic/state/manifest.json";
export const REPORT_PATH = "scripts/crawl-anthropic/state/report.md";

export const DATA_TS_PATH = "src/components/root/anthropic/data.ts";
