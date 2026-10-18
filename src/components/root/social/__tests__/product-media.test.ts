import { describe, expect, it } from "vitest";
import features from "../../../../../content/social/features.json";
import concepts from "../../../../../content/social/concepts.json";
import productMedia from "../../../../../content/social/product-media.json";
import {
  conceptFor,
  mediaGapFor,
  productMediaFor,
} from "@/lib/social-concept";

// The spotlight → social join: every school feature a post can be about has a
// concept note, and the screens it names are real CDN files.

const schoolFeatures = (features as { hogwarts: { id: string }[] }).hogwarts.map(
  (f) => f.id,
);

describe("product media", () => {
  it("every school feature resolves to a spotlight", () => {
    const missing = schoolFeatures.filter((f) => !conceptFor("balqalam", f));
    expect(missing).toEqual([]);
  });

  it("every screen is a CDN URL", () => {
    const all = Object.values(
      (productMedia as { school: Record<string, { url: string }[]> }).school,
    ).flat();
    expect(all.length).toBeGreaterThan(0);
    for (const m of all) expect(m.url).toMatch(/^https:\/\/cdn\.databayt\.org\//);
  });

  it("every flow a spotlight names published something", () => {
    const school = (concepts as { school: Record<string, { flows: string[] }> })
      .school;
    const media = (productMedia as { school: Record<string, { flow: string }[]> })
      .school;
    for (const [feature, c] of Object.entries(school)) {
      for (const flow of c.flows) {
        expect(
          (media[feature] ?? []).some((m) => m.flow === flow),
          `${feature} names ${flow} but nothing of it is on the CDN`,
        ).toBe(true);
      }
    }
  });

  it("screens belong to balqalam only, Arabic first", () => {
    expect(productMediaFor("hogwarts", "attendance")).toEqual([]);
    const shots = productMediaFor("balqalam", "transportation");
    expect(shots.length).toBeGreaterThan(0);
    expect(shots[0].lang).toBe("ar");
    expect(mediaGapFor("balqalam", "transportation")).toBeNull();
  });

  it("a feature with no screens tells the media team what to film", () => {
    const gap = mediaGapFor("balqalam", "events");
    expect(gap?.routes.length).toBeGreaterThan(0);
    expect(gap?.command).toMatch(/^node ~\/\.claude\/skills\/shoot\/scripts\/shoot\.mjs \/ar\//);
  });
});
