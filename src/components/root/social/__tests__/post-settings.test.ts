import { describe, expect, it } from "vitest";

import { ASSET_TYPES } from "@/components/root/social/showroom/taxonomy";
import {
  POST_TYPES,
  POST_TYPE_ASSETS,
  featureFits,
  featureLabel,
  featuresFor,
  libraryFits,
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

describe("features", () => {
  it("reads each brand's own list and skips the file's envelope", () => {
    // `version` and `$comment` sit beside the brand arrays; neither is a brand.
    expect(featuresFor("hogwarts").length).toBeGreaterThan(0);
    expect(featuresFor("version")).toEqual([]);
    expect(featuresFor("$comment")).toEqual([]);
    // Pre-launch brands have no catalogue, and inventing one would put claims
    // about unbuilt products into a composer that publishes to real Pages.
    expect(featuresFor("sijillee")).toEqual([]);
  });

  it("gives every feature both names, because the queue holds both", () => {
    for (const brand of ["hogwarts", "balqalam", "mkan", "databayt"]) {
      for (const f of featuresFor(brand)) {
        expect(f.id, `${brand} id`).toBeTruthy();
        expect(f.en, `${brand}/${f.id} en`).toBeTruthy();
        expect(f.ar, `${brand}/${f.id} ar`).toBeTruthy();
        // An Arabic label that is really English would silently match nothing.
        expect(f.ar, `${brand}/${f.id} ar script`).toMatch(/[\u0600-\u06FF]/);
      }
    }
  });

  it("names a feature in the reader's language", () => {
    expect(featureLabel("hogwarts", "attendance", false)).toBe("Attendance");
    expect(featureLabel("hogwarts", "attendance", true)).toBe("الحضور");
    // Unknown ids fall back to themselves rather than throwing.
    expect(featureLabel("hogwarts", "nope", false)).toBe("nope");
  });
});

describe("featureFits", () => {
  it("passes everything when no feature is chosen", () => {
    expect(featureFits("hogwarts", "anything at all", null)).toBe(true);
  });

  it("finds the feature by either of its names", () => {
    expect(featureFits("hogwarts", "Attendance in one place", "attendance")).toBe(
      true,
    );
    expect(
      featureFits("hogwarts", "الحضور يُرصد مرة واحدة", "attendance"),
    ).toBe(true);
  });

  it("folds Arabic orthography, so a written form is not a miss", () => {
    // The same matcher the search bar uses — harakat and alef forms fold.
    expect(featureFits("hogwarts", "الحُضور اليومي", "attendance")).toBe(true);
  });

  it("drops copy about something else", () => {
    expect(featureFits("hogwarts", "Exams are entered once", "attendance")).toBe(
      false,
    );
  });

  it("passes when the brand has no such feature, rather than emptying the list", () => {
    expect(featureFits("mkan", "anything", "attendance")).toBe(true);
  });
});
