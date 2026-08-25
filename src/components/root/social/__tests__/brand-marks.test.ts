import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import brandKit from "../../../../../content/media/brand-kit.json";
import { SOCIAL_PRODUCTS } from "@/components/root/social/products";

/**
 * Two records of the same fact, pinned together.
 *
 * `content/media/brand-kit.json` DECLARES each brand's mark — the file, what
 * it depicts, and the rules for placing it. `products.ts` mirrors that for the
 * Hub's brand picker, because the kit is 44KB of prompt text and the picker is
 * a client bundle. Mirrors drift; this is the test that says when.
 */
interface Mark {
  file: string | null;
}
const marks = (brandKit as { brands: Record<string, { mark?: Mark }> }).brands;

/** `public/brands/x.png` in the kit is `/brands/x.png` to a browser. */
function toUrl(file: string): string {
  return file.replace(/^public/, "");
}

function fileFor(url: string): string {
  return join(process.cwd(), "public", url.replace(/^\//, ""));
}

describe("brand marks", () => {
  it("shows a mark only where the artwork actually exists", () => {
    // A declared-but-missing file renders as a broken image, which is worse
    // than the name it replaced.
    for (const product of SOCIAL_PRODUCTS) {
      if (!product.logo) continue;
      expect(
        existsSync(fileFor(product.logo)),
        `${product.id} → ${product.logo}`,
      ).toBe(true);
    }
  });

  it("agrees with the brand kit wherever the kit names a file", () => {
    // Only where the kit speaks. It carries marks for four brands and answers
    // a narrower question than the picker does — whether a file is attached as
    // a reference when an image is GENERATED — so a brand it is silent about,
    // or records as `null`, is not a contradiction with showing that brand's
    // mark in a picker. Where it does name a file, the two must agree.
    for (const product of SOCIAL_PRODUCTS) {
      if (!product.logo) continue;
      const declared = marks[product.id]?.mark?.file;
      if (!declared) continue;
      expect(toUrl(declared), `${product.id}`).toBe(product.logo);
    }
  });

  it("wires every brand whose declared mark is already on disk", () => {
    // The other direction: dropping public/brands/mkan.png must not leave the
    // picker still showing a word because nobody remembered this file.
    for (const [id, entry] of Object.entries(marks)) {
      const file = entry.mark?.file;
      if (!file || !existsSync(join(process.cwd(), file))) continue;
      const product = SOCIAL_PRODUCTS.find((p) => p.id === id);
      if (!product) continue; // a kit brand the Hub does not publish for
      expect(
        product.logo,
        `${id} has artwork but the picker shows its name`,
      ).toBe(toUrl(file));
    }
  });
});
