// The scheduled-publish drain.
//
// Runs from GitHub Actions rather than Vercel Cron: a drain needs to fire every
// few minutes, cron frequency is a Vercel plan-tier limit, and kun already
// spends a cron slot on drafting. Actions is free, gives ~5-minute granularity,
// and this endpoint was already bearer-authenticated for exactly this shape of
// caller — so scheduling does not wait on a Vercel Pro upgrade.
//
// Publishing here is unattended, which is only acceptable because a variant
// cannot reach `scheduled` without a human putting it there. The approval gate
// moved earlier in the chain; it did not disappear.

import { isAuthorizedBearer } from "@/lib/cron-auth";
import {
  DRAIN_CHANNEL_IDS,
  type ChannelId,
} from "@/components/root/social/config";
import { db } from "@/lib/db";
import { resolveMediaUrls } from "@/lib/media-kind";
import { deliverPost } from "@/lib/social-publish";
import { REAP_AFTER_MS, reapDecision } from "@/lib/social-reap";
import { sendReview } from "@/lib/social-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps a function at 60s without Fluid Compute and allows more
// with it. 60 is the one value that deploys under both, so every social route
// pins it and the loop routes budget their work to finish inside it.
export const maxDuration = 60;

// Bounded so one permanently broken channel cannot retry forever.
const MAX_ATTEMPTS = 3;
// Keeps a backlog from running past the function timeout. Anything left over is
// picked up by the next run, which is 15 minutes away.
const BATCH = 25;
// Stop STARTING new work past this point: the worst single item is a 25s
// Facebook photo call plus writes, so an item started at the buzzer still
// finishes inside maxDuration. The budget, not BATCH, is the real bound.
const BUDGET_MS = 30_000;

/** 5 min, then 25 — long enough for a transient platform outage to pass. */
function backoffMs(attempts: number): number {
  return 5 * 60_000 * Math.pow(5, Math.max(0, attempts - 1));
}

// An hour: long enough for a sleeping Mac to wake and drain, short enough not
// to spend Max tokens answering an ask nobody is watching — the window stops
// polling after 10 minutes, so a very late answer lands unseen anyway.
const DRAFT_ASK_TTL_MS = 60 * 60_000;

// Abandoned draft asks. The Mac-side drainer only runs while a laptop is
// awake; this sweep rides the one social schedule that runs regardless, so
// "nobody ever picked it up" becomes a visible `failed` in the agent window
// instead of a pending row that outlives everyone's attention.
async function expireStaleDraftAsks(): Promise<number> {
  const expired = await db.socialDraftRequest.updateMany({
    where: {
      status: "pending",
      createdAt: { lt: new Date(Date.now() - DRAFT_ASK_TTL_MS) },
    },
    data: {
      status: "failed",
      note: "expired — no drafting session picked this up within an hour; ask again when the queue shows a recent check",
      answeredAt: new Date(),
    },
  });
  return expired.count;
}

interface DrainOutcome {
  variant: string;
  brand: string;
  channel: string;
  status: "published" | "retrying" | "failed" | "lost-race" | "reaped";
  detail?: string;
}

// Recover rows stranded in `publishing` by a killed function — see
// lib/social-reap.ts for the full rationale and the accepted residual risk.
async function reapStuck(): Promise<DrainOutcome[]> {
  const reaped: DrainOutcome[] = [];
  const stuck = await db.socialVariant.findMany({
    where: {
      status: "publishing",
      updatedAt: { lte: new Date(Date.now() - REAP_AFTER_MS) },
    },
    take: BATCH,
    include: { piece: true },
  });

  for (const row of stuck) {
    const decision = reapDecision(
      { scheduledFor: row.scheduledFor, attempts: row.attempts },
      new Date(),
      MAX_ATTEMPTS,
    );
    // Conditional, like every transition here: the terminal write may have
    // landed between the read above and now.
    const claimed = await db.socialVariant.updateMany({
      where: { id: row.id, status: "publishing" },
      data:
        decision.status === "failed"
          ? { status: "failed", result: "reaped: stuck in publishing" }
          : decision.status === "pending"
            ? { status: "pending", result: "reaped: returned to pending" }
            : {
                status: "scheduled",
                scheduledFor: decision.scheduledFor,
                result: "reaped: returned to schedule",
              },
    });
    if (claimed.count === 0) continue;

    reaped.push({
      variant: row.id,
      brand: row.piece.brand,
      channel: row.channel,
      status: "reaped",
      detail: `→ ${decision.status}`,
    });
    if (decision.status === "failed") {
      await sendReview(
        `⚠️ Reaped a stuck publish after ${MAX_ATTEMPTS} attempts — ${row.piece.brand} → ${row.channel}.`,
        `social drain: ${row.piece.brand}`,
      );
    }
  }
  return reaped;
}

