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
 * What the post is, in platform terms.
 *
 * NOT stored on the post — a `SocialVariant` carries text, media and a channel
 * and nothing else — so this steers what the composer OFFERS rather than
 * pretending to be a column. Saying so plainly here because a setting that
 * looks persisted and is not would be the worse kind of lie.
 */
export const POST_TYPES = ["post", "carousel", "reel", "story"] as const;
export type PostType = (typeof POST_TYPES)[number];

/** Image, video, or don't care. Filters both the library and the queue. */
export const MEDIA_FILTERS = ["any", "image", "video"] as const;
export type MediaFilter = (typeof MEDIA_FILTERS)[number];

/**
 * Which of the showroom's asset types belong to each post format.
 *
 * Keys are `ASSET_TYPES` from the showroom taxonomy — one vocabulary, not two.
 * A format with no matching assets in a brand's library shows an empty grid,
 * which is honest: that brand has nothing of that shape to attach yet.
 */
export const POST_TYPE_ASSETS: Record<PostType, readonly string[]> = {
  post: [
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
  ],
  carousel: ["carousel", "split", "infographic", "og"],
  reel: ["reel"],
  story: ["story", "reel"],
};

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
): boolean {
  if (!POST_TYPE_ASSETS[postType].includes(asset.type)) return false;
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
