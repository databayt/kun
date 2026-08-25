// What a post IS, as data — the settings face's vocabulary and the two rules
// that make it more than decoration.
//
// The Hub's composer has one field and three faces (queue, media, settings).
// The settings face answers "what is this post" — brand, channels, format,
// media, destination — and two of those answers have to reach the other two
// faces or the face is a form that changes nothing. Those reaches are the
// predicates below, kept here rather than inline in the JSX because they are
// the part worth testing: a filter that silently matches nothing looks exactly
// like a library that is empty.

import featuresJson from "../../../../content/social/features.json";

import { mediaKind } from "@/lib/media-kind";
import { ASSET_TYPES } from "@/components/root/social/showroom/taxonomy";
import { matchesQuery } from "@/lib/normalize-search";

/**
 * Where Send puts the post. Three real destinations, each already backed by an
 * action in `actions/post-social.ts`:
 *
 *   direct   — `publishPostDirect`, or `approveDraft` when a queue draft is
 *              loaded, which also claims that request.
 *   schedule — `approveDraft(mode: "schedule")`, which writes `scheduled`
 *              variants for the ~15-minute cron drain.
 *   review   — `stageForReview`, which mints a piece with `pending` variants
 *              and one single-use signed link per channel. This is the "draft"
 *              half of draft-or-direct: nothing reaches a platform until an
 *              approver presses a link.
 */
export const DESTINATIONS = ["direct", "schedule", "review"] as const;
export type Destination = (typeof DESTINATIONS)[number];

/**
 * The shapes a post can take.
 *
 * Two things decide a shape, and the schema names both. A draft is "copy
 * AND/OR media: any of the two may be empty, never both"
 * (`SocialDraftRequest.mediaUrls`), and a variant's media is "images and/or
 * one video" (`SocialVariant.mediaUrls`). So the axes are what it carries —
 * nothing, one still, several stills, footage — and where it lands: in the
 * feed, as a swipe, as a story, as a reel.
 *
 * NOT stored on the post. Nothing records a shape, and the delivered thing is
 * just text plus URLs, so this steers what the composer OFFERS rather than
 * pretending to be a column. Saying so here beats a setting that looks
 * persisted and is not.
 */
export const POST_TYPES = [
  "text",
  "image",
  "gallery",
  "video",
  "imageOnly",
  "videoOnly",
  "carousel",
  "story",
  "reel",
] as const;
export type PostType = (typeof POST_TYPES)[number];

export interface PostTypeMeta {
  /** Which showroom asset types this shape can draw from. */
  assets: readonly string[];
  /** What kind of media it takes. `none` means the ＋ has nothing to offer. */
  kind: "image" | "video" | "none";
  /** Does the shape carry copy? Drives nothing yet; it is what the card draws. */
  text: boolean;
  /** How many pieces of media the shape implies. */
  count: "none" | "one" | "many";
  /**
   * How the media sits in the frame — what the preview has to draw. `feed` is
   * a wide block in a scrolling post, `tall` is the 9:16 surfaces (story,
   * reel), `swipe` is the multi-card one where the next card peeks in.
   */
  frame: "feed" | "tall" | "swipe";
}

/** Stills a feed post can use — every text-bearing still type the library has. */
const STILLS = [
  "hero",
  "og",
  "banner",
  "product",
  "lifestyle",
  "mockup",
  "infographic",
  "split",
  "testimonial",
  "logo",
  "other",
] as const;

export const POST_TYPE_META: Record<PostType, PostTypeMeta> = {
  text: { assets: [], kind: "none", text: true, count: "none", frame: "feed" },
  image: {
    assets: STILLS,
    kind: "image",
    text: true,
    count: "one",
    frame: "feed",
  },
  gallery: {
    assets: STILLS,
    kind: "image",
    text: true,
    count: "many",
    frame: "feed",
  },
  video: {
    assets: ["reel", "story"],
    kind: "video",
    text: true,
    count: "one",
    frame: "feed",
  },
  imageOnly: {
    assets: STILLS,
    kind: "image",
    text: false,
    count: "one",
    frame: "feed",
  },
  videoOnly: {
    assets: ["reel", "story"],
    kind: "video",
    text: false,
    count: "one",
    frame: "feed",
  },
  carousel: {
    assets: ["carousel", "split", "infographic", "og"],
    kind: "image",
    text: true,
    count: "many",
    frame: "swipe",
  },
  story: {
    assets: ["story", "reel"],
    kind: "image",
    text: false,
    count: "one",
    frame: "tall",
  },
  reel: {
    assets: ["reel"],
    kind: "video",
    text: true,
    count: "one",
    frame: "tall",
  },
};

/** Image, video, or don't care. Filters both the library and the queue. */
export const MEDIA_FILTERS = ["any", "image", "video"] as const;
export type MediaFilter = (typeof MEDIA_FILTERS)[number];

