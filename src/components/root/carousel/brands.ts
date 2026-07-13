import type { Deck } from "./schema";

export interface BrandInfo {
  /** Latin wordmark — brand names stay Latin in both languages. */
  wordmark: string;
  domain: string;
  /**
   * The product's own Figma file — the org convention is one Figma file per
   * repo/product, each with a "carousels" page. Carousel boards are captured
   * into it via generate_figma_design (fileKey + carouselsNodeId), one small
   * frame per slide (?view=board).
   */
  figma?: { fileKey: string; carouselsNodeId: string };
}

export const BRANDS: Record<Deck["brand"], BrandInfo> = {
  hogwarts: {
    wordmark: "hogwarts",
    domain: "ed.databayt.org",
    figma: { fileKey: "HqgFh4Lxp8QtTnW04czQQN", carouselsNodeId: "251-2" },
  },
  databayt: { wordmark: "databayt", domain: "databayt.org" },
  mkan: { wordmark: "mkan", domain: "mkan.databayt.org" },
  moallimee: { wordmark: "moallimee", domain: "moallimee.databayt.org" },
  sijillee: { wordmark: "sijillee", domain: "sijillee.databayt.org" },
};
