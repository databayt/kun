import { describe, expect, it } from "vitest";
import { fleetState, parseReadiness, relativeTime } from "./fleet";

const now = Date.parse("2026-11-20T12:00:00Z");
const ago = (h: number) => new Date(now - h * 3600 * 1000);
const r = (failing: string[]) => ({ percent: 90, failing, catalogVersion: 1 });

describe("fleetState", () => {
  it("is ok when fresh and nothing fails", () => expect(fleetState(ago(1), r([]), now)).toBe("ok"));
  it("is attention when a step fails", () => expect(fleetState(ago(1), r(["node"]), now)).toBe("attention"));
  it("is stale after 48h, even with no failures", () => expect(fleetState(ago(49), r([]), now)).toBe("stale"));
  it("is stale when never seen", () => expect(fleetState(null, null, now)).toBe("stale"));
  it("is ok with no readiness reported yet", () => expect(fleetState(ago(1), null, now)).toBe("ok"));
});

describe("parseReadiness", () => {
  it("accepts the contract shape", () => expect(parseReadiness(r(["a"]))).toEqual(r(["a"])));
  it("rejects garbage", () => expect(parseReadiness({ percent: 400 })).toBeNull());
});

describe("relativeTime", () => {
  const t = { never: "never", justNow: "now", minAgo: "{n}m", hourAgo: "{n}h", dayAgo: "{n}d" };
  it("formats", () => {
    expect(relativeTime(null, t, now)).toBe("never");
    expect(relativeTime(ago(0.5), t, now)).toBe("30m");
    expect(relativeTime(ago(5), t, now)).toBe("5h");
    expect(relativeTime(ago(72), t, now)).toBe("3d");
  });
});
