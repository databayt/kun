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
  error?: string;
}> {
  const { token } = await getTelegramConfig();
  if (!token) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN not set — see /docs/social",
    };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { ok: false, error: await telegramError(res) };
    }
    const data = (await res.json().catch(() => null)) as {
      result?: { username?: string };
    } | null;
    return { ok: true, username: data?.result?.username };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to reach the Telegram API",
    };
  }
}

// `chatIdOverride` exists so internal traffic (draft reviews carrying a publish
// link) can be addressed to a private chat instead of TELEGRAM_CHANNEL_ID, which
// is the public brand channel. Callers must pass it deliberately — the default
// stays the brand channel.
export async function sendTelegramPost(
  text: string,
  chatIdOverride?: string,
): Promise<{ ok: boolean; error?: string }> {
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
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Plain text on purpose: parse_mode entities break on arbitrary copy.
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      return { ok: false, error: await telegramError(res) };
    }
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send to Telegram",
    };
  }
}
