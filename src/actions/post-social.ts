"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { requireContributor } from "@/lib/auth-guard";
import { detectSocialLocale } from "@/lib/social-locale";
import { deliverPost, type ChannelOutcome } from "@/lib/social-publish";
import { getEgressStatus, type EgressStatus } from "@/lib/social-status";
import { sendReview } from "@/lib/social-review";
import { createApprovalToken } from "@/lib/social-token";
import { db } from "@/lib/db";
import {
  CHANNELS,
  DISTRIBUTION_CHANNEL_IDS,
} from "@/components/root/social/config";
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
    return {
      hermes: denied,
      telegram: denied,
      facebook: denied,
      instagram: denied,
    };
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
    // Distribution channels only. Slack is the communication channel — it
    // receives approvals and notices via sendReview, and is never addressed
    // as an audience, so it is rejected here at the write gate.
    channels: z
      .array(z.enum(DISTRIBUTION_CHANNEL_IDS))
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

const draftCopySchema = z.object({
  product: z.enum(PRODUCT_IDS, { message: "Unknown product." }),
  brief: z
    .string()
    .trim()
    .min(3, "Say a little more about the post.")
    .max(2000, "Brief is too long (max 2000 characters)."),
});

export interface DraftRequestResult {
  ok: boolean;
  /** SocialDraftRequest id to poll with readSocialDraft. */
  id?: string;
  error?: string;
}

export interface DraftReadResult {
  ok: boolean;
  status?: "pending" | "answered" | "failed" | "consumed" | "dismissed";
  ar?: string;
  en?: string;
  note?: string;
  /** Asks queued ahead of this one. Pending only. */
  pendingAhead?: number;
  /** When a drafting session last looked at the queue, ISO. Pending only. */
  lastDrainAt?: string;
  error?: string;
}

// The agent window's ask. It does NOT call the Anthropic API: the engine's
// billing posture is subscription-only, so no API key has credits to spend
// (verified against production 2026-07-30 — see the decision record). The ask
// is queued here and a Claude Code session on a human's machine answers it
// against the Max pool, then the window reads the answer back. Same inverted
// arrow as the Hermes draft lane, same reason.
export async function requestSocialDraft(
  input: unknown,
): Promise<DraftRequestResult> {
  const session = await auth();
  const email = session?.user?.email ?? undefined;
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const parsed = draftCopySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const row = await db.socialDraftRequest.create({
      data: {
        brand: parsed.data.product,
        brief: parsed.data.brief,
        requestedBy: email,
      },
    });
    return { ok: true, id: row.id };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not queue the draft ask.",
    };
  }
}

