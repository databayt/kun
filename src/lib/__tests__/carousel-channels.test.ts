import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DISTRIBUTION_CHANNEL_IDS } from "@/components/root/social/config";

// scripts/render-carousel.mjs is plain node and cannot import the TS registry,
// so it hand-maintains its own CHANNELS list. That duplication is only
// acceptable if it cannot drift unnoticed: this test reads the literal out of
// the script and asserts it equals the registry's distribution channels. It was
// previously five of the eight, missing x/tiktok/snapchat.

const scriptPath = fileURLToPath(
  new URL("../../../scripts/render-carousel.mjs", import.meta.url),
);

function channelsLiteralFromScript(): string[] {
  const src = readFileSync(scriptPath, "utf8");
  const match = src.match(/const CHANNELS = \[([\s\S]*?)\]/);
  if (!match)
    throw new Error(
      "could not find the CHANNELS literal in render-carousel.mjs",
    );
  return [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

describe("carousel channel list stays in step with the registry", () => {
  it("equals DISTRIBUTION_CHANNEL_IDS, as a set", () => {
    const scriptChannels = channelsLiteralFromScript();
    expect(new Set(scriptChannels)).toEqual(new Set(DISTRIBUTION_CHANNEL_IDS));
    expect(scriptChannels).toHaveLength(DISTRIBUTION_CHANNEL_IDS.length);
  });

  it("never includes slack — a carousel is never a communication-channel post", () => {
    expect(channelsLiteralFromScript()).not.toContain("slack");
  });
});
