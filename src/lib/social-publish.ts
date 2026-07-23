// Egress fan-out — one place that turns (product, channels, text) into actual
// posts. Shared by the contributor-gated Server Action (actions/post-social.ts)
// and the token-gated approval route (api/social/publish), so both routes take
// exactly the same transport path and the same per-product token resolution.
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
}

export interface DeliverResult {
  ok: boolean;
  error?: string;
}

function transportOf(id: ChannelId) {
  return CHANNELS.find((c) => c.id === id)?.transport;
}

export async function deliverPost({
  product,
  text,
  channels,
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
    };
  }

  // Route per transport: telegram and facebook go straight to their official
  // APIs, everything else relays through the Hermes gateway in one webhook call.
  const hermesChannels = channels.filter((id) => transportOf(id) === "hermes");
  const wantsTelegram = channels.some((id) => transportOf(id) === "telegram");
  const wantsFacebook = channels.some((id) => transportOf(id) === "facebook");

  const failures: string[] = [];

  if (wantsTelegram) {
    const res = await sendTelegramPost(text);
    if (!res.ok) failures.push(`telegram: ${res.error}`);
  }

  if (wantsFacebook) {
    const res = await sendFacebookPost(text, product);
    if (!res.ok) failures.push(`facebook: ${res.error}`);
  }

  if (hermesChannels.length > 0) {
    const res = await sendSocialPost({ text, channels: hermesChannels });
    if (!res.ok) failures.push(`${hermesChannels.join(", ")}: ${res.error}`);
  }

  if (failures.length > 0) {
    return { ok: false, error: failures.join(" · ") };
  }
  return { ok: true };
}
