import { describe, expect, it } from "vitest";
import { buildMediaPrompt } from "@/lib/media-prompt";
import kit from "../../../content/media/brand-kit.json";
import pillars from "../../../content/social/pillars.json";

const ok = (r: ReturnType<typeof buildMediaPrompt>) => {
  if (!r.ok) throw new Error(`expected a compile, got: ${r.error}`);
  return r;
};

// Pillar fixtures come from the live plan BY PROPERTY, never by id. The plan's briefs
// rotate with the campaigns: hogwarts' pillars left content/social/pillars.json on
// 2026-09-27 (cf6bdf4, dbbb67a) and these tests sat red — or passed vacuously — for five
// weeks while the behaviour under test never changed.
type PlanPillar = { brand: string; id: string; visual?: { type: string; subject: string } | null };
const PLAN: PlanPillar[] = Object.entries(pillars as unknown as Record<string, unknown>).flatMap(
  ([brand, list]) => (Array.isArray(list) ? (list as Omit<PlanPillar, "brand">[]).map((p) => ({ ...p, brand })) : []),
);
const RASTER = ["hero", "lifestyle", "product", "plate", "mockup"];
const withVisual = PLAN.find((p) => p.visual?.subject && RASTER.includes(p.visual.type));
const withoutVisual = PLAN.find((p) => p.visual === null);
function need<T>(p: T | undefined, what: string): T {
  if (!p) throw new Error(`content/social/pillars.json has no ${what} — add one, or retire the test that needs it`);
  return p;
}

