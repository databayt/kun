import { describe, expect, it } from "vitest";
import { reapDecision } from "@/lib/social-reap";

const NOW = new Date("2026-07-30T06:00:00Z");
const MAX = 3;

describe("reapDecision", () => {
  it("returns approval-lane rows to pending regardless of attempts", () => {
    expect(reapDecision({ scheduledFor: null, attempts: 0 }, NOW, MAX)).toEqual(
      { status: "pending" },
    );
    expect(
      reapDecision({ scheduledFor: null, attempts: 99 }, NOW, MAX),
    ).toEqual({ status: "pending" });
  });

  it("returns drain-lane rows with budget left to scheduled at now", () => {
    for (const attempts of [1, 2]) {
      expect(
        reapDecision({ scheduledFor: new Date(0), attempts }, NOW, MAX),
      ).toEqual({ status: "scheduled", scheduledFor: NOW });
    }
  });

  it("fails drain-lane rows at and past the attempt budget", () => {
    for (const attempts of [3, 4]) {
      expect(
        reapDecision({ scheduledFor: new Date(0), attempts }, NOW, MAX),
      ).toEqual({ status: "failed" });
    }
  });
});
