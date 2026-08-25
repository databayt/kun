import { describe, expect, it } from "vitest";

import pillarsPlan from "../../../../../content/social/pillars.json";

import { ASSET_TYPES } from "@/components/root/social/showroom/taxonomy";
import {
  POST_TYPES,
  POST_TYPE_ASSETS,
  featureFits,
  libraryFits,
  pillarLabel,
  pillarsFor,
  queueFits,
} from "@/components/root/social/post-settings";

const IMAGE = "https://cdn.databayt.org/a.png";
const VIDEO = "https://cdn.databayt.org/a.mp4";

describe("POST_TYPE_ASSETS", () => {
  it("names only types the showroom taxonomy actually has", () => {
    // Two vocabularies that drift is how a filter starts matching nothing —
    // the failure the settings face would show as an empty library.
    const known = new Set<string>([...ASSET_TYPES, "other"]);
    for (const postType of POST_TYPES) {
      for (const assetType of POST_TYPE_ASSETS[postType]) {
        expect(known, `${postType} → ${assetType}`).toContain(assetType);
      }
    }
  });

  it("gives every post type somewhere to draw from", () => {
    for (const postType of POST_TYPES) {
      expect(POST_TYPE_ASSETS[postType].length).toBeGreaterThan(0);
    }
  });
});

describe("libraryFits", () => {
  it("offers stills to a post and withholds them from a reel", () => {
    const hero = { url: IMAGE, type: "hero" };
    expect(libraryFits(hero, "post", "any")).toBe(true);
    expect(libraryFits(hero, "reel", "any")).toBe(false);
  });

  it("offers a story asset to a story and not to a post", () => {
    const story = { url: IMAGE, type: "story" };
    expect(libraryFits(story, "story", "any")).toBe(true);
    expect(libraryFits(story, "post", "any")).toBe(false);
  });

  it("applies the media filter on top of the format", () => {
    const stillHero = { url: IMAGE, type: "hero" };
    const movingHero = { url: VIDEO, type: "hero" };
    expect(libraryFits(stillHero, "post", "image")).toBe(true);
    expect(libraryFits(stillHero, "post", "video")).toBe(false);
    expect(libraryFits(movingHero, "post", "video")).toBe(true);
  });

  it("lets an unrecognised extension through under Any", () => {
    const odd = { url: "https://cdn.databayt.org/a.heic", type: "hero" };
    expect(libraryFits(odd, "post", "any")).toBe(true);
  });
});

describe("queueFits", () => {
  it("keeps every row under Any, including copy with no media", () => {
    expect(queueFits([], "any")).toBe(true);
    expect(queueFits([IMAGE], "any")).toBe(true);
  });

  it("drops rows that carry nothing of the asked-for kind", () => {
    expect(queueFits([IMAGE], "video")).toBe(false);
    expect(queueFits([VIDEO], "video")).toBe(true);
    expect(queueFits([], "image")).toBe(false);
  });

  it("keeps a mixed row for either kind", () => {
    expect(queueFits([IMAGE, VIDEO], "image")).toBe(true);
    expect(queueFits([IMAGE, VIDEO], "video")).toBe(true);
  });
});

describe("pillars", () => {
  it("reads each brand's own plan and skips the file's envelope", () => {
    // `version` and `$comment` sit beside the brand arrays; neither is a brand.
    expect(pillarsFor("hogwarts").length).toBeGreaterThan(0);
    expect(pillarsFor("version")).toEqual([]);
    expect(pillarsFor("$comment")).toEqual([]);
    expect(pillarsFor("nobody")).toEqual([]);
  });

  it("gives brands their own vocabulary rather than a shared one", () => {
    const hogwarts = pillarsFor("hogwarts");
    const mkan = pillarsFor("mkan");
    expect(hogwarts).not.toEqual(mkan);
  });

  it("names a pillar from its id", () => {
    expect(pillarLabel("time-savings")).toBe("Time savings");
    expect(pillarLabel("trust")).toBe("Trust");
  });
});

describe("featureFits", () => {
  it("passes everything when no pillar is chosen", () => {
    expect(featureFits("hogwarts", "anything at all", null)).toBe(true);
    expect(featureFits("hogwarts", "", null)).toBe(true);
  });

  it("keeps a draft asked with that pillar's own brief", () => {
    const pillar = pillarsFor("hogwarts")[0];
    // The seeder files the plan's brief verbatim, which is the whole reason
    // a draft can be traced back to a pillar at all.
    const brief = briefFor("hogwarts", pillar);
    expect(featureFits("hogwarts", brief, pillar)).toBe(true);
  });

  it("drops a draft that belongs to a different pillar", () => {
    const [first, second] = pillarsFor("hogwarts");
    expect(featureFits("hogwarts", briefFor("hogwarts", second), first)).toBe(
      false,
    );
  });

  it("drops copy written from scratch, which belongs to no pillar", () => {
    const pillar = pillarsFor("hogwarts")[0];
    expect(featureFits("hogwarts", "something typed by hand", pillar)).toBe(
      false,
    );
  });
});

/** The first brief the plan files under this pillar, for the tests above. */
function briefFor(brand: string, pillar: string): string {
  const raw = (
    pillarsPlan as unknown as Record<
      string,
      { pillar: string; brief: string }[]
    >
  )[brand];
  return raw.find((b) => b.pillar === pillar)!.brief;
}
