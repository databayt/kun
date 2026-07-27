// Facebook Graph API client — direct egress for the `facebook` channel.
// Posting to a Page you administer is a plain HTTPS call with a long-lived Page
// access token, so the site relays to it directly (like Telegram) instead of
// hopping through the Hermes gateway. Doctrine unchanged: this layer only relays
// approved copy — Claude writes it (the /social skill), a human approves.
//
// Setup (one-time, Abdout): create the Facebook Page; create a Meta **Business**
// app (a Consumer app can never request Pages permissions); grant
// pages_manage_posts + pages_read_engagement + pages_show_list; exchange for a
// permanent Page access token (expires_at: 0). See the checklist in
// docs/SOCIAL-AUTOMATION.md.
//
// Per-product: every brand has its own Page, so config resolves from
// FACEBOOK_PAGE_ID_<PRODUCT> / FACEBOOK_PAGE_ACCESS_TOKEN_<PRODUCT> (product id
// uppercased — HOGWARTS, MKAN, DATABAYT). The legacy unsuffixed pair is the
// hogwarts fallback, kept so an env that predates the split still posts.

const GRAPH_VERSION = "v21.0";

export interface FacebookConfig {
  pageId: string;
  token: string;
}

// .trim() guards against the stray trailing \n Vercel env vars can carry.
function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export async function getFacebookConfig(
  product?: string,
): Promise<FacebookConfig> {
  const id = (product ?? "hogwarts").toUpperCase();
  // The legacy unsuffixed vars are hogwarts's — only that product falls back.
  const legacy = id === "HOGWARTS";
  return {
    pageId:
      env(`FACEBOOK_PAGE_ID_${id}`) || (legacy ? env("FACEBOOK_PAGE_ID") : ""),
    token:
      env(`FACEBOOK_PAGE_ACCESS_TOKEN_${id}`) ||
      (legacy ? env("FACEBOOK_PAGE_ACCESS_TOKEN") : ""),
  };
}

function notConfigured(product?: string): string {
  const id = (product ?? "hogwarts").toUpperCase();
  return `FACEBOOK_PAGE_ID_${id} / FACEBOOK_PAGE_ACCESS_TOKEN_${id} not set — see /docs/social`;
}

// Graph errors look like { error: { message: "..." } } — surface the message,
// never the request URL (it carries the access token as a query param).
async function facebookError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? `Facebook Graph API error ${res.status}`;
}

export async function checkFacebookHealth(product?: string): Promise<{
  ok: boolean;
  name?: string;
  error?: string;
}> {
  const { pageId, token } = await getFacebookConfig(product);
  if (!token || !pageId) {
    return { ok: false, error: notConfigured(product) };
  }
  try {
    const url = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}`,
    );
    url.searchParams.set("fields", "name");
    url.searchParams.set("access_token", token);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return { ok: false, error: await facebookError(res) };
    }
    const data = (await res.json().catch(() => null)) as {
      name?: string;
    } | null;
    return { ok: true, name: data?.name };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to reach the Facebook Graph API",
    };
  }
}

// `mediaUrl` must be a PUBLICLY reachable image URL — Graph fetches it itself
// (that's why /higgs output lands on the CDN before it gets here). A photo post
// is a different edge with different field names: /photos takes `url` +
// `caption`, /feed takes `message`. Posting the caption to /feed and the image
// separately would produce two posts, so it's one call either way.
export async function sendFacebookPost(
  text: string,
  product?: string,
  mediaUrl?: string,
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const { pageId, token } = await getFacebookConfig(product);
  if (!token || !pageId) {
    return { ok: false, error: notConfigured(product) };
  }
  const edge = mediaUrl ? "photos" : "feed";
  const payload = mediaUrl
    ? { url: mediaUrl, caption: text, access_token: token }
    : { message: text, access_token: token };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/${edge}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Graph downloads the image server-side before it answers, so a photo
        // post legitimately takes longer than a text one.
        signal: AbortSignal.timeout(mediaUrl ? 25000 : 10000),
      },
    );
    if (!res.ok) {
      return { ok: false, error: await facebookError(res) };
    }
    // Keep the id. Without it a published post cannot be found again, so it
    // cannot be deleted or have metrics attached — /photos answers with both a
    // photo `id` and the feed `post_id`, and the feed one is what addresses
    // the actual post.
    const body = (await res.json().catch(() => null)) as {
      id?: string;
      post_id?: string;
    } | null;
    return { ok: true, externalId: body?.post_id ?? body?.id };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send to Facebook",
    };
  }
}

/** Retract a published post. `externalId` is what sendFacebookPost returned. */
export async function deleteFacebookPost(
  externalId: string,
  product?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { token } = await getFacebookConfig(product);
  if (!token) return { ok: false, error: notConfigured(product) };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${externalId}`,
      { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
        signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return { ok: false, error: await facebookError(res) };
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete the post",
    };
  }
}
