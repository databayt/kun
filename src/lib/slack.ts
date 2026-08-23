// Slack incoming-webhook client — direct egress for the review lane.
//
// Slack is the engine's ONE communication channel (see social/config.ts): the
// internal surface where approvals and alarms land. It is never reach and never
// a publish target.
//
// Why a webhook and not the Hermes gateway. Slack's registry entry used to
// declare `transport: "hermes"`, which meant every approval notice depended on
// a gateway running on a laptop at home. That is the wrong shape for this
// particular message: the review notice and the token alarm are exactly the
// things that must arrive when nobody is watching, and a destination that
// sleeps when the lid closes cannot carry them. Measured on 2026-08-23: with no
// review destination configured at all, three finished posts sat unapproved for
// 23 days because nothing was capable of mentioning them. A webhook is one URL
// and one POST, reachable from a serverless function, with no token refresh and
// no scope grants to drift.
//
// Setup (one-time): api.slack.com/apps → your app → Incoming Webhooks → Add New
// Webhook to Workspace → pick a PRIVATE channel → copy the URL into
// SLACK_WEBHOOK_URL.
//
// The channel MUST be private. A review message carries a one-click publish
// link whose only protection is that the link is unguessable
// (lib/social-token.ts). Posting that into a public channel hands anyone who
// can read it the ability to publish to a brand page.

/** A webhook URL is itself the credential — never log or echo it. */
export function getSlackWebhook(): string {
  // .trim() guards against the stray trailing \n Vercel env vars can carry.
  return (process.env.SLACK_WEBHOOK_URL ?? "").trim();
}

export function isSlackConfigured(): boolean {
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
export async function sendSlackMessage(
  text: string,
  title?: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = getSlackWebhook();
  if (!url) {
    return {
      ok: false,
      error:
        "SLACK_WEBHOOK_URL not set — create an incoming webhook on a PRIVATE channel (api.slack.com/apps → Incoming Webhooks).",
    };
  }

  // Slack renders `text` as mrkdwn. A bare title line reads better than a
  // blocks payload here and cannot fail schema validation.
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
