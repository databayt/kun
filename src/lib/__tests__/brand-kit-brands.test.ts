import { describe, expect, it } from "vitest";
import kit from "../../../content/media/brand-kit.json";
import { compileMediaStudioPrompt } from "@/lib/brand-kit";
import { generateStudioImageCore } from "@/lib/studio-image";
import { PRODUCT_IDS } from "@/components/root/social/products";

// A brand with no kit entry used to fall back to Mkan silently, so picking
// balqalam compiled a Port Sudan coastal prompt carrying an mkan.sd lockup —
// while the kit's own note says a balqalam asset must never wear the Hogwarts
// wordmark. A wrong brand is worse than no output, so it refuses now.

describe("brand kit covers the wired brands", () => {
  it("has an entry for every brand that can actually publish", () => {
    // sijillee and moalimee are in the registry but have no wired channel, so
    // they are deliberately absent — they refuse rather than render off-brand.
    const wired = ["hogwarts", "mkan", "balqalam", "databayt"];
    for (const id of wired) {
      expect(Object.keys(kit.brands), `${id} missing from brand kit`).toContain(
        id,
      );
    }
    expect(PRODUCT_IDS).toEqual(expect.arrayContaining(wired));
  });

  it("gives every brand its own identity, not a borrowed one", () => {
    const brands = Object.entries(kit.brands as Record<string, {
      domain: string;
      what: string;
      types: Record<string, unknown>;
    }>);
    const domains = brands.map(([, b]) => b.domain);
    expect(new Set(domains).size, "two brands share a domain").toBe(
      domains.length,
    );
    for (const [id, b] of brands) {
      expect(b.what, `${id} has no 'what'`).toBeTruthy();
      // The size/lane table is what routes a request; a brand without one
      // cannot compile anything.
      expect(Object.keys(b.types).length, `${id} has no types`).toBeGreaterThan(
        0,
      );
    }
  });
});

describe("an unknown brand refuses", () => {
  it("throws rather than substituting another brand", () => {
    expect(() =>
      compileMediaStudioPrompt({
        brand: "not-a-brand",
        kind: "image",
        subject: "a quiet room",
      }),
    ).toThrow(/Unknown brand/);
  });

  it("surfaces the refusal as a result, not a crash", () => {
    const result = generateStudioImageCore({
      brand: "sijillee",
      format: "post",
      ratio: "4:5",
      model: "gemini",
      subject: "a quiet room",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown brand/);
    expect(result.imageUrl).toBeUndefined();
  });

  it("compiles balqalam as balqalam, never as mkan", () => {
    const out = compileMediaStudioPrompt({
      brand: "balqalam",
      kind: "image",
      format: "post",
      subject: "a school front office counter",
    });
    expect(out.domain).toBe("balqalam.com");
    expect(out.prompt).not.toMatch(/mkan|Port Sudan|Red Sea/i);
    expect(out.prompt).not.toMatch(/hogwarts/i);
  });

  it("compiles databayt without borrowing a school setting", () => {
    const out = compileMediaStudioPrompt({
      brand: "databayt",
      kind: "image",
      format: "post",
      subject: "a laptop open on a plain desk",
    });
    expect(out.domain).toBe("databayt.org");
    expect(out.prompt).not.toMatch(/school|classroom|Port Sudan/i);
  });
});
