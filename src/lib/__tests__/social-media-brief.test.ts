import { describe, expect, it } from "vitest";
// From brand-kit, not social-media-brief: the latter pulls in Prisma, and the
// compile is deliberately reachable without it.
import { chatgptTypes, compileBrief } from "@/lib/brand-kit";
import { compileBrief as compileMjs } from "../../../scripts/lib/brand-kit.mjs";

// The app compiles briefs in TypeScript; the weekly seeder and the paste-ready
// CLI compile them in JavaScript, because a .mjs cannot import a .ts. Two
// implementations of one prompt is exactly the drift rotation.ts was written to
// guard against, so this is that guard: same input, byte-identical output, or
// the build fails.
//
// Both read content/media/brand-kit.json, so only the ASSEMBLY can drift — but
// assembly is where a stray newline or a dropped constraint hides, and a prompt
// that differs by one line is a different image.

describe("compileBrief parity", () => {
  const cases = [
    ["hero", "An empty classroom in early morning light"],
    ["lifestyle", "A parent's hands holding a phone in a school corridor"],
    ["product", "A bursar's desk, ledgers closed"],
    ["mockup", "A tablet propped on a staff-room table"],
    ["story", "A corridor at the change of period"],
    ["plate", "A quiet front office counter"],
  ] as const;

  it.each(cases)(
    "TS and .mjs produce the same prompt for %s",
    (type, subject) => {
      const ts = compileBrief("hogwarts", type, subject);
      const mjs = compileMjs("hogwarts", type, subject);
      expect(ts.prompt).toBe(mjs.prompt);
      expect(ts.size).toBe(mjs.size);
      expect(ts.spine).toBe(mjs.spine);
    },
  );
});

describe("compileBrief guards", () => {
  it("refuses a template-lane type by name", () => {
    // The no-text doctrine's enforcement point: og carries copy, so it renders
    // from HTML. A silent fallback here would ship broken Arabic typography.
    expect(() => compileBrief("hogwarts", "og", "anything")).toThrow(
      /template lane/,
    );
  });

  it("refuses an unknown brand and an unknown type", () => {
    expect(() => compileBrief("nope", "hero", "x")).toThrow(/Unknown brand/);
    expect(() => compileBrief("hogwarts", "nope", "x")).toThrow(
      /Unknown asset/,
    );
  });

  it("carries the no-text rule and an exact size into every prompt", () => {
    const { prompt, size } = compileBrief("hogwarts", "hero", "A classroom");
    expect(prompt).toContain("No text, no lettering");
    expect(prompt).toContain(`exactly ${size} pixels`);
  });
});

describe("chatgptTypes", () => {
  it("offers only seat-renderable types", () => {
    const ids = chatgptTypes("hogwarts").map((t) => t.id);
    expect(ids).toContain("hero");
    expect(ids).not.toContain("og");
    expect(ids).not.toContain("carousel");
    // reel is Higgsfield's — a seat cannot render motion.
    expect(ids).not.toContain("reel");
  });

  it("returns nothing for a brand with no kit rather than throwing", () => {
    expect(chatgptTypes("nope")).toEqual([]);
  });
});

describe("brand kit sizes", () => {
  it("satisfies every GPT Image 2 constraint for hogwarts and mkan", () => {
    // Divisible by 16, longest edge <= 3840, ratio <= 3:1, and total pixels
    // between 655,360 and 8,294,400. The pixel FLOOR is the one that bites —
    // 1200x624 clears it by under 100k.
    for (const brand of ["hogwarts", "mkan"] as const) {
      for (const { id } of chatgptTypes(brand)) {
        const { size } = compileBrief(brand, id, "subject line here");
        const [w, h] = size.split("x").map(Number);
        expect(w % 16, `${brand}/${id} width`).toBe(0);
        expect(h % 16, `${brand}/${id} height`).toBe(0);
        expect(Math.max(w, h), `${brand}/${id} max edge`).toBeLessThanOrEqual(3840);
        expect(
          Math.max(w, h) / Math.min(w, h),
          `${brand}/${id} ratio`,
        ).toBeLessThanOrEqual(3);
        expect(w * h, `${brand}/${id} pixels`).toBeGreaterThanOrEqual(655_360);
        expect(w * h, `${brand}/${id} pixels`).toBeLessThanOrEqual(8_294_400);
      }
    }
  });

  it("compiles mkan briefs with parity between TS and .mjs", () => {
    const ts = compileBrief("mkan", "hero", "A coastal Port Sudan home overlooking the Red Sea");
    const mjs = compileMjs("mkan", "hero", "A coastal Port Sudan home overlooking the Red Sea");
    expect(ts.prompt).toBe(mjs.prompt);
    expect(ts.size).toBe(mjs.size);
    expect(ts.spine).toBe(mjs.spine);
    expect(ts.prompt).toContain("Port Sudan, Sudan setting");
  });
});
