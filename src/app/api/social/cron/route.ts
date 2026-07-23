// Daily auto-post cron — drafts only, never publishes.
//
// Flow: Vercel Cron (see vercel.json) → this route → one draft per opted-in
// product → a review message with a signed one-click Publish link → a human
// clicks → /api/social/publish delivers it. Nothing reaches a public brand page
// without that click.
//
// Opt-in is explicit and empty by default: SOCIAL_AUTOPOST_PRODUCTS=hogwarts,databayt.
// With the var unset, this route authenticates, does nothing, and says so.

import crypto from "node:crypto";

import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import {
  PRODUCTS,
  productChannelWired,
} from "@/components/root/social/products";
import { draftPost, draftSource } from "@/lib/social-draft";
import { sendReview } from "@/lib/social-review";
import { createApprovalToken, MAX_TOKEN_TEXT } from "@/lib/social-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Long enough for a human to see the message in the morning, short enough that a
// leaked link goes stale before it's useful.
const APPROVAL_TTL_SECONDS = 12 * 60 * 60;

function authorized(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const provided = (request.headers.get("authorization") ?? "").trim();
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function autopostProducts(): string[] {
  return (process.env.SOCIAL_AUTOPOST_PRODUCTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function baseUrl(request: Request): string {
  const configured = (process.env.SOCIAL_PUBLIC_URL ?? "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

interface ProductOutcome {
  product: string;
  channels: string[];
  status: "review_sent" | "skipped" | "failed";
  detail?: string;
}

export async function GET(request: Request): Promise<Response> {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not set — auto-post is disabled." },
      { status: 503 },
    );
  }
  if (!authorized(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const products = autopostProducts();
  if (products.length === 0) {
    return Response.json({
      ok: true,
      drafted: 0,
      note: "SOCIAL_AUTOPOST_PRODUCTS is empty — nothing is opted in to auto-posting.",
    });
  }

  const locale =
    (process.env.SOCIAL_DRAFT_LOCALE ?? "").trim() === "en" ? "en" : "ar";
  const origin = baseUrl(request);
  const results: ProductOutcome[] = [];

  for (const productId of products) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      results.push({
        product: productId,
        channels: [],
        status: "skipped",
        detail: "Unknown product id.",
      });
      continue;
    }

    // One draft per product, delivered to every channel that brand is wired for
    // — same shape as the composer, where one approved text fans out.
    const channels = CHANNELS.filter((ch) =>
      productChannelWired(productId, ch.id, ch.wired),
    ).map((ch) => ch.id as ChannelId);

    if (channels.length === 0) {
      results.push({
        product: productId,
        channels: [],
        status: "skipped",
        detail: "No channel wired for this product.",
      });
      continue;
    }

    const draft = await draftPost({
      product: productId,
      channel: channels[0],
      locale,
    });
    if (!draft.ok) {
      results.push({
        product: productId,
        channels,
        status: "failed",
        detail: draft.error,
      });
      continue;
    }

    // The token carries the copy, so an over-long draft can't be approved by
    // link. Surface it rather than truncating someone's brand post.
    if (draft.text.length > MAX_TOKEN_TEXT) {
      results.push({
        product: productId,
        channels,
        status: "failed",
        detail: `Draft is ${draft.text.length} chars (max ${MAX_TOKEN_TEXT}) — publish it manually from /en/social.`,
      });
      continue;
    }

    const token = createApprovalToken(
      { p: productId, c: channels, t: draft.text },
      APPROVAL_TTL_SECONDS,
    );
    const link = `${origin}/api/social/publish?token=${encodeURIComponent(token)}`;

    const review = await sendReview(
      [
        `📝 Draft for ${product.label} → ${channels.join(", ")}`,
        "",
        draft.text,
        "",
        `— drafted by ${draft.source}. Publish (expires in 12h):`,
        link,
      ].join("\n"),
      `social draft: ${product.label}`,
    );

    results.push({
      product: productId,
      channels,
      status: review.ok ? "review_sent" : "failed",
      detail: review.ok ? review.via : review.error,
    });
  }

  return Response.json({
    ok: results.every((r) => r.status !== "failed"),
    draftSource: draftSource(),
    results,
  });
}
