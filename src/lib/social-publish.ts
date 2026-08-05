// Egress fan-out — one place that turns (product, channels, text) into actual
// posts. Shared by the contributor-gated Server Action (actions/post-social.ts),
// the token-gated approval route (api/social/publish), and the inbound Hermes
// relay (api/social/relay), so every route takes exactly the same transport path
// and the same per-product token resolution.
//
// Doctrine: this layer only delivers approved copy. It never writes copy.

import {
  CHANNELS,
  type ChannelId,
  type ChannelTransport,
} from "@/components/root/social/config";
import { productChannelWired } from "@/components/root/social/products";
import {
  sendTelegramAlbum,
  sendTelegramPost,
  sendTelegramVideo,
} from "@/lib/telegram";
import {
  sendFacebookCarousel,
  sendFacebookPost,
  sendFacebookVideo,
} from "@/lib/facebook";
import { sendInstagramPost } from "@/lib/instagram";
import { sendSocialPost } from "@/lib/hermes";
import { applyUtm } from "@/lib/social-utm";
import { splitMedia } from "@/lib/media-kind";

export interface DeliverInput {
  product: string;
  text: string;
  channels: ChannelId[];
  /**
   * Ordered, publicly reachable media set — usually /higgs or /carousel
   * renders on the CDN. Images and/or one video; kind is inferred from the
   * extension (lib/media-kind.ts). Shapes a variant may carry: none, one
   * image, 2–10 images (album/carousel), or one video.
   */
  mediaUrls?: string[];
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
  mediaUrls = [],
}: DeliverInput): Promise<DeliverResult> {
  // Group by transport in ONE pass, before anything else.
  //
  // Filtering into three independent arrays let a channel whose transport
  // matched none of them fall out of every bucket: `results` came back empty,
  // `failures` was empty too, and the function returned ok:true having sent
  // nothing — after which the drain writes `published`. Grouping once, then
  // asserting the outcome count at the end, makes that unrepresentable.
  const byTransport = new Map<ChannelTransport, ChannelId[]>();
  const unknown: ChannelId[] = [];
  for (const id of channels) {
    const transport = transportOf(id);
    if (!transport) {
      unknown.push(id);
      continue;
    }
    byTransport.set(transport, [...(byTransport.get(transport) ?? []), id]);
  }
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown channel: ${unknown.join(", ")}.`,
      results: unknown.map((channel) => ({
        channel,
        ok: false,
        error: "unknown channel",
      })),
    };
  }

  // Copy-out channels are refused first, and by name. WhatsApp has no organic
  // posting API for Channels or broadcast lists — that is not a credential we
  // are missing, it is a capability Meta does not offer. Saying so beats the
  // generic "not wired" message, and refusing here is what stops a row being
  // recorded as published when nothing reached anyone. /publish renders the
  // copy-out block a human forwards.
  const manualChannels = byTransport.get("manual") ?? [];
  if (manualChannels.length > 0) {
    return {
      ok: false,
      error: `${manualChannels.join(", ")}: copy-out only — publish by hand via /publish.`,
      results: manualChannels.map((channel) => ({
        channel,
        ok: false,
        error: "copy-out only — no posting API exists",
      })),
    };
  }

  // Instagram is image-first by platform contract: the Graph flow publishes an
  // image container and no text-only edge exists. Refused here, by name and
  // before anything is delivered, so a mixed selection cannot half-land with
  // the Instagram leg silently missing.
  const instagramNoMedia =
    mediaUrls.length === 0 ? (byTransport.get("instagram") ?? []) : [];
  if (instagramNoMedia.length > 0) {
    return {
      ok: false,
      error: `${instagramNoMedia.join(", ")}: an image is required — Instagram has no text-only posts.`,
      results: instagramNoMedia.map((channel) => ({
        channel,
        ok: false,
        error: "an image is required — no text-only posts",
      })),
    };
  }

  // Payload-shape gates — about the media set, not any one channel, so a
  // refusal covers every requested channel and nothing is delivered anywhere.
  // The platforms themselves draw these lines: no edge mixes photos and video
  // in one post, none takes two videos, and both Graph and Telegram cap a
  // multi-photo post at 10.
  const { images, videos } = splitMedia(mediaUrls);
  const refuseAll = (error: string): DeliverResult => ({
    ok: false,
    error,
    results: channels.map((channel) => ({ channel, ok: false, error })),
  });
  if (images.length > 0 && videos.length > 0) {
    return refuseAll(
      "mixed image and video in one post — split into two posts",
    );
  }
  if (videos.length > 1) {
    return refuseAll(`one video per post (got ${videos.length})`);
  }
  if (images.length > 10) {
    return refuseAll(
      `platforms cap a multi-photo post at 10 images (got ${images.length})`,
    );
  }

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

  // Telegram, Facebook and Instagram go straight to their official APIs; the
  // rest relay through the Hermes gateway in one webhook call.
  const telegramChannels = byTransport.get("telegram") ?? [];
  const facebookChannels = byTransport.get("facebook") ?? [];
  const instagramChannels = byTransport.get("instagram") ?? [];
  const hermesChannels = byTransport.get("hermes") ?? [];

  // The transports are independent destinations — running them in
  // sequence made a multi-channel post pay every timeout back to back.
  // Tagged per channel, not once for the batch: utm_source is precisely what
  // makes each platform's traffic separable at the far end.
  const utm = (channel: string) => applyUtm(text, { channel, brand: product });

  // Route by media shape — the gates above guarantee all-images XOR one
  // video, so each transport picks exactly one edge: text, single photo,
  // album/carousel (2–10), or video.
  const sendTelegram = (caption: string) => {
    if (videos.length === 1) return sendTelegramVideo(caption, videos[0]);
    if (images.length >= 2) return sendTelegramAlbum(caption, images);
    return sendTelegramPost(caption, undefined, images[0]);
  };
  const sendFacebook = (caption: string) => {
    if (videos.length === 1)
      return sendFacebookVideo(caption, videos[0], product);
    if (images.length >= 2)
      return sendFacebookCarousel(caption, images, product);
    return sendFacebookPost(caption, product, images[0]);
  };

  const [telegramOut, facebookOut, instagramOut, hermesOut] = await Promise.all(
    [
      telegramChannels.length > 0 ? sendTelegram(utm("telegram")) : null,
      facebookChannels.length > 0 ? sendFacebook(utm("facebook")) : null,
      instagramChannels.length > 0
        ? // Single image only — the channel is gated (kun#141); when it
          // unlocks, video and carousel need their own container branches.
          sendInstagramPost(utm("instagram"), product, mediaUrls[0])
        : null,
      hermesChannels.length > 0
        ? sendSocialPost({
            // One relay call covers N channels, so the first is the honest
            // attribution; per-channel tagging for these arrives with the queue
            // lane, which hands Hermes one variant at a time.
            text: utm(hermesChannels[0]),
            channels: hermesChannels,
            // Gateway contract is single-URL (lane parked) — first item only.
            mediaUrl: mediaUrls[0],
          })
        : null,
    ],
  );

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
    ...instagramChannels.map((channel) => ({
      channel,
      ok: Boolean(instagramOut?.ok),
      error: instagramOut?.error,
      externalId: instagramOut?.externalId,
    })),
    ...hermesChannels.map((channel) => ({
      channel,
      ok: Boolean(hermesOut?.ok),
      error: hermesOut?.error,
    })),
  ];

  // Every requested channel must produce exactly one outcome. A transport
  // added without a fan-out branch above would otherwise sail through as a
  // silent success — the one failure mode in this file that reaches a caller
  // as "published" while nothing was sent.
  if (results.length !== channels.length) {
    return {
      ok: false,
      error: `internal: ${channels.length} channel(s) requested, ${results.length} outcome(s) produced`,
      results,
    };
  }

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
