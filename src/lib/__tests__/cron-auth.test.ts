import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedBearer } from "@/lib/cron-auth";

const SECRET = "s3cr3t-token-value";

function req(authorization?: string): Request {
  return new Request("https://example.com/api/social/relay", {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("isAuthorizedBearer", () => {
  it("accepts the correct secret", () => {
    process.env.CRON_SECRET = SECRET;
    expect(isAuthorizedBearer(req(`Bearer ${SECRET}`))).toBe(true);
  });

  it("rejects a wrong secret of the same length", () => {
    process.env.CRON_SECRET = SECRET;
    const wrong = "x".repeat(SECRET.length);
    expect(wrong.length).toBe(SECRET.length);
    expect(isAuthorizedBearer(req(`Bearer ${wrong}`))).toBe(false);
  });

  it("rejects a secret of the wrong length without throwing", () => {
    // timingSafeEqual throws on unequal buffers — the length guard must run first.
    process.env.CRON_SECRET = SECRET;
    expect(() => isAuthorizedBearer(req("Bearer short"))).not.toThrow();
    expect(isAuthorizedBearer(req("Bearer short"))).toBe(false);
    expect(isAuthorizedBearer(req(`Bearer ${SECRET}extra`))).toBe(false);
  });

  it("rejects an absent Authorization header", () => {
    process.env.CRON_SECRET = SECRET;
    expect(isAuthorizedBearer(req())).toBe(false);
  });

  it("rejects the bare secret without the Bearer prefix", () => {
    process.env.CRON_SECRET = SECRET;
    expect(isAuthorizedBearer(req(SECRET))).toBe(false);
  });

  it("refuses everything when CRON_SECRET is unset", () => {
    // An unconfigured deployment must fail closed, not accept all callers.
    expect(isAuthorizedBearer(req("Bearer anything"))).toBe(false);
    expect(isAuthorizedBearer(req())).toBe(false);
  });

  it("refuses when CRON_SECRET is only whitespace", () => {
    process.env.CRON_SECRET = "   ";
    expect(isAuthorizedBearer(req("Bearer    "))).toBe(false);
  });
});
