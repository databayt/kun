import { describe, expect, it } from "vitest";
import { CHANNELS } from "@/components/root/social/config";
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

// The invariant this file exists for. Telegram and Slack are single org-level
// destinations, not per-brand ones: there is exactly one Telegram channel and
// one Slack channel. Claiming either for a product brand would publish "as
// Hogwarts" into databayt's own channel. Previously guarded only by a comment.
describe("org-level channels stay databayt-only", () => {
  const ORG_LEVEL = ["telegram", "slack"] as const;

  for (const channelId of ORG_LEVEL) {
    it(`${channelId} is not wired for any brand other than databayt`, () => {
      for (const product of PRODUCTS) {
        if (product.id === "databayt") continue;
        expect(
          productChannelWired(product.id, channelId, globalWired(channelId)),
          `${product.id} must not publish to the org ${channelId}`,
        ).toBe(false);
      }
    });
  }

  it("databayt itself may use them while their transport is wired", () => {
    for (const channelId of ORG_LEVEL) {
      if (!globalWired(channelId)) continue;
      expect(productChannelWired("databayt", channelId, true)).toBe(true);
    }
  });
});
