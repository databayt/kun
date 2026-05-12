/**
 * Kun-specific adapter for the shared report pipeline.
 *
 * Kun is primarily a marketing / docs site. Reporters are usually anonymous
 * visitors. When a contributor IS signed in (kun only allows the contributors
 * allowlist — see /Users/abdout/kun/src/auth.ts), we use their session to
 * raise the trust signal.
 *
 * Storage: Kun has no Prisma DB. We use Upstash Redis for rate-limit + the
 * recent-submissions ledger (HF9) + corroboration counters.
 */

import { createHash } from "crypto";

import { auth } from "@/auth";
import {
  assertRateLimit,
  getClientIp,
  getRedis,
  RateLimitError as KunRateLimitError,
} from "@/lib/rate-limit";

import {
  RateLimitError,
  type ReportAdapter,
} from "./adapters/adapter";
import type { PipelineEvent, ReporterContext, ReportInput } from "./types";

const REPO = process.env.GITHUB_REPO || "databayt/kun";
const SALT = process.env.REPORT_IP_SALT || "kun-default-salt";

export const kunReportAdapter: ReportAdapter = {
  repo: REPO,
  hostAllowlist: [
    "kun.databayt.org",
    "databayt.org",
    "*.databayt.org",
    "localhost",
    "127.0.0.1",
  ],

  async getReporter(_input: ReportInput): Promise<ReporterContext> {
    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    // Kun's auth restricts to the contributors allowlist (signIn callback).
    // If a session exists at all, treat it as a DEVELOPER-class reporter.
    const session = await auth().catch(() => null);
    if (session?.user?.id) {
      return {
        kind: "authenticated",
        userId: session.user.id,
        role: (session.user.role as string) || "DEVELOPER",
        emailVerified: true,
        accountAgeDays: 365, // contributors list is curated, assume seasoned
        isSuspended: false,
        ipHash,
      };
    }
    return { kind: "anonymous", ipHash };
  },

  async checkRateLimit(identifier: string): Promise<void> {
    try {
      await assertRateLimit("report", identifier);
      await assertRateLimit("report-tenant", "kun");
    } catch (err) {
      if (err instanceof KunRateLimitError) {
        throw new RateLimitError(err.message);
      }
      throw err;
    }
  },

  async getRecentSelfSubmissions(identifier: string, withinSec: number): Promise<string[]> {
    const redis = getRedis();
    if (!redis) return [];
    const key = `report:dedup:${identifier}`;
    // List of "ts|head" entries pushed on each accepted submission.
    const raw = (await redis.lrange<string>(key, 0, 19).catch(() => null)) ?? [];
    const cutoff = Date.now() - withinSec * 1000;
    return raw
      .map((s) => {
        const idx = s.indexOf("|");
        if (idx < 0) return null;
        const ts = Number(s.slice(0, idx));
        const head = s.slice(idx + 1);
        return ts >= cutoff ? head : null;
      })
      .filter((v): v is string => v !== null);
  },

  async getCorroborationCount(host: string, path: string, withinDays: number): Promise<number> {
    const redis = getRedis();
    if (!redis) return 0;
    const key = `report:page:${host}:${normalizedPath(path)}`;
    const count = await redis.get<number>(key).catch(() => null);
    if (count == null) return 0;
    // TTL is set on write; we just trust the count here (anything in Redis is
    // within the corroboration window by construction).
    void withinDays;
    return Number(count);
  },

  async isBanned(identifier: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;
    const key = "report:banned";
    const banned = await redis.sismember(key, identifier).catch(() => 0);
    return banned === 1;
  },

  async recordPipelineEvent(event: PipelineEvent): Promise<void> {
    // Phase 1: console + Upstash KV for the dedup + corroboration counters.
    // Phase 2: write to a Prisma Report model (kun has no DB; phase 2 may
    // change this to Vercel KV streaming or stay Upstash-only).
    console.info("[report]", JSON.stringify(event));

    const redis = getRedis();
    if (!redis) return;

    // Maintain HF9 ledger — push the description head onto the reporter's list.
    if (event.outcome !== "silent-reject" && event.outcome !== "duplicate-corroborated") {
      const id =
        event.reporterKind === "authenticated"
          ? `user:${event.ipHash}` // we don't have userId here; ipHash is a proxy
          : `ip:${event.ipHash}`;
      const key = `report:dedup:${id}`;
      const entry = `${Date.now()}|${event.path.slice(0, 60)}`;
      await redis.lpush(key, entry).catch(() => {});
      await redis.ltrim(key, 0, 19).catch(() => {});
      await redis.expire(key, 60).catch(() => {}); // 60s sliding window
    }

    // Bump corroboration counter when a verified-report lands on a real URL.
    if (event.outcome === "verified-report" && event.host && event.path) {
      const key = `report:page:${event.host}:${normalizedPath(event.path)}`;
      await redis.incr(key).catch(() => {});
      await redis.expire(key, 60 * 60 * 24 * 7).catch(() => {}); // 7-day window
    }
  },

  async findExistingForUrl(host: string, path: string): Promise<{ issueNumber: number } | null> {
    const redis = getRedis();
    if (!redis) return null;
    const key = `report:issue:${host}:${normalizedPath(path)}`;
    const num = await redis.get<number>(key).catch(() => null);
    return num ? { issueNumber: Number(num) } : null;
  },
};

function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}:${SALT}`).digest("hex").slice(0, 16);
}

function normalizedPath(path: string): string {
  // strip trailing slash + query
  const beforeQuery = path.split("?")[0] ?? path;
  return beforeQuery.replace(/\/$/, "") || "/";
}
