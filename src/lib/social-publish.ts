// Egress fan-out — one place that turns (product, channels, text) into actual
// posts. Shared by the contributor-gated Server Action (actions/post-social.ts),
// the token-gated approval route (api/social/publish), and the inbound Hermes
// relay (api/social/relay), so every route takes exactly the same transport path
// and the same per-product token resolution.
//
// Doctrine: this layer only delivers approved copy. It never writes copy.

import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import { productChannelWired } from "@/components/root/social/products";
import { sendTelegramPost } from "@/lib/telegram";
import { sendFacebookPost } from "@/lib/facebook";
import { sendSocialPost } from "@/lib/hermes";

export interface DeliverInput {
  product: string;
  text: string;
  channels: ChannelId[];
  /** Publicly reachable image URL — usually a /higgs render on the CDN. */
  mediaUrl?: string;
}

export interface ChannelOutcome {
  channel: ChannelId;
  ok: boolean;
  error?: string;
  /**
   * Platform-side post id, where the API returns one.
   *
   * Without it a published post cannot be found again — so it cannot be
   * retracted, and metrics have nothing to attach to. Facebook gives a feed
   * post id; Telegram needs chat+message, so it is stored as "chat:message".
   * Hermes relays asynchronously and returns nothing addressable.
   */
  externalId?: string;
}

export interface DeliverResult {
  /** True only when every requested channel landed. */
  ok: boolean;
  /** Joined failure summary — kept so existing callers keep working unchanged. */
  error?: string;
  /** Per-channel truth. A partial failure is the common case worth surfacing. */
  results: ChannelOutcome[];
}

function transportOf(id: ChannelId) {
  return CHANNELS.find((c) => c.id === id)?.transport;
}

export async function deliverPost({
  product,
  text,
  channels,
  mediaUrl,
}: DeliverInput): Promise<DeliverResult> {
  // Belt-and-braces: the caller validated, but this is the last gate before a
  // public brand page, so re-refuse any channel this brand isn't wired for.
  const unwired = channels.filter(
    (id) =>
      !productChannelWired(
        product,
        id,
        Boolean(CHANNELS.find((c) => c.id === id)?.wired),
      ),
  );
  if (unwired.length > 0) {
    return {
      ok: false,
      error: `${unwired.join(", ")} not wired for ${product}.`,
      results: unwired.map((channel) => ({
        channel,
        ok: false,
        error: `not wired for ${product}`,
      })),
    };
  }

  // Route per transport: telegram and facebook go straight to their official
  // APIs, everything else relays through the Hermes gateway in one webhook call.
  const telegramChannels = channels.filter(
    (id) => transportOf(id) === "telegram",
  );
  const facebookChannels = channels.filter(
    (id) => transportOf(id) === "facebook",
  );
  const hermesChannels = channels.filter((id) => transportOf(id) === "hermes");

  // The three transports are independent destinations — running them in
  // sequence made a multi-channel post pay every timeout back to back.
  const [telegramOut, facebookOut, hermesOut] = await Promise.all([
    telegramChannels.length > 0
      ? sendTelegramPost(text, undefined, mediaUrl)
      : null,
    facebookChannels.length > 0
      ? sendFacebookPost(text, product, mediaUrl)
      : null,
    hermesChannels.length > 0
      ? sendSocialPost({ text, channels: hermesChannels, mediaUrl })
      : null,
  ]);

  // One Hermes call covers N channels, so its verdict applies to all of them.
  const results: ChannelOutcome[] = [
    ...telegramChannels.map((channel) => ({
      channel,
      ok: Boolean(telegramOut?.ok),
      error: telegramOut?.error,
      externalId: telegramOut?.externalId,
    })),
    ...facebookChannels.map((channel) => ({
      channel,
      ok: Boolean(facebookOut?.ok),
      error: facebookOut?.error,
      externalId: facebookOut?.externalId,
    })),
    ...hermesChannels.map((channel) => ({
      channel,
      ok: Boolean(hermesOut?.ok),
      error: hermesOut?.error,
    })),
  ];

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    return {
      ok: false,
      error: failures.map((f) => `${f.channel}: ${f.error}`).join(" · "),
      results,
    };
  }
  return { ok: true, results };
}
