"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { getContributorByEmail } from "@/components/root/context/config";
import { checkHermesHealth, sendSocialPost } from "@/lib/hermes";
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
      "A selected channel has no Hermes adapter wired yet.",
    ),
});

// Drafting is deliberately NOT an action here: Claude writes the copy (the
// /social skill), never the gateway's LLM — Hermes is a relay, not a brain.
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
  const result = await sendSocialPost({ text, channels });
  return { ok: result.ok, error: result.error };
}
