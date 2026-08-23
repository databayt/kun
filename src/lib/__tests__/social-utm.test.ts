import { describe, expect, it } from "vitest";
import { applyUtm } from "@/lib/social-utm";

const ctx = { channel: "facebook", brand: "hogwarts" };
const params = (text: string) => new URL(text).searchParams;

describe("applyUtm", () => {
  it("tags a bare link with source, medium and campaign", () => {
    const out = applyUtm("see https://databayt.org/x", ctx);
    const p = params(out.split(" ").pop()!);
    expect(p.get("utm_source")).toBe("facebook");
    expect(p.get("utm_medium")).toBe("social");
    expect(p.get("utm_campaign")).toBe("hogwarts");
  });

  it("separates channels, which is the whole point", () => {
    const fb = applyUtm("https://databayt.org/x", ctx);
    const ig = applyUtm("https://databayt.org/x", {
      ...ctx,
      channel: "instagram",
    });
    expect(fb).not.toBe(ig);
    expect(params(fb).get("utm_source")).toBe("facebook");
    expect(params(ig).get("utm_source")).toBe("instagram");
  });

  it("keeps existing query parameters", () => {
    const p = params(applyUtm("https://databayt.org/x?ref=a&b=2", ctx));
    expect(p.get("ref")).toBe("a");
    expect(p.get("b")).toBe("2");
    expect(p.get("utm_source")).toBe("facebook");
  });

  it("leaves a hand-tagged link alone", () => {
    // A deliberate campaign name must win, or attribution starts lying.
    const original =
      "https://databayt.org/x?utm_source=newsletter&utm_campaign=launch";
    expect(applyUtm(original, ctx)).toBe(original);
  });

  it("is idempotent, so retries cannot double-tag", () => {
    const once = applyUtm("https://databayt.org/x", ctx);
    expect(applyUtm(once, ctx)).toBe(once);
  });

  it("tags every link in a multi-link post", () => {
    const out = applyUtm(
      "a https://databayt.org/1 and https://databayt.org/2",
      ctx,
    );
    expect(out.match(/utm_source=facebook/g)).toHaveLength(2);
  });

  it("does not swallow trailing punctuation", () => {
    // "…/x." must not tag a URL ending in a full stop.
    const out = applyUtm("read https://databayt.org/x.", ctx);
    expect(out.endsWith(".")).toBe(true);
    expect(out).not.toContain("x.?");
  });

  it("leaves prose and non-http text untouched", () => {
    expect(applyUtm("no links here", ctx)).toBe("no links here");
    expect(applyUtm("مرحبا بالعالم", ctx)).toBe("مرحبا بالعالم");
    expect(applyUtm("", ctx)).toBe("");
  });

  it("preserves Arabic copy around a tagged link", () => {
    const out = applyUtm("سجل الآن https://databayt.org/x شكرا", ctx);
    expect(out).toContain("سجل الآن");
    expect(out).toContain("شكرا");
    expect(out).toContain("utm_source=facebook");
  });
});
