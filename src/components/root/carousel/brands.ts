import type { Deck } from "./schema";

export interface BrandInfo {
  /** Latin wordmark — brand names stay Latin in both languages. */
  wordmark: string;
  domain: string;
}

export const BRANDS: Record<Deck["brand"], BrandInfo> = {
  hogwarts: { wordmark: "hogwarts", domain: "ed.databayt.org" },
  databayt: { wordmark: "databayt", domain: "databayt.org" },
  mkan: { wordmark: "mkan", domain: "mkan.databayt.org" },
  moallimee: { wordmark: "moallimee", domain: "moallimee.databayt.org" },
  sijillee: { wordmark: "sijillee", domain: "sijillee.databayt.org" },
};
