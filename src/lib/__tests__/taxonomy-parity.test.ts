import { describe, expect, it } from "vitest";
import kit from "../../../content/media/brand-kit.json";
import {
  ASSET_TYPES,
  ASSET_TYPE_META,
} from "@/components/root/social/showroom/taxonomy";

// Two files say "lane" and mean different questions.
//
//   taxonomy.ts        does this type carry copy?   template | higgs | none
//   brand-kit.json     which renderer owns it?      template | chatgpt | higgs | none
//
// Collapsing them into one table would lose a real distinction, so they stay
// separate — but they must never disagree about the set that decides routing.
// A type that carries copy has to go to the deterministic engine in BOTH, or
// the studio will send Arabic type to a raster model and get nonsense back.

type KitType = { lane: string; size?: string; use?: string };
const brands = Object.entries(
  kit.brands as Record<string, { types: Record<string, KitType> }>,
);

const templateTypes = (types: Record<string, KitType>) =>
  new Set(
    Object.entries(types)
      .filter(([, t]) => t.lane === "template")
      .map(([id]) => id),
  );

describe("the two lane tables agree on what carries copy", () => {
  const taxonomyTemplate = new Set(
    ASSET_TYPES.filter((t) => ASSET_TYPE_META[t].lane === "template"),
  );

  it.each(brands)("%s matches the taxonomy's template set", (_id, brand) => {
    expect(templateTypes(brand.types)).toEqual(taxonomyTemplate);
  });

  it("never gives a copy-carrying type a raster model", () => {
    for (const type of ASSET_TYPES) {
      const meta = ASSET_TYPE_META[type];
      if (meta.lane !== "template") continue;
      expect(meta.model, `${type} has a raster model`).toBeUndefined();
      expect(meta.gemini, `${type} has a gemini model`).toBeUndefined();
    }
  });

  it("never offers to generate a brand mark", () => {
    // Every brand's mark rules say the mark is placed in post, never drawn —
    // "an AI-drawn approximation of a logo is a different logo".
    expect(ASSET_TYPE_META.logo.lane).toBe("none");
    expect(ASSET_TYPE_META.logo.model).toBeUndefined();
    for (const [id, brand] of brands) {
      expect(brand.types.logo?.lane, `${id} regenerates its logo`).toBe("none");
    }
  });

  it("has a kit entry for every type the showroom can show", () => {
    for (const [id, brand] of brands) {
      for (const type of ASSET_TYPES) {
        expect(
          brand.types[type],
          `${id} has no "${type}" entry — the showroom can filter to a type the compiler cannot size`,
        ).toBeDefined();
      }
    }
  });
});
