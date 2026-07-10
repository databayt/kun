// Hermes gateway client — the social-egress relay (see /docs/hermes).
// Hermes is a relay, not a brain: Claude writes the copy, Hermes reaches the
// platform. Endpoint comes from HERMES_API_URL; no default is invented — an
// unconfigured machine reports "not configured" instead of probing a fiction.

export interface HermesConfig {
  url: string;
  token?: string;
}

export async function getHermesConfig(): Promise<HermesConfig> {
  // .trim() guards against the stray trailing \n Vercel env vars can carry.
  const url = (process.env.HERMES_API_URL ?? "").trim();
  const token = process.env.HERMES_API_KEY?.trim() || undefined;
  // Strip trailing slash if present
  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

export async function checkHermesHealth(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  const { url, token } = await getHermesConfig();
  if (!url) {
    return { ok: false, error: "HERMES_API_URL not set — see /docs/hermes" };
  }
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${url}/health`, {
      headers,
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP Error ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return {
      ok: true,
      version: data.version || "unknown",
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to connect to Hermes gateway",
    };
  }
}

export interface PostPayload {
  text: string;
  channels: string[];
  title?: string;
  metadata?: Record<string, unknown>;
}

export async function sendSocialPost(
  payload: PostPayload,
): Promise<{ ok: boolean; error?: string }> {
  const { url, token } = await getHermesConfig();
  if (!url) {
    return { ok: false, error: "HERMES_API_URL not set — see /docs/hermes" };
  }
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${url}/webhook`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "social_post",
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Hermes gateway responded with ${res.status}: ${await res.text().catch(() => "Unknown error")}`,
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to send post to Hermes gateway",
    };
  }
}