/** The window's poll. Contributor-gated like everything else on this surface. */
export async function readSocialDraft(id: unknown): Promise<DraftReadResult> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Invalid request id." };
  }

  try {
    const row = await db.socialDraftRequest.findUnique({
      where: { id },
      select: { status: true, ar: true, en: true, note: true, createdAt: true },
    });
    if (!row) return { ok: false, error: "That draft ask no longer exists." };

    // While the ask waits, the poll carries the honesty data too: queue
    // position plus the drainer heartbeat, so the window can tell "a session
    // will get to it" from "nobody is draining" — previously indistinguishable.
    if (row.status === "pending") {
      const [ahead, beat] = await Promise.all([
        db.socialDraftRequest.count({
          where: { status: "pending", createdAt: { lt: row.createdAt } },
        }),
        db.systemHeartbeat.findUnique({ where: { key: "draft-drain" } }),
      ]);
      return {
        ok: true,
        status: row.status,
        pendingAhead: ahead,
        lastDrainAt: beat?.at.toISOString(),
      };
    }

    return {
      ok: true,
      status: row.status,
      ar: row.ar ?? undefined,
      en: row.en ?? undefined,
      note: row.note ?? undefined,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read the draft.",
    };
  }
}

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
  const result = await deliverPost({
    product,
    text,
    channels: [...channels],
    mediaUrl,
  });

  // Record what just happened. Without this a direct publish left no trace at
  // all — no piece, no variant, no stored externalId — so the post could never
  // be found again, could not be retracted, and /api/social/metrics could not
  // see it. The composer's most-used button was the one whose posts could not
  // be counted, which is why the metrics route reported zero work while two
  // Hogwarts posts sat live on the Page.
  //
  // Deliberately AFTER delivery and deliberately non-fatal: the post is already
  // public by this point, and surfacing a database error here would invite a
  // re-publish that double-posts. A lost row is recoverable; a duplicate brand
  // post is not.
  //
  // Only recorded when at least one channel landed. A total refusal (unwired,
  // copy-out, transport down) never reached a platform, the contributor sees
  // the error immediately, and writing a row nothing will ever act on would
  // just accumulate noise the drain and metrics both have to filter past.
  if (result.results.some((outcome) => outcome.ok)) {
    try {
      await db.socialPiece.create({
        data: {
          brand: product,
          source: "human",
          locale: detectSocialLocale(text),
          aiGenerated: Boolean(mediaUrl),
          variants: {
            create: result.results.map((outcome) => ({
              channel: outcome.channel,
              text,
              mediaUrl,
              status: outcome.ok ? ("published" as const) : ("failed" as const),
              publishedAt: outcome.ok ? new Date() : null,
              externalId: outcome.externalId,
              result: outcome.ok ? "ok" : (outcome.error ?? "failed"),
              attempts: 1,
            })),
          },
        },
      });
    } catch (err: unknown) {
      console.error(
        `[social] published ${product} → ${channels.join(", ")} but could not record it: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return result;
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
        locale: detectSocialLocale(text),
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
      error:
        err instanceof Error ? err.message : "Could not schedule the post.",
    };
  }
}

export interface ReviewLink {
  channel: string;
  url: string;
}

export interface ReviewResult {
  ok: boolean;
  /** Which relay carried the draft, e.g. "hermes:slack". */
  via?: string;
  /** One signed single-use link per channel — the review artifact itself. */
  links?: ReviewLink[];
  /** True when a review relay actually carried the links somewhere. */
  delivered?: boolean;
  /** Why delivery failed, when it did. `error` stays "the stage failed". */
  deliveryError?: string;
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
        locale: detectSocialLocale(text),
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

  let links: ReviewLink[];
  try {
    // The Host header is attacker-controlled on a direct request — an approval
    // link must never be minted onto a host we do not own. Fall back to the
    // canonical origin instead (the same one the GitHub workflows default to).
    const configured = (process.env.SOCIAL_PUBLIC_URL ?? "").trim();
    const origin = configured
      ? configured.replace(/\/$/, "")
      : "https://kun.databayt.org";
    links = piece.variants.map((variant) => {
      const token = createApprovalToken(variant.id, APPROVAL_TTL_SECONDS);
      return {
        channel: variant.channel,
        url: `${origin}/api/social/publish?token=${encodeURIComponent(token)}`,
      };
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
  const sent = await sendReview(
    [
      `📝 Draft for ${product} → ${channels.join(", ")}`,
      "",
      text,
      ...(mediaUrl ? ["", `Media: ${mediaUrl}`] : []),
      "",
      "— staged from /social. Each link opens a one-tap confirm page — publishes once (expires in 12h):",
      ...links.map((link) => `${link.channel}: ${link.url}`),
    ].join("\n"),
    `social draft: ${product}`,
  );
  if (sent.ok) return { ok: true, via: sent.via, delivered: true, links };

  // No relay carried it — Hermes is parked and Telegram is deferred, which is
  // the production norm. The stage still stands: the caller renders these links
  // and a human hands them to the approver. Deleting the rows here would make
  // approval impossible exactly when there is no chat destination. Handing the
  // links back to the stager grants nothing new — the same contributor gate
  // already offers direct publish one button over.
  return { ok: true, delivered: false, links, deliveryError: sent.error };
}
