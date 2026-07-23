// The human gate. A cron-drafted post only reaches a public brand page when
// someone clicks the signed link from the private review channel.
//
// This route can't require a session — it's a link click from a chat client, so
// there's no cookie to trust and no way to bounce through /login without losing
// the payload. Authority comes from the HMAC in the token instead (see
// lib/social-token.ts): unguessable, short-lived, and scoped to exactly one
// (product, channels, text) triple. Every publish is logged, and the outcome is
// echoed back into the review channel so the click is never silent.

import type { ChannelId } from "@/components/root/social/config";
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

  const { p: product, c: channels, t: text } = verified.payload;

  const result = await deliverPost({
    product,
    text,
    channels: channels as ChannelId[],
  });

  // Log the decision either way — the signed link is the only audit trail this
  // flow has, so the server-side record matters.
  console.log(
    `[social/publish] ${result.ok ? "published" : "failed"} product=${product} channels=${channels.join(",")} chars=${text.length}${result.ok ? "" : ` error=${result.error}`}`,
  );

  await sendReview(
    result.ok
      ? `✅ Published to ${product} → ${channels.join(", ")}.`
      : `❌ Publish failed for ${product} → ${channels.join(", ")}: ${result.error}`,
    `social publish: ${product}`,
  );

  return result.ok
    ? page("Published", `${product} → ${channels.join(", ")}`, 200)
    : page("Publish failed", escapeHtml(result.error ?? "Unknown error."), 502);
}
