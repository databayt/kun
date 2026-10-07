import { describe, expect, it } from "vitest";
import kit from "../../../content/media/brand-kit.json";
import { THEMES, themeFor } from "@/components/root/carousel/palette";

// Slides used one Clay for every brand, so mkan decks wore the balqalam orange. The accent now
// comes from the brand kit's production map — the same source the video renderers read.
const production = (
  kit as unknown as {
    production: Record<string, { video: { accent: string } }>;
  }
).production;

describe("carousel accent follows the brand kit", () => {
  it("gives mkan its own clay", () => {
    expect(themeFor("ivory", "mkan").accent).toBe(production.mkan.video.accent);
    expect(themeFor("clay", "mkan").bg).toBe(production.mkan.video.accent);
  });

  it("keeps the shared Clay for the balqalam family", () => {
    for (const brand of ["balqalam", "hogwarts", "databayt"]) {
      expect(themeFor("ivory", brand)).toEqual(THEMES.ivory);
    }
  });

  it("never guesses a draft or unknown brand's colour", () => {
    expect(themeFor("ivory", "sijillee")).toEqual(THEMES.ivory);
    expect(themeFor("dark", "no-such-brand")).toEqual(THEMES.dark);
    expect(themeFor("oat")).toEqual(THEMES.oat);
  });
});
