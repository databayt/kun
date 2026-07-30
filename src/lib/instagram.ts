// Instagram Graph API client — direct egress for the `instagram` channel.
//
// Publishing to an Instagram professional account is a two-step Graph flow on
// the LINKED Facebook Page's token: create a media container from a public
// image URL, then publish the container. Same doctrine as every relay: this
// layer only delivers approved copy — Claude writes it, a human approves.
//
// Image-first by platform contract: there is no text-only edge. deliverPost
// refuses an Instagram post without a mediaUrl before anything is sent.
//
// Setup (one-time, per brand — see /docs/social/channels/instagram):
//   1. Link the brand's IG professional account to its Facebook Page.
//   2. Re-mint the Page token WITH instagram_basic + instagram_content_publish
//      (Graph Explorer, app "Hogwarts Social"). Whether Standard Access
//      suffices is the open hypothesis this lane is gated on — the read scopes
//      needed no App Review (proven 2026-07-27), publish may behave the same.
//   3. GET /{page-id}?fields=instagram_business_account → the IG user id, into
//      INSTAGRAM_USER_ID_<PRODUCT>. The token stays the shared per-brand
//      FACEBOOK_PAGE_ACCESS_TOKEN_<PRODUCT> — one token per brand, both
//      channels ride it.

import { getFacebookConfig } from "@/lib/facebook";

// Matches lib/facebook.ts — app 874547138717755's floor, served silently for
// anything aimed lower, so the pin states truth rather than choosing behavior.
const GRAPH_VERSION = "v25.0";

// .trim() guards against the stray trailing \n Vercel env vars can carry.
function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export interface InstagramConfig {
  igUserId: string;
  token: string;
}

export async function getInstagramConfig(
  product?: string,
): Promise<InstagramConfig> {
  const id = (product ?? "hogwarts").toUpperCase();
  const { token } = await getFacebookConfig(product);
  return { igUserId: env(`INSTAGRAM_USER_ID_${id}`), token };
}

function notConfigured(product?: string): string {
  const id = (product ?? "hogwarts").toUpperCase();
  return `INSTAGRAM_USER_ID_${id} not set (and the Page token must carry instagram_content_publish) — see /docs/social/channels/instagram`;
}

// Graph errors look like { error: { message: "..." } } — surface the message,
// never the request URL (it carries the access token as a query param).
async function instagramError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? `Instagram Graph API error ${res.status}`;
}

export async function checkInstagramHealth(product?: string): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  const { igUserId, token } = await getInstagramConfig(product);
  if (!igUserId || !token) {
    return { ok: false, error: notConfigured(product) };
  }
  try {
    // The @username is the proof the id resolves to the right account — the
    // same crossed-token guard the Facebook row gets from the Page name.
    const url = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}`,
    );
    url.searchParams.set("fields", "username");
    url.searchParams.set("access_token", token);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return { ok: false, error: await instagramError(res) };
    }
    const data = (await res.json().catch(() => null)) as {
      username?: string;
    } | null;
    return { ok: true, username: data?.username };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to reach the Instagram Graph API",
    };
  }
}

// `mediaUrl` must be a PUBLICLY reachable image URL — Graph fetches it itself
// during container creation, which is why that call gets the long timeout.
// Caption cap is 2200; the platform rejects longer and the error flows back as
// this channel's outcome rather than being pre-truncated into silent edits.
export async function sendInstagramPost(
  text: string,
  product?: string,
  mediaUrl?: string,
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const { igUserId, token } = await getInstagramConfig(product);
  if (!igUserId || !token) {
    return { ok: false, error: notConfigured(product) };
  }
  if (!mediaUrl) {
    // deliverPost refuses earlier and by name; this guard is for any future
    // caller that reaches the client directly.
    return {
      ok: false,
      error: "an image is required — Instagram has no text-only posts",
    };
  }
  try {
    const container = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: mediaUrl,
          caption: text,
          access_token: token,
        }),
        // Graph downloads the image server-side before it answers.
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!container.ok) {
      return { ok: false, error: await instagramError(container) };
    }
    const created = (await container.json().catch(() => null)) as {
      id?: string;
    } | null;
    if (!created?.id) {
      return { ok: false, error: "Instagram returned no container id" };
    }

    // Image containers are ready immediately (video would need status
    // polling — deliberately unsupported until a video lane exists at all).
    const publish = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: created.id, access_token: token }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!publish.ok) {
      return { ok: false, error: await instagramError(publish) };
    }
    // Keep the media id — without it the post cannot be found again, so it
    // cannot be retracted or have metrics attached later.
    const body = (await publish.json().catch(() => null)) as {
      id?: string;
    } | null;
    return { ok: true, externalId: body?.id };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send to Instagram",
    };
  }
}