export async function GET(request: Request): Promise<Response> {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not set — the drain is disabled." },
      { status: 503 },
    );
  }
  if (!isAuthorizedBearer(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  // Different tables, no ordering dependency — run the sweeps together.
  const [reaped, expiredAsks] = await Promise.all([
    reapStuck(),
    expireStaleDraftAsks(),
  ]);

  const due = await db.socialVariant.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: new Date() },
      // Allow-list, not a deny-list. Hermes-transport channels are delivered
      // by the gateway pulling from /api/social/queue — draining them here
      // would race it and fail anyway, since the webhook is unreachable from a
      // cloud deployment. Manual channels have nothing to execute at all.
      // Naming what this lane CAN do means a transport added later waits
      // visibly in `scheduled` instead of being attempted and silently lost.
      channel: { in: DRAIN_CHANNEL_IDS },
    },
    orderBy: { scheduledFor: "asc" },
    take: BATCH,
    include: { piece: true },
  });

  const results: DrainOutcome[] = [];
  let processed = 0;

  for (const variant of due) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    processed += 1;
    const base = {
      variant: variant.id,
      brand: variant.piece.brand,
      channel: variant.channel,
    };

    // Claim before delivering. Two overlapping runs — a slow one and its
    // successor — both see the same row; the conditional update lets exactly
    // one through, which is what stops a double post.
    const claimed = await db.socialVariant.updateMany({
      where: { id: variant.id, status: "scheduled" },
      data: { status: "publishing", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      results.push({ ...base, status: "lost-race" });
      continue;
    }

    const attempts = variant.attempts + 1;
    const result = await deliverPost({
      product: variant.piece.brand,
      text: variant.text,
      channels: [variant.channel as ChannelId],
      mediaUrls: resolveMediaUrls(variant.mediaUrls, variant.mediaUrl),
    });

    if (result.ok) {
      await db.socialVariant.update({
        where: { id: variant.id },
        data: {
          status: "published",
          publishedAt: new Date(),
          result: "ok",
          externalId: result.results[0]?.externalId,
        },
      });
      results.push({ ...base, status: "published" });
      continue;
    }

    const error = result.error ?? "unknown error";

    if (attempts < MAX_ATTEMPTS) {
      // Back to the queue with the next attempt pushed out. Deliberately not a
      // tight retry: the usual cause is a platform hiccup, and hammering it
      // turns one failure into a rate-limit.
      await db.socialVariant.update({
        where: { id: variant.id },
        data: {
          status: "scheduled",
          scheduledFor: new Date(Date.now() + backoffMs(attempts)),
          result: error,
        },
      });
      results.push({ ...base, status: "retrying", detail: error });
      continue;
    }

    await db.socialVariant.update({
      where: { id: variant.id },
      data: { status: "failed", result: error },
    });
    results.push({ ...base, status: "failed", detail: error });

    // Only shout on the terminal failure. A notice per retry would train
    // everyone to ignore the channel.
    await sendReview(
      `❌ Scheduled post gave up after ${MAX_ATTEMPTS} attempts — ${variant.piece.brand} → ${variant.channel}: ${error}`,
      `social drain: ${variant.piece.brand}`,
    );
  }

  if (results.length || reaped.length) {
    console.log(
      `[social/drain] ${[...reaped, ...results].map((r) => `${r.channel}:${r.status}${r.status === "reaped" ? r.detail : ""}`).join(" ")}`,
    );
  }

  return Response.json({
    // A reap is recovery, not a fresh failure — only a delivery that gave up
    // this run flips ok.
    ok: results.every((r) => r.status !== "failed"),
    due: due.length,
    published: results.filter((r) => r.status === "published").length,
    reaped: reaped.length,
    expiredAsks,
    deferred: due.length - processed,
    results: [...reaped, ...results],
  });
}
