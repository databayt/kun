// The brands the Social Hub can publish for. `channels` lists which channels are
// wired PER PRODUCT — a channel is only publishable when both the global channel
// (config.ts) and this per-product flag are wired.
//
// Facebook is genuinely per-brand: each product has its own Facebook Page and its
// own permanent Page access token, read from FACEBOOK_PAGE_ID_<PRODUCT> /
// FACEBOOK_PAGE_ACCESS_TOKEN_<PRODUCT> (see lib/facebook.ts).
//
// Some channels are NOT per-brand — an org-level destination stays wired for
// `databayt` only; claiming it for a product brand would send a "post as
// Hogwarts" into the org channel. Flip a product's flag to true the day that
// brand gets its own channel and its own per-product transport config.
//
// That boolean assumes one destination per (brand, channel), which holds for a
// Page but not for WhatsApp — its real audience sits in many groups
// run by other people, selected per post. Replacing the flag with a destination
// registry is designed and deliberately unbuilt; do not widen this map to model
// groups. See /docs/social/channels/groups.
//
// Slack does not appear here at all: it is the communication channel, not a
// distribution one. The type below makes re-adding it a compile error.

import { CHANNELS, type DistributionChannelId } from "./config";

export interface SocialProduct {
  id: string; // stable key; matches the env var suffix (uppercased)
  label: string;
  labelAr: string;
  /**
   * Brand mark, shown instead of the name wherever the Hub offers a brand to
   * pick. A public URL, so `public/brands/x.png` is written `/brands/x.png`.
   *
   * `content/media/brand-kit.json` is where a mark is DECLARED — its file, its
   * description, and the rules for using it. This field mirrors that
   * declaration for the brands whose file actually exists, and a test pins the
   * two together so they cannot drift. Mirrored rather than imported because
   * the brand kit is 44KB of prompt text and this is a client bundle.
   *
   * Set only where the artwork is real. The brand kit's own rule for a brand
   * without one is explicit — "do not substitute another brand's mark" — and a
   * missing file would render as a broken image, which is worse than a name.
   *
   * Also deliberately NOT read from components/root/carousel/brands.ts, which
   * records marks too: it spells moallimee with two l's where this file uses
   * one, and a shared key would fail by silently finding nothing.
   */
  logo?: string;
  // channelId -> wired for this product. Distribution channels only —
  // a communication channel is structurally excluded from audience reach.
  channels: Partial<Record<DistributionChannelId, boolean>>;
}

export const PRODUCTS = [
  {
    id: "hogwarts",
    label: "Hogwarts",
    labelAr: "هوجورتس",
    logo: "/brands/hogwarts.png",
    channels: { facebook: true },
  },
  {
    // The in-product Arabic face of the same school SaaS that ships as Hogwarts
    // (content/media/brand-kit.json). Separate brand here because it has its own
    // Facebook Page and its own permanent Page token — one destination per
    // (brand, channel) is exactly what this map models.
    id: "balqalam",
    label: "Balqalam",
    labelAr: "بالقلم",
    // The same quill, on purpose. The brand kit says so in as many words: the
    // file lives under the hogwarts name for repo-historical reasons, the
    // artwork is a quill silhouette rather than a wordmark, and بالقلم means
    // "by the pen". The mark is shared; the name is not.
    logo: "/brands/hogwarts.png",
    channels: { facebook: true },
  },
  {
    id: "mkan",
    label: "Mkan",
    labelAr: "مكان",
    // The product's own mark, taken from databayt/mkan's public/logo.svg and
    // rasterised to the path the brand kit already declared.
    logo: "/brands/mkan.png",
    channels: { facebook: true },
  },
  {
    id: "databayt",
    label: "Databayt",
    labelAr: "داتابايت",
    // The hexagon from the live marketing site (databayt/marketing,
    // public/site/logo.png). NOTE: brand-kit.json still records this brand's
    // mark as `null` with the rule "there is no logo file to attach". That
    // line predates the artwork being found, and it governs a different
    // question — whether a mark is attached as a reference when an image is
    // GENERATED. Answering that changes render behaviour, so it is left as it
    // stands and the picker simply shows the real mark.
    logo: "/brands/databayt.png",
    channels: { facebook: true },
  },
  {
    id: "sijillee",
    logo: "/brands/sijillee.png",
    label: "Sijillee",
    labelAr: "سِجلي",
    channels: { facebook: false },
  },
  {
    id: "moalimee",
    logo: "/brands/moalimee.svg",
    label: "Moalimee",
    labelAr: "مُعلّمي",
    channels: { facebook: false },
  },
] as const satisfies readonly SocialProduct[];

/**
 * The same list, widened to the interface.
 *
 * `as const` keeps each entry's literal type, which means an optional field
 * only exists on the members that set it — reading `.logo` off the union is a
 * type error even though `satisfies` has already proved the shape. This view
 * is for callers that read optional fields across every brand.
 */
export const SOCIAL_PRODUCTS: readonly SocialProduct[] = PRODUCTS;

export type ProductId = (typeof PRODUCTS)[number]["id"];

export const PRODUCT_IDS = PRODUCTS.map((p) => p.id) as [
  ProductId,
  ...ProductId[],
];

export const DEFAULT_PRODUCT: ProductId = "hogwarts";

export function getProduct(id: string): SocialProduct | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

// A channel is publishable for a product only if BOTH are wired: the global
// transport (config.ts `wired`) and this brand's own destination.
export function productChannelWired(
  productId: string,
  channelId: string,
  channelGlobalWired: boolean,
): boolean {
  // A communication channel is never an audience destination, whatever a
  // per-brand map or a stored row claims. Slack is the team surface — its
  // approvals and notices are sent by sendReview, not by selecting it here.
  // Checked at runtime because callers pass a bare string from the database.
  if (CHANNELS.find((c) => c.id === channelId)?.kind === "communication") {
    return false;
  }
  const product = getProduct(productId);
  return Boolean(
    channelGlobalWired && product?.channels[channelId as DistributionChannelId],
  );
}
