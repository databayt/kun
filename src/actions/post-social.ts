"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { requireContributor } from "@/lib/auth-guard";
import { deliverPost, type ChannelOutcome } from "@/lib/social-publish";
import { getEgressStatus, type EgressStatus } from "@/lib/social-status";
import { sendReview } from "@/lib/social-review";
import { createApprovalToken } from "@/lib/social-token";
import { db } from "@/lib/db";
import { CHANNELS, CHANNEL_IDS } from "@/components/root/social/config";
import {
  PRODUCT_IDS,
  productChannelWired,
} from "@/components/root/social/products";

// Long enough for a human to see it in the morning, short enough that a
// leaked link goes stale before it is useful. Matches the cron.
const APPROVAL_TTL_SECONDS = 12 * 60 * 60;

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
    // ISO string from the composer's datetime input. Optional — absent means
    // publish or stage now.
    scheduledFor: z
      .string()
      .trim()
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

export interface ScheduleResult {
  ok: boolean;
  /** How many channel variants were queued. */
  count?: number;
  /** When they will publish, ISO. */
  at?: string;
  error?: string;
}

// The producer the drain has been waiting for. Writes variants straight to
// `scheduled` — no approval link, because scheduling IS the approval: a
// contributor picked the copy, the channels, and the moment.
export async function schedulePost(input: unknown): Promise<ScheduleResult> {
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

  const { product, text, channels, mediaUrl, scheduledFor } = parsed.data;
  if (!scheduledFor) {
    return { ok: false, error: "Pick a date and time first." };
  }

  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: "That date could not be read." };
  }
  // A minute of slack: the drain runs on a ~15 minute cadence, and a time
  // already in the past would publish on the very next run, which is not what
  // anyone picking a time means.
  if (when.getTime() < Date.now() - 60_000) {
    return { ok: false, error: "That time is in the past." };
  }

  try {
    const piece = await db.socialPiece.create({
      data: {
        brand: product,
        source: "human",
        aiGenerated: Boolean(mediaUrl),
        variants: {
          create: channels.map((channel) => ({
            channel,
            text,
            mediaUrl,
            status: "scheduled" as const,
            scheduledFor: when,
          })),
        },
      },
      include: { variants: true },
    });
    return { ok: true, count: piece.variants.length, at: when.toISOString() };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not schedule the post.",
    };
  }
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

  // One piece, one variant per selected channel. Each gets its own approval
  // link so a reviewer can take Telegram and hold Facebook — previously a
  // single token covered the whole fan-out, so it was all or nothing.
  let piece;
  try {
    piece = await db.socialPiece.create({
      data: {
        brand: product,
        source: "human",
        aiGenerated: Boolean(mediaUrl),
        variants: {
          create: channels.map((channel) => ({
            channel,
            text,
            mediaUrl,
            status: "pending" as const,
          })),
        },
      },
      include: { variants: true },
    });
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not stage the draft.",
    };
  }

  let links: string[];
  try {
    const configured = (process.env.SOCIAL_PUBLIC_URL ?? "").trim();
    const origin = configured
      ? configured.replace(/\/$/, "")
      : `https://${(await headers()).get("host")}`;
    links = piece.variants.map((variant) => {
      const token = createApprovalToken(variant.id, APPROVAL_TTL_SECONDS);
      return `${variant.channel}: ${origin}/api/social/publish?token=${encodeURIComponent(token)}`;
    });
  } catch (err: unknown) {
    // createApprovalToken throws when CRON_SECRET is unset — an unsigned link
    // would be a publish endpoint anyone could forge. Drop the staged rows
    // rather than leave drafts nobody can ever approve.
    await db.socialPiece.delete({ where: { id: piece.id } }).catch(() => {});
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not sign the link.",
    };
  }

  // Each link publishes exactly one channel, exactly once.
  return sendReview(
    [
      `📝 Draft for ${product} → ${channels.join(", ")}`,
      "",
      text,
      ...(mediaUrl ? ["", `Media: ${mediaUrl}`] : []),
      "",
      "— staged from /social. Each link publishes once (expires in 12h):",
      ...links,
    ].join("\n"),
    `social draft: ${product}`,
  );
}
