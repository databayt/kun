import { afterEach, describe, expect, it } from "vitest";
import { createApprovalToken, verifyApprovalToken } from "@/lib/social-token";

const SECRET = "approval-secret-value";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("approval token", () => {
  it("round-trips a variant id", () => {
    process.env.CRON_SECRET = SECRET;
    const token = createApprovalToken("var_1", 60);
    const verified = verifyApprovalToken(token);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.payload.v).toBe("var_1");
  });

  it("rejects an expired token", () => {
    process.env.CRON_SECRET = SECRET;
    const token = createApprovalToken("var_1", -10);
    const verified = verifyApprovalToken(token);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error).toMatch(/expired/i);
  });

  it("rejects a tampered signature", () => {
    process.env.CRON_SECRET = SECRET;
    const token = createApprovalToken("var_1", 60);
    const last = token.at(-1);
    const tampered = token.slice(0, -1) + (last === "A" ? "B" : "A");
    const verified = verifyApprovalToken(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error).toBe("Bad signature.");
  });

  it("rejects a body swapped under another token's signature", () => {
    process.env.CRON_SECRET = SECRET;
    const [bodyA] = createApprovalToken("var_a", 60).split(".");
    const [, sigB] = createApprovalToken("var_b", 60).split(".");
    const verified = verifyApprovalToken(`${bodyA}.${sigB}`);
    expect(verified.ok).toBe(false);
  });

  it("rejects malformed tokens without throwing", () => {
    process.env.CRON_SECRET = SECRET;
    for (const bad of ["", "abc", ".", "a.", ".b", "a.b.c"]) {
      const verified = verifyApprovalToken(bad);
      expect(verified.ok).toBe(false);
    }
  });

  it("refuses to verify when CRON_SECRET is unset", () => {
    process.env.CRON_SECRET = SECRET;
    const token = createApprovalToken("var_1", 60);
    delete process.env.CRON_SECRET;
    const verified = verifyApprovalToken(token);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error).toMatch(/CRON_SECRET/);
  });

  it("refuses to mint without a usable CRON_SECRET", () => {
    expect(() => createApprovalToken("var_1", 60)).toThrow(/CRON_SECRET/);
    process.env.CRON_SECRET = "   ";
    expect(() => createApprovalToken("var_1", 60)).toThrow(/CRON_SECRET/);
  });
});
