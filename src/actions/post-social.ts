"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { getContributorByEmail } from "@/components/root/context/config";
import { checkHermesHealth, sendSocialPost } from "@/lib/hermes";
import { checkTelegramHealth, sendTelegramPost } from "@/lib/telegram";
import { CHANNELS, CHANNEL_IDS } from "@/components/root/social/config";

// Authorization: session presence isn't enough — JWT sessions outlive removal
// from the contributors allowlist, so every mutating action re-resolves the
// email against the contributors config at call time.
async function requireContributor(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return false;
  return Boolean(getContributorByEmail(email));
}

export interface HermesConnectionStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

export async function verifyHermesConnection(): Promise<HermesConnectionStatus> {
  const session = await auth();
  if (!session?.user) {
    return { connected: false, error: "Unauthorized: Please sign in." };
  }

  const result = await checkHermesHealth();
  return {
    connected: result.ok,
    version: result.version,
    error: result.error,
  };
}

export interface TelegramConnectionStatus {
  connected: boolean;
  username?: string;
  error?: string;
}

export async function verifyTelegramConnection(): Promise<TelegramConnectionStatus> {
  const session = await auth();
  if (!session?.user) {
    return { connected: false, error: "Unauthorized: Please sign in." };
  }

  const result = await checkTelegramHealth();
  return {
    connected: result.ok,
    username: result.username,
    error: result.error,
  };
}

export interface PostResult {
  ok: boolean;
  error?: string;
}

const publishSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Post content cannot be empty.")
    .max(4000, "Post is too long (max 4000 characters)."),
  channels: z
    .array(z.enum(CHANNEL_IDS))
    .min(1, "Select at least one channel.")
    .refine(
      (ids) => ids.every((id) => CHANNELS.find((c) => c.id === id)?.wired),
      "A selected channel is not wired yet.",
    ),
});

// Drafting is deliberately NOT an action here: Claude writes the copy (the
// /social skill), never an egress-layer LLM — the relays below only deliver.
export async function publishPostDirect(input: unknown): Promise<PostResult> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { text, channels } = parsed.data;

  // Route per transport: telegram goes straight to the Bot API, everything
  // else relays through the Hermes gateway in one webhook call.
  const hermesChannels = channels.filter(
    (id) => CHANNELS.find((c) => c.id === id)?.transport === "hermes",
  );
  const wantsTelegram = channels.some(
    (id) => CHANNELS.find((c) => c.id === id)?.transport === "telegram",
  );

  const failures: string[] = [];

  if (wantsTelegram) {
    const res = await sendTelegramPost(text);
    if (!res.ok) failures.push(`telegram: ${res.error}`);
  }

  if (hermesChannels.length > 0) {
    const res = await sendSocialPost({ text, channels: hermesChannels });
    if (!res.ok) failures.push(`${hermesChannels.join(", ")}: ${res.error}`);
  }

  if (failures.length > 0) {
    return { ok: false, error: failures.join(" · ") };
  }
  return { ok: true };
}
