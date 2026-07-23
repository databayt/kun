"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { getContributorByEmail } from "@/components/root/context/config";
import { checkHermesHealth } from "@/lib/hermes";
import { checkTelegramHealth } from "@/lib/telegram";
import { checkFacebookHealth } from "@/lib/facebook";
import { deliverPost } from "@/lib/social-publish";
import { CHANNELS, CHANNEL_IDS } from "@/components/root/social/config";
import {
  PRODUCT_IDS,
  productChannelWired,
} from "@/components/root/social/products";

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

export interface FacebookConnectionStatus {
  connected: boolean;
  name?: string;
  error?: string;
}

// Facebook is per-brand — the health check names the Page the token resolves to,
// which is how the dashboard proves the selected product is pointed at the right
// Page before anyone hits Publish.
export async function verifyFacebookConnection(
  product?: string,
): Promise<FacebookConnectionStatus> {
  const session = await auth();
  if (!session?.user) {
    return { connected: false, error: "Unauthorized: Please sign in." };
  }

  const result = await checkFacebookHealth(product);
  return {
    connected: result.ok,
    name: result.name,
    error: result.error,
  };
}

export interface PostResult {
  ok: boolean;
  error?: string;
}

const publishSchema = z
  .object({
    product: z.enum(PRODUCT_IDS, { message: "Unknown product." }),
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
  })
  // Wired-only, per brand: the global transport existing isn't enough — this
  // product must have its own destination on that channel.
  .refine(
    ({ product, channels }) =>
      channels.every((id) =>
        productChannelWired(
          product,
          id,
          Boolean(CHANNELS.find((c) => c.id === id)?.wired),
        ),
      ),
    "A selected channel is not wired for this product yet.",
  );

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

  const { product, text, channels } = parsed.data;
  return deliverPost({ product, text, channels: [...channels] });
}
