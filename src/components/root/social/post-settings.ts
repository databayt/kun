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

import pillarsJson from "../../../../content/social/pillars.json";

import { mediaKind } from "@/lib/media-kind";

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
 * ——— Feature: which content pillar a post belongs to ———
 *
 * `content/social/pillars.json` is the recurring plan — per-brand briefs, each
 * tagged with a pillar ("feature", "trust", "time-savings", …). The seeder
 * files those briefs verbatim as `SocialDraftRequest.brief`, which is what
 * makes this filterable at all: a draft can be traced back to its pillar by
 * matching the brief it was asked with.
 *
 * That is also the limit, and worth saying. A post typed from scratch belongs
 * to no pillar, because nothing on a post records one — the JSON's own comment
 * notes that `pillar` was long written and read by nobody. So this narrows the
 * queue; it does not label what you write.
 */
interface PillarBrief {
  id: string;
  pillar: string;
  brief: string;
}

/** The file's envelope carries `version` and `$comment` beside the arrays. */
function briefsFor(brand: string): PillarBrief[] {
  const raw = (pillarsJson as Record<string, unknown>)[brand];
  return Array.isArray(raw) ? (raw as PillarBrief[]) : [];
}

/** The distinct pillars this brand actually plans against, in file order. */
export function pillarsFor(brand: string): string[] {
  const seen = new Set<string>();
  for (const b of briefsFor(brand)) {
    if (b.pillar) seen.add(b.pillar);
  }
  return [...seen];
}

/** "time-savings" → "Time savings". The ids are the only names these have. */
export function pillarLabel(pillar: string): string {
  const words = pillar.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Does this queue row belong to the chosen pillar?
 *
 * Matched on the brief, trimmed, because that is the one field carried from
 * the plan to the request unchanged. `null` means no pillar chosen and
 * everything passes — including drafts written from scratch, which belong to
 * no pillar and would otherwise be unreachable the moment a filter was set.
 */
export function featureFits(
  brand: string,
  brief: string,
  pillar: string | null,
): boolean {
  if (!pillar) return true;
  const wanted = briefsFor(brand)
    .filter((b) => b.pillar === pillar)
    .map((b) => b.brief.trim());
  return wanted.includes(brief.trim());
}
