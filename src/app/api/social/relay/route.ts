// The Hermes lane, inbound.
//
// Hermes runs on Abdout's own Linux desktop and the local gateway listens on
// http://localhost:18789 — neither is publicly routable, so nothing running on
// Vercel can ever call *into* Hermes. (hermes-ai.net is an unrelated community
// docs site for the open-source project, not this instance.) That makes
// HERMES_API_URL unusable in production and leaves lib/social-draft.ts's Hermes
// path a permanent half-loop.
//
// So this route inverts the direction. Hermes has outbound internet and its own
// cron; kun has the Page tokens. Hermes drafts the copy and shows it to Abdout
// in Slack, Abdout approves it there, and Hermes POSTs the approved text here.
// kun delivers it using its own per-product tokens — Hermes never holds a
// Facebook Page token, and the secrets never leave Vercel env.
//
// The human gate lives in Slack, upstream of this call. This route is a relay,
// not an approver: a valid CRON_SECRET bearer means "a human already said yes."
// Treat the secret accordingly — whoever holds it can post to a brand page.

import crypto from "node:crypto";

import {
  CHANNELS,
  CHANNEL_IDS,
  type ChannelId,
} from "@/components/root/social/config";
import {
  PRODUCTS,
  productChannelWired,
} from "@/components/root/social/products";
import { deliverPost } from "@/lib/social-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A brand post, not an essay. Far above any real caption, low enough that a
// malformed body can't tie up the function.
const MAX_RELAY_TEXT = 5000;

function authorized(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const provided = (request.headers.get("authorization") ?? "").trim();
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bad(error: string, status: number): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return bad("CRON_SECRET not set — the relay lane is disabled.", 503);
  }
  if (!authorized(request)) {
    return bad("Unauthorized.", 401);
  }

  const body = (await request.json().catch(() => null)) as {
    product?: unknown;
    channels?: unknown;
    text?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return bad("Body must be JSON: { product, text, channels? }.", 400);
  }

  const productId = typeof body.product === "string" ? body.product.trim() : "";
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return bad(
      `Unknown product "${productId}". Known: ${PRODUCTS.map((p) => p.id).join(", ")}.`,
      400,
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return bad("text is required.", 400);
  if (text.length > MAX_RELAY_TEXT) {
    return bad(`text is ${text.length} chars (max ${MAX_RELAY_TEXT}).`, 400);
  }

  // Omitting channels means "every channel this brand is wired for" — the same
  // fan-out the cron and the composer use.
  const wiredForProduct = CHANNELS.filter((ch) =>
    productChannelWired(productId, ch.id, ch.wired),
  ).map((ch) => ch.id as ChannelId);

  let channels: ChannelId[];
  if (body.channels === undefined) {
    channels = wiredForProduct;
  } else if (
    Array.isArray(body.channels) &&
    body.channels.every((c): c is string => typeof c === "string")
  ) {
    const unknownChannels = body.channels.filter(
      (c) => !(CHANNEL_IDS as readonly string[]).includes(c),
    );
    if (unknownChannels.length > 0) {
      return bad(`Unknown channel: ${unknownChannels.join(", ")}.`, 400);
    }
    channels = body.channels as ChannelId[];
  } else {
    return bad("channels must be an array of channel ids.", 400);
  }

  if (channels.length === 0) {
    return bad(`No channel wired for ${productId}.`, 400);
  }

  // deliverPost re-refuses anything this brand isn't wired for; this is the
  // friendlier error, before we get there.
  const unwired = channels.filter((id) => !wiredForProduct.includes(id));
  if (unwired.length > 0) {
    return bad(`${unwired.join(", ")} not wired for ${productId}.`, 400);
  }

  const result = await deliverPost({ product: productId, text, channels });

  // The relay has no review channel to echo into — the server log is the audit
  // trail, and the JSON below is Hermes's confirmation.
  console.log(
    `[social/relay] ${result.ok ? "published" : "failed"} product=${productId} channels=${channels.join(",")} chars=${text.length}${result.ok ? "" : ` error=${result.error}`}`,
  );

  return result.ok
    ? Response.json({ ok: true, product: productId, channels, chars: text.length })
    : bad(result.error ?? "Unknown error.", 502);
}