/** Kept for readers that only want the asset lists. */
export const POST_TYPE_ASSETS: Record<PostType, readonly string[]> =
  Object.fromEntries(
    POST_TYPES.map((t) => [t, POST_TYPE_META[t].assets]),
  ) as Record<PostType, readonly string[]>;

/**
 * Does this library asset belong in the ＋ face under these settings?
 *
 * Two gates: the format decides which asset types are on offer, and the media
 * filter decides whether we are looking at stills or footage. `any` skips the
 * second gate rather than matching every kind, so an asset with an extension
 * nobody recognises still shows up under "Any" instead of vanishing.
 */
export function libraryFits(
  asset: { url: string; type: string },
  postType: PostType,
  mediaFilter: MediaFilter,
  mediaType: string = ANY_MEDIA_TYPE,
): boolean {
  if (!mediaTypeFits(asset.type, mediaType)) return false;
  const meta = POST_TYPE_META[postType];
  // A text-only post has nothing to attach, so the library offers nothing —
  // an empty grid is the honest answer, not a bug.
  if (meta.kind === "none") return false;
  if (!meta.assets.includes(asset.type)) return false;
  // The shape decides the kind before the filter narrows it further: asking
  // for a reel and being offered stills is the shape not working.
  if (mediaKind(asset.url) !== meta.kind) return false;
  if (mediaFilter === "any") return true;
  return mediaKind(asset.url) === mediaFilter;
}

/**
 * Does this queue row survive the media filter?
 *
 * A row with no media at all fails a specific filter — asking for video and
 * being shown copy that carries none is the filter not working. Under "any",
 * everything passes, including text-only drafts, which are the common case.
 */
export function queueFits(
  mediaUrls: readonly string[],
  mediaFilter: MediaFilter,
): boolean {
  if (mediaFilter === "any") return true;
  return mediaUrls.some((url) => mediaKind(url) === mediaFilter);
}

/**
 * ——— Feature: which part of the product a post is about ———
 *
 * `content/social/features.json` is what each brand actually sells, taken from
 * that product's own block registry and narrowed to the blocks a post can be
 * about. Infrastructure is deliberately absent: nobody writes a post about a
 * sidebar.
 *
 * Matching is on the WORDS, not on a column, because no column exists — a
 * `SocialDraftRequest` carries a brief and its copy, a `SocialVariant` carries
 * text, and neither records which feature it is selling. A post about
 * attendance says "attendance" or "الحضور", so that is what this looks for,
 * through the same Arabic-folding matcher the search bar uses. It narrows a
 * list; it does not label what you write.
 */
export interface BrandFeature {
  id: string;
  en: string;
  ar: string;
}

/** The file's envelope carries `version` and `$comment` beside the arrays. */
export function featuresFor(brand: string): BrandFeature[] {
  const raw = (featuresJson as Record<string, unknown>)[brand];
  return Array.isArray(raw) ? (raw as BrandFeature[]) : [];
}

export function featureLabel(
  brand: string,
  id: string,
  isRTL: boolean,
): string {
  const found = featuresFor(brand).find((f) => f.id === id);
  if (!found) return id;
  return isRTL ? found.ar : found.en;
}

/**
 * Is this row about the chosen feature?
 *
 * Both names are tried — a brand publishes in Arabic and English from the same
 * queue, so an English draft about Admission and an Arabic one about القبول are
 * the same answer to the same question. `null` passes everything.
 */
export function featureFits(
  brand: string,
  haystack: string,
  featureId: string | null,
): boolean {
  if (!featureId) return true;
  const found = featuresFor(brand).find((f) => f.id === featureId);
  if (!found) return true;
  return matchesQuery(haystack, found.en) || matchesQuery(haystack, found.ar);
}

/**
 * ——— Media format: which shape of asset ———
 *
 * The showroom taxonomy already names every asset type and, for most, the
 * ratio it renders at. This narrows the ＋ to one of them — pick "Story" and
 * only 9:16 assets are offered — on top of what the post shape already allows.
 *
 * `any` is a real answer, not an absence: most posts do not care which of a
 * brand's stills they use.
 */
export const ANY_MEDIA_TYPE = "any";

/** The asset types this kind can contain, in taxonomy order. */
export function mediaTypesFor(
  kind: "image" | "video",
  postType: PostType,
): string[] {
  const allowed = POST_TYPE_META[postType].assets;
  return (ASSET_TYPES as readonly string[]).filter((type) => {
    if (!allowed.includes(type)) return false;
    // Reel and story are the moving formats; everything else is a still.
    const moving = type === "reel";
    return kind === "video" ? moving : !moving;
  });
}

/**
 * Does this asset match the chosen format?
 *
 * `any` passes, and so does a format the current post shape does not offer —
 * the shape has already had its say, and stacking a second silent no would
 * make an empty grid impossible to explain.
 */
export function mediaTypeFits(
  assetType: string,
  mediaType: string,
): boolean {
  if (mediaType === ANY_MEDIA_TYPE) return true;
  return assetType === mediaType;
}
