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

// Platforms fetch media themselves, so every entry has to be a public URL —
// a CDN render from /higgs or /carousel, not a blob or a localhost path.
const httpsUrl = z
  .string()
  .trim()
  .url("Media must be a full URL.")
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "Media URL must start with http(s)://",
  );

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
    // The post's ordered media set — images and/or one video (the delivery
    // fan-out enforces the shape; 10 is the platform ceiling either way).
    mediaUrls: z
      .array(httpsUrl)
      .max(10, "At most 10 media items per post.")
      .optional(),
    // LEGACY single-media field, accepted for one release so a browser tab
    // opened before the array shipped still posts. Folded into mediaUrls by
    // the transform below; remove with the composer's old payload shape.
    mediaUrl: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
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
  )
  // One media shape for every consumer: the array is the truth, the legacy
  // single URL becomes a one-element array when it is all the caller sent.
  .transform(({ mediaUrl, mediaUrls, ...rest }) => ({
    ...rest,
    mediaUrls:
      mediaUrls && mediaUrls.length > 0
        ? mediaUrls
        : mediaUrl
          ? [mediaUrl]
          : [],
  }));

const draftCopySchema = z.object({
  product: z.enum(PRODUCT_IDS, { message: "Unknown product." }),
  brief: z
    .string()
    .trim()
    .min(3, "Say a little more about the post.")
    .max(2000, "Brief is too long (max 2000 characters)."),
  // Ask-time attachments — a contributor can hand media to the drafting
  // session (a showroom pick, an event photo on the CDN). The answering
  // session may keep, extend, or replace the set.
  mediaUrls: z
    .array(httpsUrl)
    .max(10, "At most 10 media items per draft.")
    .optional(),
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
  /** The draft's media half — attached at ask time or by the answerer. */
  mediaUrls?: string[];
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
        mediaUrls: parsed.data.mediaUrls ?? [],
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
      select: {
        status: true,
        ar: true,
        en: true,
        note: true,
        createdAt: true,
        mediaUrls: true,
      },
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
      mediaUrls: row.mediaUrls,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read the draft.",
    };
  }
}

// The variant's media dual-shape: the array is the truth, the legacy column
// carries the first URL for readers deployed before the array existed. Drop
// the dual-write with the column.
function variantMedia(mediaUrls: string[]): {
  mediaUrl: string | null;
  mediaUrls: string[];
} {
  return { mediaUrl: mediaUrls[0] ?? null, mediaUrls };
}

