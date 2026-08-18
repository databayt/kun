import { describe, expect, it } from "vitest";
import { compileMediaStudioPrompt } from "@/lib/brand-kit";
import { mediaKind, splitMedia } from "@/lib/media-kind";
import { checkCraft, craftFailures } from "@/lib/craft";
import { applyUtm } from "@/lib/social-utm";

describe("Scenario: Image for Facebook Post", () => {
  describe("1. Media Studio Prompt Compilation for Facebook Feed", () => {
    it("compiles a 4:5 vertical feed image prompt for Mkan Port Sudan listing", () => {
      const compiled = compileMediaStudioPrompt({
        brand: "mkan",
        kind: "image",
        format: "post",
        subject: "Sunlit living room with large windows overlooking the Red Sea in Hayy Al-Shati, Port Sudan",
        ratio: "4:5",
        spine: "cinematic",
        model: "gemini",
      });

      expect(compiled.ratio).toBe("4:5");
      expect(compiled.dimensions).toBe("1080x1350");
      expect(compiled.format).toBe("post");
      expect(compiled.domain).toBe("mkan.sd");

      // 5-beat validation
      expect(compiled.beats.scene).toContain("Sunlit living room");
      expect(compiled.beats.cameraMotion).toContain("50mm");
      expect(compiled.beats.cameraMotion).toContain("architectural framing");
      expect(compiled.beats.lightingAtmosphere).toContain("Red Sea");
      expect(compiled.beats.postProcessing).toContain("No generated text");
      expect(compiled.paletteHexes).toContain("#e05638"); // Mkan Clay accent
    });

    it("compiles a 1:1 square feed image prompt for Hogwarts SIS feature post", () => {
      const compiled = compileMediaStudioPrompt({
        brand: "hogwarts",
        kind: "image",
        format: "post",
        subject: "Minimalist teacher desk with tablet displaying live student attendance and gradebook",
        ratio: "1:1",
        spine: "minimal",
        model: "gemini",
      });

      expect(compiled.ratio).toBe("1:1");
      expect(compiled.dimensions).toBe("1080x1080");
      expect(compiled.format).toBe("post");
      expect(compiled.domain).toBe("ed.databayt.org");

      // 5-beat validation
      expect(compiled.beats.scene).toContain("Minimalist teacher desk");
      expect(compiled.beats.postProcessing).toContain("No generated text");
      expect(compiled.paletteHexes).toContain("#d97757"); // Hogwarts Terracotta
    });

    it("compiles a 16:9 hero ad image prompt for Facebook campaign banner", () => {
      const compiled = compileMediaStudioPrompt({
        brand: "mkan",
        kind: "image",
        format: "ad",
        subject: "Luxury seaside apartment with 24/7 standby generator power in Port Sudan",
        ratio: "16:9",
        spine: "cinematic",
        model: "gemini",
      });

      expect(compiled.ratio).toBe("16:9");
      expect(compiled.dimensions).toBe("1792x1024");
      expect(compiled.beats.cameraMotion).toContain("negative space");
    });
  });

  describe("2. Media Kind Classification & Attachment Handling", () => {
    it("classifies a single public image URL as image for Facebook", () => {
      const singleUrl = "https://cdn.databayt.org/media/mkan-living-room.webp";
      expect(mediaKind(singleUrl)).toBe("image");

      const { images, videos } = splitMedia([singleUrl]);
      expect(images).toHaveLength(1);
      expect(images[0]).toBe(singleUrl);
      expect(videos).toHaveLength(0);
    });

    it("partitions multi-image sets as images for Facebook album posts", () => {
      const mediaList = [
        "https://cdn.databayt.org/media/mkan-living-room.webp",
        "https://cdn.databayt.org/media/mkan-bedroom.webp",
        "https://cdn.databayt.org/media/mkan-balcony.webp",
      ];
      const { images, videos } = splitMedia(mediaList);
      expect(images).toHaveLength(3);
      expect(videos).toHaveLength(0);
    });
  });

  describe("3. Facebook Post Copywriting & Craft Validation", () => {
    it("passes craft checks for an engaging Arabic Facebook post with booking link", () => {
      const facebookPostCopy = `الشمس تشرق على شرفة حي الشاطئ ببورتسودان.

تصل بعد سفر طويل لتجد الشقة مجهزة بالكامل ونظيفة، مكيفات سبليت تعمل في كل الغرف، والمولد الاحتياطي جاهز للعمل طوال اليوم دون انقطاع، لتضمن إقامة هادئة ومريحة لعائلتك. صالة واسعة بإطلالة ساحلية مباشرة ومطبخ متكامل يلبي كافة احتياجات الإقامة اليومية.

استمتع بالهدوء التام والقرب من شاطئ البحر وسوق المدينة، مع حجز مؤكد وموثوق من مضيفين محليين معتمدين.

احجز إقامتك القادمة وتصفح كامل الصور والتفاصيل عبر الرابط:
https://mkan.sd/homes/hayy-al-shati`;

      const findings = checkCraft({ ar: facebookPostCopy, channel: "facebook" });
      const failures = craftFailures(findings);
      expect(failures).toHaveLength(0);
    });

    it("applies Facebook UTM tracking parameters to post links", () => {
      const rawText = "احجز الآن عبر https://mkan.sd/homes/hayy-al-shati واستمتع بإجازتك.";
      const tagged = applyUtm(rawText, { channel: "facebook", brand: "mkan" });

      expect(tagged).toContain("utm_source=facebook");
      expect(tagged).toContain("utm_medium=social");
      expect(tagged).toContain("utm_campaign=mkan");
    });
  });
});
