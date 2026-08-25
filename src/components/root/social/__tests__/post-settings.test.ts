import { describe, expect, it } from "vitest";

import { ASSET_TYPES } from "@/components/root/social/showroom/taxonomy";
import {
  POST_TYPES,
  POST_TYPE_ASSETS,
  POST_TYPE_META,
  featureFits,
  featureLabel,
  featuresFor,
  libraryFits,
  queueFits,
} from "@/components/root/social/post-settings";

const IMAGE = "https://cdn.databayt.org/a.png";
const VIDEO = "https://cdn.databayt.org/a.mp4";

describe("post shapes", () => {
  it("names only asset types the showroom taxonomy actually has", () => {
    // Two vocabularies that drift is how a filter starts matching nothing —
    // the failure the settings face would show as an empty library.
    const known = new Set<string>([...ASSET_TYPES, "other"]);
    for (const postType of POST_TYPES) {
      for (const assetType of POST_TYPE_ASSETS[postType]) {
        expect(known, `${postType} → ${assetType}`).toContain(assetType);
      }
    }
  });

  it("gives every media-bearing shape somewhere to draw from", () => {
    for (const postType of POST_TYPES) {
      const meta = POST_TYPE_META[postType];
      if (meta.kind === "none") {
        // Text-only has nothing to attach, and that is the point.
        expect(meta.assets.length, postType).toBe(0);
        continue;
      }
      expect(meta.assets.length, postType).toBeGreaterThan(0);
    }
  });

  it("covers both halves of what a post may carry", () => {
    // The schema's own rule: copy AND/OR media, never neither. So the set has
    // to offer copy alone, media alone, and the pairings.
    const metas = POST_TYPES.map((t) => POST_TYPE_META[t]);
    expect(metas.some((m) => m.text && m.kind === "none")).toBe(true);
    expect(metas.some((m) => !m.text && m.kind !== "none")).toBe(true);
    expect(metas.some((m) => m.text && m.kind === "image")).toBe(true);
    expect(metas.some((m) => m.text && m.kind === "video")).toBe(true);
    expect(metas.some((m) => m.count === "many")).toBe(true);
    // And nothing may be neither, which the schema forbids outright.
    expect(metas.every((m) => m.text || m.kind !== "none")).toBe(true);
  });
});

describe("libraryFits", () => {
  it("offers stills to a feed post and withholds them from a reel", () => {
    const hero = { url: IMAGE, type: "hero" };
    expect(libraryFits(hero, "image", "any")).toBe(true);
    expect(libraryFits(hero, "reel", "any")).toBe(false);
  });

  it("offers nothing at all to a text-only post", () => {
    for (const type of ["hero", "og", "reel", "story", "carousel"]) {
      expect(libraryFits({ url: IMAGE, type }, "text", "any"), type).toBe(false);
      expect(libraryFits({ url: VIDEO, type }, "text", "any"), type).toBe(false);
    }
  });

  it("matches the kind the shape implies before any filter", () => {
    // A reel is footage: a still tagged `reel` is not one.
    expect(libraryFits({ url: VIDEO, type: "reel" }, "reel", "any")).toBe(true);
    expect(libraryFits({ url: IMAGE, type: "reel" }, "reel", "any")).toBe(false);
    // And a gallery is stills, whatever the asset was tagged.
    expect(libraryFits({ url: VIDEO, type: "hero" }, "gallery", "any")).toBe(
      false,
    );
  });

  it("lets the media filter narrow further, never widen", () => {
    const still = { url: IMAGE, type: "hero" };
    expect(libraryFits(still, "image", "image")).toBe(true);
    expect(libraryFits(still, "image", "video")).toBe(false);
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
