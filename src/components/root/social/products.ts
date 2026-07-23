// The brands the Social Hub can publish for. `channels` lists which channels are
// wired PER PRODUCT — a channel is only publishable when both the global channel
// (config.ts) and this per-product flag are wired.
//
// Facebook is genuinely per-brand: each product has its own Facebook Page and its
// own permanent Page access token, read from FACEBOOK_PAGE_ID_<PRODUCT> /
// FACEBOOK_PAGE_ACCESS_TOKEN_<PRODUCT> (see lib/facebook.ts).
//
// Telegram and Slack are NOT per-brand today — there is exactly one Telegram
// channel (TELEGRAM_CHANNEL_ID) and one Slack workspace channel (Hermes's
// SLACK_HOME_CHANNEL), both org-level databayt destinations. They stay wired for
// `databayt` only; claiming them for the product brands would send a "post as
// Hogwarts" into the org channel. Flip a product's flag to true the day that
// brand gets its own channel and its own per-product transport config.

import type { ChannelId } from "./config";

export interface SocialProduct {
  id: string; // stable key; matches the env var suffix (uppercased)
  label: string;
  labelAr: string;
  // channelId -> wired for this product
  channels: Partial<Record<ChannelId, boolean>>;
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
    channels: { facebook: true, telegram: true, slack: true },
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
  const product = getProduct(productId);
  return Boolean(
    channelGlobalWired && product?.channels[channelId as ChannelId],
  );
}
