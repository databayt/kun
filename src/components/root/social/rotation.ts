// Stateless ISO-week rotation — the calendar's clock.
//
// MIRROR of scripts/social-drafts.mjs `seed --auto` (a plain .mjs cannot
// import TS, and six lines of arithmetic do not justify a build step). Keep
// the two in lockstep: the calendar panel highlights exactly the briefs the
// Monday seeder will file, or the panel lies. rotation.test.ts pins the
// formula so a drifting edit fails visibly on this side.

/**
 * How many briefs the Monday seeder files per brand per week.
 *
 * MIRROR of SEED_COUNT in scripts/seed-drafts.sh, where it is env-overridable.
 * It lives here, beside the rotation it feeds, because two copies had already
 * appeared — the calendar panel's and the media studio's — and a reader who
 * changes the env var expects both surfaces to follow. If the seeder is ever
 * run with a different count, this is the one place to match it.
 */
export const SEED_COUNT = 2;

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
  // Positive modulo. JS `%` keeps the sign of the dividend, so a week <= 0 —
  // reachable in early January, and sooner via a negative weekOffset — would
  // index backwards off the array and yield undefined. Identical to `%` for
  // every positive week, so the existing cadence is unchanged.
  return Array.from(
    { length: count },
    (_, i) => (((week * count + i) % length) + length) % length,
  );
}
