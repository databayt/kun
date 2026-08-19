import { describe, expect, it } from "vitest";
import {
  compileMediaStudioPrompt,
  getBrandSpines,
  type MediaStudioKind,
  type MediaStudioRatio,
} from "@/lib/brand-kit";
import { generateStudioImageCore } from "@/lib/studio-image";

describe("Media Studio — Mkan & Hogwarts Handy Media Creation", () => {
  describe("Mkan media generation", () => {
    it("compiles a 9:16 video walkthrough with coastal Red Sea atmosphere", () => {
      const out = compileMediaStudioPrompt({
        brand: "mkan",
        kind: "video",
        format: "walkthrough",
        ratio: "9:16",
        model: "seedance",
        subject: "A smooth 35mm handheld tour gliding from a coastal living room to a breezy balcony overlooking the Red Sea in Port Sudan.",
      });

      expect(out.lane).toBe("video");
      expect(out.format).toBe("walkthrough");
      expect(out.ratio).toBe("9:16");
      expect(out.dimensions).toContain("9:16 vertical 24fps");
      expect(out.domain).toBe("mkan.sd");
      expect(out.accentHex).toBe("#e05638");
      expect(out.paletteHexes).toContain("#e05638");

      // Verify prompt contents
      expect(out.prompt).toContain("[FORMAT & USE CASE]: WALKTHROUGH");
      expect(out.prompt).toContain("Port Sudan");
      expect(out.prompt).toContain("Red Sea");
      expect(out.prompt).toContain("24fps");
      expect(out.prompt).toContain("No generated text");

      // Verify beats breakdown
      expect(out.beats.cameraMotion).toContain("35mm handheld drift");
      expect(out.beats.soundFoley).toContain("Red Sea breeze");
    });

    it("compiles a 4:5 post/listing architectural shot", () => {
      const out = compileMediaStudioPrompt({
        brand: "mkan",
        kind: "image",
        format: "post",
        ratio: "4:5",
        model: "gemini",
        subject: "A bright master bedroom with clean white linens and gentle morning sunlight in Hayy Al-Shati, Port Sudan.",
      });

      expect(out.lane).toBe("image");
      expect(out.format).toBe("post");
      expect(out.ratio).toBe("4:5");
      expect(out.dimensions).toBe("1080x1350");
      expect(out.prompt).toContain("[USE CASE: POST]");
      expect(out.prompt).toContain("Clean 50mm architectural framing");
      expect(out.prompt).toContain("Setting: Port Sudan");
      expect(out.prompt).toContain("No text, no lettering");
      expect(out.prompt).toContain("Leave the bottom-start corner quiet for a mark placed in post.");
    });

    it("compiles a 35mm candid lifestyle scene", () => {
      const out = compileMediaStudioPrompt({
        brand: "mkan",
        kind: "image",
        format: "lifestyle",
        ratio: "4:5",
        subject: "A Sudanese family enjoying mint tea on a breezy seaside veranda in Port Sudan at golden hour.",
      });

      expect(out.beats.cameraMotion).toContain("Candid 35mm documentary");
      expect(out.prompt).toContain("[USE CASE: LIFESTYLE]");
      expect(out.prompt).toContain("Port Sudan");
    });

    it("compiles a high-impact promotional ad plate", () => {
      const out = compileMediaStudioPrompt({
        brand: "mkan",
        kind: "image",
        format: "ad",
        ratio: "16:9",
        subject: "Weekend rental promotion with standby power and split AC in Port Sudan.",
      });

      expect(out.dimensions).toBe("1792x1024");
      expect(out.beats.cameraMotion).toContain("High-impact promotional composition");
      expect(out.prompt).toContain("[USE CASE: AD]");
    });

    it("compiles a template directive for infographics", () => {
      const out = compileMediaStudioPrompt({
        brand: "mkan",
        kind: "template",
        format: "infographic",
        ratio: "1:1",
        subject: "Amenities checklist: 24/7 power, split AC in all rooms, 5 mins from Red Sea.",
      });

      expect(out.lane).toBe("template");
      expect(out.prompt).toContain("[TEMPLATE DIRECTIVE: INFOGRAPHIC]");
      expect(out.prompt).toContain("Thmanyah Serif Display");
      expect(out.prompt).toContain("Badge Overlay");
      expect(out.prompt).toContain("public/brands/mkan.png");
    });
  });

  describe("Hogwarts media generation", () => {
    it("compiles a school library campus walkthrough video", () => {
      const out = compileMediaStudioPrompt({
        brand: "hogwarts",
        kind: "video",
        format: "walkthrough",
        ratio: "9:16",
        model: "veo",
        subject: "Cinematic camera glide across a sunlit school library courtyard with students collaborating on laptops.",
      });

      expect(out.lane).toBe("video");
      expect(out.format).toBe("walkthrough");
      expect(out.ratio).toBe("9:16");
      expect(out.domain).toBe("ed.databayt.org");
      expect(out.prompt).toContain("[FORMAT & USE CASE]: WALKTHROUGH");
      expect(out.prompt).toContain("Hogwarts");
      expect(out.beats.cameraMotion).toContain("school library");
      expect(out.beats.soundFoley).toContain("school ambience");
    });

    it("compiles a clean teacher desk product/listing shot", () => {
      const out = compileMediaStudioPrompt({
        brand: "hogwarts",
        kind: "image",
        format: "post",
        ratio: "4:5",
        model: "gemini",
        subject: "Clean minimalist teacher's desk with a tablet displaying the Hogwarts live student gradebook.",
      });

      expect(out.lane).toBe("image");
      expect(out.format).toBe("post");
      expect(out.dimensions).toBe("1080x1350");
      expect(out.prompt).toContain("[USE CASE: POST]");
      expect(out.prompt).toContain("No text, no lettering");
    });

    it("compiles a Hogwarts admission campaign ad banner", () => {
      const out = compileMediaStudioPrompt({
        brand: "hogwarts",
        kind: "image",
        format: "ad",
        ratio: "16:9",
        subject: "Modernize your school management with zero paperwork this admission term.",
      });

      expect(out.ratio).toBe("16:9");
      expect(out.dimensions).toBe("1792x1024");
      expect(out.beats.cameraMotion).toContain("High-impact promotional composition");
    });

    it("compiles a Hogwarts SIS fee collection infographic card", () => {
      const out = compileMediaStudioPrompt({
        brand: "hogwarts",
        kind: "template",
        format: "infographic",
        ratio: "1:1",
        subject: "98% on-time fee collection, 100% automated progress cards.",
      });

      expect(out.lane).toBe("template");
      expect(out.prompt).toContain("[TEMPLATE DIRECTIVE: INFOGRAPHIC]");
      expect(out.prompt).toContain("Thmanyah Serif Display");
      expect(out.prompt).toContain("public/brands/hogwarts.png");
    });
  });

  describe("Spines, Ratios & Guardrails", () => {
    it("retrieves brand style spines for Mkan and Hogwarts", () => {
      const mkanSpines = getBrandSpines("mkan");
      expect(mkanSpines.length).toBeGreaterThan(0);
      expect(mkanSpines.map((s) => s.id)).toContain("cinematic");

      const hogwartsSpines = getBrandSpines("hogwarts");
      expect(hogwartsSpines.length).toBeGreaterThan(0);
      expect(hogwartsSpines.map((s) => s.id)).toContain("cinematic");
    });

    it("supports all 4 standard aspect ratios with exact pixel specs", () => {
      const ratios: MediaStudioRatio[] = ["9:16", "1:1", "16:9", "4:5"];

      for (const r of ratios) {
        const imgOut = compileMediaStudioPrompt({
          brand: "mkan",
          kind: "image",
          format: "post",
          ratio: r,
          subject: "Test scene",
        });
        expect(imgOut.ratio).toBe(r);
        expect(imgOut.dimensions).toBeDefined();

        const vidOut = compileMediaStudioPrompt({
          brand: "mkan",
          kind: "video",
          format: "walkthrough",
          ratio: r,
          subject: "Test video",
        });
        expect(vidOut.ratio).toBe(r);
        expect(vidOut.dimensions).toContain("24fps");
      }
    });

    it("supports all 8 concrete asset formats for both brands", () => {
      const formats = [
        "walkthrough",
        "post",
        "lifestyle",
        "ad",
        "infographic",
        "carousel",
        "testimonial",
        "mockup",
      ] as const;

      for (const brand of ["mkan", "hogwarts"] as const) {
        for (const fmt of formats) {
          const kind: MediaStudioKind =
            fmt === "walkthrough"
              ? "video"
              : ["infographic", "carousel", "testimonial"].includes(fmt)
                ? "template"
                : "image";

          const out = compileMediaStudioPrompt({
            brand,
            kind,
            format: fmt,
            subject: `Automated test for ${brand} ${fmt}`,
          });

          expect(out.format).toBe(fmt);
          expect(out.lane).toBe(kind);
          expect(out.prompt.length).toBeGreaterThan(50);
          expect(out.beats.scene).toContain(fmt);
        }
      }
    });

    it("safely handles fallback for unknown brand gracefully", () => {
      const out = compileMediaStudioPrompt({
        brand: "unknown-brand",
        kind: "image",
        format: "post",
        subject: "Fallback test",
      });

      expect(out.title).toBeDefined();
      expect(out.prompt).toContain("Fallback test");
      expect(out.paletteHexes.length).toBeGreaterThan(0);
    });
  });

  describe("Studio results (generateStudioImageCore)", () => {
    // These assertions used to pin `engine: "Nano Banana 2 (…)"` onto a static
    // JPG, which made the suite green precisely because it agreed with the bug.
    // The rule now: the badge must never name a model that did not run.
    it("offers the desk still for a Hogwarts dashboard prompt, labelled as a library asset", () => {
      const result = generateStudioImageCore({
        brand: "hogwarts",
        format: "post",
        ratio: "1:1",
        model: "gemini",
        subject:
          "Minimalist teacher desk in a modern school classroom with soft morning sunlight. On the wooden desk sits a sleek tablet displaying a clean modern student dashboard interface, a small notebook and pen, warm terracotta accents.",
      });

      expect(result.ok).toBe(true);
      expect(result.imageUrl).toBe("/media/hogwarts-teacher-desk.jpg");
      expect(result.engine).toBe("Library asset · hogwarts-teacher-desk.jpg");
      // Fixed file on disk — never resized, so no dimensions are claimed.
      expect(result.dimensions).toBeUndefined();
      expect(result.attachable).toBe(false);
    });

    it("offers the library still for a Hogwarts library prompt", () => {
      const result = generateStudioImageCore({
        brand: "hogwarts",
        format: "post",
        ratio: "4:5",
        model: "gemini",
        subject: "Student studying in tranquil modern library courtyard with natural light.",
      });

      expect(result.ok).toBe(true);
      expect(result.imageUrl).toBe("/media/hogwarts-library-study.jpg");
      expect(result.engine).toBe("Library asset · hogwarts-library-study.jpg");
    });

    it("offers the coastal still for a Mkan stay prompt", () => {
      const result = generateStudioImageCore({
        brand: "mkan",
        format: "post",
        ratio: "4:5",
        model: "gemini",
        subject: "A bright coastal living room overlooking the Red Sea in Hayy Al-Shati with split AC.",
      });

      expect(result.ok).toBe(true);
      expect(result.imageUrl).toBe("/media/mkan-coastal-living-room.jpg");
    });

    it("never claims a model name it did not call", () => {
      for (const model of ["gemini", "gpt_image", "seedance", "veo"]) {
        const result = generateStudioImageCore({
          brand: "mkan",
          format: "post",
          ratio: "4:5",
          model,
          subject: "A bright coastal living room overlooking the Red Sea.",
        });
        expect(result.engine).not.toMatch(/Nano Banana|Gemini|GPT Image|DALL|Seedance|Veo|Kling/i);
      }
    });

    it("returns a prompt, not a still, when a video format is requested", () => {
      // `walkthrough` used to fall through to the stills table, so picking a
      // video model handed back a JPG.
      const result = generateStudioImageCore({
        brand: "mkan",
        format: "walkthrough",
        ratio: "9:16",
        model: "seedance",
        subject: "Sunset veranda with sea breeze in Port Sudan.",
      });

      expect(result.ok).toBe(true);
      expect(result.imageUrl).toBeUndefined();
      expect(result.prompt).toBeTruthy();
      expect(result.attachable).toBe(false);
      expect(result.engine).toMatch(/no video renderer/i);
    });

    it("does not borrow another brand's stills for a brand that has none", () => {
      // Every non-Mkan brand silently used Hogwarts' shelf; balqalam is a real
      // brand in the pipeline as of e606768.
      const result = generateStudioImageCore({
        brand: "balqalam",
        format: "post",
        ratio: "4:5",
        model: "gemini",
        subject: "A reading nook with warm afternoon light.",
      });

      expect(result.ok).toBe(true);
      expect(result.imageUrl).toBeUndefined();
      expect(result.engine).toContain("balqalam");
      expect(result.prompt).toBeTruthy();
    });

    it("refuses an unknown format instead of emitting a template plate", () => {
      // A mode switch could hand the action format:"" while the UI read
      // "Walkthrough"; the empty value fell through to the canvas branch and a
      // video request came back as a deterministic card.
      for (const format of ["", "nonsense"]) {
        const result = generateStudioImageCore({
          brand: "mkan",
          format,
          ratio: "9:16",
          model: "veo",
          subject: "Sunset veranda with sea breeze in Port Sudan.",
        });
        expect(result.ok).toBe(false);
        expect(result.imageUrl).toBeUndefined();
      }
    });

    it("still renders the deterministic SVG plate for template formats", () => {
      const result = generateStudioImageCore({
        brand: "mkan",
        format: "infographic",
        ratio: "1:1",
        model: "canvas",
        subject: "Amenities breakdown in Port Sudan.",
      });

      expect(result.ok).toBe(true);
      expect(result.imageUrl).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(result.engine).toBe("Deterministic HTML Canvas Engine");
    });
  });
});
