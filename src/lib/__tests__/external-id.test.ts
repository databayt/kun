import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendFacebookPost } from "@/lib/facebook";
import { sendTelegramPost } from "@/lib/telegram";

// Stubbed transport on purpose. The alternative is publishing to a real brand
// page to read back an id, which is exactly the mistake that made this column
// necessary in the first place.

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
  process.env.TELEGRAM_BOT_TOKEN = "bot";
  process.env.TELEGRAM_CHANNEL_ID = "@brand";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
  delete process.env.FACEBOOK_PAGE_ID_HOGWARTS;
  delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN_HOGWARTS;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHANNEL_ID;
});

describe("Facebook externalId", () => {
  it("keeps the feed post id for a text post", async () => {
    stub({ id: "123_456" });
    const res = await sendFacebookPost("hello", "hogwarts");
    expect(res.ok).toBe(true);
    expect(res.externalId).toBe("123_456");
  });

  it("prefers post_id over the photo id for a media post", async () => {
    // /photos answers with the PHOTO id plus the feed post_id. Addressing the
    // post — to delete it or read its metrics — needs post_id.
    stub({ id: "photo_999", post_id: "123_456" });
    const res = await sendFacebookPost(
      "hello",
      "hogwarts",
      "https://cdn/x.jpg",
    );
    expect(res.externalId).toBe("123_456");
  });

  it("has no id when the call failed", async () => {
    stub({ error: { message: "nope" } }, false);
    const res = await sendFacebookPost("hello", "hogwarts");
    expect(res.ok).toBe(false);
    expect(res.externalId).toBeUndefined();
  });
});

describe("Telegram externalId", () => {
  it("stores chat and message together", async () => {
    // Deleting needs both; a bare message_id addresses nothing.
    stub({ ok: true, result: { message_id: 42, chat: { id: -1001234 } } });
    const res = await sendTelegramPost("hello");
    expect(res.ok).toBe(true);
    expect(res.externalId).toBe("-1001234:42");
  });

  it("has no id when the response omits the ids", async () => {
    stub({ ok: true, result: {} });
    const res = await sendTelegramPost("hello");
    expect(res.ok).toBe(true);
    expect(res.externalId).toBeUndefined();
  });
});
