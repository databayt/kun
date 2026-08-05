import { describe, expect, it } from "vitest";
import { isoWeek, weeklyPickIndexes } from "@/components/root/social/rotation";

// The formula from scripts/social-drafts.mjs `seed --auto`, replicated
// verbatim — the parity assertion below is the lockstep guarantee.
function seederWeek(now: Date): number {
  const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
  return Math.ceil(
    ((now.getTime() - jan4.getTime()) / 86400000 +
      ((jan4.getUTCDay() + 6) % 7) +
      1) /
      7,
  );
}

describe("isoWeek", () => {
  it("matches known ISO week numbers", () => {
    // 2026-01-01 is a Thursday — ISO week 1.
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toBe(1);
    // 2026 is a 53-week ISO year; Dec 31 sits in W53.
    expect(isoWeek(new Date(Date.UTC(2026, 11, 31)))).toBe(53);
    expect(isoWeek(new Date(Date.UTC(2026, 7, 5)))).toBe(32);
  });

  it("stays in lockstep with the seeder's formula across the year", () => {
    for (let month = 0; month < 12; month++) {
      for (const day of [1, 11, 21, 28]) {
        const date = new Date(Date.UTC(2026, month, day, 9, 30));
        expect(isoWeek(date)).toBe(seederWeek(date));
      }
    }
  });
});

describe("weeklyPickIndexes", () => {
  it("computes the seeder's picks", () => {
    // week 32, count 2, 8 briefs → (64 % 8, 65 % 8).
    expect(weeklyPickIndexes(8, 32, 2)).toEqual([0, 1]);
    expect(weeklyPickIndexes(8, 3, 2)).toEqual([6, 7]);
  });

  it("wraps across the end of the list", () => {
    // week 7, count 2, 5 briefs → (14 % 5, 15 % 5).
    expect(weeklyPickIndexes(5, 7, 2)).toEqual([4, 0]);
  });

  it("is empty for an empty brief list or zero count", () => {
    expect(weeklyPickIndexes(0, 10, 2)).toEqual([]);
    expect(weeklyPickIndexes(8, 10, 0)).toEqual([]);
  });
});
