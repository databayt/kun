import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliverPost } from "@/lib/social-publish";

// Stubbed transport, same reasoning as external-id.test.ts: the alternative is
// publishing to a real brand page, which is the mistake these guards exist to
// make impossible.

const realFetch = globalThis.fetch;

function stub(json: unknown, ok = true) {
  // Args declared so mock.calls carries the fetched URLs for the routing
  // assertions below.
  const spy = vi.fn(
    async (..._args: [input: unknown, init?: unknown]) =>
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

describe("deliverPost — media shape gates", () => {
  it("refuses mixed image and video without any network call", async () => {
    const spy = stub({ id: "nope" });

    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["facebook"],
      mediaUrls: [
        "https://cdn.example.com/a.png",
        "https://cdn.example.com/b.mp4",
      ],
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/mixed image and video/i);
    // A payload gate covers every requested channel — one outcome each.
    expect(res.results).toHaveLength(1);
    expect(res.results[0]?.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses more than one video", async () => {
    const spy = stub({});
    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["facebook"],
      mediaUrls: ["https://c/a.mp4", "https://c/b.mp4"],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/one video per post/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses more than 10 images", async () => {
    const spy = stub({});
    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["facebook"],
      mediaUrls: Array.from({ length: 11 }, (_, i) => `https://c/${i}.png`),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/10 images/i);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("deliverPost — media routing", () => {
  it("routes 2+ images to the Facebook carousel flow (unpublished uploads, one feed post)", async () => {
    const spy = stub({ id: "fb_media" });

    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["facebook"],
      mediaUrls: ["https://c/1.png", "https://c/2.png", "https://c/3.png"],
    });

    expect(res.ok).toBe(true);
    // 3 unpublished photo uploads + 1 attached_media feed post.
    expect(spy).toHaveBeenCalledTimes(4);
    const urls = spy.mock.calls.map((call) => String(call[0]));
    expect(urls.slice(0, 3).every((u) => u.endsWith("/photos"))).toBe(true);
    expect(urls[3]?.endsWith("/feed")).toBe(true);
    expect(res.results[0]?.externalId).toBe("fb_media");
  });

  it("routes one video to the Facebook /videos edge", async () => {
    const spy = stub({ id: "fb_video" });

    const res = await deliverPost({
      product: "hogwarts",
      text: "hello",
      channels: ["facebook"],
      mediaUrls: ["https://c/reel.mp4"],
    });

    expect(res.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/\/videos$/);
    expect(res.results[0]?.externalId).toBe("fb_video");
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
