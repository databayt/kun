import { describe, expect, it } from "vitest";
import specs from "../../../content/social/platform-specs.json";
import { DISTRIBUTION_CHANNEL_IDS } from "@/components/root/social/config";

// scripts/render-carousel.mjs hand-maintains a CHANNELS literal because plain
// node cannot import the TS registry, and carousel-channels.test.ts stops that
// copy from rotting. This is the same guard for the same reason: a channel that
// can receive a post but has no media specs would compile a brief with no size,
// and the failure would be a silently wrong artboard rather than an error.

const platforms = specs.platforms as Record<
  string,
  { placements: string[]; default: string; label: string }
>;

describe("platform media specs cover every publishable channel", () => {
  it("has an entry for each distribution channel, and no extras", () => {
    expect(new Set(Object.keys(platforms))).toEqual(
      new Set(DISTRIBUTION_CHANNEL_IDS),
    );
  });

  it("gives every platform a default placement it actually offers", () => {
    for (const [id, p] of Object.entries(platforms)) {
      expect(p.placements.length, `${id} offers no placement`).toBeGreaterThan(0);
      expect(p.placements, `${id} defaults to a placement it does not offer`).toContain(
        p.default,
      );
    }
  });

  it("resolves every placement to a real pixel size", () => {
    const sizes = specs.sizes as Record<string, string>;
    for (const [id, p] of Object.entries(platforms)) {
      for (const placement of p.placements) {
        const size = sizes[placement];
        expect(size, `${id} names placement "${placement}" with no size`).toBeDefined();
        expect(size).toMatch(/^\d+x\d+$/);
      }
    }
  });

  it("keeps caption and hashtag policy out of this file", () => {
    // craft-rules.json owns the house copy rules; instagram.ts
    // own the transports' hard caps. A number duplicated here would drift on
    // the platform's schedule, not ours.
    const raw = JSON.stringify(specs);
    for (const leaked of ["hashtag", "captionMax", "maxChars", "charLimit"]) {
      expect(
        raw.toLowerCase().includes(leaked.toLowerCase()) &&
          !raw.includes("craft-rules"),
        `"${leaked}" looks duplicated here — it belongs to craft-rules.json`,
      ).toBe(false);
    }
  });
});
