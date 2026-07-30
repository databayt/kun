import { afterEach, describe, expect, it } from "vitest";
import { draftBrief } from "@/lib/social-draft";

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("draftBrief", () => {
  it("refuses without ANTHROPIC_API_KEY — the spend lane fails closed", async () => {
    const res = await draftBrief({ product: "hogwarts", brief: "a test" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("treats a whitespace key as unset", async () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    const res = await draftBrief({ product: "hogwarts", brief: "a test" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ANTHROPIC_API_KEY/);
  });
});