describe("buildMediaPrompt — routing", () => {
  it("sends a copy-carrying type to the template lane, never to a raster model", () => {
    for (const assetType of ["og", "banner", "infographic", "split", "testimonial", "carousel"]) {
      const r = ok(buildMediaPrompt({ brand: "hogwarts", assetType, subject: "three numbers about admissions" }));
      expect(r.kind, `${assetType} produced a raster prompt`).toBe("deck");
      // The tell of the old bug: raster vocabulary applied to an HTML lane.
      expect(r.prompt).not.toMatch(/camera|framing|photograph|depth of field/i);
    }
  });

  it("refuses to generate a brand mark", () => {
    const r = buildMediaPrompt({ brand: "hogwarts", assetType: "logo", subject: "the quill" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/different logo/);
  });

  it("refuses an unknown brand rather than substituting one", () => {
    const r = buildMediaPrompt({ brand: "sijillee", assetType: "hero", subject: "a desk" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown brand/);
  });

  it("refuses an unknown asset type", () => {
    const r = buildMediaPrompt({ brand: "mkan", assetType: "billboard", subject: "a desk" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown asset type/);
  });
});

describe("buildMediaPrompt — the artboard", () => {
  it("lets the platform decide the size, not the type", () => {
    const story = ok(buildMediaPrompt({ brand: "mkan", assetType: "lifestyle", subject: "a balcony", platform: "tiktok" }));
    expect(story.dimensions).toBe("1080x1920");
    const feed = ok(buildMediaPrompt({ brand: "mkan", assetType: "lifestyle", subject: "a balcony", platform: "instagram" }));
    expect(feed.dimensions).toBe("1080x1350");
  });

  it("falls back to the type's own size when no platform is named", () => {
    const r = ok(buildMediaPrompt({ brand: "hogwarts", assetType: "hero", subject: "an empty classroom" }));
    expect(r.dimensions).toBe(kit.brands.hogwarts.types.hero.size);
  });

  it("never asks a channel for a placement it does not offer", () => {
    // Instagram has no landscape placement; asking for one must not silently
    // produce a 1200x630 that the platform will crop.
    const r = ok(buildMediaPrompt({ brand: "mkan", assetType: "lifestyle", subject: "a balcony", platform: "instagram", placement: "landscape" }));
    expect(r.dimensions).not.toBe("1200x630");
  });
});

describe("buildMediaPrompt — what it says", () => {
  it("carries the palette, the region and the negative list", () => {
    const r = ok(buildMediaPrompt({ brand: "hogwarts", assetType: "hero", subject: "an empty classroom in early morning light" }));
    expect(r.prompt).toContain("#d97757");
    expect(r.prompt).toMatch(/MENA/);
    expect(r.prompt).toMatch(/no text, no lettering/i);
    expect(r.prompt).toContain("an empty classroom in early morning light");
  });

  it("names the feature and why, when a pillar is picked", () => {
    const p = need(withVisual, "pillar with a raster visual");
    const r = ok(buildMediaPrompt({ brand: p.brand, assetType: p.visual!.type, subject: "", pillarId: p.id }));
    expect(r.prompt).toContain(p.id);
    // The pillar carries its own scene, so an empty subject still compiles.
    expect(r.prompt.length).toBeGreaterThan(400);
  });

  it("omits an absent section rather than rendering it empty", () => {
    const p = need(withVisual, "pillar with a raster visual");
    const without = ok(buildMediaPrompt({ brand: p.brand, assetType: "hero", subject: "a desk" }));
    expect(without.prompt).not.toMatch(/WHY IT EXISTS/);
    expect(without.prompt).not.toMatch(/REFERENCES/);
    const withPillar = ok(buildMediaPrompt({ brand: p.brand, assetType: "hero", subject: "a desk", pillarId: p.id }));
    expect(withPillar.prompt).toMatch(/WHY IT EXISTS/);
  });

  it("puts the brand static first, so a cache prefix stays identical", () => {
    const a = ok(buildMediaPrompt({ brand: "hogwarts", assetType: "hero", subject: "a desk" }));
    const b = ok(buildMediaPrompt({ brand: "hogwarts", assetType: "hero", subject: "a corridor" }));
    const prefix = a.prompt.slice(0, a.prompt.indexOf("─────"));
    expect(b.prompt.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeGreaterThan(300);
  });
});

describe("buildMediaPrompt — it says when it diverges from the plan", () => {
  it("warns when the chosen type is not the one the plan suggested", () => {
    const p = need(withVisual, "pillar with a raster visual");
    const other = RASTER.find((t) => t !== p.visual!.type)!;
    const r = ok(buildMediaPrompt({ brand: p.brand, assetType: other, subject: "a counter", pillarId: p.id }));
    expect(r.warnings.join(" ")).toContain(`plan suggests "${p.visual!.type}"`);
  });

  it("stays quiet when the type matches the plan", () => {
    const p = need(withVisual, "pillar with a raster visual");
    const r = ok(buildMediaPrompt({ brand: p.brand, assetType: p.visual!.type, subject: "a counter", pillarId: p.id }));
    expect(r.warnings.join(" ")).not.toMatch(/plan suggests/);
  });

  it("says so when the plan left the image to the template lane", () => {
    const p = need(withoutVisual, "pillar with visual: null");
    const r = ok(buildMediaPrompt({ brand: p.brand, assetType: "hero", subject: "a screen", pillarId: p.id }));
    expect(r.warnings.join(" ")).toMatch(/template lane/);
  });

  it("flags a channel that cannot receive a post", () => {
    const r = ok(buildMediaPrompt({ brand: "hogwarts", assetType: "hero", subject: "a desk", platform: "slack" }));
    expect(r.warnings.join(" ")).toMatch(/not a publishable channel/);
  });
});

describe("buildMediaPrompt — attachments", () => {
  it("always attaches the mark, as a servable URL not a repo path", () => {
    const r = ok(buildMediaPrompt({ brand: "hogwarts", assetType: "hero", subject: "a desk" }));
    const mark = r.attachments[0];
    expect(mark.url).toBe("/brands/hogwarts.png");
    expect(mark.url.startsWith("public/")).toBe(false);
  });

  it("warns instead of attaching when a brand has no mark", () => {
    const r = ok(buildMediaPrompt({ brand: "databayt", assetType: "hero", subject: "a laptop on a desk" }));
    expect(r.attachments.some((a) => a.why.includes("brand mark"))).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/no mark file/);
  });

  it("attaches a library asset but only cites a reference with no image", () => {
    const r = ok(
      buildMediaPrompt({
        brand: "mkan",
        assetType: "lifestyle",
        subject: "a balcony",
        references: [
          { title: "coastal-living-room.jpg", url: "https://example.com/a.jpg", note: "house aesthetic" },
          { title: "Thmanyah quote card", sourceUrl: "https://facebook.com/x", note: "Arabic type treatment" },
        ],
      }),
    );
    expect(r.attachments.map((a) => a.label)).toContain("coastal-living-room.jpg");
    expect(r.attachments.map((a) => a.label)).not.toContain("Thmanyah quote card");
    expect(r.prompt).toMatch(/REFERENCES/);
    expect(r.prompt).toContain("Arabic type treatment");
    expect(r.prompt).toMatch(/cannot fetch a URL/);
  });
});
