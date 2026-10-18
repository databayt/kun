import { describe, expect, it } from "vitest";

import { fundingAdapter } from "../adapters/twenty-funding";
import { kigaliAdapter, type KigaliRow } from "../adapters/twenty-kigali";
import { seekCommandSchema } from "../commands";
import type { SeekEvent, SeekItem } from "../item";
import { seekItemSchema } from "../item";
import { countByGroup, funnel, needsMe, weekly } from "../metrics";
import { toPulse } from "../public";
import { TRACKS, getTrack } from "../tracks/registry";

const row = (over: Partial<KigaliRow> = {}): KigaliRow => ({
  id: "r1",
  name: "Full-Stack Engineer @ Irembo",
  campaign: "WEB_DEVELOPER",
  tier: "STRONG_FIT",
  engineScore: 72,
  applicationStatus: "QUEUED",
  deadline: null,
  jobUrl: { primaryLinkUrl: "https://irembo.example/jobs/1" },
  assessment: { markdown: "scored 72" },
  applyUrl: null,
  channel: "EMAIL",
  appliedAt: null,
  lastTouchAt: null,
  touchNumber: 0,
  holdReason: null,
  country: "RWANDA",
  city: "Kigali",
  remoteType: "ONSITE",
  track: "FOUNDER",
  updatedAt: "2026-10-18T08:00:00.000Z",
  ...over,
});

const job = getTrack("job");
const items: SeekItem[] = [
  kigaliAdapter.toItem(row(), "abdout"),
  kigaliAdapter.toItem(row({ id: "r2", applicationStatus: "HOLD", engineScore: 90, holdReason: "Ashby packet" }), "abdout"),
  kigaliAdapter.toItem(row({ id: "r3", applicationStatus: "APPLIED" }), "abdout"),
  kigaliAdapter.toItem(row({ id: "r4", applicationStatus: "OFFER" }), "abdout"),
];

describe("adapters", () => {
  it("maps a board row into a valid item", () => {
    const item = items[0];
    expect(seekItemSchema.parse(item)).toEqual(item);
    expect(item).toMatchObject({ title: "Full-Stack Engineer", org: "Irembo", stage: "QUEUED", lane: "WEB_DEVELOPER" });
    expect(item.recordUrl).toBe("https://sales.databayt.org/object/kigaliOpportunity/r1");
  });

  it("maps a funding row with sparse fields", () => {
    const item = fundingAdapter.toItem(
      { id: "f1", name: "AWS Activate", status: null, deadline: null, ladderRung: 1 },
      "abdout",
    );
    expect(seekItemSchema.parse(item).stage).toBe("TO_REVIEW");
    expect(item.tier).toBe("RUNG_1");
  });
});

describe("tracks with a console", () => {
  it("declare unique stage ids", () => {
    for (const t of TRACKS) {
      const ids = (t.stages ?? []).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("metrics", () => {
  it("groups stages", () => {
    expect(countByGroup(items, job)).toEqual({ inbox: 0, needs: 2, in_play: 1, won: 1, lost: 0 });
    expect(funnel(items, job).find((s) => s.id === "QUEUED")?.count).toBe(1);
  });

  it("puts queued cards first in the needs queue", () => {
    expect(needsMe(items, job).map((i) => i.externalId)).toEqual(["r1", "r2"]);
  });

  it("counts a duplicated reply once", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const ev = (kind: string, ts = "2026-10-17T10:00:00Z"): SeekEvent => ({
      instance: "abdout", ts, kind, externalId: "r1", title: null, lane: null, detail: "ack",
    });
    const w = weekly([ev("sent"), ev("reply"), ev("reply"), ev("sent", "2026-09-01T00:00:00Z")], now);
    expect(w).toMatchObject({ sent: 1, replies: 1 });
  });
});

describe("commands", () => {
  it("accepts a veto and refuses an empty hold reason", () => {
    expect(seekCommandSchema.safeParse({ kind: "veto", externalId: "r1" }).success).toBe(true);
    expect(seekCommandSchema.safeParse({ kind: "hold", externalId: "r1", reason: " " }).success).toBe(false);
  });

  it("needs a URL or text to ingest", () => {
    expect(seekCommandSchema.safeParse({ kind: "ingest" }).success).toBe(false);
    expect(seekCommandSchema.safeParse({ kind: "ingest", url: "https://x.example/j" }).success).toBe(true);
  });

  it("keeps the daily cap inside the hard wall", () => {
    expect(seekCommandSchema.safeParse({ kind: "dailyCap", n: 500 }).success).toBe(false);
  });
});

describe("public pulse", () => {
  it("carries counts only — no names, orgs or links", () => {
    const pulse = toPulse(items, [], TRACKS, "2026-10-18T08:00:00Z");
    expect(pulse.total).toBe(4);
    const text = JSON.stringify(pulse);
    for (const leak of ["Irembo", "Full-Stack", "http", "RWANDA", "r1"]) expect(text).not.toContain(leak);
  });
});
