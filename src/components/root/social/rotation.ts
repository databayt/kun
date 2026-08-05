// Stateless ISO-week rotation — the calendar's clock.
//
// MIRROR of scripts/social-drafts.mjs `seed --auto` (a plain .mjs cannot
// import TS, and six lines of arithmetic do not justify a build step). Keep
// the two in lockstep: the calendar panel highlights exactly the briefs the
// Monday seeder will file, or the panel lies. rotation.test.ts pins the
// formula so a drifting edit fails visibly on this side.

/** UTC ISO-8601 week number — the seeder's jan-4 anchor formula, verbatim. */
export function isoWeek(date: Date): number {
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return Math.ceil(
    ((date.getTime() - jan4.getTime()) / 86400000 +
      ((jan4.getUTCDay() + 6) % 7) +
      1) /
      7,
  );
}

/**
 * The seeder's picks for a week: briefs[(week*count+i) % length] for i in
 * 0..count-1. Order is cadence — rotation carries no state anywhere.
 */
export function weeklyPickIndexes(
  length: number,
  week: number,
  count: number,
): number[] {
  if (length <= 0 || count <= 0) return [];
  return Array.from({ length: count }, (_, i) => (week * count + i) % length);
}
