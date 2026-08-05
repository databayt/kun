// Telegram Bot API client — direct egress for the `telegram` channel.
// Telegram is the one platform whose official posting API is a plain HTTPS
// call (free, instant), so the site relays to it directly instead of hopping
// through the Hermes gateway. Doctrine unchanged: this layer only relays
// approved copy — Claude writes it (the /social skill).
//
// Setup (one-time, Abdout): @BotFather → bot token; create the brand channel;
// add the bot as channel admin; set TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID.

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  // .trim() guards against the stray trailing \n Vercel env vars can carry.
  return {
    token: (process.env.TELEGRAM_BOT_TOKEN ?? "").trim(),
    chatId: (process.env.TELEGRAM_CHANNEL_ID ?? "").trim(),
  };
}

// Telegram error bodies look like { ok: false, description: "..." } — surface
// the description, never the request URL (it embeds the bot token).
async function telegramError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    description?: string;
  } | null;
  return body?.description ?? `Telegram API error ${res.status}`;
}

export async function checkTelegramHealth(): Promise<{
  ok: boolean;
  username?: string;
  chatTitle?: string;
  error?: string;
}> {
  const { token, chatId } = await getTelegramConfig();
  if (!token) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN not set — see /docs/social",
    };
  }
  // A bot with nowhere to post is not a working transport. Same treatment as
  // Facebook's missing per-brand env: not-configured — the dashboard's green
  // dot must vouch for the destination, not just the credential.
  if (!chatId) {
    return {
      ok: false,
      error: "TELEGRAM_CHANNEL_ID not set — see /docs/social",
    };
  }
  try {
    const [me, chat] = await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(3000),
      }),
      fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,
        { signal: AbortSignal.timeout(3000) },
      ),
    ]);
    if (!me.ok) {
      return { ok: false, error: await telegramError(me) };
    }
    if (!chat.ok) {
      return { ok: false, error: `channel: ${await telegramError(chat)}` };
    }
    const meData = (await me.json().catch(() => null)) as {
      result?: { username?: string };
    } | null;
    const chatData = (await chat.json().catch(() => null)) as {
      result?: { title?: string };
    } | null;
    return {
      ok: true,
      username: meData?.result?.username,
      chatTitle: chatData?.result?.title,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to reach the Telegram API",
    };
  }
}

// Telegram caps a photo caption at 1024 chars while a plain message allows 4096.
// Rather than truncate someone's approved copy, an over-long caption is sent as
// a follow-up message under an uncaptioned photo — nothing is lost either way.
const MAX_CAPTION = 1024;

async function callTelegram(
  token: string,
  method: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    return { ok: false, error: await telegramError(res) };
  }
  // Deleting a Telegram message needs the chat AND the message id, so the
  // identifier has to carry both — a bare message_id addresses nothing.
  const body_ = (await res.json().catch(() => null)) as {
    result?: { message_id?: number; chat?: { id?: number | string } };
  } | null;
  const messageId = body_?.result?.message_id;
  const chatId = body_?.result?.chat?.id;
  return {
    ok: true,
    externalId:
      messageId !== undefined && chatId !== undefined
        ? `${chatId}:${messageId}`
        : undefined,
  };
}

