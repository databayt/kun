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
  jobsChannel: string; // private #jobs — weekly report + discussion thread
  whatsappCap: number; // applications/day from Abdout's own WhatsApp number
  briefWhatsApp: string; // where the interview/offer briefs go ("" = off)
  vetoHours: number; // a QUEUED card waits this long before it can send
  pausedLanes: string[]; // CRM campaign values the wave skips
  dailyTotalCap: number; // email + ATS applications per day (Abdout's goal: 100)
  minCoverageByLane: Record<string, number>; // tailored-CV fit floor per campaign
}

const DEFAULTS: LoopConfig = {
  fromAccount: "osmanabdout@hotmail.com",
  dailyCap: 40, // hotmail ceiling (Abdout, 2026-09-27: cap the personal mailbox at 40)
  rampCap: 40,
  rampUntil: "2026-10-11",
  followUpCap: 5,
  sendDays: [1, 2, 3, 4, 5],
  sendHour: 10,
  windowFrom: 9,
  windowTo: 17,
  slackTarget: "slack:D0AQ0JR5ZU4",
  // Private on purpose (CVs, contacts) — created 2026-10-10, kun bot invited.
  jobsChannel: "C0C8A8YRXNW",
  // Abdout, 2026-10-04: apply on WhatsApp too. Small on purpose — a personal
  // number that cold-messages many strangers a day risks a WhatsApp ban.
  whatsappCap: 5,
  // Abdout, 2026-10-05: a WhatsApp brief only when an application is
  // accepted (interview or offer) — not on every send. His own chat.
  briefWhatsApp: "+249919071294",
  vetoHours: 2,
  // Abdout, 2026-10-03: electrical/protection back on (his deepest CV, Gulf +
  // East Africa). 2026-10-05: marine ETO back on too — no lane is paused.
  pausedLanes: [],
  dailyTotalCap: 100,
  minCoverageByLane: { AI_TRAINING: 20 },
};

/// Priority, lowest first (Abdout, 2026-10-03): days-to-cash — AI-training
/// gigs and software roles → remote → freelance + electrical/protection →
/// Databayt tenders and client projects → engineering contracts. Marine ETO
/// (unpaused 2026-10-05) sits with electrical — same CV family, ready marine CV.
/// Paused lanes never reach the wave.
/// 2026-10-10 repositioning (quick earn): AI-training / Arabic-AI evaluation
/// first (Mercor confirms Rwanda, weekly Stripe pay), then software roles,
/// then the fixed-price freelance offer; US-heavy remote Greenhouse drops a
/// band — it rarely hires from Rwanda. The weekly adopter may re-order these
/// through `laneBand` in jobs/loop.config.json.
export const LANE_BAND: Record<string, number> = {
  AI_TRAINING: 0,
  WEB_DEVELOPER: 1,
  FREELANCE: 2,
  REMOTE_WORLDWIDE: 3,
  PROTECTION: 3,
  ELECTRICAL: 3,
  TENDER: 4,
  CLIENT_PROJECT: 4,
  ENGINEERING_CONTRACT: 5,
  MARINE_ETO: 3,
};

/// The rung a posting names, as a sort band — lower goes out first. Abdout's
/// goal is the shortest path to an offer (2026-09-28), so a junior or
/// unlabelled rung, which has the widest funnel and the shortest interview
/// loop, is queued ahead of a senior one. This orders the queue; nothing is
/// filtered out, and a senior role still sends the same day if the cap allows.
export function seniorityBand(title: string): number {
  if (/\b(junior|jr\.?|graduate|entry[ -]level|trainee|apprentice)\b/i.test(title)) return 1;
  if (/\b(senior|sr\.?|lead|staff|principal)\b/i.test(title)) return 3;
  return 2; // unlabelled, which in practice reads as mid-level
}

/// Limits the weekly adopter can never cross, whatever the data says
/// (Abdout, 2026-10-10: fully autonomous adoption inside these walls).
export const HARD_LIMITS = {
  dailyTotalCap: 100,
  dailyCap: 40, // hotmail account-lock risk
  rampCap: 40,
  whatsappCap: 5, // personal-number ban risk
  followUpCap: 10,
  vetoHours: { min: 1, max: 24 },
};

// Adopted lane order overrides the defaults above, once at load.
try {
  const o = existsSync("jobs/loop.config.json")
    ? (JSON.parse(readFileSync("jobs/loop.config.json", "utf-8")) as {
        laneBand?: Record<string, number>;
      })
    : {};
  Object.assign(LANE_BAND, o.laneBand ?? {});
} catch {
  // a malformed override must never stop the loop — defaults stand
}

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
