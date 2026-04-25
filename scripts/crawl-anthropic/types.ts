export type AssetCategory =
  | "illustrations"
  | "engineering"
  | "research"
  | "values"
  | "ui-icons"
  | "maps"
  | "brand"
  | "partners"
  | "benchmarks"
  | "social"
  | "events"
  | "animations"
  | "fonts"
  | "documents"
  | "team"
  | "mars";

export type AssetFormat =
  | "svg" | "png" | "jpg" | "webp" | "gif"
  | "json" | "pdf" | "woff2" | "ttf" | "ico"
  | "mp4" | "webm" | "wav";

export interface PageSource {
  url: string;
  group: string;
  dynamic?: boolean;
  authWalled?: boolean;
  followLinks?: { selector: string; depth: number };
}

export interface AssetCandidate {
  sourceUrl: string;
  pageUrl: string;
  alt?: string;
  caption?: string;
  fromMeta?: "og:image" | "twitter:image" | "icon" | "preload";
}

export interface BlobMeta {
  sha256: string;
  bytes: number;
  contentType: string;
  format: AssetFormat;
  width?: number;
  height?: number;
  stagingPath: string;
}

export interface ManifestEntry {
  sha256: string;
  key: string;
  bytes: number;
  uploadedAt: string;
  contentType: string;
}

export type Manifest = Record<string, ManifestEntry>;

export interface NewAssetRow {
  key: string;
  sourceUrl: string;
  name: string;
  description: string;
  category: AssetCategory;
  format: AssetFormat;
  source: string;
  width?: number;
  height?: number;
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  pagesCrawled: number;
  pagesFailed: string[];
  assetsDiscovered: number;
  assetsSkippedExisting: number;
  assetsDownloaded: number;
  assetsUploaded: number;
  assetsNeedReview: NewAssetRow[];
  newRows: NewAssetRow[];
  deadLinks: string[];
}