// `chatIdOverride` exists so internal traffic (draft reviews carrying a publish
// link) can be addressed to a private chat instead of TELEGRAM_CHANNEL_ID, which
// is the public brand channel. Callers must pass it deliberately — the default
// stays the brand channel.
//
// `mediaUrl` must be publicly reachable — Telegram fetches the image itself.
export async function sendTelegramPost(
  text: string,
  chatIdOverride?: string,
  mediaUrl?: string,
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const config = await getTelegramConfig();
  const token = config.token;
  const chatId = (chatIdOverride ?? config.chatId).trim();
  if (!token) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN not set — see /docs/social",
    };
  }
  if (!chatId) {
    return {
      ok: false,
      error: "TELEGRAM_CHANNEL_ID not set — see /docs/social",
    };
  }
  try {
    if (mediaUrl) {
      const captionFits = text.length <= MAX_CAPTION;
      // Telegram is strict about ordering — the photo has to land before the
      // spill-over text or the channel reads backwards.
      const photo = await callTelegram(
        token,
        "sendPhoto",
        {
          chat_id: chatId,
          photo: mediaUrl,
          ...(captionFits ? { caption: text } : {}),
        },
        25000,
      );
      if (!photo.ok || captionFits) return photo;
      // Caption spilled into a follow-up message. The photo is the post, so its
      // id is the one worth keeping.
      const spill = await callTelegram(
        token,
        "sendMessage",
        { chat_id: chatId, text },
        10000,
      );
      return spill.ok ? { ...spill, externalId: photo.externalId } : spill;
    }
    // Plain text on purpose: parse_mode entities break on arbitrary copy.
    return await callTelegram(
      token,
      "sendMessage",
      { chat_id: chatId, text },
      10000,
    );
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send to Telegram",
    };
  }
}

// Album (2–10 photos) via sendMediaGroup. The caption rides the FIRST item —
// that is where Telegram renders an album's caption — with the same spill-over
// rule as a single photo: over-long copy follows as a plain message so nothing
// approved is ever truncated. Media are attached in array order.
export async function sendTelegramAlbum(
  text: string,
  mediaUrls: string[],
  chatIdOverride?: string,
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const config = await getTelegramConfig();
  const token = config.token;
  const chatId = (chatIdOverride ?? config.chatId).trim();
  if (!token) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN not set — see /docs/social",
    };
  }
  if (!chatId) {
    return {
      ok: false,
      error: "TELEGRAM_CHANNEL_ID not set — see /docs/social",
    };
  }
  if (mediaUrls.length < 2 || mediaUrls.length > 10) {
    return {
      ok: false,
      error: `An album takes 2–10 photos (got ${mediaUrls.length}).`,
    };
  }
  try {
    const captionFits = text.length <= MAX_CAPTION;
    const album = await callTelegram(
      token,
      "sendMediaGroup",
      {
        chat_id: chatId,
        media: mediaUrls.map((url, i) => ({
          type: "photo",
          media: url,
          ...(i === 0 && captionFits ? { caption: text } : {}),
        })),
      },
      // Telegram fetches every URL server-side before answering.
      25000,
    );
    if (!album.ok || captionFits) return album;
    const spill = await callTelegram(
      token,
      "sendMessage",
      { chat_id: chatId, text },
      10000,
    );
    return spill.ok ? { ...spill, externalId: album.externalId } : spill;
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send the album",
    };
  }
}

// Single video via sendVideo — same caption/spill-over contract as a photo.
// `videoUrl` must be publicly reachable; Telegram downloads it itself.
export async function sendTelegramVideo(
  text: string,
  videoUrl: string,
  chatIdOverride?: string,
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const config = await getTelegramConfig();
  const token = config.token;
  const chatId = (chatIdOverride ?? config.chatId).trim();
  if (!token) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN not set — see /docs/social",
    };
  }
  if (!chatId) {
    return {
      ok: false,
      error: "TELEGRAM_CHANNEL_ID not set — see /docs/social",
    };
  }
  try {
    const captionFits = text.length <= MAX_CAPTION;
    const video = await callTelegram(
      token,
      "sendVideo",
      {
        chat_id: chatId,
        video: videoUrl,
        ...(captionFits ? { caption: text } : {}),
      },
      // A video download is the slowest fetch Telegram does on our behalf.
      25000,
    );
    if (!video.ok || captionFits) return video;
    const spill = await callTelegram(
      token,
      "sendMessage",
      { chat_id: chatId, text },
      10000,
    );
    return spill.ok ? { ...spill, externalId: video.externalId } : spill;
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send the video",
    };
  }
}
