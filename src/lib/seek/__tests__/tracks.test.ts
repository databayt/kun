import { describe, expect, it } from "vitest";
import { JobOpportunityStatus } from "@/generated/prisma/enums";
import { TRACKS, getTrack } from "../tracks/registry";

describe("seek tracks", () => {
  it("has unique ids", () => {
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
  });

  it("keeps the job pipeline inside the stored status enum", () => {
    const stored = new Set<string>(Object.values(JobOpportunityStatus));
    for (const status of getTrack("job").pipeline) expect(stored).toContain(status);
  });

  it("only briefs on statuses the pipeline can reach", () => {
    for (const track of TRACKS) {
      for (const status of track.briefOn) expect(track.pipeline).toContain(status);
    }
  });

  it("follow-ups run in increasing order", () => {
    for (const track of TRACKS) {
      expect([...track.followUpDays].sort((a, b) => a - b)).toEqual(track.followUpDays);
    }
  });
});
