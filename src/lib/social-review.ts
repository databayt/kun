// Where drafts go for a human to say yes.
//
// Whatever relay is configured, the review destination must be a PRIVATE channel:
// the message carries a one-click publish link whose only protection is that the
// link is unguessable (see lib/social-token.ts). Hermes/Slack first, Telegram as
// the fallback — both are org-internal, neither is a brand page.

import { sendSocialPost } from "@/lib/hermes";
import { sendTelegramPost } from "@/lib/telegram";
import { reviewChannel } from "@/lib/social-draft";

export async function sendReview(
  text: string,
  title?: string,
): Promise<{ ok: boolean; via?: string; error?: string }> {
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

  // Deliberately NOT TELEGRAM_CHANNEL_ID — that is the public brand channel, and
  // a draft carrying a one-click publish link must never land there. A private
  // chat id has to be set on purpose.
  const reviewChat = (process.env.TELEGRAM_REVIEW_CHAT_ID ?? "").trim();
  if ((process.env.TELEGRAM_BOT_TOKEN ?? "").trim() && reviewChat) {
    const res = await sendTelegramPost(text, reviewChat);
    if (res.ok) return { ok: true, via: "telegram" };
    return { ok: false, error: `telegram: ${res.error}` };
  }

  return {
    ok: false,
    error:
      "No review destination configured — set HERMES_API_URL (preferred) or TELEGRAM_BOT_TOKEN + TELEGRAM_REVIEW_CHAT_ID (a private chat, not the brand channel).",
  };
}
