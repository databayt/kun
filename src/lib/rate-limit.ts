/**
 * Upstash-backed rate limiting. Copied verbatim from mkan with the `report`
 * bucket added (5 reports per 10 minutes per identifier, plus a per-tenant
 * report-tenant bucket of 30/hour to catch coordinated abuse).
 *
 * Server actions: `await assertRateLimit("report", identifier)` at the top
 * of the action; throws RateLimitError if the bucket is empty. In development
 * (no Redis) it fails open.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

export const rateLimiters = {
  /** Mutating actions in general. */
  mutation: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/mutation",
      })
    : null,
  /** Report submissions per reporter (user or IP). */
  report: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "10 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/report",
      })
    : null,
  /** Per-tenant aggregate so one tenant can't flood with many reporters. */
  "report-tenant": redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/report-tenant",
      })
    : null,
  /** Inline Gemini drafting, all contributors together — a spend cap on the
   *  20-requests/day free tier (D-20260807), not an abuse gate. */
  "draft-inline": redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(8, "1 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/draft-inline",
      })
    : null,
  /** The same cap per contributor, so one busy reviewer cannot spend the
   *  team's morning quota on refinements alone. */
  "draft-inline-user": redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(4, "1 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/draft-inline-user",
      })
    : null,
};

export class RateLimitError extends Error {
  readonly code = "rate_limited" as const;
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super("Too many requests");
    this.retryAfter = retryAfter;
  }
}

export async function assertRateLimit(
  limiterType: keyof typeof rateLimiters,
  identifier: string,
): Promise<void> {
  // Development runs without Upstash on purpose.
  if (process.env.NODE_ENV === "development") return;

  // Production must fail CLOSED. Returning here on a missing config meant a
  // deploy without Upstash silently accepted unlimited submissions — the abuse
  // pipeline looked healthy while enforcing nothing.
  if (!redis) {
    throw new Error(
      "Rate limiting is not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Refusing the request rather than accepting it unlimited.",
    );
  }
  const limiter = rateLimiters[limiterType];
  if (!limiter) {
    throw new Error(
      `Rate limiter "${limiterType}" is not configured. Refusing the request.`,
    );
  }
  const res = await limiter.limit(identifier);
  if (!res.success) {
    throw new RateLimitError(
      Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    );
  }
}

/**
 * The inline draft lane's limiter — non-throwing and fail-OPEN by design,
 * diverging from assertRateLimit's fail-closed doctrine on purpose.
 *
 * assertRateLimit protects an abuse surface: there, accepting a request that
 * should have been refused is the failure, so a missing Redis must refuse.
 * This helper caps SPEND on a measured 20-requests/day free tier
 * (D-20260807), and the whole surface is already contributor-gated. A false
 * never refuses the ask — it skips the inline Gemini call and the row queues
 * for the Mac lane, the same fallback every other inline miss takes, so the
 * 9th draft of a busy minute gets last week's latency instead of an error.
 * Failing closed would silently kill the fast lane the day Redis is missing,
 * while Gemini's own 429 still backstops the daily total either way.
 */
export async function allowInlineDraft(identifier: string): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  const global = rateLimiters["draft-inline"];
  const user = rateLimiters["draft-inline-user"];
  if (!global || !user) return true;
  try {
    const [g, u] = await Promise.all([
      // One shared key: the global bucket meters the lane, not a caller.
      global.limit("all"),
      user.limit(identifier),
    ]);
    return g.success && u.success;
  } catch {
    // An Upstash outage must not take the fast lane down with it.
    return true;
  }
}

/** Resolve the client IP from request headers (best-effort). */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    "0.0.0.0"
  );
}

/** Get the Upstash Redis client. May be null in development without env. */
export function getRedis(): Redis | null {
  return redis;
}
