// Slack incoming-webhook client — the scripts-side mirror of src/lib/slack.ts.
//
// Why a mirror and not an import: the launchd scripts are plain .mjs and cannot
// load the TypeScript lib. Same shape, same names, same honesty rules as the
// original — see src/lib/slack.ts for the full reasoning, in particular why the
// channel MUST be private (review messages carry one-click publish links whose
// only protection is that they are unguessable).
//
// Kept deliberately small so drift is obvious: three exports, no dependencies.

/** A webhook URL is itself the credential — never log or echo it. */
export function getSlackWebhook() {
  // .trim() guards against the stray trailing \n Vercel env vars can carry.
  return (process.env.SLACK_WEBHOOK_URL ?? "").trim();
}

export function isSlackConfigured() {
  return getSlackWebhook().length > 0;
}

/**
 * Post text to the configured review channel.
 *
 * Slack answers a webhook with the literal body "ok" on success and a plain
 * string like "invalid_token" / "channel_not_found" on failure — not JSON, so
 * the body is read as text and surfaced verbatim. The URL is never included in
 * an error message: it embeds the secret.
 */
export async function sendSlackMessage(text, title) {
  const url = getSlackWebhook();
  if (!url) {
    return {
      ok: false,
      error:
        "SLACK_WEBHOOK_URL not set — create an incoming webhook on a PRIVATE channel (api.slack.com/apps → Incoming Webhooks).",
    };
  }

  const body = title ? `*${title}*\n${text}` : text;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: body }),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return {
        ok: false,
        error: `Slack webhook ${res.status}${detail ? `: ${detail}` : ""}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Slack webhook unreachable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
