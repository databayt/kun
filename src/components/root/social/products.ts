// The brands the Social Hub can publish for. `channels` lists which channels are
// wired PER PRODUCT — a channel is only publishable when both the global channel
// (config.ts) and this per-product flag are wired.
//
// Facebook is genuinely per-brand: each product has its own Facebook Page and its
// own permanent Page access token, read from FACEBOOK_PAGE_ID_<PRODUCT> /
// FACEBOOK_PAGE_ACCESS_TOKEN_<PRODUCT> (see lib/facebook.ts).
//
// Telegram is NOT per-brand today — there is exactly one Telegram channel
// (TELEGRAM_CHANNEL_ID), an org-level databayt destination. It stays wired for
// `databayt` only; claiming it for a product brand would send a "post as
// Hogwarts" into the org channel. Flip a product's flag to true the day that
// brand gets its own channel and its own per-product transport config.
//
// That boolean assumes one destination per (brand, channel), which holds for a
// Page but not for Telegram/WhatsApp — their real audience sits in many groups
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
  // channelId -> wired for this product. Distribution channels only —
  // a communication channel is structurally excluded from audience reach.
  channels: Partial<Record<DistributionChannelId, boolean>>;
}

export const PRODUCTS = [
  {
    id: "hogwarts",
    label: "Hogwarts",
    labelAr: "هوجورتس",
    channels: { facebook: true },
  },
  {
    id: "mkan",
    label: "Mkan",
    labelAr: "مكان",
    channels: { facebook: true },
  },
  {
    id: "databayt",
    label: "Databayt",
    labelAr: "داتابايت",
    channels: { facebook: true, telegram: true },
  },
  {
    id: "sijillee",
    label: "Sijillee",
    labelAr: "سِجلي",
    channels: { facebook: false },
  },
  {
    id: "moalimee",
    label: "Moalimee",
    labelAr: "مُعلّمي",
    channels: { facebook: false },
  },
] as const satisfies readonly SocialProduct[];

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
