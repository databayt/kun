// ── Follow-up cadence: the funnel's stall clock, for applications ─────────────
//
// Ported from mkan's decideCadenceStage (mkan/scripts/crm/outreach-cadence.ts):
// a pure decision from dates, no model. Counted from the application, not the
// last touch, so a late follow-up never pushes the whole clock back.
//
//   touch 1 = the application · touch 2 at day 7 · touch 3 at day 14
//   day 21 with no reply → archive. Any reply freezes the clock.

export type CadenceAction = "none" | "touch2" | "touch3" | "archive";

export interface CadenceInput {
  appliedAt: Date | string | null;
  touchNumber: number | null;
  replied: boolean;
  now: Date;
}

const DAY = 86_400_000;

export const CADENCE_DAYS = { touch2: 7, touch3: 14, archive: 21 } as const;

export function daysSince(from: Date | string, now: Date): number {
  return Math.floor((now.getTime() - new Date(from).getTime()) / DAY);
}

export function decideFollowUp({
  appliedAt,
  touchNumber,
  replied,
  now,
}: CadenceInput): CadenceAction {
  if (replied || !appliedAt) return "none";
  const days = daysSince(appliedAt, now);
  const touch = touchNumber ?? 1;
  if (days >= CADENCE_DAYS.archive && touch >= 3) return "archive";
  if (days >= CADENCE_DAYS.touch3 && touch === 2) return "touch3";
  if (days >= CADENCE_DAYS.touch2 && touch === 1) return "touch2";
  return "none";
}
