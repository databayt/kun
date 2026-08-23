// Where drafts go for a human to say yes.
//
// Whatever relay is configured, the review destination must be a PRIVATE channel:
// the message carries a one-click publish link whose only protection is that the
// link is unguessable (see lib/social-token.ts). Slack is the org-internal
// communication channel; neither lane is ever a brand page.
//
// Order is deliberate. Slack's direct webhook comes first because it is the only
// destination reachable from a serverless function with nothing else awake —
// Hermes runs on a laptop at home, and an approval notice that waits for a lid
// to open is the failure this module exists to prevent. Measured 2026-08-23:
// with no destination configured, three finished posts sat unapproved for 23
// days because nothing could mention them. Hermes stays as a secondary for
// installs that run it.

import { sendSocialPost } from "@/lib/hermes";
import { sendSlackMessage, isSlackConfigured } from "@/lib/slack";
import { reviewChannel } from "@/lib/social-draft";

/** True when sendReview has somewhere to deliver. */
export function canSendReview(): boolean {
  return isSlackConfigured() || Boolean((process.env.HERMES_API_URL ?? "").trim());
}

export async function sendReview(
  text: string,
  title?: string,
): Promise<{ ok: boolean; via?: string; error?: string }> {
  if (isSlackConfigured()) {
    const res = await sendSlackMessage(text, title);
    if (res.ok) return { ok: true, via: "slack" };
    return { ok: false, error: `slack: ${res.error}` };
  }

  if ((process.env.HERMES_API_URL ?? "").trim()) {
    const res = await sendSocialPost({
      text,
      channels: [reviewChannel()],
      title,
      metadata: { kind: "social_review" },
    });
    if (res.ok) return { ok: true, via: `hermes:${reviewChannel()}` };
    return { ok: false, error: `hermes: ${res.error}` };
  }

  return {
    ok: false,
    error:
      "No review destination configured — set SLACK_WEBHOOK_URL (preferred; an incoming webhook on a PRIVATE channel) or HERMES_API_URL.",
  };
}
