"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { requireContributor } from "@/lib/auth-guard";
import { detectSocialLocale } from "@/lib/social-locale";
import { deliverPost, type ChannelOutcome } from "@/lib/social-publish";
import { getEgressStatus, type EgressStatus } from "@/lib/social-status";
import { sendReview } from "@/lib/social-review";
import { createApprovalToken } from "@/lib/social-token";
import {
  isStorageConfigured,
  mediaUrlFor,
  presignMediaPut,
  putMedia,
} from "@/lib/s3";
import {
  dismissBrief,
  fileBrief,
  listRenderedBriefs,
  markRendered,
  recordUpload,
  type BriefRow,
} from "@/lib/social-media-brief";
import { db } from "@/lib/db";
import {
  briefAsAsset,
  getShowroomData,
} from "@/components/root/social/showroom/data";
import {
  CHANNELS,
  DISTRIBUTION_CHANNEL_IDS,
} from "@/components/root/social/config";
import { type MediaStudioRatio } from "@/lib/brand-kit";
import { ASSET_TYPES } from "@/components/root/social/showroom/taxonomy";
import {
  PRODUCT_IDS,
  productChannelWired,
} from "@/components/root/social/products";
import {
  DISMISS_REASON_IDS,
  DRAFT_MODEL_IDS,
} from "@/components/root/social/knobs";
import {
  CRAFT_REFUSED_PREFIX,
  draftWithGeminiFree,
  inlineDraftEnabled,
} from "@/lib/google-draft";
import { checkCraft, craftFailures, type CraftFinding } from "@/lib/craft";
import { allowInlineDraft, getClientIp } from "@/lib/rate-limit";
import { conceptFor, type Concept } from "@/lib/social-concept";
import {
  dueSlots,
  findSlot,
  type PlanSlot,
} from "@/components/root/social/plan";

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
      slack: denied,
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

/**
 * The direction a contributor gives without writing prose about it.
 *
 * These are not new vocabulary: `content/social/pillars.json` already writes
 * Angle, The scene, and Register into every brief string because there was
 * nowhere else to put them. Making them columns means the Hub can offer them
 * as controls and the drain can read them without parsing prose.
 */
const draftKnobsSchema = z.object({
  // The window's model select was decoration until the column existed. Only
  // the engine's own chain is accepted — this value reaches `claude -p --model`
  // on a contributor's machine, so it is an execution parameter, not a label.
  model: z.enum(DRAFT_MODEL_IDS).optional(),
  angle: z.enum(["pain", "moment", "proof"]).optional(),
  // 2–4. Rung 1 is فصحى الصحافة, which copy.mdx says never ships — so it is
  // storable (the column means "a rung on the ladder") but never askable.
  register: z.number().int().min(2).max(4).optional(),
  // "Write it like this one" — checked against the same brand below.
  referenceId: z.string().min(1).optional(),
});

