// The Hermes lane, pull-based.
//
// Hermes runs on a personal machine behind a home connection, so kun can never
// call into it. Every design where kun must reach Hermes to make progress is
// therefore wrong — it would stall the moment a laptop lid closed. Instead the
// gateway polls here for work and reports back, which turns an outage into a
// delay rather than a loss: unclaimed work simply waits in the queue.
//
// GET  — what needs delivering on a Hermes transport, and a heartbeat.
// POST — what happened to it.
//
// Both are CRON_SECRET-bearer authenticated. Holding that secret means "a human
// already approved this", so treat it as a publishing credential.

import { isAuthorizedBearer } from "@/lib/cron-auth";
import { HERMES_CHANNEL_IDS } from "@/components/root/social/config";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 25;

async function beat(detail: string): Promise<void> {
  // The Hub's Hermes row shows reachability from Vercel, which is always false
  // in production and says nothing about whether the gateway is alive. This is
  // the signal that actually means something.
  await db.systemHeartbeat
    .upsert({
      where: { key: "hermes" },
      create: { key: "hermes", detail },
      update: { detail },
    })
    .catch(() => {});
}

export async function GET(request: Request): Promise<Response> {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not set — the queue is disabled." },
      { status: 503 },
    );
  }
  if (!isAuthorizedBearer(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  // Claim nothing. A poll that claimed work would strand it as `publishing`
  // for good if Hermes died between the read and the report — and it dies
  // routinely. Hermes claims per item by reporting an outcome instead.
  const items = await db.socialVariant.findMany({
    where: {
      status: { in: ["scheduled", "approved"] },
      channel: { in: HERMES_CHANNEL_IDS },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    orderBy: { scheduledFor: "asc" },
    take: BATCH,
    include: { piece: true },
  });

  await beat(`polled ${items.length}`);

  return Response.json({
    ok: true,
    count: items.length,
    items: items.map((v) => ({
      id: v.id,
      brand: v.piece.brand,
      channel: v.channel,
      text: v.text,
      mediaUrl: v.mediaUrl,
      locale: v.piece.locale,
      attempts: v.attempts,
    })),
  });
}

interface ReportBody {
  id?: unknown;
  ok?: unknown;
  externalId?: unknown;
  error?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not set — the queue is disabled." },
      { status: 503 },
    );
  }
  if (!isAuthorizedBearer(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as ReportBody | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || typeof body?.ok !== "boolean") {
    return Response.json(
      { ok: false, error: "Body must be { id: string, ok: boolean, ... }." },
      { status: 400 },
    );
  }

  await beat(`reported ${id}`);

  const variant = await db.socialVariant.findUnique({ where: { id } });
  if (!variant) {
    return Response.json(
      { ok: false, error: "Unknown variant." },
      { status: 404 },
    );
  }

  // Idempotency. A flapping client retries, and a retry after a report that
  // did land must not flip a published row back or double-count an attempt.
  // The conditional update is the whole guard: only a row still awaiting
  // delivery moves.
  const settled = await db.socialVariant.updateMany({
    where: { id, status: { in: ["scheduled", "approved"] } },
    data: body.ok
      ? {
          status: "published",
          publishedAt: new Date(),
          result: "ok",
          externalId:
            typeof body.externalId === "string" ? body.externalId : undefined,
          attempts: { increment: 1 },
        }
      : {
          status: "failed",
          result:
            typeof body.error === "string"
              ? body.error
              : "hermes reported a failure",
          attempts: { increment: 1 },
        },
  });

  if (settled.count === 0) {
    // Already settled by an earlier report, or by the drain. Not an error —
    // saying so lets Hermes drop the item instead of retrying forever.
    return Response.json({
      ok: true,
      duplicate: true,
      status: variant.status,
    });
  }

  console.log(
    `[social/queue] ${body.ok ? "published" : "failed"} variant=${id} channel=${variant.channel} via=hermes`,
  );

  return Response.json({ ok: true, duplicate: false });
}
