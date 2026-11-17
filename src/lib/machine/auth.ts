// Bearer token → Machine. Only the sha256 of a token is stored, so the lookup is by hash.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { db } from "@/lib/db";
import { getProfile, type Profile } from "./profiles";

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let limiter: Ratelimit | null | undefined;
function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  limiter =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? new Ratelimit({
          redis: Redis.fromEnv(),
          limiter: Ratelimit.slidingWindow(120, "1 m"),
          prefix: "@upstash/ratelimit/machine",
        })
      : null; // no Redis (local dev): fail open, like src/lib/rate-limit.ts
  return limiter;
}

export interface MachineAuth {
  machineId: string;
  login: string;
  profile: Profile;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** A MachineAuth, or the Response to return (401 / 403 / 429). */
export async function authenticate(request: Request): Promise<MachineAuth | Response> {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!m) return json({ error: "unauthorized" }, 401);
  const tokenHash = await sha256Hex(m[1]);
  const machine = await db.machine.findUnique({
    where: { tokenHash },
    select: { id: true, login: true },
  });
  if (!machine) return json({ error: "unauthorized" }, 401);
  const rl = getLimiter();
  if (rl) {
    const r = await rl.limit(tokenHash).catch(() => null);
    if (r && !r.success)
      return json({ error: "rate_limited" }, 429, {
        "retry-after": String(Math.max(1, Math.ceil((r.reset - Date.now()) / 1000))),
      });
  }
  const profile = getProfile(machine.login);
  if (!profile) return json({ error: "no_profile" }, 403);
  return { machineId: machine.id, login: machine.login, profile };
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}

/** Parse a JSON body with a zod schema; the Response on failure. */
export async function readBody<T>(
  request: Request,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
): Promise<T | Response> {
  const raw = await request.json().catch(() => undefined);
  const r = schema.safeParse(raw);
  return r.success ? r.data : json({ error: "bad_request" }, 400);
}
