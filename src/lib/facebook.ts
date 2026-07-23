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

export async function sendFacebookPost(
  text: string,
  product?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { pageId, token } = await getFacebookConfig(product);
  if (!token || !pageId) {
    return { ok: false, error: notConfigured(product) };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, access_token: token }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      return { ok: false, error: await facebookError(res) };
    }
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send to Facebook",
    };
  }
}
