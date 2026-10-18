// The dated content plan — the month a writer can read.
//
// content/social/queue/<brand>/plan.json is the editorial plan: numbered
// weeks of numbered slots, each with a theme, a kind, the feature it is about,
// the persona it speaks to, its angle and a one-line guide to the shape of the
// post. It was written undated on purpose (a queue survives a gap), which left
// the Hub unable to say what is due on which day. A start date per brand turns
// the week/slot grid into days; nothing in the file itself changes.
//
// A slot is linked to its draft by `SocialDraftRequest.slot` ("<brand>#NNN"),
// which the queue loader writes and an ask filed from the Calendar or Draft
// stage carries. Brands with no plan fall back to the pillars.json rotation.
//
// Statically imported like features.json and pillars.json: a commit redeploys
// the plan, and the Worker has no filesystem.

import balqalamPlan from "../../../../content/social/queue/balqalam/plan.json";

export interface PlanSlot {
  /** `<brand>#NNN` — the key the draft row carries in `slot`. */
  key: string;
  seq: number;
  week: number;
  slot: number;
  /** ISO date (YYYY-MM-DD) the slot is due, from the brand's start date. */
  date: string;
  theme: string;
  /** pain · proof · persona · learn · how-to · question · trust */
  kind: string;
  pillar: string;
  /** Feature id — the concept note to read before writing. */
  feature: string;
  persona: string;
  /** What this post says, in one line. */
  angle: string;
  /** How this kind of post is shaped. */
  slotGuide: string;
}

interface RawSlot {
  seq: number;
  week: number;
  slot: number;
  theme: string;
  kind: string;
  pillar: string;
  feature: string;
  persona: string;
  angle: string;
  slotGuide: string;
}

/**
 * Week 1's Monday per brand. Slots run one a day from there: slot 1 is the
 * Monday, slot 7 the Sunday. Moving a plan is one edit here.
 */
const PLANS: Record<string, { start: string; slots: RawSlot[] }> = {
  balqalam: { start: "2026-10-19", slots: balqalamPlan as RawSlot[] },
};

export function slotKey(brand: string, seq: number): string {
  return `${brand}#${String(seq).padStart(3, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function hasPlan(brand: string): boolean {
  return brand in PLANS;
}

/** Every slot of a brand's plan, dated, in plan order. Empty with no plan. */
export function planFor(brand: string): PlanSlot[] {
  const plan = PLANS[brand];
  if (!plan) return [];
  return plan.slots.map((s) => ({
    ...s,
    key: slotKey(brand, s.seq),
    date: addDays(plan.start, (s.week - 1) * 7 + (s.slot - 1)),
  }));
}

/** One slot by its key, or null. */
export function findSlot(key: string): PlanSlot | null {
  const brand = key.split("#")[0];
  return planFor(brand).find((s) => s.key === key) ?? null;
}

/** ISO date for "today" in UTC — the plan's own clock. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The slots worth recommending now: everything due up to the end of this
 * plan week (overdue first, then today, then the rest of the week).
 */
export function dueSlots(brand: string, now: Date = new Date()): PlanSlot[] {
  const today = todayIso(now);
  const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
  const weekEnd = addDays(today, 6 - dow);
  return planFor(brand).filter((s) => s.date <= weekEnd);
}
