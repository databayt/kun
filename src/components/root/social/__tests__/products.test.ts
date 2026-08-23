import { describe, expect, it } from "vitest";
import {
  CHANNELS,
  CHANNEL_IDS,
  COMMUNICATION_CHANNEL_IDS,
  DISTRIBUTION_CHANNEL_IDS,
  DRAIN_CHANNEL_IDS,
  HERMES_CHANNEL_IDS,
  MANUAL_CHANNEL_IDS,
} from "@/components/root/social/config";
import {
  PRODUCTS,
  productChannelWired,
} from "@/components/root/social/products";

const globalWired = (channelId: string): boolean =>
  Boolean(CHANNELS.find((c) => c.id === channelId)?.wired);

describe("productChannelWired — the full product × channel matrix", () => {
  it("is the AND of the global transport and the brand's own destination", () => {
    for (const product of PRODUCTS) {
      for (const channel of CHANNELS) {
        const expected =
          channel.kind === "distribution" &&
          globalWired(channel.id) &&
          Boolean(
            (product.channels as Partial<Record<string, boolean>>)[channel.id],
          );
        expect(
          productChannelWired(product.id, channel.id, globalWired(channel.id)),
          `${product.id} × ${channel.id}`,
        ).toBe(expected);
      }
    }
  });

  it("refuses a channel whose transport is not wired, even if the brand claims it", () => {
    const unwired = CHANNELS.find((c) => !c.wired);
    expect(unwired, "expected at least one unwired channel").toBeDefined();
    for (const product of PRODUCTS) {
      expect(productChannelWired(product.id, unwired!.id, false)).toBe(false);
    }
  });

  it("refuses an unknown product", () => {
    expect(productChannelWired("not-a-product", "facebook", true)).toBe(false);
  });

  it("refuses an unknown channel", () => {
    for (const product of PRODUCTS) {
      expect(productChannelWired(product.id, "not-a-channel", true)).toBe(
        false,
      );
    }
  });
});

// The taxonomy this file now exists to defend. Slack was registered as a
// first-class publish channel and counted as audience reach, which is how a
// team chat ended up in a marketing-reach denominator. `kind` separates what a
// channel is FOR from how its bytes move, and these tests keep the two apart.
describe("channel taxonomy", () => {
  it("exposes exactly the seven distribution channels", () => {
    expect(new Set(DISTRIBUTION_CHANNEL_IDS)).toEqual(
      new Set([
        "facebook",
        "instagram",
        "whatsapp",
        "x",
        "linkedin",
        "tiktok",
        "snapchat",
      ]),
    );
    expect(DISTRIBUTION_CHANNEL_IDS).toHaveLength(7);
  });

  it("keeps Slack as the only communication channel", () => {
    expect(COMMUNICATION_CHANNEL_IDS).toEqual(["slack"]);
  });

  it("never lets a communication channel become an audience destination", () => {
    for (const product of PRODUCTS) {
      for (const id of COMMUNICATION_CHANNEL_IDS) {
        expect(
          productChannelWired(product.id, id, true),
          `${product.id} must not publish to ${id}`,
        ).toBe(false);
      }
    }
  });

  it("routes whatsapp to the manual lane, never to Hermes or the drain", () => {
    expect(CHANNELS.find((c) => c.id === "whatsapp")?.transport).toBe("manual");
    expect(MANUAL_CHANNEL_IDS).toContain("whatsapp");
    expect(HERMES_CHANNEL_IDS).not.toContain("whatsapp");
    expect(DRAIN_CHANNEL_IDS).not.toContain("whatsapp");
  });

  // The guard that catches a transport added later with no delivery lane.
  // Without it such a channel is selectable, reaches deliverPost, matches no
  // fan-out branch, and is recorded as published having sent nothing.
  it("partitions every channel into exactly one delivery lane", () => {
    const lanes = [
      ...DRAIN_CHANNEL_IDS,
      ...HERMES_CHANNEL_IDS,
      ...MANUAL_CHANNEL_IDS,
    ];
    // The partition covers the DISTRIBUTION channels — the ones that carry
    // copy to an audience and therefore need a publish lane. A communication
    // channel deliberately has none: Slack is reached by the review lane, and
    // giving it a publish lane is precisely the conflation this file defends
    // against. It previously satisfied this assertion only because it was
    // parked on the `hermes` transport, i.e. it WAS publishable.
    expect(new Set(lanes), "every distribution channel has a lane").toEqual(
      new Set(DISTRIBUTION_CHANNEL_IDS),
    );
    expect(lanes, "no channel has two lanes").toHaveLength(
      DISTRIBUTION_CHANNEL_IDS.length,
    );
    for (const id of COMMUNICATION_CHANNEL_IDS) {
      expect(lanes, `${id} must not have a publish lane`).not.toContain(id);
    }
  });

  it("marks only metric-capable channels as such", () => {
    for (const channel of CHANNELS) {
      if (!("metrics" in channel) || !channel.metrics) continue;
      expect(
        channel.kind,
        `${channel.id} reports metrics, so it must be a distribution channel`,
      ).toBe("distribution");
    }
  });
});
