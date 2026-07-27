// The metrics pull-back.
//
// The counterpart to the drain: that one pushes copy out, this one reads
// numbers back. Same caller shape (GitHub Actions with a bearer token), same
// claim-before-work concurrency, a much slower cadence — reach moves on a scale
// of hours and Graph rate-limits per app, so six-hourly over a thirty-day
// window is already ~120 reads per post.
//
// Until this existed, lib/facebook-metrics.ts had no callers and SocialMetric
// had no writer: the plumbing was laid at both ends with nothing in between.
//
// THE FAILURE POLICY IS THE POINT. Three of the four failure kinds cannot be
// fixed by trying again — a missing scope needs a token, a retired metric name
// needs a code change, and a brand with no Page needs a Page. Retrying those on
// every run forever would burn quota and bury the one signal that matters. They
// are terminal on the first attempt and set `metricsGaveUp`; only `transport`
// retries.
//
// TO RE-ARM after fixing a token or a metric name:
//   UPDATE "SocialVariant"
//      SET "metricsGaveUp" = false, "metricsAttempts" = 0, "metricsError" = NULL
//    WHERE "metricsGaveUp" = true;

import { isAuthorizedBearer } from "@/lib/cron-auth";
import { METRIC_CHANNEL_IDS } from "@/components/root/social/config";
import { db } from "@/lib/db";
import { getFacebookPostMetrics } from "@/lib/facebook-metrics";
import type { MetricsFailure } from "@/lib/facebook-metrics";
import { sendReview } from "@/lib/social-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 25;
/** Transport failures only. The other kinds are terminal at the first attempt. */
const MAX_ATTEMPTS = 5;
/** A post under an hour old has noise, not numbers. */
const MIN_AGE_MS = 60 * 60_000;
const REFRESH_EVERY_MS = 6 * 60 * 60_000;
/** Stop chasing a post after a month; the curve has flattened by then. */
const REFRESH_WINDOW_DAYS = 30;

/**
 * Retrying cannot help with these. The fix is a token, a metric name, or a
 * Facebook Page — all of them outside this process.
 */
const TERMINAL: ReadonlySet<MetricsFailure["kind"]> = new Set([
  "permission",
  "bad-metric",
  "not-configured",
]);

/**
 * `not-configured` is a known gap, not an incident: sijillee and moalimee have
 * no Page yet, and saying so once a run would be noise forever.
 */
const SILENT: ReadonlySet<MetricsFailure["kind"]> = new Set(["not-configured"]);

function remedy(kind: MetricsFailure["kind"]): string {
  switch (kind) {
    case "permission":
      return "Add read_insights / pages_read_user_content to the app's Use Case (Dashboard → Use cases → Customize → Permissions and features), then re-arm.";
    case "bad-metric":
      return "Meta retired the metric names again. Fix METRIC_VIEWS / METRIC_REACH in lib/facebook-metrics.ts — the token is fine.";
    case "not-configured":
      return "This brand has no Facebook Page token yet.";
    default:
      return "";
  }
}

interface MetricOutcome {
  variant: string;
  brand: string;
  channel: string;
  status: "fetched" | "partial" | "retrying" | "gave-up" | "lost-race";
  reach?: number;
  views?: number;
  detail?: string;
}

