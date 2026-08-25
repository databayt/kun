import { describe, expect, it } from "vitest";

import {
  ANY_STYLE,
  IMAGE_STYLES,
  isImageStyle,
  styleLabel,
} from "@/components/root/social/image-styles";

describe("image styles", () => {
  it("gives every register both names", () => {
    for (const style of IMAGE_STYLES) {
      expect(style.id, "id").toBeTruthy();
      expect(style.en, `${style.id} en`).toBeTruthy();
      expect(style.ar, `${style.id} ar`).toBeTruthy();
      // An Arabic label that is secretly English reads as a missing
      // translation only once someone switches the Hub over.
      expect(style.ar, `${style.id} ar script`).toMatch(/[؀-ۿ0-9]/);
    }
  });

  it("keeps ids unique, since the choice is stored by id", () => {
    const ids = IMAGE_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("accepts a real register and the absence of one", () => {
    expect(isImageStyle(ANY_STYLE)).toBe(true);
    expect(isImageStyle("cinematic")).toBe(true);
    // A stale value in localStorage must not survive a rename.
    expect(isImageStyle("vaporwave")).toBe(false);
    expect(isImageStyle("")).toBe(false);
  });

  it("names a register in the reader's language, and falls back to its id", () => {
    expect(styleLabel("luxury", false)).toBe("Luxury");
    expect(styleLabel("luxury", true)).toBe("فاخر");
    expect(styleLabel("nope", false)).toBe("nope");
  });
});
