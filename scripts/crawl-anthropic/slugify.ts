import slugifyLib from "slugify";

const STOPWORDS = new Set(["image", "icon", "logo", "photo", "picture", "img"]);

export function slugifyName(input: string): string {
  return slugifyLib(input, {
    lower: true,
    strict: true,
    locale: "en",
    trim: true,
  });
}

export function deriveSlug(opts: {
  alt?: string;
  caption?: string;
  pageUrl: string;
  sourceUrl: string;
  sha256: string;
  category: string;
}): string {
  const { alt, caption, pageUrl, sha256, category } = opts;

  if (alt && alt.length > 2 && !STOPWORDS.has(alt.toLowerCase().trim())) {
    return slugifyName(alt);
  }
  if (caption && caption.length > 2) {
    return slugifyName(caption);
  }

  try {
    const u = new URL(pageUrl);
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1];
    if (last && last.length > 1) {
      return slugifyName(last);
    }
  } catch { /* fall through */ }

  return `${category}-${sha256.slice(0, 8)}`;
}

export function ensureUnique(
  candidate: string,
  category: string,
  used: Set<string>,
  sha256: string,
): string {
  const baseKey = `anthropic/${category}/${candidate}`;
  if (!used.has(baseKey)) {
    used.add(baseKey);
    return candidate;
  }
  const suffixed = `${candidate}-${sha256.slice(0, 4)}`;
  used.add(`anthropic/${category}/${suffixed}`);
  return suffixed;
}