export async function GET(request: Request): Promise<Response> {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not set — metrics are disabled." },
      { status: 503 },
    );
  }
  if (!isAuthorizedBearer(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const now = Date.now();
  const due = await db.socialVariant.findMany({
    where: {
      status: "published",
      externalId: { not: null },
      // Derived from the registry, not a literal: Facebook is the only channel
      // that reports numbers back today, and this follows if that changes.
      channel: { in: METRIC_CHANNEL_IDS },
      metricsGaveUp: false,
      publishedAt: {
        lte: new Date(now - MIN_AGE_MS),
        gte: new Date(now - REFRESH_WINDOW_DAYS * 86_400_000),
      },
      OR: [
        { metricsFetchedAt: null },
        { metricsFetchedAt: { lte: new Date(now - REFRESH_EVERY_MS) } },
      ],
    },
    // `nulls: "first"` is load-bearing. Postgres sorts NULLs LAST in ASC, so
    // without it a backlog of never-fetched variants starves indefinitely
    // behind merely-stale ones — a bug that only appears once there is a
    // backlog, which is exactly when it is hardest to notice.
    orderBy: [
      { metricsFetchedAt: { sort: "asc", nulls: "first" } },
      { publishedAt: "asc" },
    ],
    take: BATCH,
    include: { piece: true },
  });

  const results: MetricOutcome[] = [];
  // A missing scope hits every variant in the batch identically. Accumulating
  // one alert per (brand, kind) is the difference between one message and
  // twenty-five.
  const alerts = new Map<string, string>();

  for (const variant of due) {
    const base = {
      variant: variant.id,
      brand: variant.piece.brand,
      channel: variant.channel,
    };

    // Claim on the field we already read. Reading metrics twice is harmless, so
    // this needs no status of its own — it just makes an overlapping run a
    // no-op instead of a duplicate write.
    const claimed = await db.socialVariant.updateMany({
      where: {
        id: variant.id,
        metricsFetchedAt: variant.metricsFetchedAt,
        metricsGaveUp: false,
      },
      data: { metricsAttempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      results.push({ ...base, status: "lost-race" });
      continue;
    }

    const attempts = variant.metricsAttempts + 1;
    const { engagement, reach } = await getFacebookPostMetrics(
      variant.externalId!,
      variant.piece.brand,
    );

    // Give up only when BOTH halves are terminal. If reach is permission-blocked
    // but engagement works, the real reactions/comments/shares are worth storing
    // and the row stays live so it self-heals the day the scope lands. That
    // costs one wasted call per refresh and buys automatic recovery.
    const failures = [engagement, reach].filter((r) => !r.ok) as Array<
      { ok: false } & MetricsFailure
    >;
    const bothFailed = failures.length === 2;
    const bothTerminal =
      bothFailed && failures.every((f) => TERMINAL.has(f.kind));

    if (bothTerminal) {
      const kind = failures[0].kind;
      const detail =
        `${failures.map((f) => f.error).join(" · ")} ${remedy(kind)}`.trim();
      await db.socialVariant.update({
        where: { id: variant.id },
        data: { metricsGaveUp: true, metricsError: detail },
      });
      results.push({ ...base, status: "gave-up", detail });
      if (!SILENT.has(kind)) {
        alerts.set(
          `${variant.piece.brand}:${kind}`,
          `⚠️ Social metrics stopped for ${variant.piece.brand} (${kind}) — ${detail}`,
        );
      }
      continue;
    }

    if (bothFailed) {
      const detail = failures.map((f) => f.error).join(" · ");
      if (attempts >= MAX_ATTEMPTS) {
        await db.socialVariant.update({
          where: { id: variant.id },
          data: { metricsGaveUp: true, metricsError: detail },
        });
        results.push({ ...base, status: "gave-up", detail });
        alerts.set(
          `${variant.piece.brand}:transport`,
          `⚠️ Social metrics gave up for ${variant.piece.brand} after ${MAX_ATTEMPTS} attempts — ${detail}`,
        );
        continue;
      }
      // Record the error and leave it. The six-hourly cadence IS the backoff —
      // five attempts span thirty hours, far longer than any Graph blip, and
      // no explicit delay is needed. Deliberately does NOT touch
      // metricsFetchedAt: that column means "last SUCCESSFUL read", and writing
      // a scheduling cursor into it would put a future timestamp in a field
      // every later reader takes as a fact about the past.
      await db.socialVariant.update({
        where: { id: variant.id },
        data: { metricsError: detail },
      });
      results.push({ ...base, status: "retrying", detail });
      continue;
    }

    // At least one half succeeded. Insert, never upsert — SocialMetric is a
    // time series and the delta between two readings is the interesting number.
    await db.socialMetric.create({
      data: {
        variantId: variant.id,
        reach: reach.ok ? reach.reach : 0,
        views: reach.ok ? reach.views : 0,
        reactions: engagement.ok ? engagement.reactions : 0,
        comments: engagement.ok ? engagement.comments : 0,
        shares: engagement.ok ? engagement.shares : 0,
        // No analytics destination is wired, so this stays 0 rather than being
        // filled with a platform number that means something else.
        clicks: 0,
      },
    });

    const halfError = failures[0]?.error;
    await db.socialVariant.update({
      where: { id: variant.id },
      data: {
        metricsFetchedAt: new Date(),
        metricsAttempts: 0,
        metricsError: halfError ?? null,
      },
    });

    results.push({
      ...base,
      status: halfError ? "partial" : "fetched",
      reach: reach.ok ? reach.reach : undefined,
      views: reach.ok ? reach.views : undefined,
      detail: halfError,
    });
  }

  for (const message of alerts.values()) {
    await sendReview(message, "social metrics");
  }

  if (results.length) {
    console.log(
      `[social/metrics] ${results.map((r) => `${r.brand}:${r.status}`).join(" ")}`,
    );
  }

  return Response.json({
    ok: results.every((r) => r.status !== "gave-up"),
    due: due.length,
    fetched: results.filter((r) => r.status === "fetched").length,
    results,
  });
}
