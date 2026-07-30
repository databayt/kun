// The human gate. A cron-drafted post only reaches a public brand page when
// someone opens the signed link from the private review channel AND presses
// the button.
//
// GET is read-only by design. The link is delivered into chat clients, and
// chat clients unfurl links with GET (sometimes HEAD) — so a preview crawler
// must never be able to consume the approval. The page a GET returns is
// byte-identical whatever the variant's status; consumption state is only
// revealed to a POST, which no unfurler sends.
//
// This route cannot require a session — it is a link click from a chat client,
// so there is no cookie to trust and no way to bounce through /login without
// losing the payload. Authority comes from the HMAC in the token instead (see
// lib/social-token.ts). That is also why a cross-site POST is not a CSRF
// surface: there is no ambient credential to ride — posting needs the token,
// and token possession was always the trust model.
//
// The token names a variant rather than carrying the copy, which is what makes
// approval SINGLE USE: deciding is a conditional status transition, so a
// second press finds the row no longer `pending` and refuses. Two people
// pressing at the same moment race on one UPDATE and exactly one wins.

import type { ChannelId } from "@/components/root/social/config";
import { db } from "@/lib/db";
import { confirmationPage, page } from "@/lib/social-approval-page";
import { deliverPost } from "@/lib/social-publish";
import { sendReview } from "@/lib/social-review";
import { verifyApprovalToken } from "@/lib/social-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// See the drain route for why 60 is the pin on every social route.
export const maxDuration = 60;

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Unfurl bots often probe HEAD first. Answer empty and cheap — without this,
// Next would synthesize HEAD from GET and pay the token verify + DB read.
export function HEAD(): Response {
  return new Response(null, { status: 200 });
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return html(page("Missing token", "This link is incomplete."), 400);
  }

  const verified = verifyApprovalToken(token);
  if (!verified.ok) {
    console.warn("[social/publish] rejected approval link:", verified.error);
    return html(page("Link rejected", verified.error), 403);
  }

  const variant = await db.socialVariant.findUnique({
    where: { id: verified.payload.v },
    include: { piece: true },
  });
  if (!variant) {
    return html(page("Not found", "This draft no longer exists."), 404);
  }

  return html(
    confirmationPage({
      brand: variant.piece.brand,
      channel: variant.channel,
      text: variant.text,
      mediaUrl: variant.mediaUrl,
      expiresAt: `${new Date(verified.payload.e * 1000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 16)} UTC`,
      token,
      postPath: "/api/social/publish",
    }),
    200,
  );
}

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return html(
      page("Bad request", "This endpoint expects a form submission."),
      400,
    );
  }

  const token = String(form.get("token") ?? "");
  const action = String(form.get("action") ?? "");
  if (!token) {
    return html(page("Missing token", "This link is incomplete."), 400);
  }
  if (action !== "approve" && action !== "reject") {
    return html(page("Bad request", "Unknown action."), 400);
  }

  const verified = verifyApprovalToken(token);
  if (!verified.ok) {
    console.warn("[social/publish] rejected approval form:", verified.error);
    return html(page("Link rejected", verified.error), 403);
  }

  const variantId = verified.payload.v;
  const variant = await db.socialVariant.findUnique({
    where: { id: variantId },
    include: { piece: true },
  });
  if (!variant) {
    return html(page("Not found", "This draft no longer exists."), 404);
  }

  if (action === "reject") {
    // Same conditional-transition guarantee as approval, no attempts spent.
    const rejected = await db.socialVariant.updateMany({
      where: { id: variantId, status: "pending" },
      data: { status: "rejected", result: "rejected via approval link" },
    });
    if (rejected.count === 0) {
      return html(
        page(
          "Already handled",
          `This draft is "${variant.status}" — a link decides once.`,
        ),
        409,
      );
    }
    console.log(
      `[social/publish] rejected variant=${variantId} brand=${variant.piece.brand} channel=${variant.channel}`,
    );
    await sendReview(
      `🚫 Rejected ${variant.piece.brand} → ${variant.channel}.`,
      `social publish: ${variant.piece.brand}`,
    );
    return html(page("Rejected", "Nothing was published."), 200);
  }

  // The claim. `status: "pending"` in the WHERE is the whole guarantee — a
  // second press, or a concurrent one, matches zero rows and stops here.
  const claimed = await db.socialVariant.updateMany({
    where: { id: variantId, status: "pending" },
    data: { status: "publishing", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    console.log(
      `[social/publish] refused replay variant=${variantId} status=${variant.status}`,
    );
    return html(
      page(
        "Already handled",
        `This draft is "${variant.status}" — a link publishes once.`,
      ),
      409,
    );
  }

  const result = await deliverPost({
    product: variant.piece.brand,
    text: variant.text,
    channels: [variant.channel as ChannelId],
    mediaUrl: variant.mediaUrl ?? undefined,
  });

  await db.socialVariant.update({
    where: { id: variantId },
    data: {
      status: result.ok ? "published" : "failed",
      publishedAt: result.ok ? new Date() : null,
      result: result.ok ? "ok" : (result.error ?? "unknown error"),
      externalId: result.results[0]?.externalId,
    },
  });

  // Log the decision either way — with the row now carrying the outcome, this
  // is the operator-facing trail rather than the only one.
  console.log(
    `[social/publish] ${result.ok ? "published" : "failed"} variant=${variantId} brand=${variant.piece.brand} channel=${variant.channel} chars=${variant.text.length}${result.ok ? "" : ` error=${result.error}`}`,
  );

  await sendReview(
    result.ok
      ? `✅ Published ${variant.piece.brand} → ${variant.channel}.`
      : `❌ Publish failed for ${variant.piece.brand} → ${variant.channel}: ${result.error}`,
    `social publish: ${variant.piece.brand}`,
  );

  return result.ok
    ? html(
        page("Published", `${variant.piece.brand} → ${variant.channel}`),
        200,
      )
    : html(page("Publish failed", result.error ?? "Unknown error."), 502);
}
