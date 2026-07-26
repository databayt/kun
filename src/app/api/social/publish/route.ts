// The human gate. A cron-drafted post only reaches a public brand page when
// someone clicks the signed link from the private review channel.
//
// This route cannot require a session — it is a link click from a chat client,
// so there is no cookie to trust and no way to bounce through /login without
// losing the payload. Authority comes from the HMAC in the token instead (see
// lib/social-token.ts).
//
// The token names a variant rather than carrying the copy, which is what makes
// the link SINGLE USE: publishing is a conditional status transition, so a
// second click finds the row no longer `pending` and refuses. Two people
// clicking the same link at the same moment race on one UPDATE and exactly one
// wins. Before persistence this was replayable by design and posting twice was
// a real outcome.

import type { ChannelId } from "@/components/root/social/config";
import { db } from "@/lib/db";
import { deliverPost } from "@/lib/social-publish";
import { sendReview } from "@/lib/social-review";
import { verifyApprovalToken } from "@/lib/social-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, status: number): Response {
  // A bare page, not an app route: this is opened from a chat client, often on a
  // phone, and it exists only to report what happened.
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 ui-sans-serif, system-ui, sans-serif; margin: 0;
         display: grid; place-items: center; min-height: 100dvh; padding: 2rem; }
  main { max-width: 42ch; }
  h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
  p { margin: 0; opacity: .75; white-space: pre-wrap; }
</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return page("Missing token", "This link is incomplete.", 400);
  }

  const verified = verifyApprovalToken(token);
  if (!verified.ok) {
    console.warn("[social/publish] rejected approval link:", verified.error);
    return page("Link rejected", escapeHtml(verified.error), 403);
  }

  const variantId = verified.payload.v;
  const variant = await db.socialVariant.findUnique({
    where: { id: variantId },
    include: { piece: true },
  });
  if (!variant) {
    return page("Not found", "This draft no longer exists.", 404);
  }

  // The claim. `status: "pending"` in the WHERE is the whole guarantee — a
  // second click, or a concurrent one, matches zero rows and stops here.
  const claimed = await db.socialVariant.updateMany({
    where: { id: variantId, status: "pending" },
    data: { status: "publishing", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    console.log(
      `[social/publish] refused replay variant=${variantId} status=${variant.status}`,
    );
    return page(
      "Already handled",
      `This draft is "${variant.status}" — a link publishes once.`,
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
    ? page("Published", `${variant.piece.brand} → ${variant.channel}`, 200)
    : page("Publish failed", escapeHtml(result.error ?? "Unknown error."), 502);
}
