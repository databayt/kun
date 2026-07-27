import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliverPost } from "@/lib/social-publish";

// Stubbed transport, same reasoning as external-id.test.ts: the alternative is
// publishing to a real brand page, which is the mistake these guards exist to
// make impossible.

const realFetch = globalThis.fetch;

function stub(json: unknown, ok = true) {
  const spy = vi.fn(
    async () =>
      ({
        ok,
        json: async () => json,
        text: async () => JSON.stringify(json),
      }) as unknown as Response,
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => {
  process.env.FACEBOOK_PAGE_ID_HOGWARTS = "123";
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN_HOGWARTS = "tok";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("deliverPost — copy-out channels", () => {
  it("refuses a manual channel instead of reporting a phantom success", async () => {
    const spy = stub({ id: "should-not-be-called" });

    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["whatsapp"],
    });

    // The bug this guards: an empty `results` array reads as zero failures,
    // so the old shape returned ok:true and the drain wrote `published`.
    expect(res.ok).toBe(false);
    expect(res.results).toHaveLength(1);
    expect(res.results[0]?.channel).toBe("whatsapp");
    expect(res.results[0]?.ok).toBe(false);
    expect(res.error).toMatch(/copy-out/i);
    expect(
      spy,
      "no network call may be made for a manual channel",
    ).not.toHaveBeenCalled();
  });

  it("names the copy-out reason rather than the generic not-wired message", async () => {
    stub({});
    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["whatsapp"],
    });
    expect(res.results[0]?.error).toMatch(/no posting API exists/i);
  });
});

describe("deliverPost — outcome accounting", () => {
  it("produces exactly one outcome per requested channel", async () => {
    stub({ id: "post_1" });

    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["facebook"],
    });

    expect(res.ok).toBe(true);
    expect(res.results).toHaveLength(1);
    expect(res.results[0]?.channel).toBe("facebook");
    expect(res.results[0]?.externalId).toBe("post_1");
  });

  it("refuses a channel this brand has no destination for", async () => {
    const spy = stub({});

    // sijillee has no Facebook Page yet.
    const res = await deliverPost({
      product: "sijillee",
      text: "hello",
      channels: ["facebook"],
    });

    expect(res.ok).toBe(false);
    expect(res.results).toHaveLength(1);
    expect(res.error).toMatch(/not wired for sijillee/i);
    expect(spy).not.toHaveBeenCalled();
  });
});
