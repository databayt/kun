"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { requireContributor } from "@/lib/auth-guard";
import { deliverPost, type ChannelOutcome } from "@/lib/social-publish";
import { getEgressStatus, type EgressStatus } from "@/lib/social-status";
import { sendReview } from "@/lib/social-review";
import { createApprovalToken, MAX_TOKEN_TEXT } from "@/lib/social-token";
import { CHANNELS, CHANNEL_IDS } from "@/components/root/social/config";
import {
  PRODUCT_IDS,
  productChannelWired,
} from "@/components/root/social/products";

export type { EgressStatus } from "@/lib/social-status";

// One action for all three transports. Three separate actions meant three
// POSTs and three `auth()` resolutions to paint one status panel; the probes
// were already parallel server-side, so only the round trips were wasted.
export async function verifyConnections(
  product?: string,
): Promise<EgressStatus> {
  const session = await auth();
  if (!session?.user) {
    const denied = {
      connected: false,
      error: "Unauthorized: Please sign in.",
    };
    return { hermes: denied, telegram: denied, facebook: denied };
  }
  return getEgressStatus(product);
}

export interface PostResult {
  ok: boolean;
  error?: string;
  results?: ChannelOutcome[];
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
    // Platforms fetch the image themselves, so it has to be a public URL — a
    // CDN render from /higgs, not a blob or a localhost path.
    mediaUrl: z
      .string()
      .trim()
      .url("Media must be a full URL.")
      .refine(
        (value) => /^https?:\/\//i.test(value),
        "Media URL must start with http(s)://",
      )
      .optional()
      .or(z.literal("").transform(() => undefined)),
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

  const { product, text, channels, mediaUrl } = parsed.data;
  return deliverPost({ product, text, channels: [...channels], mediaUrl });
}

export interface ReviewResult {
  ok: boolean;
  /** Which relay carried the draft, e.g. "hermes:slack". */
  via?: string;
  error?: string;
}

// The other half of the human gate. The cron already drafts → review → signed
// link; this lets a contributor push their own copy down the same path instead
// of publishing straight to a brand page — useful when someone else approves.
export async function stageForReview(input: unknown): Promise<ReviewResult> {
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

  const { product, text, channels, mediaUrl } = parsed.data;

  // The approval token carries the copy inside the URL, so an over-long draft
  // would mint a link that a chat client silently truncates into a 404.
  if (text.length > MAX_TOKEN_TEXT) {
    return {
      ok: false,
      error: `Too long to stage for review (${text.length} > ${MAX_TOKEN_TEXT} chars). Shorten it, or publish directly.`,
    };
  }

  let link: string;
  try {
    const token = createApprovalToken(
      { p: product, c: [...channels], t: text, m: mediaUrl },
      12 * 60 * 60,
    );
    const configured = (process.env.SOCIAL_PUBLIC_URL ?? "").trim();
    const origin = configured
      ? configured.replace(/\/$/, "")
      : `https://${(await headers()).get("host")}`;
    link = `${origin}/api/social/publish?token=${encodeURIComponent(token)}`;
  } catch (err: unknown) {
    // createApprovalToken throws when CRON_SECRET is unset — an unsigned link
    // would be a publish endpoint anyone could forge.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not sign the link.",
    };
  }

  // The media URL is signed into the token (so approving publishes the image,
  // not just the caption) and repeated in the message so the reviewer can see
  // what they're about to approve.
  return sendReview(
    [
      `📝 Draft for ${product} → ${channels.join(", ")}`,
      "",
      text,
      ...(mediaUrl ? ["", `Media: ${mediaUrl}`] : []),
      "",
      "— staged from /social. Publish (expires in 12h):",
      link,
    ].join("\n"),
    `social draft: ${product}`,
  );
}