const draftCopySchema = draftKnobsSchema.extend({
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
  // The plan — what the draft is FOR. The Calendar and Draft stages send the
  // slot and feature; the Draft box's Channels and Post shape used to be
  // decoration because nothing carried them.
  slot: z
    .string()
    .regex(/^[a-z]+#\d{3}$/, "Unknown calendar slot.")
    .optional(),
  feature: z.string().trim().max(60).optional(),
  channel: z.string().trim().max(40).optional(),
  shape: z.string().trim().max(40).optional(),
});

export interface DraftRequestResult {
  ok: boolean;
  /** SocialDraftRequest id to poll with readSocialDraft. */
  id?: string;
  error?: string;
}

export interface DraftReadResult {
  ok: boolean;
  status?:
    "pending" | "answered" | "failed" | "consumed" | "dismissed" | "superseded";
  ar?: string;
  en?: string;
  note?: string;
  /** The draft's media half — attached at ask time or by the answerer. */
  mediaUrls?: string[];
  /** 1-based depth in the refinement thread. The window renders it as "v{turn}". */
  turn?: number;
  /** Asks queued ahead of this one. Pending only. */
  pendingAhead?: number;
  /** When a drafting session last looked at the queue, ISO. Pending only. */
  lastDrainAt?: string;
  error?: string;
}

/**
 * Resolve a knob set against the brand it will be filed under.
 *
 * The only knob that can lie is `referenceId`: model and angle are closed enums
 * and register is a bounded int, but a reference is an id a caller supplies. An
 * unchecked one would let a contributor point a hogwarts draft at mkan's copy —
 * not a security hole (the whole surface is contributor-gated) but a quiet way
 * to poison a brand's voice with another brand's register. Cross-brand
 * references are dropped rather than rejected: the ask is still answerable, and
 * refusing the whole draft over a stale inspiration link would be worse.
 */
async function resolveReference(
  referenceId: string | undefined,
  brand: string,
): Promise<string | null> {
  if (!referenceId) return null;
  const row = await db.socialDraftRequest.findUnique({
    where: { id: referenceId },
    select: { brand: true, ar: true },
  });
  // Must exist, share the brand, and actually carry copy — an unanswered ask
  // is not an inspiration.
  if (!row || row.brand !== brand || !row.ar) return null;
  return referenceId;
}

interface InlineDraftOutcome {
  /** Craft-clean copy, ready to land the row `answered` inline. */
  result: { ar: string; en: string } | null;
  /**
   * Set when the lane REFUSED: the attempt tripped the craft gate and the one
   * corrective retry either tripped it again or could not run. Written to
   * `note` on the pending row — drain-google skips it, `list` shows the Mac
   * lane what failed.
   */
  refusalNote: string | null;
}

/**
 * The other half of the feedback loop, extended to the inline lane.
 *
 * `social-drafts.mjs lessons` has fed 60 days of human dismiss reasons into
 * the Mac drain's prompt since 2026-08-06; the inline Gemini lane never saw
 * them. One Prisma aggregate (hits the [brand, dismissReason] index) turns
 * the same rows into one compact prompt line — zero model tokens, and the
 * doctrine's cheapest quality lever now reaches the default lane too.
 * Non-fatal by design: losing the lesson line must never cost the draft.
 */
async function recentDismissLessons(
  brand: string,
): Promise<string | undefined> {
  try {
    const groups = await db.socialDraftRequest.groupBy({
      by: ["dismissReason"],
      where: {
        brand,
        status: "dismissed",
        dismissReason: { not: null },
        answeredAt: { gt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
      _count: { _all: true },
    });
    const ranked = groups
      .filter((g) => g.dismissReason)
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 5);
    if (ranked.length === 0) return undefined;
    return ranked.map((g) => `${g.dismissReason} ${g._count._all}×`).join(", ");
  } catch {
    return undefined;
  }
}

function refusalNoteFrom(failures: CraftFinding[]): string {
  // note is a human-and-machine surface: the prefix is the machine key, the
  // named rules are what the drain prompt feeds back to the writer. ~500 chars
  // keeps a many-failure draft from turning the column into a transcript.
  return `${CRAFT_REFUSED_PREFIX} ${failures
    .map((f) => `${f.rule}: ${f.message}`)
    .join("; ")}`.slice(0, 500);
}

// The inline half of the gate `social-drafts.mjs answer` has run since
// 2026-08-06. Until this helper existed the Gemini lanes bypassed the craft
// gate entirely — copy.mdx's "auto-fail, no discussion" was executed on the
// Mac fallback lane and skipped by the DEFAULT one, so ungated copy reached
// the review queue at exactly the speed that made it the common path.
//
// Same doctrine as `answer`: a failing draft is rewritten before it is
// answered, never answered with a warning attached. One corrective retry —
// each call spends the measured 20-requests/day free tier (D-20260807) — then
// refuse to the queue, which is this lane's pre-existing fallback for every
// other kind of inline miss.
async function draftInlineGated(params: {
  product: string;
  brief: string;
  instruction?: string;
  angle?: string;
  register?: number;
  /** Feature id — its concept note rides into the prompt. */
  feature?: string;
  /** Calendar slot key — its angle, persona and guide ride into the prompt. */
  slot?: string;
  /** Every text a number may legitimately come from — see CraftInput. */
  allowedFrom: string;
}): Promise<InlineDraftOutcome> {
  const gate = (ar: string, en: string): CraftFinding[] =>
    craftFailures(
      checkCraft({
        ar,
        en,
        brand: params.product,
        allowedFrom: params.allowedFrom,
      }),
    );

  const lessons = await recentDismissLessons(params.product);
  const first = await draftWithGeminiFree({ ...params, lessons });
  if (!first.ok || !first.ar || !first.en) {
    // Transport or quota miss — no craft verdict, so no marker. The row falls
    // to the queue plain, and drain-google may retry it when the quota resets.
    return { result: null, refusalNote: null };
  }
  const firstFailures = gate(first.ar, first.en);
  if (firstFailures.length === 0) {
    return { result: { ar: first.ar, en: first.en }, refusalNote: null };
  }

  const retry = await draftWithGeminiFree({
    ...params,
    lessons,
    violations: firstFailures.map((f) => `${f.rule}: ${f.message}`).join("; "),
  });
  if (!retry.ok || !retry.ar || !retry.en) {
    // The brief already tripped the gate once and the retry could not run.
    // Mark it anyway: letting drain-google spend two more requests
    // rediscovering the same failures is how a poisoned brief burns the day's
    // quota, and the Mac lane writes better copy regardless.
    return { result: null, refusalNote: refusalNoteFrom(firstFailures) };
  }
  const retryFailures = gate(retry.ar, retry.en);
  if (retryFailures.length === 0) {
    return { result: { ar: retry.ar, en: retry.en }, refusalNote: null };
  }
  return { result: null, refusalNote: refusalNoteFrom(retryFailures) };
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
    let gated: InlineDraftOutcome = { result: null, refusalNote: null };
    if (
      inlineDraftEnabled() &&
      (!parsed.data.model || parsed.data.model === "google-free") &&
      process.env.GEMINI_API_KEY &&
      // Last on purpose: a limiter token is only worth spending once the lane
      // is actually going to call Gemini. A false queues the ask instead —
      // the contributor sees last week's latency, never an error.
      (await allowInlineDraft(email ?? (await getClientIp())))
    ) {
      gated = await draftInlineGated({
        product: parsed.data.product,
        brief: parsed.data.brief,
        angle: parsed.data.angle,
        register: parsed.data.register,
        feature: parsed.data.feature,
        slot: parsed.data.slot,
        // A root ask has no thread yet — the brief is the whole allowance.
        allowedFrom: parsed.data.brief,
      });
    }
    const instantResult = gated.result;

    const row = await db.socialDraftRequest.create({
      data: {
        brand: parsed.data.product,
        brief: parsed.data.brief,
        requestedBy: email,
        mediaUrls: parsed.data.mediaUrls ?? [],
        model: parsed.data.model,
        angle: parsed.data.angle,
        register: parsed.data.register,
        slot: parsed.data.slot,
        // A slot implies its feature; an explicit pick wins.
        feature:
          parsed.data.feature ??
          (parsed.data.slot ? findSlot(parsed.data.slot)?.feature : undefined),
        channel: parsed.data.channel,
        shape: parsed.data.shape,
        referenceId: await resolveReference(
          parsed.data.referenceId,
          parsed.data.product,
        ),
        status: instantResult ? "answered" : "pending",
        ar: instantResult?.ar ?? null,
        en: instantResult?.en ?? null,
        note: gated.refusalNote,
        answeredAt: instantResult ? new Date() : null,
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

const refineSchema = z.object({
  parentId: z.string().min(1, "Missing draft id."),
  instruction: z
    .string()
    .trim()
    .min(3, "Say what to change.")
    .max(1000, "Keep the change to 1000 characters."),
  // A refinement may re-aim the knobs — "same brief, rung 3" is a legitimate
  // turn. Unset means inherit the parent's, which is what a plain "sharper
  // hook" should do.
  model: z.enum(DRAFT_MODEL_IDS).optional(),
  angle: z.enum(["pain", "moment", "proof"]).optional(),
  register: z.number().int().min(2).max(4).optional(),
});

/**
 * The next turn of a conversation.
 *
 * Refining does NOT mutate the answer. It supersedes the parent and files a
 * child carrying the same root brief, the inherited knobs, and the instruction
 * that says what to change. Three things fall out of that shape, and all three
 * are why it beats an `UPDATE`:
 *
 *   - every turn stays independently readable and approvable, so a v3 that came
 *     out worse does not destroy the v2 someone liked;
 *   - the queue lifecycle is untouched — a turn is an ordinary `pending` ask, so
 *     the drain, the poll, the review queue and the approval claim all work on
 *     it without knowing threads exist;
 *   - the supersede is a conditional update on `answered`, so two reviewers
 *     refining the same draft race exactly as they already do on approve, and
 *     one of them is told it lost.
 */
export async function refineSocialDraft(
  input: unknown,
): Promise<DraftRequestResult> {
  const session = await auth();
  const email = session?.user?.email ?? undefined;
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const parsed = refineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const parent = await db.socialDraftRequest.findUnique({
    where: { id: parsed.data.parentId },
    select: {
      brand: true,
      brief: true,
      turn: true,
      status: true,
      mediaUrls: true,
      model: true,
      angle: true,
      register: true,
      referenceId: true,
      slot: true,
      feature: true,
      channel: true,
      shape: true,
      // The craft gate's allowance: a number the parent draft already carries
      // (or the reviewer's own instruction asks for) stays legal on the child —
      // same construction as `answer`'s in social-drafts.mjs.
      ar: true,
      en: true,
    },
  });
  if (!parent) {
    return { ok: false, error: "That draft no longer exists." };
  }
  if (parent.status !== "answered") {
    // Naming the state beats "cannot refine": a consumed draft is already
    // published and a dismissed one is already decided, and the reviewer
    // should know which happened rather than assume a bug.
    return {
      ok: false,
      error: `That draft is "${parent.status}" — only an answered draft can be refined.`,
    };
  }

  // Claim the parent first. If this loses, nothing was created — the alternative
  // ordering leaves an orphan child pointing at a draft someone else approved.
  const claimed = await db.socialDraftRequest.updateMany({
    where: { id: parsed.data.parentId, status: "answered" },
    data: { status: "superseded" },
  });
  if (claimed.count === 0) {
    return {
      ok: false,
      error: "Already handled — someone else decided this draft.",
    };
  }

  try {
    const chosenModel = parsed.data.model ?? parent.model ?? undefined;
    const chosenAngle = parsed.data.angle ?? parent.angle ?? undefined;
    const chosenRegister = parsed.data.register ?? parent.register ?? undefined;

    let gated: InlineDraftOutcome = { result: null, refusalNote: null };
    if (
      inlineDraftEnabled() &&
      (!chosenModel || chosenModel === "google-free") &&
      process.env.GEMINI_API_KEY &&
      (await allowInlineDraft(email ?? (await getClientIp())))
    ) {
      gated = await draftInlineGated({
        product: parent.brand,
        // The root brief travels unchanged; the instruction rides beside it
        // (copy.mdx's refinement contract) — the prompt builder renders each
        // in its own labelled slot.
        brief: parent.brief,
        instruction: parsed.data.instruction,
        angle: chosenAngle,
        register: chosenRegister,
        feature: parent.feature ?? undefined,
        slot: parent.slot ?? undefined,
        allowedFrom: [
          parent.brief,
          parsed.data.instruction,
          parent.ar,
          parent.en,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
    const instantResult = gated.result;

    const row = await db.socialDraftRequest.create({
      data: {
        brand: parent.brand,
        brief: parent.brief,
        instruction: parsed.data.instruction,
        parentId: parsed.data.parentId,
        turn: parent.turn + 1,
        requestedBy: email,
        mediaUrls: parent.mediaUrls,
        model: chosenModel,
        angle: chosenAngle,
        register: chosenRegister,
        referenceId: parent.referenceId,
        slot: parent.slot,
        feature: parent.feature,
        channel: parent.channel,
        shape: parent.shape,
        status: instantResult ? "answered" : "pending",
        ar: instantResult?.ar ?? null,
        en: instantResult?.en ?? null,
        note: gated.refusalNote,
        answeredAt: instantResult ? new Date() : null,
      },
    });
    return { ok: true, id: row.id };
  } catch (err: unknown) {
    // Hand the parent back — a thread that lost its next turn must not also
    // lose the answer it already had.
    await db.socialDraftRequest
      .updateMany({
        where: { id: parsed.data.parentId, status: "superseded" },
        data: { status: "answered" },
      })
      .catch(() => {});
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not queue the refinement.",
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
        turn: true,
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
        turn: row.turn,
        pendingAhead: ahead,
        lastDrainAt: beat?.at.toISOString(),
      };
    }

    return {
      ok: true,
      status: row.status,
      turn: row.turn,
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
/**
 * The AI-disclosure flag: true when any attached media was generated. It used
 * to be `mediaUrls.length > 0`, which labelled a real screenshot or a filmed
 * clip as AI. The media team's own uploads carry a `u` id in their storage key
 * (`media/<brand>/u…`, see uploadMedia); everything else on the shelf — the
 * Higgsfield library, seat-lane renders, studio stills — is generated, and an
 * outside URL nobody can vouch for is treated as generated too.
 */
function anyGeneratedMedia(mediaUrls: string[]): boolean {
  return mediaUrls.some((url) => !/\/media\/[a-z]+\/u[0-9a-z]+-/.test(url));
}

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
        aiGenerated: anyGeneratedMedia(mediaUrls),
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
      aiGenerated: anyGeneratedMedia(mediaUrls),
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
  // link so a reviewer can take one channel and hold another — previously a
  // single token covered the whole fan-out, so it was all or nothing.
  let piece;
  try {
    piece = await db.socialPiece.create({
      data: {
        brand: product,
        source: "human",
        locale: detectSocialLocale(text),
        aiGenerated: anyGeneratedMedia(mediaUrls),
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
  // the part the reviewer actually needs — past a chat platform's message
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

  // No relay carried it — Hermes is parked, which is
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
  /** 1-based depth in the refinement thread. Rendered as a "v{turn}" badge. */
  turn: number;
  /** What the last refinement asked for. Null on a first turn. */
  instruction: string | null;
  /** ISO — when the ask was filed. The queue orders oldest-first by this. */
  createdAt: string;
  answeredAt: string | null;
  /** The calendar slot it answers (`<brand>#NNN`), or null for an ad-hoc ask. */
  slot: string | null;
  /** Feature id the post is about, when the ask recorded one. */
  feature: string | null;
}

export interface AnsweredDraftsResult {
  ok: boolean;
  drafts?: AnsweredDraft[];
  error?: string;
}

// All brands in one read: the queue is small (answered rows drain into
// consumed/dismissed), and filtering client-side means switching brand in the
// Hub never refetches.
//
// One turn per thread reaches this list without a filter for it: refining
// flips the parent to `superseded`, so only a thread's newest answer is ever
// `answered`. That is the whole reason refinement supersedes instead of
// inserting a sibling — a reviewer should see the current draft, not three
// versions of one post competing for the same slot.
const ANSWERED_SELECT = {
  id: true,
  brand: true,
  brief: true,
  ar: true,
  en: true,
  mediaUrls: true,
  requestedBy: true,
  turn: true,
  instruction: true,
  createdAt: true,
  answeredAt: true,
  slot: true,
  feature: true,
} as const;

function toAnsweredDraft(row: {
  id: string;
  brand: string;
  brief: string;
  ar: string | null;
  en: string | null;
  mediaUrls: string[];
  requestedBy: string | null;
  turn: number;
  instruction: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  slot: string | null;
  feature: string | null;
}): AnsweredDraft {
  return {
    ...row,
    ar: row.ar ?? "",
    en: row.en ?? "",
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
  };
}

/**
 * One answered draft by id — the Calendar's "Publish" link, which may point at
 * a slot not yet due and so not in the queue read.
 */
export async function readAnsweredDraft(
  id: unknown,
): Promise<{ ok: boolean; draft?: AnsweredDraft; error?: string }> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  if (typeof id !== "string" || !id) return { ok: false, error: "Invalid id." };
  const row = await db.socialDraftRequest.findFirst({
    where: { id, status: "answered" },
    select: ANSWERED_SELECT,
  });
  return row
    ? { ok: true, draft: toAnsweredDraft(row) }
    : { ok: false, error: "That draft is no longer waiting for review." };
}

export async function listAnsweredDrafts(): Promise<AnsweredDraftsResult> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  try {
    // A brand's editorial plan is loaded months ahead (balqalam: 90 answered
    // drafts at once), and oldest-first with a cap of 20 meant the plan
    // crowded every ad-hoc draft — and every other brand — out of the queue.
    // Planned drafts now join the queue when their slot falls due (overdue or
    // this week); the rest wait on the Calendar, one press from Publish.
    const dueKeys = PRODUCT_IDS.flatMap((b) => dueSlots(b).map((s) => s.key));
    const rows = await db.socialDraftRequest.findMany({
      where: {
        status: "answered",
        OR: [{ slot: null }, { slot: { in: dueKeys } }],
      },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: ANSWERED_SELECT,
    });
    return { ok: true, drafts: rows.map(toAnsweredDraft) };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read the queue.",
    };
  }
}

/**
 * The other two thirds of the publish queue.
 *
 * `listAnsweredDrafts` reads work that has not been decided yet; this reads
 * work that has — variants a human already approved, either waiting on the
 * cron drain (`scheduled`) or already on a platform (`published`). The search
 * bar's mode row spans all three, so a reviewer can answer "did that go out?"
 * without leaving the stage for the ledger on /social/measure.
 *
 * Read-only on purpose. These rows never load into the composer: a variant is
 * downstream of a SocialPiece, so re-approving one would mint a duplicate.
 */
export interface QueuedVariant {
  id: string;
  kind: "scheduled" | "published";
  brand: string;
  /** Channel id from components/root/social/config.ts. */
  channel: string;
  text: string;
  mediaUrls: string[];
  /** ISO — when it publishes (scheduled) or when it did (published). */
  when: string;
}

export interface QueuedVariantsResult {
  ok: boolean;
  variants?: QueuedVariant[];
  error?: string;
}

export async function listQueuedVariants(): Promise<QueuedVariantsResult> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  try {
    const rows = await db.socialVariant.findMany({
      where: { status: { in: ["scheduled", "published"] } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        channel: true,
        status: true,
        text: true,
        mediaUrls: true,
        scheduledFor: true,
        publishedAt: true,
        createdAt: true,
        piece: { select: { brand: true } },
      },
    });

    const variants: QueuedVariant[] = rows.map((row) => {
      const scheduled = row.status === "scheduled";
      return {
        id: row.id,
        kind: scheduled ? ("scheduled" as const) : ("published" as const),
        brand: row.piece.brand,
        channel: row.channel,
        text: row.text,
        mediaUrls: row.mediaUrls,
        when: (scheduled
          ? (row.scheduledFor ?? row.createdAt)
          : (row.publishedAt ?? row.createdAt)
        ).toISOString(),
      };
    });

    // Soonest-first for what has not happened, newest-first for what has —
    // both orderings answer "what is nearest to now", from opposite sides.
    variants.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "scheduled" ? -1 : 1;
      const delta = a.when.localeCompare(b.when);
      return a.kind === "scheduled" ? delta : -delta;
    });

    return { ok: true, variants };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read the queue.",
    };
  }
}

export interface BrandMedia {
  id: string;
  /** Human label for the tile's alt text and tooltip. */
  title: string;
  /** Public CDN URL — Graph fetches the bytes itself, so it must be reachable. */
  url: string;
  /**
   * The showroom's asset type (`reel`, `carousel`, `og`, `lifestyle`, …). The
   * composer's settings filter the library by it, so picking "Reel" as the
   * post's format stops offering hero stills. Carried from `library.json`
   * through the showroom's own reader, so there is one vocabulary rather than
   * two that drift.
   */
  type: string;
  /** Feature id the asset shows; null for a brand-wide asset. */
  feature: string | null;
}

/**
 * Media worth attaching to this brand's next post.
 *
 * The showroom already knows every generated asset and its brand; this is the
 * same data, narrowed to what a composer can actually use — a renderable URL —
 * so the publish stage can offer a few tiles inline instead of sending someone
 * to another route to copy a link back. Newest first: the asset made for the
 * campaign currently being written is almost always the one wanted.
 */
export async function listBrandMedia(
  brand: unknown,
  feature?: unknown,
): Promise<{ ok: boolean; media?: BrandMedia[]; error?: string }> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  if (
    typeof brand !== "string" ||
    !(PRODUCT_IDS as readonly string[]).includes(brand)
  ) {
    return { ok: false, error: "Unknown product." };
  }

  const wanted =
    typeof feature === "string" && feature && feature !== "any"
      ? feature
      : null;

  try {
    // The library file plus everything the media team rendered or uploaded —
    // reading only library.json meant an upload never reached a post.
    const rendered = await listRenderedBriefs();
    const { assets } = getShowroomData(rendered.map(briefAsAsset));
    const mine = assets.filter(
      (a) => a.kind === "generated" && a.brand === brand && a.imageUrl,
    );
    // With a feature picked: assets made for it first, then brand-wide ones
    // that fit any post. Assets tagged for a DIFFERENT feature drop out — an
    // attendance screenshot is the wrong picture for an admission post.
    const ranked = wanted
      ? [
          ...mine.filter((a) => a.feature === wanted),
          ...mine.filter((a) => a.feature === null),
        ]
      : mine;
    return {
      ok: true,
      media: ranked.slice(0, 24).map((a) => ({
        id: a.id,
        title: a.title,
        url: a.imageUrl as string,
        type: a.type,
        feature: a.feature,
      })),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read the library.",
    };
  }
}

export interface DraftReference {
  id: string;
  /** First line of the Arabic copy — enough to recognize the post by. */
  excerpt: string;
  /** consumed = it shipped. answered = it is still in review. */
  shipped: boolean;
}

/**
 * Candidates for "write it like this one".
 *
 * Approved drafts first and by recency, because a post that cleared the human
 * gate is the strongest evidence of what this brand's voice sounds like when it
 * works — which is exactly what a reference is for. Dismissed and superseded
 * copy is excluded on the same logic: a reviewer already said it was wrong, and
 * offering it as inspiration would recycle the failure.
 */
export async function listDraftReferences(
  brand: unknown,
): Promise<{ ok: boolean; references?: DraftReference[]; error?: string }> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  if (
    typeof brand !== "string" ||
    !(PRODUCT_IDS as readonly string[]).includes(brand)
  ) {
    return { ok: false, error: "Unknown product." };
  }

  try {
    const rows = await db.socialDraftRequest.findMany({
      where: {
        brand,
        status: { in: ["consumed", "answered"] },
        ar: { not: null },
      },
      orderBy: { answeredAt: "desc" },
      take: 12,
      select: { id: true, ar: true, status: true },
    });
    return {
      ok: true,
      references: rows
        .map((row) => ({
          id: row.id,
          excerpt: (row.ar ?? "").split("\n")[0]!.slice(0, 80),
          shipped: row.status === "consumed",
        }))
        // Shipped first, recency preserved inside each group (sort is stable).
        // Done here rather than as an `orderBy` on status: Prisma sorts enums by
        // DECLARATION order, so the SQL version would silently re-rank the day
        // someone reorders DraftRequestStatus for an unrelated reason.
        .sort((a, b) => Number(b.shipped) - Number(a.shipped)),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not read the references.",
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
  // The failed check, as a stable id. This is the ONE signal that travels back
  // to the writing side: copy.mdx claims the pipeline's feedback loop is
  // "dismiss reasons on the review queue", and until this column existed that
  // claim was true only in intent — the reason was concatenated into `note`,
  // where nothing could group it by brand or count it over a month.
  reason: z.enum(DISMISS_REASON_IDS).optional(),
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
      // `note` stays the human sentence; `dismissReason` is the machine key.
      // Both, not either: the note is what the next person reads, the reason is
      // what the next drain counts.
      note: `dismissed by ${email}${parsed.data.note ? `: ${parsed.data.note}` : ""}`,
      dismissReason: parsed.data.reason,
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

// ── The media brief queue ───────────────────────────────────────────────────
//
// The Media stage's third lane. Higgsfield spends credits and the carousel
// engine renders HTML; this one hands a compiled prompt to a person holding a
// ChatGPT seat and takes the image back. The seat cannot be called — a consumer
// plan carries no API key — so the queue exists to make that person's work a
// list instead of an invention.

const fileBriefSchema = z.object({
  brand: z.string().trim().min(1),
  assetType: z.string().trim().min(1),
  subject: z
    .string()
    .trim()
    .min(8, "Say what the scene is — one line.")
    .max(400),
});

export async function fileMediaBrief(
  input: unknown,
): Promise<{ ok: boolean; error?: string; brief?: BriefRow }> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const parsed = fileBriefSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const brief = await fileBrief(
      parsed.data.brand,
      parsed.data.assetType,
      parsed.data.subject,
    );
    return { ok: true, brief };
  } catch (err) {
    // compileBrief throws by design when the type belongs to another lane —
    // that message names the lane, so it is the useful thing to surface.
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not compile the brief.",
    };
  }
}

const MAX_RENDER_BYTES = 4 * 1024 * 1024;
const RENDER_TYPES = ["image/webp", "image/png", "image/jpeg"];

/**
 * FormData rather than a JSON body: the payload is an image, and a base64 hop
 * through a Server Action argument would inflate it by a third for nothing.
 */
export async function submitMediaRender(
  form: FormData,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  const session = await auth();
  const email = session?.user?.email ?? "contributor";
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const briefId = String(form.get("briefId") ?? "").trim();
  const file = form.get("file");
  if (!briefId) return { ok: false, error: "Which brief is this for?" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image attached." };
  }
  if (!RENDER_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `Unsupported image type: ${file.type || "unknown"}.`,
    };
  }
  if (file.size > MAX_RENDER_BYTES) {
    return { ok: false, error: "Image is over 4MB even after re-encoding." };
  }
  if (!isStorageConfigured()) {
    return {
      ok: false,
      error:
        "Object storage is not configured — set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.",
    };
  }

  // Read the brief first: it names the brand, which is the storage prefix, and
  // its status is the guard against two people uploading against one ask.
  const brief = await db.socialMediaBrief.findUnique({
    where: { id: briefId },
    select: { id: true, brand: true, assetType: true, status: true },
  });
  if (!brief) return { ok: false, error: "No such brief." };
  if (brief.status !== "pending") {
    return {
      ok: false,
      error: "Already handled — someone else rendered this.",
    };
  }

  const ext = file.type.split("/")[1] ?? "webp";
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const stored = await putMedia(
      brief.brand,
      brief.id.slice(0, 12),
      `${brief.assetType}.${ext}`,
      bytes,
      file.type,
    );
    await markRendered(brief.id, stored.url, email);
    return { ok: true, url: stored.url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export async function dismissMediaBrief(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const email = session?.user?.email ?? "contributor";
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  const parsed = z.object({ id: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await dismissBrief(parsed.data.id, `dismissed by ${email}`);
  return { ok: true };
}

import {
  generateStudioImageCore,
  type GenerateStudioImageInput,
  type GenerateStudioImageResult,
} from "@/lib/studio-image";

export async function generateStudioImage(
  input: GenerateStudioImageInput,
): Promise<GenerateStudioImageResult> {
  // Server Actions are public POST endpoints and do not traverse proxy.ts's
  // matcher, so the Hub's page guard never sees this call. Without the check
  // here there is none: this was the only exported action in the file missing
  // it, and the only one that can reach a paid renderer.
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }

  return generateStudioImageCore(input);
}

export interface ConceptReadResult {
  ok: boolean;
  /** The calendar slot, when one was asked for and exists. */
  slot?: PlanSlot;
  /** The feature's concept note, when the brand has one for it. */
  concept?: Concept;
  error?: string;
}

/**
 * The Draft stage's concept card: what a writer reads before writing. Either
 * key may be absent — a slot implies its feature, a feature alone is an
 * ad-hoc post about it.
 */
export async function readConcept(input: {
  product: string;
  feature?: string;
  slot?: string;
}): Promise<ConceptReadResult> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  const slot = input.slot ? findSlot(input.slot) : null;
  if (slot && !slot.key.startsWith(`${input.product}#`)) {
    return { ok: false, error: "That slot belongs to another brand." };
  }
  const concept = conceptFor(input.product, input.feature || slot?.feature);
  return {
    ok: true,
    ...(slot && { slot }),
    ...(concept && { concept }),
  };
}

// ── Free-standing uploads ───────────────────────────────────────────────────
//
// The media team's own lane: finished images and videos put on the shelf for
// a brand (and optionally a feature), waiting for a post — no brief first.
// Images ride the server action (≤4MB, the body limit); videos go browser →
// S3 on a presigned PUT and are recorded after the bytes land.

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const uploadMetaSchema = z.object({
  product: z.enum(PRODUCT_IDS, { message: "Unknown product." }),
  feature: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/, "Unknown feature.")
    .nullable()
    .optional(),
  caption: z
    .string()
    .trim()
    .min(2, "Say in a few words what it shows.")
    .max(200, "Keep the caption under 200 characters."),
  assetType: z.enum(ASSET_TYPES).optional(),
});

function uploadId(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function uploadMedia(
  form: FormData,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  const session = await auth();
  const email = session?.user?.email ?? "contributor";
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  const meta = uploadMetaSchema.safeParse({
    product: form.get("product"),
    feature: form.get("feature") || null,
    caption: form.get("caption"),
    assetType: form.get("assetType") || undefined,
  });
  if (!meta.success) {
    return { ok: false, error: meta.error.issues[0]?.message ?? "Invalid upload." };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image attached." };
  }
  if (!RENDER_TYPES.includes(file.type)) {
    return { ok: false, error: `Unsupported image type: ${file.type || "unknown"}.` };
  }
  if (file.size > MAX_RENDER_BYTES) {
    return { ok: false, error: "Image is over 4MB — export it smaller, or as WebP." };
  }
  if (!isStorageConfigured()) {
    return { ok: false, error: "Object storage is not configured on this deployment." };
  }
  try {
    const id = uploadId();
    const ext = file.type.split("/")[1] ?? "webp";
    const stored = await putMedia(
      meta.data.product,
      id,
      `${meta.data.feature ?? "brand"}.${ext}`,
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    await recordUpload({
      brand: meta.data.product,
      assetType: meta.data.assetType ?? "product",
      subject: meta.data.caption,
      feature: meta.data.feature ?? null,
      kind: "image",
      url: stored.url,
      by: email,
    });
    return { ok: true, url: stored.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function presignMediaUpload(input: {
  product: string;
  contentType: string;
  size: number;
}): Promise<{ ok: boolean; error?: string; uploadUrl?: string; key?: string }> {
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  if (!(PRODUCT_IDS as readonly string[]).includes(input.product)) {
    return { ok: false, error: "Unknown product." };
  }
  if (!VIDEO_TYPES.includes(input.contentType)) {
    return { ok: false, error: "Videos must be MP4, WebM or MOV." };
  }
  if (!(input.size > 0) || input.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: "Videos must be under 200MB." };
  }
  if (!isStorageConfigured()) {
    return { ok: false, error: "Object storage is not configured on this deployment." };
  }
  try {
    const signed = await presignMediaPut(
      input.product,
      uploadId(),
      `video.${VIDEO_EXT[input.contentType]}`,
      input.contentType,
    );
    return { ok: true, uploadUrl: signed.uploadUrl, key: signed.key };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not sign the upload." };
  }
}

/** Records a video the browser already PUT to S3 under a presigned key. */
export async function confirmMediaUpload(input: {
  product: string;
  key: string;
  feature?: string | null;
  caption: string;
}): Promise<{ ok: boolean; error?: string; url?: string }> {
  const session = await auth();
  const email = session?.user?.email ?? "contributor";
  if (!(await requireContributor())) {
    return { ok: false, error: "Forbidden: contributors only." };
  }
  const meta = uploadMetaSchema.safeParse({
    product: input.product,
    feature: input.feature || null,
    caption: input.caption,
  });
  if (!meta.success) {
    return { ok: false, error: meta.error.issues[0]?.message ?? "Invalid upload." };
  }
  // The key must be one presignMediaUpload minted for this brand — never a
  // URL the client chose.
  const url = input.key.startsWith(`media/${meta.data.product}/u`)
    ? mediaUrlFor(input.key)
    : null;
  if (!url) return { ok: false, error: "That upload key is not ours." };
  try {
    await recordUpload({
      brand: meta.data.product,
      assetType: "reel",
      subject: meta.data.caption,
      feature: meta.data.feature ?? null,
      kind: "video",
      url,
      by: email,
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not record the upload." };
  }
}
