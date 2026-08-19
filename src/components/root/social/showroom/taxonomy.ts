// The canonical asset-type vocabulary — ONE list where four used to drift
// (higgs trigger prose, brand-style defaults, Higgsfield vendor modes, and the
// carousel archetypes). The showroom filters by it, `library.json` records it,
// the docs table explains it, and the Portrait Gallery spells route by it.
//
// `lane` is the doctrine made data: AI rasters must stay text-free (typography
// breaks, Arabic doubly so), so every type that carries copy renders on the
// deterministic template lane (the carousel engine — Thmanyah type, brand
// frame, exact platform sizes) and only text-free photography goes to /higgs.

export const ASSET_TYPES = [
  "hero",
  "og",
  "banner",
  "logo",
  "product",
  "lifestyle",
  "mockup",
  "infographic",
  "split",
  "testimonial",
  "carousel",
  "reel",
  "story",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export interface AssetTypeMeta {
  en: string;
  ar: string;
  /**
   * Does this type carry copy? That is the whole question this field answers:
   * `template` goes to the deterministic carousel engine, `higgs` to a raster
   * renderer, `none` is never generated at all.
   *
   * Note this is NOT the same question `lane` answers in
   * `content/media/brand-kit.json`, which names the specific renderer or seat
   * (`chatgpt` vs `higgs`). The two agree on the set that matters — every
   * copy-carrying type — and `taxonomy-parity.test.ts` pins that agreement.
   */
  lane: "higgs" | "template" | "none";
  /** Higgs-lane defaults, lifted from the skill's verified tables. */
  model?: string;
  ratio?: string;
  style?: "minimal" | "cinematic";
  /**
   * The same raster job addressed at Google directly instead of through
   * Higgsfield's resale of it (`nano_banana_*` there IS Nano Banana here).
   * `model` is an alias understood by `scripts/gemini-media.mjs`; `size` is the
   * image tier (1K/2K/4K) or, for video, the clip length in seconds.
   */
  gemini?: { model: string; size?: string; seconds?: number };
}

export const ASSET_TYPE_META: Record<AssetType, AssetTypeMeta> = {
  hero: {
    en: "Hero image",
    ar: "صورة رئيسية",
    lane: "higgs",
    model: "nano_banana_pro",
    ratio: "16:9",
    style: "minimal",
    gemini: { model: "pro", size: "2K" },
  },
  og: {
    en: "OG image",
    ar: "صورة المعاينة",
    lane: "template",
    ratio: "1200x630",
  },
  banner: {
    en: "Banner",
    ar: "لافتة",
    lane: "template",
    ratio: "1200x630",
  },
  logo: {
    en: "Logo / wordmark",
    ar: "شعار",
    // No model, and `lane: "none"` on purpose. Every brand's mark rules say the
    // same thing — "the mark is placed in post, never drawn by a generative
    // model; an AI-drawn approximation of a logo is a different logo". This
    // entry used to carry nano_banana_2_lite, which invited exactly that.
    // The type stays so the library can still FILE a logo; it just never
    // generates one.
    lane: "none",
  },
  product: {
    en: "Product shot",
    ar: "لقطة منتج",
    lane: "higgs",
    model: "nano_banana_2_lite",
    ratio: "4:5",
    style: "minimal",
    gemini: { model: "lite", size: "1K" },
  },
  lifestyle: {
    en: "Lifestyle scene",
    ar: "مشهد حياتي",
    lane: "higgs",
    model: "nano_banana_2_lite",
    ratio: "4:5",
    style: "cinematic",
    gemini: { model: "lite", size: "1K" },
  },
  mockup: {
    en: "Interface mockup",
    ar: "نموذج واجهة",
    lane: "higgs",
    // flash, not lite: a mockup restyles a real screenshot, and only flash and
    // pro take reference images.
    model: "nano_banana_flash",
    ratio: "1:1",
    style: "minimal",
    gemini: { model: "flash", size: "1K" },
  },
  infographic: {
    en: "Infographic",
    ar: "إنفوجرافيك",
    lane: "template",
  },
  split: {
    en: "Split / before-after",
    ar: "مقارنة قبل/بعد",
    lane: "template",
  },
  testimonial: {
    en: "Testimonial lockup",
    ar: "شهادة عميل",
    lane: "template",
  },
  carousel: {
    en: "Carousel deck",
    ar: "كاروسيل",
    lane: "template",
    ratio: "1080x1350",
  },
  reel: {
    en: "Reel / promo clip",
    ar: "ريل / مقطع ترويجي",
    lane: "higgs",
    model: "seedance_2_5",
    ratio: "9:16",
    style: "cinematic",
    gemini: { model: "veo-lite", seconds: 8 },
  },
  story: {
    en: "Story",
    ar: "ستوري",
    lane: "higgs",
    model: "nano_banana_2_lite",
    ratio: "9:16",
    style: "cinematic",
    gemini: { model: "lite", size: "1K" },
  },
};

/** The showroom folds unknown/legacy rows here rather than guessing. */
export const OTHER_TYPE = "other" as const;

export type ShowroomType = AssetType | typeof OTHER_TYPE;

export function typeLabel(type: ShowroomType, isRTL: boolean): string {
  if (type === OTHER_TYPE) return isRTL ? "غير مصنّف" : "Unsorted";
  const meta = ASSET_TYPE_META[type];
  return isRTL ? meta.ar : meta.en;
}
