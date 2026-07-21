// Facebook Graph API client — direct egress for the `facebook` channel.
// Posting to a Page you administer is a plain HTTPS call with a long-lived Page
// access token, so the site relays to it directly (like Telegram) instead of
// hopping through the Hermes gateway. Doctrine unchanged: this layer only relays
// approved copy — Claude writes it (the /social skill), a human approves.
//
// Setup (one-time, Abdout): create the Facebook Page; create a Meta app (dev
// mode is enough to post to a Page you admin — no App Review); generate a
// long-lived Page access token; set FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN.
// See the manual checklist in twenty-deploy/SOCIAL-SETUP.md.

const GRAPH_VERSION = "v21.0";

export interface FacebookConfig {
  pageId: string;
  token: string;
}

export async function getFacebookConfig(): Promise<FacebookConfig> {
  // .trim() guards against the stray trailing \n Vercel env vars can carry.
  return {
    pageId: (process.env.FACEBOOK_PAGE_ID ?? "").trim(),
    token: (process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "").trim(),
  };
}

// Graph errors look like { error: { message: "..." } } — surface the message,
// never the request URL (it carries the access token as a query param).
async function facebookError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? `Facebook Graph API error ${res.status}`;
}

export async function checkFacebookHealth(): Promise<{
  ok: boolean;
  name?: string;
  error?: string;
}> {
  const { pageId, token } = await getFacebookConfig();
  if (!token || !pageId) {
    return {
      ok: false,
      error: "FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN not set — see /docs/social",
    };
  }
  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}`);
    url.searchParams.set("fields", "name");
    url.searchParams.set("access_token", token);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return { ok: false, error: await facebookError(res) };
    }
    const data = (await res.json().catch(() => null)) as { name?: string } | null;
    return { ok: true, name: data?.name };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reach the Facebook Graph API",
    };
  }
}

export async function sendFacebookPost(
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const { pageId, token } = await getFacebookConfig();
  if (!token || !pageId) {
    return {
      ok: false,
      error: "FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN not set — see /docs/social",
    };
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
