// Pure helpers for the /machines fleet page (kept apart so they are unit-testable).
import { readinessSchema, type Readiness } from "@/lib/machine/contract";

export const STALE_MS = 48 * 3600 * 1000;

/** Parse the stored `readiness` JSON; null when absent or malformed. */
export function parseReadiness(v: unknown): Readiness | null {
  const r = readinessSchema.safeParse(v);
  return r.success ? r.data : null;
}

export type FleetState = "ok" | "attention" | "stale";

/** Red when not seen for 48h or any step fails; "stale" wins so the reason is the louder one. */
export function fleetState(
  lastSeenAt: Date | null,
  readiness: Readiness | null,
  now = Date.now(),
): FleetState {
  if (!lastSeenAt || now - lastSeenAt.getTime() > STALE_MS) return "stale";
  if (readiness && readiness.failing.length > 0) return "attention";
  return "ok";
}

export function relativeTime(
  d: Date | null,
  t: { never: string; justNow: string; minAgo: string; hourAgo: string; dayAgo: string },
  now = Date.now(),
): string {
  if (!d) return t.never;
  const m = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (m < 1) return t.justNow;
  if (m < 60) return t.minAgo.replace("{n}", String(m));
  const h = Math.round(m / 60);
  if (h < 48) return t.hourAgo.replace("{n}", String(h));
  return t.dayAgo.replace("{n}", String(Math.round(h / 24)));
}
