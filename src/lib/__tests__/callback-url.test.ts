import { describe, it, expect } from "vitest";
import { safeCallbackUrl } from "@/routes";

describe("safeCallbackUrl", () => {
  it("allows same-origin paths", () => {
    expect(safeCallbackUrl("/en/social/publish")).toBe("/en/social/publish");
    expect(safeCallbackUrl("/ar/context?tab=1")).toBe("/ar/context?tab=1");
  });
  it("rejects empty/missing", () => {
    expect(safeCallbackUrl(null)).toBeNull();
    expect(safeCallbackUrl(undefined)).toBeNull();
    expect(safeCallbackUrl("")).toBeNull();
  });
  it("rejects off-site absolute URLs", () => {
    expect(safeCallbackUrl("https://evil.com")).toBeNull();
    expect(safeCallbackUrl("javascript:alert(1)")).toBeNull();
  });
  it("rejects protocol-relative and backslash variants", () => {
    expect(safeCallbackUrl("//evil.com")).toBeNull();
    expect(safeCallbackUrl("/\\evil.com")).toBeNull();
  });
});
