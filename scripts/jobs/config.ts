// ── Send-loop configuration ──────────────────────────────────────────────────
//
// Defaults here; jobs/loop.config.json (gitignored, personal) overrides any key.
// The ramp is deliberate: the first two weeks send 5/day so the first waves
// can be read in the digest before the volume rises (plan, 2026-09-27).

import { existsSync, readFileSync } from "node:fs";

export interface LoopConfig {
  fromAccount: string;
  dailyCap: number;
  rampCap: number;
  rampUntil: string;
  followUpCap: number;
  sendDays: number[]; // 1 = Monday … 5 = Friday
  sendHour: number; // the wave leaves at this hour
  windowFrom: number;
  windowTo: number;
  slackTarget: string; // hermes send --to
}

const DEFAULTS: LoopConfig = {
  fromAccount: "osmanabdout@hotmail.com",
  dailyCap: 10,
  rampCap: 5,
  rampUntil: "2026-10-11",
  followUpCap: 5,
  sendDays: [1, 2, 3, 4, 5],
  sendHour: 10,
  windowFrom: 9,
  windowTo: 17,
  slackTarget: "slack:D0AQ0JR5ZU4",
};

export function loadConfig(): LoopConfig {
  const path = "jobs/loop.config.json";
  if (!existsSync(path)) return DEFAULTS;
  return {
    ...DEFAULTS,
    ...(JSON.parse(readFileSync(path, "utf-8")) as Partial<LoopConfig>),
  };
}

export function todaysCap(
  c: LoopConfig,
  today = new Date().toISOString().slice(0, 10),
): number {
  return today <= c.rampUntil ? c.rampCap : c.dailyCap;
}

/// Kigali is UTC+2 year-round; the Mac is on CAT too, but launchd children
/// should not depend on it.
export function kigaliNow(d = new Date()): {
  date: string;
  hour: number;
  weekday: number;
} {
  const k = new Date(d.getTime() + 2 * 3_600_000);
  return {
    date: k.toISOString().slice(0, 10),
    hour: k.getUTCHours(),
    weekday: k.getUTCDay(),
  };
}

export function killSwitchOn(): boolean {
  return existsSync("jobs/.send-off") || process.env.JOBS_SEND === "off";
}
