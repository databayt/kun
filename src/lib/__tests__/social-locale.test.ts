import { describe, expect, it } from "vitest";
import { detectSocialLocale } from "@/lib/social-locale";

describe("detectSocialLocale", () => {
  it("detects Arabic copy", () => {
    expect(detectSocialLocale("نظام مدرسي متكامل")).toBe("ar");
  });

  it("detects English copy", () => {
    expect(detectSocialLocale("A school system that runs itself.")).toBe("en");
  });

  it("treats mixed copy as Arabic — one Arabic char decides", () => {
    expect(detectSocialLocale("hogwarts نظام المدارس")).toBe("ar");
  });

  it("defaults to English for empty or URL-only text", () => {
    expect(detectSocialLocale("")).toBe("en");
    expect(detectSocialLocale("https://ed.databayt.org")).toBe("en");
  });
});