// Record a delivered post. Without this a direct publish left no trace at
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
async function recordPublishedPiece(
  product: string,
  text: string,
  mediaUrls: string[],
  outcomes: ChannelOutcome[],
): Promise<void> {
  if (!outcomes.some((outcome) => outcome.ok)) return;
  try {
    await db.socialPiece.create({
      data: {
        brand: product,
        source: "human",
        locale: detectSocialLocale(text),
        aiGenerated: mediaUrls.length > 0,
        variants: {
          create: outcomes.map((outcome) => ({
            channel: outcome.channel,
            text,
            ...variantMedia(mediaUrls),
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
      `[social] published ${product} → ${outcomes
        .map((o) => o.channel)
        .join(", ")} but could not record it: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

// One piece, variants straight to `scheduled` — the drain delivers them.
// Shared by schedulePost (composer) and approveDraft (review queue).
async function createScheduledPiece(
  product: string,
  text: string,
  channels: readonly string[],
  mediaUrls: string[],
  when: Date,
): Promise<number> {
  const piece = await db.socialPiece.create({
    data: {
      brand: product,
      source: "human",
      locale: detectSocialLocale(text),
      aiGenerated: mediaUrls.length > 0,
      variants: {
        create: channels.map((channel) => ({
          channel,
          text,
          ...variantMedia(mediaUrls),
          status: "scheduled" as const,
          scheduledFor: when,
        })),
      },
    },
    include: { variants: true },
  });
  return piece.variants.length;
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

  const { product, text, channels, mediaUrls } = parsed.data;
  const result = await deliverPost({
    product,
    text,
    channels: [...channels],
    mediaUrls,
  });

  await recordPublishedPiece(product, text, mediaUrls, result.results);

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

  const { product, text, channels, mediaUrls, scheduledFor } = parsed.data;
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
    const count = await createScheduledPiece(
      product,
      text,
      channels,
      mediaUrls,
      when,
    );
    return { ok: true, count, at: when.toISOString() };
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

  const { product, text, channels, mediaUrls } = parsed.data;

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
        aiGenerated: mediaUrls.length > 0,
        variants: {
          create: channels.map((channel) => ({
            channel,
            text,
            ...variantMedia(mediaUrls),
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

  // Media listed capped at 4 URLs so ten attachments cannot push the links —
  // the part the reviewer actually needs — past Telegram's 4096-char message
  // limit. The confirm page itself lists every URL.
  const mediaLines = mediaUrls
    .slice(0, 4)
    .map((url, i) => `Media ${i + 1}/${mediaUrls.length}: ${url}`);
  if (mediaUrls.length > 4) {
    mediaLines.push(`… and ${mediaUrls.length - 4} more`);
  }

  // Each link publishes exactly one channel, exactly once.
  const sent = await sendReview(
    [
      `📝 Draft for ${product} → ${channels.join(", ")}`,
      "",
      text,
      ...(mediaLines.length ? ["", ...mediaLines] : []),
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

// ——— The review queue ———
//
// /social/publish is a review surface, not a composer: answered draft asks
// (copy AND/OR media) queue up here, a contributor loads one, fine-tunes, and
// approves. Approval in the Hub IS the human gate for this lane — the same
// contributor authority that could always press "publish now", pointed at
// work a session drafted instead of a blank textarea.

export interface AnsweredDraft {
  id: string;
  brand: string;
  brief: string;
  ar: string;
  en: string;
  mediaUrls: string[];
  requestedBy: string | null;
  /** ISO — when the ask was filed. The queue orders oldest-first by this. */
  createdAt: string;
  answeredAt: string | null;
}

export interface AnsweredDraftsResult {
  ok: boolean;
  drafts?: AnsweredDraft[];
  error?: string;
}

// All brands in one read: the queue is small (answered rows drain into
// consumed/dismissed), and filtering client-side means switching brand in the
// Hub never refetches.
export async function listAnsweredDrafts(): Promise<AnsweredDraftsResult> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  try {
    const rows = await db.socialDraftRequest.findMany({
      where: { status: "answered" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        id: true,
        brand: true,
        brief: true,
        ar: true,
        en: true,
        mediaUrls: true,
        requestedBy: true,
        createdAt: true,
        answeredAt: true,
      },
    });
    return {
      ok: true,
      drafts: rows.map((row) => ({
        id: row.id,
        brand: row.brand,
        brief: row.brief,
        ar: row.ar ?? "",
        en: row.en ?? "",
        mediaUrls: row.mediaUrls,
        requestedBy: row.requestedBy,
        createdAt: row.createdAt.toISOString(),
        answeredAt: row.answeredAt?.toISOString() ?? null,
      })),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read the queue.",
    };
  }
}

const approveMetaSchema = z.object({
  draftId: z.string().min(1, "Missing draft id."),
  // The settings choice: deliver now, or write `scheduled` variants for the
  // ~15-minute cron drain to deliver.
  mode: z.enum(["now", "schedule"]),
});

export interface ApproveResult extends PostResult {
  /** Schedule mode: how many channel variants were queued. */
  count?: number;
  /** Schedule mode: when they will publish, ISO. */
  at?: string;
}

export async function approveDraft(input: unknown): Promise<ApproveResult> {
  const session = await auth();
  const email = session?.user?.email ?? "contributor";
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const meta = approveMetaSchema.safeParse(input);
  if (!meta.success) {
    return {
      ok: false,
      error: meta.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  // The publish payload (product, edited text, channels, media) validates
  // through the same schema every other write gate uses — an approved draft
  // gets no laxer a contract than a hand-typed post.
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const { product, text, channels, mediaUrls, scheduledFor } = parsed.data;

  // Schedule-mode time errors are caught BEFORE the claim below — a typo in
  // the date must not consume the draft.
  let when: Date | null = null;
  if (meta.data.mode === "schedule") {
    if (!scheduledFor) {
      return { ok: false, error: "Pick a date and time first." };
    }
    when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) {
      return { ok: false, error: "That date could not be read." };
    }
    if (when.getTime() < Date.now() - 60_000) {
      return { ok: false, error: "That time is in the past." };
    }
  }

  // The claim. `status: "answered"` in the WHERE is the whole concurrency
  // guarantee — two reviewers approving the same draft race on one UPDATE and
  // exactly one wins (same pattern as the drain and the approval link).
  const claimed = await db.socialDraftRequest.updateMany({
    where: { id: meta.data.draftId, status: "answered" },
    data: { status: "consumed", note: `approved by ${email}` },
  });
  if (claimed.count === 0) {
    return {
      ok: false,
      error: "Already handled — someone else decided this draft.",
    };
  }

  if (when) {
    try {
      const count = await createScheduledPiece(
        product,
        text,
        channels,
        mediaUrls,
        when,
      );
      return { ok: true, count, at: when.toISOString() };
    } catch (err: unknown) {
      // Nothing was published — hand the draft back so approval can be
      // retried once the write path recovers.
      const error =
        err instanceof Error ? err.message : "Could not schedule the post.";
      await db.socialDraftRequest
        .updateMany({
          where: { id: meta.data.draftId, status: "consumed" },
          data: { status: "answered", note: `approve failed: ${error}` },
        })
        .catch(() => {});
      return { ok: false, error };
    }
  }

  const result = await deliverPost({
    product,
    text,
    channels: [...channels],
    mediaUrls,
  });
  await recordPublishedPiece(product, text, mediaUrls, result.results);

  // Total failure: nothing reached any platform, so the draft goes back to
  // the queue with the reason. A PARTIAL failure stays consumed — the post is
  // public somewhere, and a re-approve would double-post the channels that
  // landed (the recorded variants carry the per-channel truth).
  if (!result.results.some((outcome) => outcome.ok)) {
    await db.socialDraftRequest
      .updateMany({
        where: { id: meta.data.draftId, status: "consumed" },
        data: {
          status: "answered",
          note: `approve failed: ${result.error ?? "unknown error"}`,
        },
      })
      .catch(() => {});
  }

  return result;
}

const dismissSchema = z.object({
  draftId: z.string().min(1, "Missing draft id."),
  note: z.string().trim().max(500).optional(),
});

export async function dismissDraft(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const email = session?.user?.email ?? "contributor";
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const parsed = dismissSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const dismissed = await db.socialDraftRequest.updateMany({
    where: { id: parsed.data.draftId, status: "answered" },
    data: {
      status: "dismissed",
      note: `dismissed by ${email}${parsed.data.note ? `: ${parsed.data.note}` : ""}`,
    },
  });
  if (dismissed.count === 0) {
    return {
      ok: false,
      error: "Already handled — someone else decided this draft.",
    };
  }
  return { ok: true };
}
