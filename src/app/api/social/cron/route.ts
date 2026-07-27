// Daily auto-post cron — drafts only, never publishes.
//
// Flow: Vercel Cron (see vercel.json) → this route → one draft per opted-in
// product → a review message with a signed one-click Publish link → a human
// clicks → /api/social/publish delivers it. Nothing reaches a public brand page
// without that click.
//
// Opt-in is explicit and empty by default: SOCIAL_AUTOPOST_PRODUCTS=hogwarts,databayt.
// With the var unset, this route authenticates, does nothing, and says so.

import { isAuthorizedBearer } from "@/lib/cron-auth";

import {
  DISTRIBUTION_CHANNELS,
  type ChannelId,
} from "@/components/root/social/config";
import {
  PRODUCTS,
  productChannelWired,
} from "@/components/root/social/products";
import { draftPost, draftSource } from "@/lib/social-draft";
import { sendReview } from "@/lib/social-review";
import { createApprovalToken } from "@/lib/social-token";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Long enough for a human to see the message in the morning, short enough that a
// leaked link goes stale before it's useful.
const APPROVAL_TTL_SECONDS = 12 * 60 * 60;

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
  // handoff — draft request delivered to Hermes; reply arrives async.
  // skipped — Hermes down (transient) or nothing to do; retry next run.
  status: "review_sent" | "handoff" | "skipped" | "failed";
  detail?: string;
}

export async function GET(request: Request): Promise<Response> {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not set — auto-post is disabled." },
      { status: 503 },
    );
  }
  if (!isAuthorizedBearer(request)) {
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
    const channels = DISTRIBUTION_CHANNELS.filter((ch) =>
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
      // A Hermes hand-off and a transient outage are not failures — only a
      // genuine error should flip the run's `ok` to false and read as broken.
      results.push({
        product: productId,
        channels,
        status: draft.handoff
          ? "handoff"
          : draft.transient
            ? "skipped"
            : "failed",
        detail: draft.error,
      });
      continue;
    }

    // One piece, one variant per channel this brand is wired for. The draft is
    // the same text everywhere for now; making the variants real rows is what
    // lets a later pass adapt them per platform without a migration.
    const piece = await db.socialPiece.create({
      data: {
        brand: productId,
        locale,
        source: draft.source,
        variants: {
          create: channels.map((channel) => ({
            channel,
            text: draft.text,
            status: "pending" as const,
          })),
        },
      },
      include: { variants: true },
    });

    // A link per variant, so a reviewer can approve Telegram and hold Facebook.
    // Each one publishes exactly once — the publish route claims the row.
    const links = piece.variants.map(
      (variant) =>
        `${variant.channel}: ${origin}/api/social/publish?token=${encodeURIComponent(
          createApprovalToken(variant.id, APPROVAL_TTL_SECONDS),
        )}`,
    );

    const review = await sendReview(
      [
        `📝 Draft for ${product.label} → ${channels.join(", ")}`,
        "",
        draft.text,
        "",
        `— drafted by ${draft.source}. Each link publishes once (expires in 12h):`,
        ...links,
      ].join("\n"),
      `social draft: ${product.label}`,
    );

    // A draft nobody can be told about is a draft nobody will approve — drop
    // the rows rather than leave them pending forever.
    if (!review.ok) {
      await db.socialPiece.delete({ where: { id: piece.id } }).catch(() => {});
    }

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
