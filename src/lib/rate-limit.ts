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
  identifier: string
): Promise<void> {
  if (process.env.NODE_ENV === "development" || !redis) return;
  const limiter = rateLimiters[limiterType];
  if (!limiter) return;
  const res = await limiter.limit(identifier);
  if (!res.success) {
    throw new RateLimitError(Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)));
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
