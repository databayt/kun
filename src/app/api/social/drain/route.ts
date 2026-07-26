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
import type { ChannelId } from "@/components/root/social/config";
import { db } from "@/lib/db";
import { deliverPost } from "@/lib/social-publish";
import { sendReview } from "@/lib/social-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bounded so one permanently broken channel cannot retry forever.
const MAX_ATTEMPTS = 3;
// Keeps a backlog from running past the function timeout. Anything left over is
// picked up by the next run, which is 15 minutes away.
const BATCH = 25;

/** 5 min, then 25 — long enough for a transient platform outage to pass. */
function backoffMs(attempts: number): number {
  return 5 * 60_000 * Math.pow(5, Math.max(0, attempts - 1));
}

interface DrainOutcome {
  variant: string;
  brand: string;
  channel: string;
  status: "published" | "retrying" | "failed" | "lost-race";
  detail?: string;
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

  const due = await db.socialVariant.findMany({
    where: { status: "scheduled", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: BATCH,
    include: { piece: true },
  });

  const results: DrainOutcome[] = [];

  for (const variant of due) {
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
      mediaUrl: variant.mediaUrl ?? undefined,
    });

    if (result.ok) {
      await db.socialVariant.update({
        where: { id: variant.id },
        data: { status: "published", publishedAt: new Date(), result: "ok" },
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

  if (results.length) {
    console.log(
      `[social/drain] ${results.map((r) => `${r.channel}:${r.status}`).join(" ")}`,
    );
  }

  return Response.json({
    ok: results.every((r) => r.status !== "failed"),
    due: due.length,
    published: results.filter((r) => r.status === "published").length,
    results,
  });
}
